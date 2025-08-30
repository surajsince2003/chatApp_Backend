const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = mongoose.model('User'); // already defined elsewhere

const isMember = (chat, uid) => chat.members.some(m => String(m) === String(uid));

const previewFromMessage = (msg) => {
  if (msg.isDeleted) return 'Message deleted';
  if (msg.type === 'text') return msg.text || '…';
  if (msg.type === 'image') return '📷 IMAGE';
  if (msg.type === 'video') return '🎥 VIDEO';
  if (msg.type === 'audio') return '🎙️ VOICE NOTE';
  return msg.media?.filename ? `📎 ${msg.media.filename}` : '📎 FILE';
};

exports.list = async (req, res) => {
  const { chatId } = req.params;
  const { cursor, limit = 50 } = req.query;
  if (!mongoose.isValidObjectId(chatId)) return res.status(400).json({ error: 'invalid chatId' });

  const chat = await Chat.findById(chatId).select('members');
  if (!chat || !isMember(chat, req.userId)) return res.status(404).json({ error: 'chat not found or access denied' });

  const q = { chatId };
  if (cursor) q.createdAt = { $gt: new Date(cursor) };

  const items = await Message.find(q)
    .sort({ createdAt: 1 })
    .limit(Math.min(+limit, 200))
    .lean();

  const senderIds = [...new Set(items.map(m => String(m.senderId)))];
  const users = await User.find({ _id: { $in: senderIds } }).select('username avatarUrl').lean();
  const uMap = Object.fromEntries(users.map(u => [String(u._id), u]));

  const enriched = items.map(m => ({
    ...m,
    sender: { id: String(m.senderId), username: uMap[String(m.senderId)]?.username, avatarUrl: uMap[String(m.senderId)]?.avatarUrl }
  }));
  res.json({ items: enriched, nextCursor: items.at(-1)?.createdAt || null });
};

exports.send = async (req, res) => {
  const { chatId } = req.params;
  const { text, media, replyTo, forwardedFrom } = req.body || {};
  if (!mongoose.isValidObjectId(chatId)) return res.status(400).json({ error: 'invalid chatId' });

  const chat = await Chat.findById(chatId).select('members');
  if (!chat || !isMember(chat, req.userId)) return res.status(404).json({ error: 'chat not found or access denied' });

  const hasMedia = !!(media && media.url);
  if (!hasMedia && (!text || !text.trim())) return res.status(400).json({ error: 'text or media required' });

  let type = 'text';
  if (hasMedia) {
    const m = (media.mime || '').toLowerCase();
    if (m.startsWith('video/')) type = 'video';
    else if (m.startsWith('image/')) type = 'image';
    else if (m.startsWith('audio/')) type = 'audio';
    else type = 'file';
  }

  const msg = await Message.create({
    chatId,
    senderId: req.userId,
    type,
    text: text?.trim() || null,
    media: hasMedia ? media : undefined,
    replyTo: replyTo && mongoose.isValidObjectId(replyTo) ? replyTo : null,
    forwardedFrom: forwardedFrom && mongoose.isValidObjectId(forwardedFrom) ? forwardedFrom : null,
    readBy: [req.userId] // sender has read
  });

  await Chat.updateOne(
    { _id: chatId },
    { $set: { lastMessage: previewFromMessage(msg), lastMessageAt: msg.createdAt } }
  );

  const io = req.app.get('io');
  // bump sidebars
  const updatedChat = await Chat.findById(chatId).select('members lastMessage lastMessageAt');
  updatedChat.members.forEach(uid => {
    io?.to(String(uid)).emit('chat_bumped', {
      chatId: String(chatId),
      lastMessage: updatedChat.lastMessage,
      lastMessageAt: updatedChat.lastMessageAt
    });
  });

  // broadcast to room
  io?.to(String(chatId)).emit('new_message', {
    id: msg._id, chatId, senderId: msg.senderId, type: msg.type,
    text: msg.text, media: msg.media, createdAt: msg.createdAt,
    replyTo: msg.replyTo, forwardedFrom: msg.forwardedFrom,
    readBy: msg.readBy
  });

  res.json({
    id: msg._id, chatId, senderId: msg.senderId, type: msg.type,
    text: msg.text, media: msg.media, createdAt: msg.createdAt,
    replyTo: msg.replyTo, forwardedFrom: msg.forwardedFrom,
    readBy: msg.readBy
  });
};

// mark delivered (called by receiver when they open the app or receive message)
exports.markDelivered = async (req, res) => {
  const { chatId } = req.params;
  await Message.updateMany(
    { chatId, deliveredTo: { $ne: req.userId } },
    { $addToSet: { deliveredTo: req.userId } }
  );
  req.app.get('io')?.to(String(chatId)).emit('message_delivered', { chatId, userId: req.userId });
  res.json({ ok: true });
};

// mark read (you already had a simpler version)
exports.markRead = async (req, res) => {
  const { chatId } = req.params;
  await Message.updateMany(
    { chatId, readBy: { $ne: req.userId } },
    { $addToSet: { readBy: req.userId } }
  );
  req.app.get('io')?.to(String(chatId)).emit('message_read', { chatId, userId: req.userId, at: new Date() });
  res.json({ ok: true });
};

// edit text
exports.edit = async (req, res) => {
  const { messageId } = req.params;
  const { text } = req.body || {};
  const m = await Message.findById(messageId);
  if (!m) return res.status(404).json({ error: 'message not found' });
  if (String(m.senderId) !== req.userId) return res.status(403).json({ error: 'not your message' });
  if (m.isDeleted) return res.status(400).json({ error: 'cannot edit deleted message' });

  m.text = (text || '').trim();
  m.editedAt = new Date();
  await m.save();

  req.app.get('io')?.to(String(m.chatId)).emit('message_edited', { messageId: String(m._id), text: m.text, editedAt: m.editedAt });
  res.json({ ok: true });
};

// delete for everyone OR for me
exports.remove = async (req, res) => {
  const { messageId } = req.params;
  const { forEveryone = false } = req.body || {};
  const m = await Message.findById(messageId);
  if (!m) return res.status(404).json({ error: 'message not found' });

  if (forEveryone) {
    if (String(m.senderId) !== req.userId) return res.status(403).json({ error: 'not your message' });
    m.isDeleted = true; m.text = null; m.media = undefined; m.reactions = []; m.editedAt = new Date();
    await m.save();
    req.app.get('io')?.to(String(m.chatId)).emit('message_deleted', { messageId: String(m._id), forEveryone: true });
  } else {
    await Message.updateOne({ _id: messageId, deletedFor: { $ne: req.userId } }, { $addToSet: { deletedFor: req.userId } });
    req.app.get('io')?.to(String(m.chatId)).emit('message_deleted', { messageId: String(m._id), forEveryone: false, userId: req.userId });
  }
  res.json({ ok: true });
};

// reactions
exports.react = async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body || {};
  if (!emoji) return res.status(400).json({ error: 'emoji required' });

  // toggle same emoji by same user
  const m = await Message.findById(messageId);
  if (!m) return res.status(404).json({ error: 'message not found' });

  const has = m.reactions.find(r => String(r.userId) === req.userId && r.emoji === emoji);
  if (has) {
    m.reactions = m.reactions.filter(r => !(String(r.userId) === req.userId && r.emoji === emoji));
  } else {
    m.reactions.push({ userId: req.userId, emoji });
  }
  await m.save();

  req.app.get('io')?.to(String(m.chatId)).emit('message_reacted', { messageId: String(m._id), userId: req.userId, emoji, added: !has });
  res.json({ ok: true });
};

// forward (copy content to another chat)
exports.forward = async (req, res) => {
  const { messageId } = req.params;
  const { targetChatId } = req.body || {};
  const src = await Message.findById(messageId);
  if (!src) return res.status(404).json({ error: 'message not found' });

  const dest = await Chat.findById(targetChatId).select('members');
  if (!dest || !isMember(dest, req.userId)) return res.status(404).json({ error: 'target chat not found or access denied' });

  const msg = await Message.create({
    chatId: targetChatId,
    senderId: req.userId,
    type: src.type,
    text: src.text,
    media: src.media,
    forwardedFrom: src.senderId,
    readBy: [req.userId]
  });

  await Chat.updateOne(
    { _id: targetChatId },
    { $set: { lastMessage: previewFromMessage(msg), lastMessageAt: msg.createdAt } }
  );

  const io = req.app.get('io');
  io?.to(String(targetChatId)).emit('new_message', {
    id: msg._id, chatId: targetChatId, senderId: msg.senderId, type: msg.type,
    text: msg.text, media: msg.media, createdAt: msg.createdAt, forwardedFrom: msg.forwardedFrom
  });
  res.json({ id: msg._id });
};

// list media/doc messages for gallery
exports.listMedia = async (req, res) => {
  const { chatId } = req.params;
  const items = await Message.find({ chatId, type: { $in: ['image','video','file','audio'] }, isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .select('type media createdAt senderId');
  res.json(items);
};

// full-text search (optionally by chat)
exports.search = async (req, res) => {
  const { q, chatId } = req.query;
  if (!q) return res.json({ items: [] });
  const filter = { $text: { $search: q }, isDeleted: { $ne: true } };
  if (chatId && mongoose.isValidObjectId(chatId)) filter.chatId = chatId;
  const items = await Message.find(filter).sort({ createdAt: -1 }).limit(100)
    .select('chatId senderId text type media createdAt');
  res.json({ items });
};
