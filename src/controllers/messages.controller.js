const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

const isMember = (chat, uid) => chat.members.some(m => String(m) === uid);

function previewFromMessage(msg) {
  if (msg.type === 'text') return msg.text || '…';
  if (msg.type === 'image') return '📷 IMAGE';
  if (msg.type === 'video') return '🎥 VIDEO';
  return '📎 FILE';
}

exports.list = async (req, res) => {
  const { chatId } = req.params;
  const { cursor, limit = 50 } = req.query;
  if (!mongoose.isValidObjectId(chatId)) return res.status(400).json({ error: 'invalid chatId' });

  const chat = await Chat.findById(chatId).select('members');
  if (!chat || !isMember(chat, req.userId)) return res.status(404).json({ error: 'chat not found or access denied' });

  const q = { chatId };
  if (cursor) q.createdAt = { $gt: new Date(cursor) };

  const items = await Message.find(q).sort({ createdAt: 1 }).limit(Math.min(+limit, 200)).lean();

  const senderIds = [...new Set(items.map(m => String(m.senderId)))];
  const users = await mongoose.model('User').find({ _id: { $in: senderIds } }).select('username avatarUrl').lean();
  const map = Object.fromEntries(users.map(u => [String(u._id), u]));

  const enriched = items.map(m => ({
    ...m,
    sender: { id: String(m.senderId), username: map[String(m.senderId)]?.username, avatarUrl: map[String(m.senderId)]?.avatarUrl }
  }));
  res.json({ items: enriched, nextCursor: items.at(-1)?.createdAt || null });
};

exports.send = async (req, res) => {
  const { chatId } = req.params;
  const { text, media } = req.body || {};

  // ... (validation left as-is)

  let type = 'text';
  if (media?.mime) {
    const m = media.mime.toLowerCase();
    type = m.startsWith('video/') ? 'video' : m.startsWith('image/') ? 'image' : 'file';
  }

  const msg = await Message.create({
    chatId, senderId: req.userId, type,
    text: text?.trim() || null, media: media || undefined, readBy: [req.userId]
  });

  // update preview + bump time
  await Chat.updateOne(
    { _id: chatId },
    { $set: { lastMessage: previewFromMessage(msg), lastMessageAt: msg.createdAt } }
  );

  // ✅ NEW: nudge both users' sidebars via their personal rooms
  const io = req.app.get('io');
  try {
    const chat = await Chat.findById(chatId).select('members lastMessage lastMessageAt').lean();
    chat?.members?.forEach((uid) => {
      io?.to(String(uid)).emit('chat_bumped', {
        chatId: String(chatId),
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt
      });
    });
  } catch (_) {}

  // keep your existing room broadcast for the open chat
  io?.to(String(chatId)).emit('new_message', {
    id: msg._id, chatId, senderId: msg.senderId, type: msg.type,
    text: msg.text, media: msg.media, createdAt: msg.createdAt, readBy: msg.readBy
  });

  res.json({
    id: msg._id, chatId, senderId: msg.senderId, type: msg.type,
    text: msg.text, media: msg.media, createdAt: msg.createdAt, readBy: msg.readBy
  });
};

exports.markRead = async (req, res) => {
  const { chatId } = req.params;
  if (!mongoose.isValidObjectId(chatId)) return res.status(400).json({ error: 'invalid chatId' });
  const chat = await Chat.findById(chatId).select('members');
  if (!chat || !isMember(chat, req.userId)) return res.status(404).json({ error: 'chat not found or access denied' });
  await Message.updateMany({ chatId, readBy: { $ne: req.userId } }, { $addToSet: { readBy: req.userId } });
  res.json({ ok: true });
};
