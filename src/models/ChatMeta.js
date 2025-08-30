// src/models/ChatMeta.js
const { Schema, model, Types } = require('mongoose');

const ChatMetaSchema = new Schema({
  chatId:   { type: Types.ObjectId, ref: 'Chat', index: true, required: true },
  userId:   { type: Types.ObjectId, ref: 'User', index: true, required: true },
  pinned:   { type: Boolean, default: false },
  muted:    { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  lastReadAt: { type: Date, default: null }
}, { timestamps: true });

ChatMetaSchema.index({ chatId: 1, userId: 1 }, { unique: true });

module.exports = model('ChatMeta', ChatMetaSchema);
