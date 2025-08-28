const { Schema, model, Types } = require('mongoose');

const ChatSchema = new Schema({
  members: [{ type: Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: null },
}, { timestamps: true });

ChatSchema.index({ members: 1 });

module.exports = model('Chat', ChatSchema);
