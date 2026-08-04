const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

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

  const readDays = db.prepare(`
    SELECT DISTINCT date(completed_at) as d FROM reading_stats WHERE user_id = ? ORDER BY d DESC
  `).all(user.id);

  let streak = 0;
  if (readDays.length) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let cursor = today;
    for (const row of readDays) {
      const d = new Date(row.d + 'T00:00:00Z');
      const diffDays = Math.round((cursor - d) / (1000 * 60 * 60 * 24));
      if (diffDays === 0 || diffDays === 1) {
        streak += 1;
        cursor = d;
      } else {
        break;
      }
    }
  }

  let favoriteBook = null;
  if (user.favorite_book_id) {
    favoriteBook = db.prepare('SELECT id, title, slug FROM books WHERE id = ?').get(user.favorite_book_id);
  }

  let favoriteChapter = null;
  if (user.favorite_chapter_id) {
    favoriteChapter = db.prepare('SELECT id, title FROM chapters WHERE id = ?').get(user.favorite_chapter_id);
  }

  const { password_hash, ...safeUser } = user;

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
  const { bio, avatar_url, favorite_book_id, favorite_chapter_id } = req.body;
  const fields = [];
  const values = [];

  if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
  if (avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(avatar_url); }
  if (favorite_book_id !== undefined) { fields.push('favorite_book_id = ?'); values.push(favorite_book_id); }
  if (favorite_chapter_id !== undefined) { fields.push('favorite_chapter_id = ?'); values.push(favorite_chapter_id); }

  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser });
});

module.exports = router;
