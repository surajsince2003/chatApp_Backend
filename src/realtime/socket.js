// src/realtime/socket.js
const { Server } = require('socket.io');
const { verifyToken } = require('../lib/jwt');
const User = require('../models/User');

module.exports = function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: true, credentials: false },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('missing token'));
      const payload = verifyToken(token);
      socket.userId = payload.sub;
      next();
    } catch (e) {
      console.error('[SOCKET] auth failed:', e.message);
      next(new Error('invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log('[SOCKET] connected', { sid: socket.id, userId: socket.userId });
    socket.join(String(socket.userId));
    await User.updateOne({ _id: socket.userId }, { $set: { isOnline: true, lastSeenAt: new Date() } });

    socket.on('join', (chatId) => {
      console.log('[SOCKET] join room', { sid: socket.id, chatId });
      socket.join(String(chatId));
    });

    socket.on('typing', (p) => {
      console.log('[SOCKET] typing', p);
      if (p?.chatId) io.to(String(p.chatId)).emit('typing', {
        chatId: String(p.chatId), userId: socket.userId, typing: !!p.typing
      });
    });

    socket.on('disconnect', async (reason) => {
      console.log('[SOCKET] disconnected', { sid: socket.id, reason });
      await User.updateOne({ _id: socket.userId }, { $set: { isOnline: false, lastSeenAt: new Date() } });
    });
  });

  return io;
};
