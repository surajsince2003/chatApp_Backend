const { verifyToken } = require('../lib/jwt');

module.exports = function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
};
