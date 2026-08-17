const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { positiveInt, boundedString } = require('../security');

const router = express.Router();
router.use(requireAuth, requireRole('escritor'));

function validMonthDay(value) {
  if (!/^\d{2}-\d{2}$/.test(value || '')) return false;
  const [month, day] = value.split('-').map(Number);
  const d = new Date(Date.UTC(2000, month - 1, day));
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function noteSelect(where = '') {
  return `
    SELECT sn.id, sn.message, sn.special_date, sn.chapter_id, sn.created_at,
           c.title as chapter_title, MAX(nd.found_at) as found_at,
           COUNT(nd.found_at) as discovery_count
    FROM special_notes sn
    LEFT JOIN chapters c ON c.id = sn.chapter_id
    LEFT JOIN note_discoveries nd ON nd.note_id = sn.id
    ${where}
    GROUP BY sn.id
  `;
}

router.get('/notes', async (req, res) => {
  const notes = await db.prepare(`${noteSelect()} ORDER BY sn.special_date ASC, sn.id ASC`).all();
  res.json({ notes });
});

router.post('/notes', async (req, res) => {
  const message = boundedString(req.body?.message, 5000, '').trim();
  const specialDate = String(req.body?.special_date || '');
  if (!message) return res.status(400).json({ error: 'O bilhete precisa de uma mensagem.' });
  if (!validMonthDay(specialDate)) return res.status(400).json({ error: 'A data do bilhete e invalida.' });

  let chapterId = null;
  if (req.body?.chapter_id) {
    chapterId = positiveInt(req.body.chapter_id);
    if (!chapterId || !await db.prepare('SELECT 1 FROM chapters WHERE id = ?').get(chapterId)) {
      return res.status(400).json({ error: 'Capitulo do bilhete invalido.' });
    }
  }

  const result = await db.prepare(`
    INSERT INTO special_notes (message, special_date, chapter_id, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(message, specialDate, chapterId);
  const note = await db.prepare(`${noteSelect('WHERE sn.id = ?')}`).get(result.lastInsertRowid);
  res.status(201).json({ note });
});

router.patch('/notes/:id', async (req, res) => {
  const note = await db.prepare('SELECT * FROM special_notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Bilhete nao encontrado.' });

  const fields = [];
  const values = [];
  if (req.body.message !== undefined) {
    const message = boundedString(req.body.message, 5000, '').trim();
    if (!message) return res.status(400).json({ error: 'O bilhete precisa de uma mensagem.' });
    fields.push('message = ?'); values.push(message);
  }
  if (req.body.special_date !== undefined) {
    if (!validMonthDay(req.body.special_date)) return res.status(400).json({ error: 'A data do bilhete e invalida.' });
    fields.push('special_date = ?'); values.push(req.body.special_date);
  }
  if (req.body.chapter_id !== undefined) {
    const chapterId = req.body.chapter_id ? positiveInt(req.body.chapter_id) : null;
    if (chapterId && !await db.prepare('SELECT 1 FROM chapters WHERE id = ?').get(chapterId)) {
      return res.status(400).json({ error: 'Capitulo do bilhete invalido.' });
    }
    fields.push('chapter_id = ?'); values.push(chapterId);
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  values.push(req.params.id);
  await db.prepare(`UPDATE special_notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = await db.prepare(`${noteSelect('WHERE sn.id = ?')}`).get(req.params.id);
  res.json({ note: updated });
});

router.delete('/notes/:id', async (req, res) => {
  const note = await db.prepare('SELECT 1 FROM special_notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Bilhete nao encontrado.' });
  await db.prepare('DELETE FROM special_notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
