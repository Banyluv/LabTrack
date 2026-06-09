const express = require('express');
const { createRequest, getUserRequests, getAllRequests, approveRequest, rejectRequest } = require('../controllers/requestController');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// User requests their consumables
router.post('/', auth, createRequest);

// Get user's own requests
router.get('/my-requests', auth, getUserRequests);

// Admin gets all requests
router.get('/', auth, adminOnly, getAllRequests);

// Admin approves a request
router.put('/:request_id/approve', auth, adminOnly, approveRequest);

// Admin rejects a request
router.put('/:request_id/reject', auth, adminOnly, rejectRequest);

module.exports = router;
