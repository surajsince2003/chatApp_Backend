const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/chats.controller');

router.post('/dm', auth, c.createDM);
router.get('/', auth, c.listMyChats);
router.get('/by-username/:username', auth, c.getOrCreateByUsername);

module.exports = router;
