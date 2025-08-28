const router = require('express').Router();
const c = require('../controllers/auth.controller');

router.get('/username-available', c.usernameAvailable);
router.post('/register', c.register);
router.post('/login', c.login);

module.exports = router;
