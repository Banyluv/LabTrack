const router = require('express').Router();
const { logUsage, getLogs, getTodaySummary, deleteLog } = require('../controllers/dailyUsageController');
const { auth } = require('../middleware/auth');

router.post('/', auth, logUsage);
router.get('/', auth, getLogs);
router.get('/today', auth, getTodaySummary);
router.delete('/:id', auth, deleteLog);

module.exports = router;