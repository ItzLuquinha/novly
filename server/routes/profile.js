const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { dateKey, consecutiveStreak } = require('../timezone');
const { positiveInt, boundedString, removeManagedUploadUrl } = require('../security');

const router = express.Router();

router.get('/:userId', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado.' });

  const chaptersRead = db.prepare(`
    SELECT COUNT(*) as c FROM reading_stats WHERE user_id = ?
  `).get(user.id).c;

  const totalSeconds = db.prepare(`
    SELECT COALESCE(SUM(seconds_spent), 0) as s FROM reading_stats WHERE user_id = ?
  `).get(user.id).s;

  const commentCount = db.prepare(`
    SELECT COUNT(*) as c FROM comments WHERE user_id = ?
  `).get(user.id).c;

  const readRows = db.prepare('SELECT completed_at FROM reading_stats WHERE user_id = ?').all(user.id);
  const streak = consecutiveStreak(new Set(readRows.map((row) => dateKey(row.completed_at))));

  let favoriteBook = null;
  if (user.favorite_book_id) {
    favoriteBook = req.user.role === 'escritor'
      ? db.prepare('SELECT id, title, slug FROM books WHERE id = ?').get(user.favorite_book_id)
      : db.prepare('SELECT id, title, slug FROM books WHERE id = ? AND published_at IS NOT NULL').get(user.favorite_book_id);
  }

  let favoriteChapter = null;
  if (user.favorite_chapter_id) {
    favoriteChapter = req.user.role === 'escritor'
      ? db.prepare('SELECT id, title FROM chapters WHERE id = ?').get(user.favorite_chapter_id)
      : db.prepare("SELECT ch.id, ch.title FROM chapters ch JOIN books b ON b.id = ch.book_id WHERE ch.id = ? AND ch.status = 'publicado' AND b.published_at IS NOT NULL").get(user.favorite_chapter_id);
  }

  const safeUser = {
    id: user.id,
    role: user.role,
    username: user.username,
    bio: user.bio || '',
    avatar_url: user.avatar_url || '',
    joined_at: user.joined_at,
  };

  res.json({
    user: safeUser,
    stats: {
      chapters_read: chaptersRead,
      total_reading_minutes: Math.round(totalSeconds / 60),
      comment_count: commentCount,
      consecutive_days: streak,
      favorite_book: favoriteBook,
      favorite_chapter: favoriteChapter,
    },
  });
});

router.patch('/me', requireAuth, (req, res) => {
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const fields = [];
  const values = [];

  if (req.body.bio !== undefined) { fields.push('bio = ?'); values.push(boundedString(req.body.bio, 2000, '')); }
  if (req.body.avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(boundedString(req.body.avatar_url, 2048, '')); }
  if (req.body.favorite_book_id !== undefined) {
    const id = req.body.favorite_book_id ? positiveInt(req.body.favorite_book_id) : null;
    const validBook = id && (req.user.role === 'escritor'
      ? db.prepare('SELECT 1 FROM books WHERE id = ?').get(id)
      : db.prepare('SELECT 1 FROM books WHERE id = ? AND published_at IS NOT NULL').get(id));
    if (id && !validBook) return res.status(400).json({ error: 'Livro favorito invalido.' });
    fields.push('favorite_book_id = ?'); values.push(id);
  }
  if (req.body.favorite_chapter_id !== undefined) {
    const id = req.body.favorite_chapter_id ? positiveInt(req.body.favorite_chapter_id) : null;
    const validChapter = id && (req.user.role === 'escritor'
      ? db.prepare('SELECT 1 FROM chapters WHERE id = ?').get(id)
      : db.prepare("SELECT 1 FROM chapters ch JOIN books b ON b.id = ch.book_id WHERE ch.id = ? AND ch.status = 'publicado' AND b.published_at IS NOT NULL").get(id));
    if (id && !validChapter) return res.status(400).json({ error: 'Capitulo favorito invalido.' });
    fields.push('favorite_chapter_id = ?'); values.push(id);
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  if (req.body.avatar_url !== undefined && req.body.avatar_url !== current.avatar_url) removeManagedUploadUrl(current.avatar_url);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const { password_hash, session_version, ...safeUser } = user;
  res.json({ user: safeUser });
});

module.exports = router;
