const router = require('express').Router();
const { transfer, getTransfers } = require('../controllers/stockTransferController');
const { auth } = require('../middleware/auth');

router.post('/', auth, transfer);
router.get('/', auth, getTransfers);

module.exports = router;