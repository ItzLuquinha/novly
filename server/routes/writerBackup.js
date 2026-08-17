const express = require('express');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('escritor'));

router.get('/backup/database', async (req, res, next) => {
  try {
    const backupPath = await db.backupDatabase();
    const filename = `novly-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    res.download(backupPath, filename, (err) => { if (err && !res.headersSent) next(err); });
  } catch (err) { next(err); }
});

router.get('/backup/info', (req, res) => {
  const dbPath = db.DB_PATH;
  let size = 0, mtime = null;
  if (dbPath && fs.existsSync(dbPath)) {
    const st = fs.statSync(dbPath); size = st.size; mtime = st.mtime.toISOString();
  }
  res.json({
    size_bytes: size,
    modified_at: mtime,
    books: db.prepare('SELECT COUNT(*) as c FROM books').get().c,
    chapters: db.prepare('SELECT COUNT(*) as c FROM chapters').get().c,
    backup_rotation: 10,
    tip: 'Use armazenamento persistente para DATA_DIR e mantenha uma copia externa criptografada dos backups.',
  });
});

module.exports = router;
