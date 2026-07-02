const pool = require('../config/db');

/**
 * Log an activity to the activity_logs table
 * @param {object} params
 * @param {string} params.entity_type - e.g. 'stock_transfer', 'procurement', 'dispatch', 'receive', 'request', 'consumable'
 * @param {number} params.entity_id - The ID of the entity being acted upon
 * @param {string} params.action - e.g. 'created', 'updated', 'deleted', 'approved', 'rejected', 'transferred', 'dispatched', 'received', 'status_changed'
 * @param {string} [params.details] - Human-readable summary
 * @param {object} [params.changes] - JSON object describing before/after changes
 * @param {string} params.performed_by - Name of the user who performed the action
 */
const logActivity = async ({ entity_type, entity_id, action, details, changes, performed_by }) => {
  try {
    await pool.query(
      `INSERT INTO activity_logs (entity_type, entity_id, action, details, changes, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entity_type, entity_id, action, details || '', JSON.stringify(changes || {}), performed_by]
    );
  } catch (err) {
    console.error('[ActivityLogger] Failed to log activity:', err.message);
  }
};

module.exports = { logActivity };