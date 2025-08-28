const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let bucket = null;
function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Mongo not connected');
  if (!bucket) bucket = new GridFSBucket(db, { bucketName: 'uploads' });
  return bucket;
}
module.exports = { getBucket };
