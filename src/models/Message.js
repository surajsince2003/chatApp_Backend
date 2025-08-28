const { Schema, model, Types } = require('mongoose');

const MessageSchema = new Schema({
  chatId: { type: Types.ObjectId, ref: 'Chat', required: true, index: true },
  senderId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['text', 'image', 'video', 'file'], default: 'text' },
  text: { type: String, default: null },
  media: {
    url: String,
    mime: String,
    size: Number,
    width: Number,
    height: Number
  },
  readBy: [{ type: Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = model('Message', MessageSchema);
