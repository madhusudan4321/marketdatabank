const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getProfile, getDashboard } = require('../controllers/userController');

router.get('/me', auth, getProfile);
router.get('/dashboard', auth, getDashboard);

module.exports = router;
