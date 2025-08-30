require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');


const connectMongo = require('./lib/db');
const initSocket = require('./realtime/socket');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const mediaRoutes = require('./routes/media');

const app = express();
const server = http.createServer(app);
const io = initSocket(server);
app.set('io', io);

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/', (_, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/chats', chatRoutes);
app.use('/messages', messageRoutes);
app.use('/media', mediaRoutes);



const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.send("Backend is live 🚀");
});

(async () => {
  await connectMongo();

})();
