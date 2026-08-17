const bcrypt = require('bcryptjs');
const db = require('./db');

function seed({ writerEmail, writerPassword, readerEmail, readerPassword }) {
  writerEmail = String(writerEmail || '').toLowerCase().trim();
  readerEmail = String(readerEmail || '').toLowerCase().trim();
  writerPassword = String(writerPassword || '');
  readerPassword = String(readerPassword || '');
  const hosted = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || !!process.env.VERCEL || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.FLY_APP_NAME;
  if (hosted) {
    const validEmail = (value) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const validPassword = (value) => value.length >= 12 && value.length <= 72 && value !== 'trocar-esta-senha';
    const weak = !validEmail(writerEmail) || !validEmail(readerEmail) || !validPassword(writerPassword) || !validPassword(readerPassword);
    if (weak) throw new Error('Credenciais de seed fortes e explicitas sao obrigatorias em ambiente hospedado.');
  }
  const existing = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (existing.c > 0) {
    console.log('Usuarios ja existem, pulando seed de usuarios.');
    return;
  }

  const writerHash = bcrypt.hashSync(writerPassword, 10);
  const readerHash = bcrypt.hashSync(readerPassword, 10);

  db.prepare(`
    INSERT INTO users (email, password_hash, role, username, bio, joined_at)
    VALUES (?, ?, 'escritor', ?, ?, datetime('now'))
  `).run(writerEmail, writerHash, 'Escritor', 'Escreve todas as noites, geralmente muito tarde.');

  db.prepare(`
    INSERT INTO users (email, password_hash, role, username, bio, joined_at)
    VALUES (?, ?, 'leitora', ?, ?, datetime('now'))
  `).run(readerEmail, readerHash, 'Leitora', 'Le uma pagina a mais do que devia, sempre.');

  console.log('Seed concluido. Nenhum livro criado; a biblioteca comeca vazia.');
}

module.exports = seed;

if (require.main === module) {
  const hosted = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || !!process.env.VERCEL || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.FLY_APP_NAME;
  if (hosted && !(process.env.SEED_WRITER_EMAIL && process.env.SEED_WRITER_PASSWORD && process.env.SEED_READER_EMAIL && process.env.SEED_READER_PASSWORD)) {
    throw new Error('Defina todas as variaveis SEED_* antes de executar o seed em ambiente hospedado.');
  }
  seed({
    writerEmail: process.env.SEED_WRITER_EMAIL || 'escritor@novly.local',
    writerPassword: process.env.SEED_WRITER_PASSWORD || 'trocar-esta-senha',
    readerEmail: process.env.SEED_READER_EMAIL || 'leitora@novly.local',
    readerPassword: process.env.SEED_READER_PASSWORD || 'trocar-esta-senha',
  });
}

