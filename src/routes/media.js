const router = require('express').Router();
const multer = require('multer');
const { ObjectId } = require('mongodb');
const auth = require('../middleware/auth');
const { getBucket } = require('../lib/gridfs');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB cap (tune as needed)
});

// POST /media/upload  (multipart/form-data, field name: file)
// returns: { id, publicUrl, mime, size }
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required (multipart/form-data, field "file")' });

    const bucket = getBucket();
    const filename = req.file.originalname || 'upload';
    const contentType = req.file.mimetype || 'application/octet-stream';

    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata: {
        uploader: req.userId,
        size: req.file.size
      }
    });

    uploadStream.end(req.file.buffer, async (err) => {
      if (err) return res.status(500).json({ error: 'upload failed', detail: String(err) });

      // uploadStream.id is a Mongo ObjectId
      const id = uploadStream.id.toString();
      const publicUrl = `/media/file/${id}`;
      res.json({ id, publicUrl, mime: contentType, size: req.file.size });
    });
  } catch (e) {
    res.status(500).json({ error: 'upload exception', detail: String(e?.message || e) });
  }
});

// GET /media/file/:id  -> streams the file
router.get('/file/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'invalid id' });

    const bucket = getBucket();
    const _id = new ObjectId(id);

    // Get file info first to set headers
    const files = await bucket.find({ _id }).toArray();
    if (!files.length) return res.status(404).json({ error: 'file not found' });

    const file = files[0];
    if (file.contentType) res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const stream = bucket.openDownloadStream(_id);
    stream.on('error', () => res.sendStatus(404));
    stream.pipe(res);
  } catch (e) {
    res.status(500).json({ error: 'stream error', detail: String(e?.message || e) });
  }
});

// (optional) GET /media/info/:id  -> returns file metadata only
router.get('/info/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'invalid id' });

    const bucket = getBucket();
    const files = await bucket.find({ _id: new ObjectId(id) }).toArray();
    if (!files.length) return res.status(404).json({ error: 'file not found' });

    const file = files[0];
    res.json({
      id: file._id,
      filename: file.filename,
      length: file.length,
      uploadDate: file.uploadDate,
      contentType: file.contentType,
      metadata: file.metadata
    });
  } catch (e) {
    res.status(500).json({ error: 'info error', detail: String(e?.message || e) });
  }
});

module.exports = router;
