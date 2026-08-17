const express = require('express');
const db = require('../db');
const { publishDueChapters } = require('../publishing');
const { requireAuth } = require('../auth');
const { boundedString } = require('../security');

const router = express.Router();

router.get('/summary', requireAuth, async (req, res) => {
  await publishDueChapters();
  const userId = req.user.id;
  const isWriter = req.user.role === 'escritor';

  const inProgress = await db.prepare(`
    SELECT rp.book_id, rp.chapter_id, rp.scroll_position, rp.char_offset, rp.progress_percent, rp.updated_at,
           b.title as book_title, b.slug as book_slug, b.cover_color, b.spine_color, ch.title as chapter_title
    FROM reading_progress rp
    JOIN books b ON b.id = rp.book_id
    JOIN chapters ch ON ch.id = rp.chapter_id
    WHERE rp.user_id = ?
      ${isWriter ? '' : "AND b.published_at IS NOT NULL AND ch.status = 'publicado'"}
    ORDER BY rp.updated_at DESC LIMIT 1
  `).get(userId);

  const lastUpdatedBook = await db.prepare(`
    SELECT b.id, b.title, b.slug, b.synopsis, b.cover_color, b.spine_color, b.cover_url,
           b.category, b.status, b.published_at, MAX(c.updated_at) as last_chapter_update
    FROM books b JOIN chapters c ON c.book_id = b.id
    WHERE c.status = 'publicado' AND b.published_at IS NOT NULL
    GROUP BY b.id ORDER BY last_chapter_update DESC LIMIT 1
  `).get();

  const lastComment = await db.prepare(`
    SELECT c.id, c.content, c.created_at, c.chapter_id, c.book_id, c.resolved, c.pinned,
           u.username, u.role as user_role, b.title as book_title, b.slug as book_slug, ch.title as chapter_title
    FROM comments c
    JOIN users u ON u.id = c.user_id
    JOIN books b ON b.id = c.book_id
    JOIN chapters ch ON ch.id = c.chapter_id
    WHERE ${isWriter ? '1=1' : "b.published_at IS NOT NULL AND ch.status = 'publicado'"}
    ORDER BY c.created_at DESC LIMIT 1
  `).get();

  const recentChapter = await db.prepare(`
    SELECT ch.id, ch.title, ch.order_index, ch.word_count, ch.published_at,
           b.title as book_title, b.slug as book_slug
    FROM chapters ch JOIN books b ON b.id = ch.book_id
    WHERE ch.status = 'publicado' AND b.published_at IS NOT NULL
    ORDER BY ch.published_at DESC LIMIT 1
  `).get();

  const nextScheduled = isWriter ? await db.prepare(`
    SELECT ch.id, ch.title, ch.scheduled_for, ch.word_count,
           b.id as book_id, b.title as book_title, b.slug as book_slug
    FROM chapters ch JOIN books b ON b.id = ch.book_id
    WHERE ch.status = 'agendado' AND ch.scheduled_for IS NOT NULL
    ORDER BY ch.scheduled_for ASC LIMIT 1
  `).get() : null;

  const favoriteHighlight = await db.prepare(`
    SELECT h.id, h.book_id, h.chapter_id, h.text, h.note, h.created_at
    FROM highlights h WHERE h.user_id = ? ORDER BY h.created_at DESC LIMIT 1
  `).get(userId) || null;

  const otherUser = await db.prepare('SELECT id, username, role FROM users WHERE id != ? ORDER BY id ASC LIMIT 1').get(userId);
  let otherPresence = null;
  if (otherUser) {
    const presence = await db.prepare('SELECT last_ping_at FROM presence WHERE user_id = ?').get(otherUser.id);
    if (presence) {
      const lastPing = new Date(`${presence.last_ping_at}Z`).getTime();
      otherPresence = { username: otherUser.username, role: otherUser.role, online: Date.now() - lastPing < 2 * 60 * 1000 };
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

router.post('/presence/ping', requireAuth, async (req, res) => {
  const location = boundedString(req.body?.location, 120, '');
  await db.prepare(`
    INSERT INTO presence (user_id, last_ping_at, location) VALUES (?, datetime('now'), ?)
    ON CONFLICT(user_id) DO UPDATE SET last_ping_at = datetime('now'), location = excluded.location
  `).run(req.user.id, location);
  res.json({ ok: true });
});

router.get('/presence', requireAuth, async (req, res) => {
  const otherUser = await db.prepare('SELECT id, username, role FROM users WHERE id != ? ORDER BY id ASC LIMIT 1').get(req.user.id);
  if (!otherUser) return res.json({ other_presence: null });
  const presence = await db.prepare('SELECT last_ping_at, location FROM presence WHERE user_id = ?').get(otherUser.id);
  if (!presence) return res.json({ other_presence: null });
  const lastPing = new Date(`${presence.last_ping_at}Z`).getTime();
  res.json({
    other_presence: {
      username: otherUser.username,
      role: otherUser.role,
      online: Date.now() - lastPing < 2 * 60 * 1000,
      location: presence.location || '',
    },
  });
});

module.exports = router;
