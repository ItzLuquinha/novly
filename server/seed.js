const { hashPassword } = require('./passwords');
const db = require('./db');

let seedPromise = null;
async function seedFromBindings() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const existing = await db.prepare('SELECT COUNT(*) as c FROM users').get();
    if (Number(existing?.c || 0) > 0) return false;
    const env = db.env();
    const writerEmail = String(env.SEED_WRITER_EMAIL || '').toLowerCase().trim();
    const readerEmail = String(env.SEED_READER_EMAIL || '').toLowerCase().trim();
    const writerPassword = String(env.SEED_WRITER_PASSWORD || '');
    const readerPassword = String(env.SEED_READER_PASSWORD || '');
    const validEmail = (v) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    const validPassword = (v) => v.length >= 12 && v.length <= 72;
    if (!validEmail(writerEmail) || !validEmail(readerEmail) || !validPassword(writerPassword) || !validPassword(readerPassword)) {
      throw new Error('Banco vazio: configure os quatro secrets SEED_* com emails validos e senhas de 12-72 caracteres.');
    }
    const writerHash = await hashPassword(writerPassword);
    const readerHash = await hashPassword(readerPassword);
    await db.env().DB.batch([
      db.env().DB.prepare(`INSERT INTO users (email,password_hash,role,username,bio,joined_at) VALUES (?,?,'escritor',?,?,datetime('now'))`).bind(writerEmail, writerHash, 'Escritor', 'Escreve todas as noites, geralmente muito tarde.'),
      db.env().DB.prepare(`INSERT INTO users (email,password_hash,role,username,bio,joined_at) VALUES (?,?,'leitora',?,?,datetime('now'))`).bind(readerEmail, readerHash, 'Leitora', 'Le uma pagina a mais do que devia, sempre.'),
    ]);
    return true;
  })().catch((err) => { seedPromise = null; throw err; });
  return seedPromise;
}
module.exports = { seedFromBindings };
