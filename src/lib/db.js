const mongoose = require('mongoose');

async function connectMongo() {
  const uri = process.env.MONGO_URL;
  if (!uri) { console.error('[mongo] MONGO_URL missing'); process.exit(1); }
  console.log('[mongo] connecting...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('[mongo] connected');
}

module.exports = connectMongo;
