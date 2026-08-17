const jwt = require('jsonwebtoken');
const db = require('./db');

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_HOSTED = IS_PROD || process.env.RENDER === 'true' || !!process.env.VERCEL || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.FLY_APP_NAME;
const DEV_SECRET = 'novly-dev-secret-troque-em-producao';
const JWT_SECRET = process.env.JWT_SECRET || (!IS_HOSTED ? DEV_SECRET : '');
const COOKIE_NAME = 'novly_session';
const configuredTtl = Number(process.env.SESSION_TTL_SECONDS);
const SESSION_TTL_SECONDS = Number.isFinite(configuredTtl)
  ? Math.max(900, Math.floor(configuredTtl))
  : 7 * 24 * 60 * 60;

if (!JWT_SECRET || (IS_HOSTED && (JWT_SECRET === DEV_SECRET || JWT_SECRET.length < 32))) {
  throw new Error('JWT_SECRET forte (minimo 32 caracteres) e exclusivo e obrigatorio em producao.');
}

function cookieOptions() {
  const configured = (process.env.COOKIE_SAME_SITE || '').toLowerCase();
  const sameSite = ['lax', 'strict', 'none'].includes(configured)
    ? configured
    : 'lax';
  return {
    httpOnly: true,
    secure: IS_HOSTED || sameSite === 'none',
    sameSite,
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  };
}

function signToken(user) {
  const sessionVersion = Number(user.session_version || 0);
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username, sv: sessionVersion },
    JWT_SECRET,
    { expiresIn: SESSION_TTL_SECONDS, issuer: 'novly', audience: 'novly-web' }
  );
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearSessionCookie(res) {
  const opts = cookieOptions();
  delete opts.maxAge;
  res.clearCookie(COOKIE_NAME, opts);
}

function tokenFromRequest(req) {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.substring(7);
  return null;
}

function requireAuth(req, res, next) {
  const token = tokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Nao autenticado.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'novly', audience: 'novly-web' });
    const user = db.prepare('SELECT id, role, username, session_version FROM users WHERE id = ?').get(payload.id);
    if (!user || Number(payload.sv) !== Number(user.session_version || 0)) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Sessao revogada. Entre novamente.' });
    }
    req.user = { ...payload, role: user.role, username: user.username };
    next();
  } catch (_) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sessao invalida ou expirada.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ error: 'Sem permissao para esta acao.' });
    next();
  };
}

module.exports = {
  signToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requireRole,
  COOKIE_NAME,
  JWT_SECRET,
  SESSION_TTL_SECONDS,
};
