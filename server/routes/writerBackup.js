const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

router.get('/backup/database', (req, res) => {
  const dbPath = db.DB_PATH;
  if (!dbPath || !fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'Arquivo do banco nao encontrado.' });
  }

  try {
    if (typeof db.backupDatabase === 'function') db.backupDatabase();
  } catch (_) {}

  const filename = `novly-backup-${new Date().toISOString().slice(0, 10)}.db`;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(dbPath).pipe(res);
});

router.get('/backup/info', (req, res) => {
  const dbPath = db.DB_PATH;
  let size = 0;
  let mtime = null;
  if (dbPath && fs.existsSync(dbPath)) {
    const st = fs.statSync(dbPath);
    size = st.size;
    mtime = st.mtime.toISOString();
  }

  const books = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
  const chapters = db.prepare('SELECT COUNT(*) as c FROM chapters').get().c;

  res.json({
    db_path: dbPath,
    data_dir: db.DATA_DIR,
    size_bytes: size,
    modified_at: mtime,
    books,
    chapters,
    tip: 'No Render, monte um disco persistente e defina DATA_DIR para esse caminho. Sem isso, cada deploy apaga o banco.',
  });
});

module.exports = router;
