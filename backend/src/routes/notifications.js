const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.use(auth);

router.get('/', ctrl.getNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.put('/:id/read', ctrl.markAsRead);
router.put('/read-all', (req, res) => {
  req.params.id = 'all';
  ctrl.markAsRead(req, res);
});
router.delete('/:id', ctrl.deleteNotification);

module.exports = router;