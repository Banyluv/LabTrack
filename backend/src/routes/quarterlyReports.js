const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ctrl = require('../controllers/quarterlyReportController');
const { auth } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

router.get('/', auth, ctrl.listReports);
router.get('/:id', auth, ctrl.getReport);
router.post('/import', auth, upload.single('excelFile'), ctrl.importReport);

module.exports = router;
