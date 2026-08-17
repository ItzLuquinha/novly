const db = require('./db');

async function publishDueChapters() {
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

// Workers do not run permanent timers. Cloudflare Cron calls publishDueChapters
// through worker/index.mjs instead.
function startPublishingScheduler() { return null; }
module.exports = { publishDueChapters, startPublishingScheduler };
