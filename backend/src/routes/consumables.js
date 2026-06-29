const router = require('express').Router();
const ctrl = require('../controllers/consumableController');
const importCtrl = require('../controllers/importController');
const exportCtrl = require('../controllers/exportController');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { file.mimetype === 'text/csv' || file.originalname.endsWith('.csv') ? cb(null, true) : cb(new Error('Only CSV files allowed')); } });

router.get('/categories', auth, ctrl.getCategories);
router.get('/dashboard', auth, ctrl.getDashboardStats);
router.get('/export', auth, exportCtrl.exportInventory);
router.post('/import', auth, upload.single('file'), importCtrl.importCSV);
router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.post('/', auth, ctrl.create);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.delete);

module.exports = router;
