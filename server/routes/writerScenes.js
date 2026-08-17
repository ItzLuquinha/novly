const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { boundedString } = require('../security');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

router.get('/chapters/:chapterId/scenes', async (req, res) => {
  const scenes = await db.prepare(`
    SELECT * FROM scenes WHERE chapter_id = ? ORDER BY order_index ASC
  `).all(req.params.chapterId);
  res.json({ scenes });
});

router.post('/chapters/:chapterId/scenes', async (req, res) => {
  const chapter = await db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.chapterId);
  if (!chapter) return res.status(404).json({ error: 'Capitulo nao encontrado.' });

  const { title, summary } = req.body;
  const safeTitle = boundedString(title, 300, '').trim();
  if (!safeTitle) {
    return res.status(400).json({ error: 'A cena precisa de um titulo.' });
  }

  const maxOrder = (await db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM scenes WHERE chapter_id = ?')
    .get(req.params.chapterId)).m;

  const result = await db.prepare(`
    INSERT INTO scenes (chapter_id, title, summary, order_index, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(req.params.chapterId, safeTitle, boundedString(summary, 10000, ''), maxOrder + 1);

  const scene = await db.prepare('SELECT * FROM scenes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ scene });
});

router.patch('/scenes/:id', async (req, res) => {
  const scene = await db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id);
  if (!scene) return res.status(404).json({ error: 'Cena nao encontrada.' });

  const { title, summary } = req.body;
  const fields = [];
  const values = [];

  if (title !== undefined) {
    const safeTitle = boundedString(title, 300, '').trim();
    if (!safeTitle) return res.status(400).json({ error: 'A cena precisa de um titulo.' });
    fields.push('title = ?'); values.push(safeTitle);
  }
  if (summary !== undefined) { fields.push('summary = ?'); values.push(boundedString(summary, 10000, '')); }

  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  values.push(req.params.id);
  await db.prepare(`UPDATE scenes SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = await db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id);
  res.json({ scene: updated });
});

router.delete('/scenes/:id', async (req, res) => {
  const scene = await db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id);
  if (!scene) return res.status(404).json({ error: 'Cena nao encontrada.' });
  await db.prepare('DELETE FROM scenes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/scenes/:id/reorder', async (req, res) => {
  const { direction } = req.body;
  if (!['up', 'down'].includes(direction)) {
    return res.status(400).json({ error: 'Direcao invalida.' });
  }
  const scene = await db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id);
  if (!scene) return res.status(404).json({ error: 'Cena nao encontrada.' });

  const neighbor = direction === 'up'
    ? await db.prepare('SELECT * FROM scenes WHERE chapter_id = ? AND order_index < ? ORDER BY order_index DESC LIMIT 1')
        .get(scene.chapter_id, scene.order_index)
    : await db.prepare('SELECT * FROM scenes WHERE chapter_id = ? AND order_index > ? ORDER BY order_index ASC LIMIT 1')
        .get(scene.chapter_id, scene.order_index);

  if (!neighbor) return res.json({ ok: true });

  await db.prepare('UPDATE scenes SET order_index = ? WHERE id = ?').run(neighbor.order_index, scene.id);
  await db.prepare('UPDATE scenes SET order_index = ? WHERE id = ?').run(scene.order_index, neighbor.id);

  res.json({ ok: true });
});

module.exports = router;
