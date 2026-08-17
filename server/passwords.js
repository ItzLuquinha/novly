const db = require('./db');

const PREFIX = 'novly-hmac-v1';
const enc = new TextEncoder();

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}
function fromB64url(value) {
  try { return new Uint8Array(Buffer.from(value, 'base64url')); }
  catch { return new Uint8Array(); }
}
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function pepperKey() {
  const secret = String(db.env().PASSWORD_PEPPER || '');
  if (secret.length < 32) throw new Error('PASSWORD_PEPPER precisa ter pelo menos 32 caracteres.');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function digest(password, salt) {
  const key = await pepperKey();
  const saltText = b64url(salt);
  const message = enc.encode(`${saltText}\u0000${String(password)}`);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
}
async function hashPassword(password) {
  const value = String(password || '');
  if (value.length < 12 || value.length > 72) throw new Error('A senha precisa ter entre 12 e 72 caracteres.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const mac = await digest(value, salt);
  return `${PREFIX}$${b64url(salt)}$${b64url(mac)}`;
}
async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    // Keep the failure path cryptographic too; old bcrypt hashes are intentionally
    // not evaluated in pure JS on Workers Free because of its tight CPU budget.
    const fakeSalt = new Uint8Array(16);
    await digest(String(password || ''), fakeSalt);
    return false;
  }
  const salt = fromB64url(parts[1]);
  const expected = fromB64url(parts[2]);
  if (salt.length !== 16 || expected.length !== 32) return false;
  const actual = await digest(String(password || ''), salt);
  return equalBytes(actual, expected);
}

module.exports = { hashPassword, verifyPassword, PASSWORD_PREFIX: PREFIX };
