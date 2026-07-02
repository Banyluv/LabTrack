const pool = require('../config/db');

/**
 * Send a targeted notification to a specific user
 * @param {object} params
 * @param {number} params.user_id - Target user ID
 * @param {string} params.type - e.g. 'request_approved', 'request_rejected', 'dispatch', 'stock_transfer', 'request_created'
 * @param {string} params.title - Short title for the notification
 * @param {string} [params.message] - Detailed message
 * @param {object} [params.data] - JSON payload with quantities, comments, etc.
 * @param {string} [params.link] - Frontend route to navigate to when clicked
 */
const sendNotification = async ({ user_id, type, title, message, data, link }) => {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, data, link)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_id, type, title, message || '', JSON.stringify(data || {}), link || '']
    );
  } catch (err) {
    console.error('[NotificationService] Failed to send notification:', err.message);
  }
};

/**
 * Get unread notification count for a user
 */
const getUnreadCount = async (user_id) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [user_id]
    );
    return parseInt(rows[0].count);
  } catch (err) {
    console.error('[NotificationService] Failed to get unread count:', err.message);
    return 0;
  }
};

module.exports = { sendNotification, getUnreadCount };