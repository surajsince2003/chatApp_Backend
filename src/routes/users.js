const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/users.controller');

router.get('/me', auth, c.me);
router.put('/me', auth, c.updateMe);
router.get('/:username', auth, c.byUsername);

module.exports = router;
