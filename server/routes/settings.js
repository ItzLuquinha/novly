const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, signToken, setSessionCookie } = require('../auth');
const { removeManagedUploadUrl, boundedString } = require('../security');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  const { password_hash, session_version, ...safeUser } = user;
  res.json({ user: safeUser });
});

router.patch('/email', requireAuth, (req, res) => {
  const { new_email, current_password } = req.body;
  const normalized = String(new_email || '').toLowerCase().trim();
  if (!normalized || normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return res.status(400).json({ error: 'Informe um email valido.' });
  }
  if (typeof current_password !== 'string' || !current_password || current_password.length > 256) {
    return res.status(400).json({ error: 'Informe a senha atual para confirmar.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }

  const taken = db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(normalized, req.user.id);
  if (taken) {
    return res.status(409).json({ error: 'Este email ja esta em uso.' });
  }

  db.prepare('UPDATE users SET email = ?, session_version = session_version + 1 WHERE id = ?').run(normalized, req.user.id);
  const refreshed = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  setSessionCookie(res, signToken(refreshed));
  res.json({ email: normalized });
});

router.patch('/password', requireAuth, (req, res) => {
  const { new_password, current_password } = req.body;
  if (typeof new_password !== 'string' || new_password.length < 12 || new_password.length > 72) {
    return res.status(400).json({ error: 'A nova senha precisa ter entre 12 e 72 caracteres.' });
  }
  if (typeof current_password !== 'string' || !current_password || current_password.length > 256) {
    return res.status(400).json({ error: 'Informe a senha atual para confirmar.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?').run(newHash, req.user.id);
  const refreshed = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  setSessionCookie(res, signToken(refreshed));
  res.json({ ok: true });
});

router.patch('/background', requireAuth, (req, res) => {
  const { background_type } = req.body;
  const validTypes = ['default', 'preset', 'upload', 'url', 'video'];
  if (!validTypes.includes(background_type)) return res.status(400).json({ error: 'Tipo de background invalido.' });
  const backgroundValue = boundedString(req.body?.background_value, 2048, '');
  if (background_type === 'url' && backgroundValue && !/^https:\/\//i.test(backgroundValue)) {
    return res.status(400).json({ error: 'Use uma URL HTTPS para o background.' });
  }
  const user = db.prepare('SELECT background_value FROM users WHERE id = ?').get(req.user.id);
  db.prepare('UPDATE users SET background_type = ?, background_value = ? WHERE id = ?').run(background_type, backgroundValue, req.user.id);
  if (user?.background_value !== backgroundValue) removeManagedUploadUrl(user?.background_value);
  res.json({ background_type, background_value: backgroundValue });
});

module.exports = router;
