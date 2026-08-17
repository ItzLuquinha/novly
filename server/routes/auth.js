const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, setSessionCookie, clearSessionCookie, requireAuth } = require('../auth');
const { createRateLimiter } = require('../security');

const router = express.Router();

const loginIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyFn: (req) => `login-ip:${req.ip || 'unknown'}`,
});
const loginPairLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `login-pair:${req.ip || 'unknown'}:${String(req.body?.email || '').toLowerCase().trim()}`,
});

router.post('/login', loginIpLimiter, loginPairLimiter, (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  if (!email || !password || email.length > 254 || password.length > 256) {
    return res.status(400).json({ error: 'Informe email e senha validos.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Always run a password comparison path to reduce account-enumeration timing differences.
  const valid = user ? bcrypt.compareSync(password, user.password_hash) : bcrypt.compareSync(password, '$2b$10$P7zFWLZY8q5RZZ6U63Y2WuK1WEibAGxQlKECMhbgz8ozsI8ksR2kG');
  if (!user || !valid) return res.status(401).json({ error: 'Email ou senha incorretos.' });

  db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").run(user.id);
  db.prepare(`
    INSERT INTO presence (user_id, last_ping_at) VALUES (?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET last_ping_at = datetime('now')
  `).run(user.id);

  const freshUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  setSessionCookie(res, signToken(freshUser));
  const { password_hash, session_version, ...safeUser } = freshUser;
  res.json({ user: safeUser });
});

router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').run(req.user.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  const { password_hash, session_version, ...safeUser } = user;
  res.json({ user: safeUser });
});

module.exports = router;
