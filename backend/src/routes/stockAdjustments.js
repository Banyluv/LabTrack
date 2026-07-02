const { Router } = require('express');
const { create, getAll } = require('../controllers/stockAdjustmentController');
const { auth, adminOnly } = require('../middleware/auth');

const router = Router();
router.get('/', auth, getAll);
router.post('/', auth, adminOnly, create);

module.exports = router;