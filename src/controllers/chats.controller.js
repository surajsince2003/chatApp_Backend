const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const User = require('../models/User');
const ChatMeta = require('../models/ChatMeta');

const isValidId = (id) => mongoose.isValidObjectId(id);

exports.createDM = async (req, res) => {
  const { otherUsername, otherUserId } = req.body || {};
  let other = null;

  if (otherUserId) {
    if (!isValidId(otherUserId)) return res.status(400).json({ error: 'invalid otherUserId' });
    other = await User.findById(otherUserId).select('_id username');
  } else if (otherUsername) {
    other = await User.findOne({ username: otherUsername.toLowerCase() }).select('_id username');
  } else {
    return res.status(400).json({ error: 'otherUsername or otherUserId required' });
  }

  if (!other) return res.status(404).json({ error: 'user not found' });
  if (String(other._id) === req.userId) return res.status(400).json({ error: 'cannot chat with yourself' });

  const pair = [req.userId, String(other._id)];
  const existing = await Chat.findOne({
    members: { $all: pair },
    $expr: { $eq: [{ $size: '$members' }, 2] }
  });
  if (existing) return res.json(existing);

  const chat = await Chat.create({ members: pair });
  res.json(chat);
};

exports.listMyChats = async (req, res) => {
  const me = new mongoose.Types.ObjectId(req.userId);
  const list = await Chat.aggregate([
    { $match: { members: me } },
    { $addFields: {
        otherId: { $first: { $filter: { input: '$members', as: 'm', cond: { $ne: ['$$m', me] } } } }
      }
    },
    { $lookup: { from: 'users', localField: 'otherId', foreignField: '_id', as: 'peer' } },
    { $unwind: '$peer' },
    // join ChatMeta for current user
    { $lookup: {
        from: 'chatmetas', let: { chatId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$chatId', '$$chatId'] }, { $eq: ['$userId', me] }] } } },
          { $limit: 1 }
        ],
        as: 'meta'
      }
    },
    { $addFields: { meta: { $first: '$meta' } } },
    { $project: {
        _id: 1, lastMessage: 1, lastMessageAt: 1,
        peer: { _id: '$peer._id', username: '$peer.username', name: '$peer.name', avatarUrl: '$peer.avatarUrl' },
        pinned: '$meta.pinned'
      }
    },
    { $sort: { pinned: -1, lastMessageAt: -1, _id: -1 } }
  ]);

  res.json(list.map(c => ({ ...c, lastMessagePreview: c.lastMessage || 'Start chatting…' })));
};


exports.pin = async (req, res) => {
  const { chatId } = req.params;
  await ChatMeta.updateOne(
    { chatId, userId: req.userId },
    { $set: { pinned: true } },
    { upsert: true }
  );
  res.json({ ok: true });
};

exports.unpin = async (req, res) => {
  const { chatId } = req.params;
  await ChatMeta.updateOne(
    { chatId, userId: req.userId },
    { $set: { pinned: false } },
    { upsert: true }
  );
  res.json({ ok: true });
};

exports.getOrCreateByUsername = async (req, res) => {
  const uname = (req.params.username || '').toLowerCase();
  const peer = await User.findOne({ username: uname }).select('_id username name avatarUrl');
  if (!peer) return res.status(404).json({ error: 'user not found' });
  if (String(peer._id) === req.userId) return res.status(400).json({ error: 'cannot chat with yourself' });

  const me = new mongoose.Types.ObjectId(req.userId);
  let chat = await Chat.findOne({
    members: { $all: [me, peer._id] },
    $expr: { $eq: [{ $size: '$members' }, 2] }
  });

  if (!chat && String(req.query.create) === '1') {
    chat = await Chat.create({ members: [String(me), String(peer._id)] });
  }

  if (!chat) return res.json({ exists: false, peer });

  res.json({
    exists: true,
    chat: { _id: chat._id, lastMessage: chat.lastMessage, lastMessageAt: chat.lastMessageAt },
    peer
  });
};



