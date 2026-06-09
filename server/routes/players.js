const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();

router.use(auth);

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, skill, balance, is_active FROM players ORDER BY id ASC'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch players' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  const { name, skill } = req.body || {};
  const finalSkill = ['Beg', 'Int', 'Adv'].includes(skill) ? skill : 'Int';

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO players (name, skill) VALUES (?, ?)',
      [String(name).trim(), finalSkill]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create player' });
  }
});

router.patch('/:id', adminOnly, async (req, res) => {
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

  try {
    await pool.query(`UPDATE players SET ${updates.join(', ')} WHERE id = ?`, values);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update player' });
  }
});

router.post('/:id/adjust-balance', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body || {};
  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount)) {
    return res.status(400).json({ error: 'amount must be a number' });
  }

  try {
    await pool.query('UPDATE players SET balance = balance + ? WHERE id = ?', [parsedAmount, id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to adjust balance' });
  }
});

module.exports = router;
