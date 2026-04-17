const express = require('express');
const router = express.Router();
const { registerDevotee, loginUser } = require('../controllers/authController');

router.post('/register', registerDevotee);
router.post('/login', loginUser);

module.exports = router;
