const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
const TIME_ZONE = process.env.APP_TIMEZONE || 'America/New_York';

function todayParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { year: Number(get('year')), monthDay: `${get('month')}-${get('day')}` };
}

router.get('/available', requireAuth, (req, res) => {
  const { year, monthDay } = todayParts();
  const candidates = db.prepare(`
    SELECT sn.* FROM special_notes sn
    WHERE sn.special_date = ?
      AND NOT EXISTS (
        SELECT 1 FROM note_discoveries nd
        WHERE nd.note_id = sn.id AND nd.user_id = ? AND nd.discovery_year = ?
      )
    ORDER BY sn.id ASC
  `).all(monthDay, req.user.id, year);

  for (const note of candidates) {
    if (note.chapter_id) {
      const hasRead = db.prepare('SELECT 1 FROM reading_stats WHERE user_id = ? AND chapter_id = ?')
        .get(req.user.id, note.chapter_id);
      if (!hasRead) continue;
    }
    return res.json({ note: { id: note.id, message: note.message } });
  }
  res.json({ note: null });
});

router.post('/:id/found', requireAuth, (req, res) => {
  const note = db.prepare('SELECT * FROM special_notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Bilhete nao encontrado.' });
  const { year, monthDay } = todayParts();
  if (note.special_date !== monthDay) return res.status(400).json({ error: 'Este bilhete nao esta disponivel hoje.' });
  if (note.chapter_id) {
    const hasRead = db.prepare('SELECT 1 FROM reading_stats WHERE user_id = ? AND chapter_id = ?').get(req.user.id, note.chapter_id);
    if (!hasRead) return res.status(403).json({ error: 'Este bilhete ainda esta bloqueado.' });
  }
  db.prepare(`
    INSERT INTO note_discoveries (note_id, user_id, discovery_year, found_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(note_id, user_id, discovery_year) DO NOTHING
  `).run(note.id, req.user.id, year);
  res.json({ ok: true });
});

module.exports = router;
