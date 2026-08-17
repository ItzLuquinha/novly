const jwt = require('jsonwebtoken');
const db = require('./db');

const COOKIE_NAME = 'novly_session';
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function runtimeConfig() {
  const env = db.env();
  const secret = String(env.JWT_SECRET || '');
  if (secret.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
  const configuredTtl = Number(env.SESSION_TTL_SECONDS);
  return {
    secret,
    ttl: Number.isFinite(configuredTtl) ? Math.max(900, Math.floor(configuredTtl)) : DEFAULT_TTL_SECONDS,
  };
}

function cookieOptions() {
  const { ttl } = runtimeConfig();
  return { httpOnly: true, secure: true, sameSite: 'lax', maxAge: ttl * 1000, path: '/' };
}

function signToken(user) {
  const { secret, ttl } = runtimeConfig();
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username, sv: Number(user.session_version || 0) },
    secret,
    { expiresIn: ttl, issuer: 'novly', audience: 'novly-web' }
  );
}

function setSessionCookie(res, token) { res.cookie(COOKIE_NAME, token, cookieOptions()); }
function clearSessionCookie(res) {
  const opts = cookieOptions(); delete opts.maxAge; res.clearCookie(COOKIE_NAME, opts);
}
function tokenFromRequest(req) {
  return req.cookies?.[COOKIE_NAME] || null;
}

async function requireAuth(req, res, next) {
  const token = tokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Nao autenticado.' });
  try {
    const { secret } = runtimeConfig();
    const payload = jwt.verify(token, secret, { issuer: 'novly', audience: 'novly-web' });
    const user = await db.prepare('SELECT id, role, username, session_version FROM users WHERE id = ?').get(payload.id);
    if (!user || Number(payload.sv) !== Number(user.session_version || 0)) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Sessao revogada. Entre novamente.' });
    }
    req.user = { ...payload, role: user.role, username: user.username };
    return next();
  } catch (_) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sessao invalida ou expirada.' });
  }
}

function requireRole(role) {
  return (req, res, next) => req.user?.role === role
    ? next()
    : res.status(403).json({ error: 'Sem permissao para esta acao.' });
}

module.exports = { signToken, setSessionCookie, clearSessionCookie, requireAuth, requireRole, COOKIE_NAME };
