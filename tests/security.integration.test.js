const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 49137;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:5173';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novly-test-'));
let server;
let serverLog = '';

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

async function api(pathname, { method = 'GET', cookie, body, form } = {}) {
  const headers = { Origin: ORIGIN };
  let payload;
  if (cookie) headers.Cookie = cookie;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${pathname}`, { method, headers, body: payload, redirect: 'manual' });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : null;
  return { res, data };
}

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor de teste nao iniciou.\n${serverLog}`);
}

test.before(async () => {
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      DATA_DIR: tempDir,
      UPLOAD_DIR: path.join(tempDir, 'uploads'),
      CLIENT_ORIGIN: ORIGIN,
      JWT_SECRET: 'novly-integration-test-secret-please-change-in-production-123456',
      SEED_WRITER_EMAIL: 'writer@test.local',
      SEED_WRITER_PASSWORD: 'writer-password-123',
      SEED_READER_EMAIL: 'reader@test.local',
      SEED_READER_PASSWORD: 'reader-password-123',
      APP_TIMEZONE: 'America/New_York',
      PUBLISH_INTERVAL_MS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => { serverLog += d.toString(); });
  server.stderr.on('data', (d) => { serverLog += d.toString(); });
  await waitForServer();
});

test.after(() => {
  if (server && !server.killed) server.kill('SIGTERM');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('permissoes, privacidade, leitura e backup ficam protegidos', async () => {
  // Writer login -> HttpOnly cookie, no token exposed in JSON.
  let r = await api('/api/auth/login', { method: 'POST', body: { email: 'writer@test.local', password: 'writer-password-123' } });
  assert.equal(r.res.status, 200);
  assert.equal(typeof r.data.token, 'undefined');
  const writerCookie = cookieFrom(r.res);
  assert.match(writerCookie, /^novly_session=/);
  assert.match(r.res.headers.get('set-cookie') || '', /HttpOnly/i);

  // Book with explicitly private writer notes.
  r = await api('/api/writer/books', { method: 'POST', cookie: writerCookie, body: { title: 'Livro Seguro', writer_notes: 'NOTA ULTRA PRIVADA' } });
  assert.equal(r.res.status, 201);
  const book = r.data.book;
  await api(`/api/writer/books/${book.id}/publish`, { method: 'POST', cookie: writerCookie });

  // Published chapter.
  r = await api(`/api/writer/books/${book.id}/chapters`, { method: 'POST', cookie: writerCookie, body: { title: 'Capitulo Publico' } });
  const publishedChapter = r.data.chapter;
  r = await api(`/api/writer/chapters/${publishedChapter.id}`, {
    method: 'PUT', cookie: writerCookie,
    body: { title: 'Capitulo Publico', content: 'Este e um texto publico com conteudo suficiente para testes de leitura.', expected_revision: 0 },
  });
  assert.equal(r.res.status, 200);
  assert.equal(r.data.chapter.revision, 1);

  // Stale autosave cannot overwrite a newer edit.
  r = await api(`/api/writer/chapters/${publishedChapter.id}`, {
    method: 'PUT', cookie: writerCookie,
    body: { title: 'Titulo velho', content: 'versao velha', expected_revision: 0 },
  });
  assert.equal(r.res.status, 409);
  await api(`/api/writer/chapters/${publishedChapter.id}/publish`, { method: 'POST', cookie: writerCookie });

  // Scheduled secret chapter far in the future for leak checks.
  r = await api(`/api/writer/books/${book.id}/chapters`, { method: 'POST', cookie: writerCookie, body: { title: 'SPOILER AGENDADO' } });
  const secretChapter = r.data.chapter;
  await api(`/api/writer/chapters/${secretChapter.id}`, {
    method: 'PUT', cookie: writerCookie,
    body: { title: 'SPOILER AGENDADO', content: 'CONTEUDO SECRETO DO FUTURO', expected_revision: 0 },
  });
  await api(`/api/writer/chapters/${secretChapter.id}/schedule`, {
    method: 'POST', cookie: writerCookie, body: { scheduled_for: new Date(Date.now() + 60_000).toISOString() },
  });

  // Reader login.
  r = await api('/api/auth/login', { method: 'POST', body: { email: 'reader@test.local', password: 'reader-password-123' } });
  assert.equal(r.res.status, 200);
  const readerCookie = cookieFrom(r.res);

  // Reader DTO does not include writer notes or draft/scheduled chapter metadata.
  r = await api('/api/books', { cookie: readerCookie });
  assert.equal(r.res.status, 200);
  assert.equal(r.data.books.length, 1);
  assert.equal(Object.hasOwn(r.data.books[0], 'writer_notes'), false);
  assert.deepEqual(r.data.books[0].chapters.map((c) => c.title), ['Capitulo Publico']);
  assert.equal(JSON.stringify(r.data).includes('SPOILER AGENDADO'), false);
  assert.equal(JSON.stringify(r.data).includes('NOTA ULTRA PRIVADA'), false);

  r = await api(`/api/books/${book.slug}/chapters/${secretChapter.id}`, { cookie: readerCookie });
  assert.equal(r.res.status, 403);

  r = await api('/api/home/summary', { cookie: readerCookie });
  assert.equal(r.res.status, 200);
  assert.equal(r.data.next_scheduled, null);
  assert.equal(JSON.stringify(r.data).includes('CONTEUDO SECRETO DO FUTURO'), false);

  // Cross-entity IDs are rejected.
  r = await api(`/api/comments/chapter/${publishedChapter.id}`, {
    method: 'POST', cookie: readerCookie, body: { book_id: book.id + 999, content: 'teste' },
  });
  assert.equal(r.res.status, 400);

  // Reader can comment, but cannot moderate.
  r = await api(`/api/comments/chapter/${publishedChapter.id}`, {
    method: 'POST', cookie: readerCookie, body: { book_id: book.id, content: 'Comentario da leitora' },
  });
  assert.equal(r.res.status, 201);
  const commentId = r.data.comment.id;
  assert.equal((await api(`/api/comments/${commentId}/pin`, { method: 'PATCH', cookie: readerCookie })).res.status, 403);
  assert.equal((await api(`/api/comments/${commentId}/resolve`, { method: 'PATCH', cookie: readerCookie })).res.status, 403);

  // Highlights must belong to the exact published chapter/book and real text.
  r = await api('/api/highlights', {
    method: 'POST', cookie: readerCookie,
    body: { chapter_id: publishedChapter.id, book_id: book.id + 1, text: 'Este e um texto' },
  });
  assert.equal(r.res.status, 400);
  r = await api('/api/highlights', {
    method: 'POST', cookie: readerCookie,
    body: { chapter_id: publishedChapter.id, book_id: book.id, text: 'texto que nao existe no capitulo' },
  });
  assert.equal(r.res.status, 400);

  // Writer-only asset routes reject the reader before accepting the file.
  const form = new FormData();
  form.append('image', new Blob([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], { type: 'image/png' }), 'x.png');
  r = await api('/api/uploads/book-cover', { method: 'POST', cookie: readerCookie, form });
  assert.equal(r.res.status, 403);

  // Client-supplied time cannot forge completion; server requires real progress/activity.
  await api(`/api/books/${book.slug}/chapters/${publishedChapter.id}/progress`, {
    method: 'POST', cookie: readerCookie,
    body: { scroll_position: 10, progress_percent: 10, char_offset: 0 },
  });
  r = await api(`/api/books/${book.slug}/chapters/${publishedChapter.id}/complete`, {
    method: 'POST', cookie: readerCookie, body: { seconds_spent: 999999999 },
  });
  assert.equal(r.res.status, 400);

  await api(`/api/books/${book.slug}/chapters/${publishedChapter.id}/progress`, {
    method: 'POST', cookie: readerCookie,
    body: { scroll_position: 999, progress_percent: 90, char_offset: 10 },
  });
  r = await api(`/api/books/${book.slug}/chapters/${publishedChapter.id}/complete`, {
    method: 'POST', cookie: readerCookie, body: { seconds_spent: 999999999 },
  });
  assert.equal(r.res.status, 400); // not enough server-measured seconds yet

  // Hidden notes are per-user/per-year rather than globally consumed.
  const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const getPart = (type) => dateParts.find((p) => p.type === type).value;
  const monthDay = `${getPart('month')}-${getPart('day')}`;
  r = await api('/api/writer/notes', { method: 'POST', cookie: writerCookie, body: { message: 'Bilhete anual', special_date: monthDay } });
  assert.equal(r.res.status, 201);
  const noteId = r.data.note.id;
  r = await api('/api/notes/available', { cookie: readerCookie });
  assert.equal(r.data.note.id, noteId);
  assert.equal((await api(`/api/notes/${noteId}/found`, { method: 'POST', cookie: readerCookie })).res.status, 200);
  assert.equal((await api('/api/notes/available', { cookie: readerCookie })).data.note, null);
  assert.equal((await api('/api/notes/available', { cookie: writerCookie })).data.note.id, noteId);

  // SQLite backup endpoint serves the snapshot generated by the backup API.
  r = await api('/api/writer/backup/database', { cookie: writerCookie });
  assert.equal(r.res.status, 200);
  assert.match(r.res.headers.get('content-disposition') || '', /novly-backup-/);

  // Real scheduler publishes without needing a reader request to trigger publication.
  r = await api(`/api/writer/books/${book.id}/chapters`, { method: 'POST', cookie: writerCookie, body: { title: 'Agendado pelo timer' } });
  const timerChapter = r.data.chapter;
  await api(`/api/writer/chapters/${timerChapter.id}`, {
    method: 'PUT', cookie: writerCookie,
    body: { title: 'Agendado pelo timer', content: 'publicado automaticamente', expected_revision: 0 },
  });
  await api(`/api/writer/chapters/${timerChapter.id}/schedule`, {
    method: 'POST', cookie: writerCookie, body: { scheduled_for: new Date(Date.now() + 1200).toISOString() },
  });
  await new Promise((resolve) => setTimeout(resolve, 2800));
  r = await api('/api/books', { cookie: readerCookie });
  assert.ok(r.data.books[0].chapters.some((c) => c.id === timerChapter.id && c.status === 'publicado'));

  // Logout revokes the token version; replaying the old cookie fails.
  r = await api('/api/auth/logout', { method: 'POST', cookie: readerCookie });
  assert.equal(r.res.status, 200);
  r = await api('/api/auth/me', { cookie: readerCookie });
  assert.equal(r.res.status, 401);
});
