const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/available', requireAuth, (req, res) => {
  const today = new Date();
  const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const candidates = db.prepare(`
    SELECT * FROM special_notes WHERE special_date = ? AND found_at IS NULL
  `).all(monthDay);

  for (const note of candidates) {
    if (note.chapter_id) {
      const hasRead = db.prepare(`
        SELECT 1 FROM reading_stats WHERE user_id = ? AND chapter_id = ?
      `).get(req.user.id, note.chapter_id);
      if (!hasRead) continue;
    }
    return res.json({ note: { id: note.id, message: note.message } });
  }

  res.json({ note: null });
});

router.post('/:id/found', requireAuth, (req, res) => {
  const note = db.prepare('SELECT * FROM special_notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Bilhete nao encontrado.' });
  if (note.found_at) return res.json({ ok: true });

  db.prepare("UPDATE special_notes SET found_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
