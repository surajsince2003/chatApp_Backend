const User = require('../models/User');

exports.me = async (req, res) => {
  const me = await User.findById(req.userId).select('username name email avatarUrl lastSeenAt isOnline');
  res.json(me);
};
exports.updateMe = async (req, res) => {
  const { name, avatarUrl, username, showLastSeen, statusText } = req.body || {};
  const update = {};
  if (typeof name === 'string') update.name = name;
  if (typeof avatarUrl === 'string') update.avatarUrl = avatarUrl;
  if (typeof showLastSeen === 'boolean') update.showLastSeen = showLastSeen;
  if (typeof statusText === 'string') update.statusText = statusText;

  if (typeof username === 'string' && username.trim()) {
    const uname = username.trim().toLowerCase();
    const exists = await require('../models/User').exists({ username: uname, _id: { $ne: req.userId } });
    if (exists) return res.status(409).json({ error: 'username taken' });
    update.username = uname;
  }

  const me = await require('../models/User')
    .findByIdAndUpdate(req.userId, update, { new: true })
    .select('username name email avatarUrl lastSeenAt isOnline showLastSeen statusText');

  res.json(me);
};
exports.byUsername = async (req, res) => {
  const u = await User.findOne({ username: req.params.username.toLowerCase() })
    .select('username name avatarUrl');
  if (!u) return res.status(404).json({ error: 'user not found' });
  res.json(u);
};