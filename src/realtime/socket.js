// src/realtime/socket.js
const { Server } = require('socket.io');
const { verifyToken } = require('../lib/jwt');

module.exports = function initSocket(server) {
  const io = new Server(server, { cors: { origin: true, credentials: false } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('missing token'));
      const payload = verifyToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // 👇 join a personal room so we can nudge the sidebar
    socket.join(String(socket.userId));

    socket.on('join', (chatId) => socket.join(String(chatId)));
    socket.on('typing', (p) => {
      if (p?.chatId) socket.to(String(p.chatId)).emit('typing', {
        chatId: String(p.chatId), userId: socket.userId, typing: !!p.typing
      });
    });
  });

  return io;
};
