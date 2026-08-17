const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('migrations create the D1/SQLite schema cleanly', () => {
  const db = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(path.join(root, 'migrations')).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(read(`migrations/${file}`));
  }
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  for (const name of ['users', 'books', 'chapters', 'comments', 'highlights', 'writer_settings', 'timeline_events', 'uploaded_files']) {
    assert.ok(tables.includes(name), `missing table ${name}`);
  }
  const upload = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='uploaded_files'").get();
  assert.match(upload.sql, /size_bytes\s+INTEGER/i);
  db.close();
});

test('Cloudflare free-only bindings and SPA routing are configured', () => {
  const cfg = JSON.parse(read('wrangler.jsonc'));
  assert.ok(cfg.compatibility_flags.includes('nodejs_compat'));
  assert.equal(cfg.d1_databases[0].binding, 'DB');
  assert.equal(cfg.r2_buckets, undefined);
  assert.equal(cfg.assets.not_found_handling, 'single-page-application');
  assert.ok(cfg.assets.run_worker_first.includes('/api/*'));
  assert.ok(cfg.assets.run_worker_first.includes('/uploads/*'));
  assert.ok(cfg.triggers.crons.length > 0);
});

test('runtime no longer depends on Render, R2, filesystem SQLite, or process.env', () => {
  const runtimeFiles = [
    'server/index.js', 'server/db.js', 'server/auth.js', 'server/security.js',
    'server/publishing.js', 'server/routes/uploads.js', 'worker/index.mjs', 'client/src/lib/api.js',
  ];
  const source = runtimeFiles.map(read).join('\n');
  assert.doesNotMatch(source, /onrender\.com/i);
  assert.doesNotMatch(source, /better-sqlite3|node:sqlite|sqlite3/i);
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /CLIENT_ORIGIN/);
  assert.doesNotMatch(source, /\.r2\(\)|env\.UPLOADS|__NOVLY_CF_ENV\.UPLOADS/);
});

test('frontend production API is same-origin and authentication stays in HttpOnly cookie', () => {
  const api = read('client/src/lib/api.js');
  const auth = read('server/auth.js');
  assert.match(api, /window\.location\.origin/);
  assert.match(api, /credentials:\s*'include'/);
  assert.match(auth, /httpOnly:\s*true/);
  assert.match(auth, /secure:\s*true/);
  assert.match(auth, /sameSite:\s*'lax'/);
  assert.doesNotMatch(auth, /Bearer /);
});

test('D1 media storage has strict caps and no video upload endpoint', () => {
  const uploads = read('server/routes/uploads.js');
  assert.match(uploads, /MAX_IMAGE_BYTES\s*=\s*1_250_000/);
  assert.match(uploads, /GLOBAL_QUOTA_BYTES\s*=\s*64 \* 1024 \* 1024/);
  assert.match(uploads, /uploaded_files/);
  assert.doesNotMatch(uploads, /background-video/);
  assert.doesNotMatch(uploads, /video\/mp4|video\/webm/);
});

test('D1 routes do not contain legacy explicit BEGIN/COMMIT transactions', () => {
  const routesDir = path.join(root, 'server', 'routes');
  const source = fs.readdirSync(routesDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => fs.readFileSync(path.join(routesDir, name), 'utf8'))
    .join('\n');
  assert.doesNotMatch(source, /db\.exec\(['"]BEGIN/i);
  assert.doesNotMatch(source, /db\.exec\(['"]COMMIT/i);
  assert.doesNotMatch(source, /db\.exec\(['"]ROLLBACK/i);
});

test('modern D1 backup path does not use alpha-only dump API', () => {
  assert.doesNotMatch(read('server/routes/writerBackup.js'), /\.DB\.dump\(|\.dump\(\)/);
});
