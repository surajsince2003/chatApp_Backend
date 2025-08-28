const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../lib/jwt');

exports.usernameAvailable = async (req, res) => {
  const u = (req.query.u || '').toLowerCase().trim();
  if (!u) return res.json({ available: false });
  const exists = await User.exists({ username: u });
  res.json({ available: !exists });
};

exports.register = async (req, res) => {
  const { username, name, email, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });
  const uname = username.toLowerCase().trim();
  const exists = await User.exists({ username: uname });
  if (exists) return res.status(409).json({ error: 'username taken' });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ username: uname, name: name || '', email: email || '', passwordHash: hash });
  const token = signToken(user._id);
  res.json({ token, user: { id: user._id, username: user.username, name: user.name, avatarUrl: user.avatarUrl } });
};

exports.login = async (req, res) => {
  const { usernameOrEmail, password } = req.body || {};
  if (!usernameOrEmail || !password) return res.status(400).json({ error: 'username/email & password required' });
  const query = usernameOrEmail.includes('@') ? { email: usernameOrEmail } : { username: usernameOrEmail.toLowerCase() };
  const user = await User.findOne(query);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = signToken(user._id);
  res.json({ token, user: { id: user._id, username: user.username, name: user.name, avatarUrl: user.avatarUrl } });
};
