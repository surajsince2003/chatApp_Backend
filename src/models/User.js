const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  lastSeenAt: { type: Date, default: null },
  isOnline: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model('User', UserSchema);
