const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, skill, balance, is_active FROM players WHERE user_id = ? ORDER BY id ASC',
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch players' });
  }
});

router.post('/', async (req, res) => {
  const { name, skill } = req.body || {};
  const trimmedName = String(name || '').trim();
  const finalSkill = ['Beg', 'Int', 'Adv'].includes(skill) ? skill : 'Int';

  if (!trimmedName) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO players (user_id, name, skill)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         skill = VALUES(skill),
         is_active = TRUE,
         id = LAST_INSERT_ID(id)`,
      [req.user.id, trimmedName, finalSkill]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create player' });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, skill, balance, is_active } = req.body || {};
  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(String(name).trim());
  }

  if (skill !== undefined) {
    if (!['Beg', 'Int', 'Adv'].includes(skill)) {
      return res.status(400).json({ error: 'Invalid skill' });
    }
    updates.push('skill = ?');
    values.push(skill);
  }

  if (balance !== undefined) {
    const parsed = Number(balance);
    if (!Number.isFinite(parsed)) {
      return res.status(400).json({ error: 'Invalid balance' });
    }
    updates.push('balance = ?');
    values.push(parsed);
  }

  if (is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(Boolean(is_active));
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(id);
  values.push(req.user.id);

  try {
    const [result] = await pool.query(
      `UPDATE players SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Player not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update player' });
  }
});

router.post('/:id/adjust-balance', async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body || {};
  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount)) {
    return res.status(400).json({ error: 'amount must be a number' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE players SET balance = balance + ? WHERE id = ? AND user_id = ?',
      [parsedAmount, id, req.user.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Player not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to adjust balance' });
  }
});

module.exports = router;
