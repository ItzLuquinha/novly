const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'novly-dev-secret-troque-em-producao';
const COOKIE_NAME = 'novly_session';

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Nao autenticado.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessao invalida ou expirada.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Sem permissao para esta acao.' });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, COOKIE_NAME, JWT_SECRET };
