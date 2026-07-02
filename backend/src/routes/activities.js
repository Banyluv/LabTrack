const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { auth, adminOnly } = require('../middleware/auth');

// All activity routes require authentication
router.use(auth);

// Get paginated activity logs with filters
router.get('/', adminOnly, activityController.getActivityLogs);

// Get activity types summary
router.get('/types', adminOnly, activityController.getEntityTypes);

// Get all activities by entity type (no specific entity_id)
router.get('/:entity_type', activityController.getEntityTypeHistory);

// Get history for a specific entity
router.get('/:entity_type/:entity_id', activityController.getEntityHistory);

module.exports = router;
