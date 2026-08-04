const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/summary', requireAuth, (req, res) => {
  const userId = req.user.id;

  const inProgress = db.prepare(`
    SELECT rp.*, b.title as book_title, b.slug as book_slug, b.cover_color, b.spine_color,
           ch.title as chapter_title
    FROM reading_progress rp
    JOIN books b ON b.id = rp.book_id
    JOIN chapters ch ON ch.id = rp.chapter_id
    WHERE rp.user_id = ?
    ORDER BY rp.updated_at DESC
    LIMIT 1
  `).get(userId);

  const lastUpdatedBook = db.prepare(`
    SELECT b.*, MAX(c.updated_at) as last_chapter_update
    FROM books b JOIN chapters c ON c.book_id = b.id
    WHERE c.status = 'publicado'
    GROUP BY b.id
    ORDER BY last_chapter_update DESC
    LIMIT 1
  `).get();

  const lastComment = db.prepare(`
    SELECT c.*, u.username, u.role as user_role, b.title as book_title, b.slug as book_slug,
           ch.title as chapter_title
    FROM comments c
    JOIN users u ON u.id = c.user_id
    JOIN books b ON b.id = c.book_id
    JOIN chapters ch ON ch.id = c.chapter_id
    ORDER BY c.created_at DESC
    LIMIT 1
  `).get();

  const recentChapter = db.prepare(`
    SELECT ch.*, b.title as book_title, b.slug as book_slug
    FROM chapters ch JOIN books b ON b.id = ch.book_id
    WHERE ch.status = 'publicado'
    ORDER BY ch.published_at DESC
    LIMIT 1
  `).get();

  const nextScheduled = db.prepare(`
    SELECT ch.*, b.title as book_title, b.slug as book_slug
    FROM chapters ch JOIN books b ON b.id = ch.book_id
    WHERE ch.status = 'agendado' AND ch.scheduled_for IS NOT NULL
    ORDER BY ch.scheduled_for ASC
    LIMIT 1
  `).get();

  const favoriteHighlight = db.prepare(`
    SELECT h.* FROM highlights h WHERE h.user_id = ? ORDER BY h.created_at DESC LIMIT 1
  `).get(userId) || null;

  const otherUser = db.prepare('SELECT id, username, role FROM users WHERE id != ?').get(userId);
  let otherPresence = null;
  if (otherUser) {
    const presence = db.prepare('SELECT * FROM presence WHERE user_id = ?').get(otherUser.id);
    if (presence) {
      const lastPing = new Date(presence.last_ping_at + 'Z').getTime();
      const now = Date.now();
      const isOnline = now - lastPing < 2 * 60 * 1000;
      otherPresence = { username: otherUser.username, role: otherUser.role, online: isOnline };
    }
  }

  res.json({
    continue_reading: inProgress || null,
    last_updated_book: lastUpdatedBook || null,
    last_comment: lastComment || null,
    recent_chapter: recentChapter || null,
    next_scheduled: nextScheduled || null,
    favorite_highlight: favoriteHighlight,
    other_presence: otherPresence,
  });
});

router.post('/presence/ping', requireAuth, (req, res) => {
  db.prepare(`
    INSERT INTO presence (user_id, last_ping_at, location) VALUES (?, datetime('now'), ?)
    ON CONFLICT(user_id) DO UPDATE SET last_ping_at = datetime('now'), location = excluded.location
  `).run(req.user.id, req.body.location || '');
  res.json({ ok: true });
});

module.exports = router;
