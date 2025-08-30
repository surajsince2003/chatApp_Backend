const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/messages.controller');

router.get('/:chatId', auth, c.list);
router.post('/:chatId', auth, c.send);

// delivery / read
router.post('/:chatId/delivered', auth, c.markDelivered);
router.post('/:chatId/read', auth, c.markRead);

// edit/delete
router.put('/item/:messageId', auth, c.edit);
router.delete('/item/:messageId', auth, c.remove);

// reactions
router.post('/item/:messageId/react', auth, c.react);

// forward
router.post('/item/:messageId/forward', auth, c.forward);

// gallery + search
router.get('/:chatId/media', auth, c.listMedia);
router.get('/search/all', auth, c.search);

module.exports = router;
