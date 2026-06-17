const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function parseJsonField(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function normalizeName(value) {
  return String(value || '').trim();
}

function extractSessionPlayers(state) {
  const seen = new Set();
  const players = [];
  const playerMeta = state && state.playerMeta && typeof state.playerMeta === 'object' ? state.playerMeta : {};
  const names = [];

  if (state && Array.isArray(state.allPlayersList)) {
    names.push(...state.allPlayersList);
  }

  if (state && Array.isArray(state.teams)) {
    state.teams.forEach((team) => {
      if (team && Array.isArray(team.players)) names.push(...team.players);
    });
  }

  names.forEach((rawName) => {
    const name = normalizeName(rawName);
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const meta = playerMeta[key] || {};
    players.push({
      name,
      skill: ['Beg', 'Int', 'Adv'].includes(meta.skill) ? meta.skill : 'Int'
    });
  });

  return players;
}

async function upsertPlayers(db, userId, state) {
  const players = extractSessionPlayers(state);
  for (const player of players) {
    await db.query(
      `INSERT INTO players (user_id, name, skill)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         skill = VALUES(skill),
         is_active = TRUE`,
      [userId, player.name, player.skill]
    );
  }
}

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, mode, created_at, completed_at FROM sessions WHERE created_by = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, mode, state_json, match_history, created_at, completed_at
       FROM sessions
       WHERE created_by = ? AND completed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.json(null);
    }

    const session = rows[0];
    session.state_json = parseJsonField(session.state_json);
    session.match_history = parseJsonField(session.match_history);
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, created_by, mode, state_json, match_history, completed_at, created_at
       FROM sessions
       WHERE id = ? AND created_by = ?
       LIMIT 1`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = rows[0];
    session.state_json = parseJsonField(session.state_json);
    session.match_history = parseJsonField(session.match_history);
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

router.post('/', async (req, res) => {
  const { mode, state_json } = req.body || {};

  if (!['session', 'tournament', 'promotion'].includes(mode) || !state_json) {
    return res.status(400).json({ error: 'mode and state_json are required' });
  }

  try {
    await upsertPlayers(pool, req.user.id, state_json);
    const [result] = await pool.query(
      'INSERT INTO sessions (created_by, mode, state_json, match_history) VALUES (?, ?, ?, ?)',
      [req.user.id, mode, JSON.stringify(state_json), JSON.stringify(state_json.matchHistory || [])]
    );

    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

router.patch('/:id', async (req, res) => {
  const { state_json, match_history } = req.body || {};
  const updates = [];
  const values = [];

  if (state_json !== undefined) {
    updates.push('state_json = ?');
    values.push(JSON.stringify(state_json));
  }

  if (match_history !== undefined) {
    updates.push('match_history = ?');
    values.push(JSON.stringify(match_history));
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(req.params.id);
  values.push(req.user.id);

  try {
    if (state_json !== undefined) {
      await upsertPlayers(pool, req.user.id, state_json);
    }
    const [result] = await pool.query(
      `UPDATE sessions SET ${updates.join(', ')} WHERE id = ? AND created_by = ?`,
      values
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update session' });
  }
});

router.post('/:id/complete', async (req, res) => {
  const { cost_per_game } = req.body || {};
  const cost = Number(cost_per_game);

  if (!Number.isFinite(cost)) {
    return res.status(400).json({ error: 'cost_per_game must be a number' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, state_json FROM sessions WHERE id = ? AND created_by = ? LIMIT 1 FOR UPDATE',
      [req.params.id, req.user.id]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Session not found' });
    }

    const state = parseJsonField(rows[0].state_json) || {};
    const matchHistory = Array.isArray(state.matchHistory) ? state.matchHistory : [];
    const playCount = state.playCount && typeof state.playCount === 'object' ? state.playCount : {};
    await upsertPlayers(conn, req.user.id, state);

    await conn.query(
      'UPDATE sessions SET match_history = ?, completed_at = NOW() WHERE id = ?',
      [JSON.stringify(matchHistory), req.params.id]
    );

    const entries = Object.entries(playCount);
    for (const [playerName, gamesPlayedRaw] of entries) {
      const gamesPlayed = Number(
        gamesPlayedRaw && typeof gamesPlayedRaw === 'object' ? gamesPlayedRaw.games : gamesPlayedRaw
      );
      if (!Number.isFinite(gamesPlayed) || gamesPlayed <= 0) continue;
      const deduction = cost * gamesPlayed;
      await conn.query(
        'UPDATE players SET balance = balance - ? WHERE user_id = ? AND name = ?',
        [deduction, req.user.id, normalizeName(playerName)]
      );
    }

    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: 'Failed to complete session' });
  } finally {
    conn.release();
  }
});

module.exports = router;
