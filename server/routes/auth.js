const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth, COOKIE_NAME } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe email e senha.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: 'Email ou senha incorretos.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Email ou senha incorretos.' });
  }

  db.prepare('UPDATE users SET last_active_at = datetime(\'now\') WHERE id = ?').run(user.id);
  db.prepare(`
    INSERT INTO presence (user_id, last_ping_at) VALUES (?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET last_ping_at = datetime('now')
  `).run(user.id);

  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser });
});

module.exports = router;
