const router = require('express').Router();
const ctrl = require('../controllers/consumableController');
const { auth } = require('../middleware/auth');

router.get('/categories', auth, ctrl.getCategories);
router.get('/dashboard', auth, ctrl.getDashboardStats);
router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.post('/', auth, ctrl.create);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.delete);

module.exports = router;
