// replace your Message schema with this superset
const { Schema, model, Types } = require('mongoose');

const ReactionSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  emoji:  { type: String, required: true } // "👍", "❤️", etc.
}, { _id: false });

const MessageSchema = new Schema({
  chatId:   { type: Types.ObjectId, ref: 'Chat', required: true, index: true },
  senderId: { type: Types.ObjectId, ref: 'User', required: true, index: true },

  type: { type: String, enum: ['text','image','video','file','audio'], default: 'text' },
  text: { type: String, default: null },

  media: {
    url: String,
    mime: String,
    size: Number,
    width: Number,
    height: Number,
    filename: String // for docs
  },

  // delivery/reads
  deliveredTo: [{ type: Types.ObjectId, ref: 'User' }], // ✔✔ delivered
  readBy:      [{ type: Types.ObjectId, ref: 'User' }], // ✔✔ blue read

  // reactions
  reactions: [ReactionSchema],

  // reply/forward
  replyTo:      { type: Types.ObjectId, ref: 'Message', default: null },
  forwardedFrom:{ type: Types.ObjectId, ref: 'User', default: null },

  // edit/delete
  editedAt:  { type: Date, default: null },
  isDeleted: { type: Boolean, default: false },
  deletedFor:[{ type: Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

MessageSchema.index({ text: 'text' }); // full-text search

module.exports = model('Message', MessageSchema);
