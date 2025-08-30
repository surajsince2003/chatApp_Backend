const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/chats.controller');

router.post('/dm', auth, c.createDM);
router.get('/', auth, c.listMyChats);
router.get('/by-username/:username', auth, c.getOrCreateByUsername);

// pinned
router.post('/:chatId/pin', auth, c.pin);
router.post('/:chatId/unpin', auth, c.unpin);

module.exports = router;
