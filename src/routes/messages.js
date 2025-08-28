const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/messages.controller');

router.get('/:chatId', auth, c.list);
router.post('/:chatId', auth, c.send);
router.post('/:chatId/read', auth, c.markRead);

module.exports = router;
