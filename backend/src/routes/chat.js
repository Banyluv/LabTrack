const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

router.use(auth);
router.post('/', chatController.askQuestion);

module.exports = router;
