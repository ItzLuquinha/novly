const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser });
});

router.patch('/email', requireAuth, (req, res) => {
  const { new_email, current_password } = req.body;
  if (!new_email || !new_email.trim()) {
    return res.status(400).json({ error: 'Informe o novo email.' });
  }
  if (!current_password) {
    return res.status(400).json({ error: 'Informe a senha atual para confirmar.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }

  const normalized = new_email.toLowerCase().trim();
  const taken = db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(normalized, req.user.id);
  if (taken) {
    return res.status(409).json({ error: 'Este email ja esta em uso.' });
  }

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalized, req.user.id);
  res.json({ email: normalized });
});

router.patch('/password', requireAuth, (req, res) => {
  const { new_password, current_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });
  }
  if (!current_password) {
    return res.status(400).json({ error: 'Informe a senha atual para confirmar.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ ok: true });
});

router.patch('/background', requireAuth, (req, res) => {
  const { background_type, background_value } = req.body;
  const validTypes = ['default', 'preset', 'upload', 'url'];
  if (!validTypes.includes(background_type)) {
    return res.status(400).json({ error: 'Tipo de background invalido.' });
  }

  db.prepare(`
    UPDATE users SET background_type = ?, background_value = ? WHERE id = ?
  `).run(background_type, background_value || '', req.user.id);

  res.json({ background_type, background_value: background_value || '' });
});

module.exports = router;
