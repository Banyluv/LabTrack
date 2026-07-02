const pool = require('../config/db');

exports.getNotifications = async (req, res) => {
  const user_id = req.user.id;
  const { limit = 20, offset = 0 } = req.query;
  try {
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = $1',
      [user_id]
    );
    const total = parseInt(countResult.rows[0].total);

    const { rows } = await pool.query(
      `SELECT n.*, u.name as actor_name 
       FROM notifications n 
       LEFT JOIN users u ON (n.data->>'performed_by') = u.name
       WHERE n.user_id = $1 
       ORDER BY n.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [user_id, parseInt(limit), parseInt(offset)]
    );
    res.json({ notifications: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  const user_id = req.user.id;
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [user_id]
    );
    res.json({ unread_count: parseInt(rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  try {
    if (id === 'all') {
      await pool.query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
        [user_id]
      );
    } else {
      await pool.query(
        'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
        [id, user_id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteNotification = async (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};