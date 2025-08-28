const multer = require('multer');
const { ObjectId } = require('mongodb');
const { getBucket } = require('../lib/gridfs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

exports.uploadMiddleware = upload.single('file');

exports.upload = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required (multipart/form-data, field "file")' });
  const bucket = getBucket();
  const filename = req.file.originalname || 'upload';
  const contentType = req.file.mimetype || 'application/octet-stream';

  const stream = bucket.openUploadStream(filename, { contentType, metadata: { uploader: req.userId, size: req.file.size } });
  stream.end(req.file.buffer, (err) => {
    if (err) return res.status(500).json({ error: 'upload failed', detail: String(err) });
    const id = String(stream.id);
    res.json({ id, publicUrl: `/media/file/${id}`, mime: contentType, size: req.file.size });
  });
};

exports.file = async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'invalid id' });

  const bucket = getBucket();
  const files = await bucket.find({ _id: new ObjectId(id) }).toArray();
  if (!files.length) return res.status(404).json({ error: 'file not found' });

  const file = files[0];
  if (file.contentType) res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Length', file.length);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  bucket.openDownloadStream(new ObjectId(id)).on('error', () => res.sendStatus(404)).pipe(res);
};

exports.info = async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'invalid id' });
  const files = await getBucket().find({ _id: new ObjectId(id) }).toArray();
  if (!files.length) return res.status(404).json({ error: 'file not found' });
  const f = files[0];
  res.json({ id: f._id, filename: f.filename, length: f.length, uploadDate: f.uploadDate, contentType: f.contentType, metadata: f.metadata });
};
