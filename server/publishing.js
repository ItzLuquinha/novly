const db = require('./db');

function publishDueChapters() {
  return db.prepare(`
    UPDATE chapters
    SET status = 'publicado',
        published_at = COALESCE(published_at, datetime('now')),
        scheduled_for = NULL,
        updated_at = datetime('now')
    WHERE status = 'agendado'
      AND scheduled_for IS NOT NULL
      AND datetime(scheduled_for) <= datetime('now')
  `).run();
}

function startPublishingScheduler() {
  publishDueChapters();
  const configured = Number(process.env.PUBLISH_INTERVAL_MS);
  const intervalMs = Number.isFinite(configured) ? Math.max(1000, Math.floor(configured)) : 30 * 1000;
  const timer = setInterval(() => {
    try { publishDueChapters(); } catch (err) { console.error('[novly] Falha ao publicar agendados:', err.message); }
  }, intervalMs);
  timer.unref?.();
  return timer;
}

module.exports = { publishDueChapters, startPublishingScheduler };
