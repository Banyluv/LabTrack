const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/login', ctrl.login);
router.post('/register', ctrl.register);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.get('/me', auth, ctrl.me);
router.put('/profile', auth, ctrl.updateProfile);
router.put('/change-password', auth, ctrl.changePassword);
router.get('/users', auth, ctrl.listUsers);
router.put('/users/:id/toggle-status', auth, ctrl.toggleUserStatus);
router.put('/users/:id/toggle-status', auth, ctrl.toggleUserStatus);

module.exports = router;
