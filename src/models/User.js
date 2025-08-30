const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  username:   { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name:       { type: String, default: '' },
  email:      { type: String, default: '' },
  passwordHash: { type: String, required: true },
  avatarUrl:  { type: String, default: '' },

  // presence / privacy
  isOnline:   { type: Boolean, default: false },
  lastSeenAt: { type: Date, default: null },
  showLastSeen: { type: Boolean, default: true },

  // profile bio / status
  statusText: { type: String, default: '' },
}, { timestamps: true });

module.exports = model('User', UserSchema);
``