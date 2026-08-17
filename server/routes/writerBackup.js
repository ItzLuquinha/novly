const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('escritor'));

// Downloadable, portable content backup. Password hashes and ephemeral presence/activity
// are intentionally excluded. For a full SQL snapshot use `wrangler d1 export`.
const BACKUP_TABLES = [
  'books', 'chapters', 'comments', 'highlights', 'likes', 'favorites', 'bookmarks',
  'chapter_versions', 'writing_sessions', 'writer_settings', 'characters',
  'character_books', 'character_chapters', 'places', 'place_events', 'place_books',
  'place_chapters', 'objects', 'object_books', 'object_chapters', 'timeline_events',
  'special_notes', 'note_discoveries', 'kanban_cards', 'scenes', 'reading_progress',
  'reading_stats',
];

router.get('/backup/database', async (req, res, next) => {
  try {
    const tables = {};
    for (const table of BACKUP_TABLES) {
      tables[table] = await db.prepare(`SELECT * FROM ${table}`).all();
    }
    const payload = {
      format: 'novly-cloudflare-content-backup',
      version: 1,
      generated_at: new Date().toISOString(),
      note: 'Backup logico. Para snapshot SQL completo use: npx wrangler d1 export novly-db --remote --output=novly-d1-backup.sql',
      tables,
    };
    const filename = `novly-content-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(JSON.stringify(payload));
  } catch (err) { next(err); }
});

router.get('/backup/info', async (req, res) => {
  res.json({
    books: (await db.prepare('SELECT COUNT(*) as c FROM books').get()).c,
    chapters: (await db.prepare('SELECT COUNT(*) as c FROM chapters').get()).c,
    platform: 'cloudflare-d1',
    automatic_recovery: 'D1 Time Travel',
    retention_days: 7,
    downloadable_backup: 'logical-json',
    tip: 'O botao baixa um backup logico. Para um dump SQL completo, use wrangler d1 export.',
  });
});
module.exports = router;
