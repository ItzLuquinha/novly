const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function todayParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: db.env().APP_TIMEZONE || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { year: Number(get('year')), monthDay: `${get('month')}-${get('day')}` };
}

router.get('/available', requireAuth, async (req, res) => {
  const { year, monthDay } = todayParts();
  const note = await db.prepare(`
    SELECT sn.id, sn.message
    FROM special_notes sn
    WHERE sn.special_date = ?
      AND NOT EXISTS (
        SELECT 1 FROM note_discoveries nd
        WHERE nd.note_id = sn.id AND nd.user_id = ? AND nd.discovery_year = ?
      )
      AND (
        sn.chapter_id IS NULL OR EXISTS (
          SELECT 1 FROM reading_stats rs
          WHERE rs.user_id = ? AND rs.chapter_id = sn.chapter_id
        )
      )
    ORDER BY sn.id ASC
    LIMIT 1
  `).get(monthDay, req.user.id, year, req.user.id);
  res.json({ note: note || null });
});

router.post('/:id/found', requireAuth, async (req, res) => {
  const note = await db.prepare('SELECT * FROM special_notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Bilhete nao encontrado.' });
  const { year, monthDay } = todayParts();
  if (note.special_date !== monthDay) return res.status(400).json({ error: 'Este bilhete nao esta disponivel hoje.' });
  if (note.chapter_id) {
    const hasRead = await db.prepare('SELECT 1 FROM reading_stats WHERE user_id = ? AND chapter_id = ?').get(req.user.id, note.chapter_id);
    if (!hasRead) return res.status(403).json({ error: 'Este bilhete ainda esta bloqueado.' });
  }
  await db.prepare(`
    INSERT INTO note_discoveries (note_id, user_id, discovery_year, found_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(note_id, user_id, discovery_year) DO NOTHING
  `).run(note.id, req.user.id, year);
  res.json({ ok: true });
});

module.exports = router;
