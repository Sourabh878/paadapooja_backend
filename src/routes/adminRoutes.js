const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middlewares/authMiddleware');

router.get('/dashboard', authenticate, isAdmin, (req, res) => {
  res.json({
    message: 'Welcome Admin',
    adminId: req.user.id
  });
});

module.exports = router;
