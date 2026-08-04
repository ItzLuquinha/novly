const bcrypt = require('bcryptjs');
const db = require('./db');

function seed({ writerEmail, writerPassword, readerEmail, readerPassword }) {
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
  seed({
    writerEmail: process.env.SEED_WRITER_EMAIL || 'escritor@novly.local',
    writerPassword: process.env.SEED_WRITER_PASSWORD || 'trocar-esta-senha',
    readerEmail: process.env.SEED_READER_EMAIL || 'leitora@novly.local',
    readerPassword: process.env.SEED_READER_PASSWORD || 'trocar-esta-senha',
  });
}

