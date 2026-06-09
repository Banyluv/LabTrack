const router = require('express').Router();
const dispatch = require('../controllers/dispatchController');
const receive = require('../controllers/receiveController');
const report = require('../controllers/reportController');
const hierarchical = require('../controllers/hierarchicalReportController');
const { auth } = require('../middleware/auth');

router.post('/dispatch', auth, dispatch.dispatch);
router.get('/dispatch', auth, dispatch.getLogs);
router.post('/receive', auth, receive.receive);
router.get('/receive', auth, receive.getLogs);
router.get('/reports', auth, report.getReport);
router.get('/reports/export', auth, report.exportExcel);
router.get('/reports/hierarchical', auth, hierarchical.getHierarchicalReport);
router.get('/reports/calendar', auth, hierarchical.getCalendarData);

module.exports = router;
