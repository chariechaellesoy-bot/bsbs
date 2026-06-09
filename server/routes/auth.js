const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, display_name, role } = req.body || {};

  if (!email || !password || !display_name) {
    return res.status(400).json({ error: 'email, password, and display_name are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const finalRole = role === 'admin' ? 'admin' : 'member';

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (existing.length) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(String(password), 10);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
      [normalizedEmail, password_hash, finalRole, String(display_name).trim()]
    );

    return res.status(201).json({
      id: result.insertId,
      email: normalizedEmail,
      role: finalRole,
      display_name: String(display_name).trim()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, role, display_name FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      role: user.role,
      display_name: user.display_name
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

module.exports = router;
