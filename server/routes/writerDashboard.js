const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

router.get('/dashboard', (req, res) => {
  const userId = req.user.id;

  const bookCount = db.prepare('SELECT COUNT(*) as c FROM books').get().c;

  const chapterStats = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'publicado' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN status = 'rascunho' THEN 1 ELSE 0 END) as draft,
      SUM(CASE WHEN status = 'agendado' THEN 1 ELSE 0 END) as scheduled
    FROM chapters
  `).get();

  const wordsToday = db.prepare(`
    SELECT COALESCE(SUM(words_written), 0) as total FROM writing_sessions
    WHERE user_id = ? AND date(started_at) = date('now') AND words_written > 0
  `).get(userId).total;

  const wordsThisWeek = db.prepare(`
    SELECT COALESCE(SUM(words_written), 0) as total FROM writing_sessions
    WHERE user_id = ? AND started_at >= date('now', '-7 days') AND words_written > 0
  `).get(userId).total;

  const wordsThisMonth = db.prepare(`
    SELECT COALESCE(SUM(words_written), 0) as total FROM writing_sessions
    WHERE user_id = ? AND started_at >= date('now', 'start of month') AND words_written > 0
  `).get(userId).total;

  const writingDays = db.prepare(`
    SELECT DISTINCT date(started_at) as d FROM writing_sessions
    WHERE user_id = ? AND words_written > 0
    ORDER BY d DESC
  `).all(userId);

  let streak = 0;
  if (writingDays.length) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let cursor = today;
    for (const row of writingDays) {
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

  const lastSession = db.prepare(`
    SELECT ws.*, c.title as chapter_title, b.title as book_title
    FROM writing_sessions ws
    LEFT JOIN chapters c ON c.id = ws.chapter_id
    LEFT JOIN books b ON b.id = ws.book_id
    WHERE ws.user_id = ?
    ORDER BY ws.started_at DESC LIMIT 1
  `).get(userId);

  const nextScheduled = db.prepare(`
    SELECT ch.*, b.title as book_title, b.slug as book_slug
    FROM chapters ch JOIN books b ON b.id = ch.book_id
    WHERE ch.status = 'agendado' AND ch.scheduled_for IS NOT NULL
    ORDER BY ch.scheduled_for ASC LIMIT 1
  `).get();

  let settings = db.prepare('SELECT * FROM writer_settings WHERE user_id = ?').get(userId);
  if (!settings) {
    db.prepare('INSERT INTO writer_settings (user_id, daily_goal, weekly_goal) VALUES (?, 500, 3000)').run(userId);
    settings = { user_id: userId, daily_goal: 500, weekly_goal: 3000 };
  }

  res.json({
    book_count: bookCount,
    chapters_published: chapterStats.published || 0,
    chapters_draft: chapterStats.draft || 0,
    chapters_scheduled: chapterStats.scheduled || 0,
    words_today: wordsToday,
    words_this_week: wordsThisWeek,
    words_this_month: wordsThisMonth,
    daily_goal: settings.daily_goal,
    weekly_goal: settings.weekly_goal,
    streak_days: streak,
    last_session: lastSession || null,
    next_scheduled: nextScheduled || null,
  });
});

router.get('/dashboard/history', (req, res) => {
  const userId = req.user.id;
  const days = Math.min(Number(req.query.days) || 180, 366);

  const rows = db.prepare(`
    SELECT date(started_at) as day, SUM(words_written) as words
    FROM writing_sessions
    WHERE user_id = ? AND words_written > 0 AND started_at >= date('now', ?)
    GROUP BY date(started_at)
    ORDER BY day ASC
  `).all(userId, `-${days} days`);

  res.json({ days: rows });
});

router.patch('/dashboard/goals', (req, res) => {
  const { daily_goal, weekly_goal } = req.body;
  const existing = db.prepare('SELECT * FROM writer_settings WHERE user_id = ?').get(req.user.id);

  if (existing) {
    db.prepare(`
      UPDATE writer_settings SET daily_goal = ?, weekly_goal = ? WHERE user_id = ?
    `).run(daily_goal ?? existing.daily_goal, weekly_goal ?? existing.weekly_goal, req.user.id);
  } else {
    db.prepare(`
      INSERT INTO writer_settings (user_id, daily_goal, weekly_goal) VALUES (?, ?, ?)
    `).run(req.user.id, daily_goal ?? 500, weekly_goal ?? 3000);
  }

  res.json({ ok: true });
});

router.get('/editor-preferences', (req, res) => {
  let settings = db.prepare('SELECT * FROM writer_settings WHERE user_id = ?').get(req.user.id);
  if (!settings) {
    db.prepare(`
      INSERT INTO writer_settings (user_id, daily_goal, weekly_goal, editor_font, editor_font_size, editor_text_color, spellcheck_mode)
      VALUES (?, 500, 3000, 'reading', 19, '#e8dcc8', 'local')
    `).run(req.user.id);
    settings = db.prepare('SELECT * FROM writer_settings WHERE user_id = ?').get(req.user.id);
  }
  res.json({
    editor_font: settings.editor_font,
    editor_font_size: settings.editor_font_size,
    editor_text_color: settings.editor_text_color,
    spellcheck_mode: settings.spellcheck_mode || 'local',
  });
});

router.patch('/editor-preferences', (req, res) => {
  const { editor_font, editor_font_size, editor_text_color, spellcheck_mode } = req.body;
  const existing = db.prepare('SELECT * FROM writer_settings WHERE user_id = ?').get(req.user.id);

  if (spellcheck_mode !== undefined && !['off', 'local', 'languagetool'].includes(spellcheck_mode)) {
    return res.status(400).json({ error: 'Modo de corretor invalido.' });
  }

  const nextFont = editor_font ?? existing?.editor_font ?? 'reading';
  const nextSize = editor_font_size ?? existing?.editor_font_size ?? 19;
  const nextColor = editor_text_color ?? existing?.editor_text_color ?? '#e8dcc8';
  const nextSpellcheck = spellcheck_mode ?? existing?.spellcheck_mode ?? 'local';

  if (existing) {
    db.prepare(`
      UPDATE writer_settings SET editor_font = ?, editor_font_size = ?, editor_text_color = ?, spellcheck_mode = ? WHERE user_id = ?
    `).run(nextFont, nextSize, nextColor, nextSpellcheck, req.user.id);
  } else {
    db.prepare(`
      INSERT INTO writer_settings (user_id, editor_font, editor_font_size, editor_text_color, spellcheck_mode)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, nextFont, nextSize, nextColor, nextSpellcheck);
  }

  res.json({
    editor_font: nextFont,
    editor_font_size: nextSize,
    editor_text_color: nextColor,
    spellcheck_mode: nextSpellcheck,
  });
});

module.exports = router;
