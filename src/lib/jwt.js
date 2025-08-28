const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev_secret';

const signToken = (userId) => jwt.sign({ sub: String(userId) }, SECRET, { expiresIn: '7d' });
const verifyToken = (t) => jwt.verify(t, SECRET);

module.exports = { signToken, verifyToken };
