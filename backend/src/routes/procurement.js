const router = require('express').Router();
const { createOrder, getOrders, updateOrderStatus, exportExcel } = require('../controllers/procurementController');
const { auth } = require('../middleware/auth');

router.post('/', auth, createOrder);
router.get('/export', auth, exportExcel);
router.get('/', auth, getOrders);
router.put('/:id', auth, updateOrderStatus);

module.exports = router;