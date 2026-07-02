const pool = require('../config/db');

exports.getActivityLogs = async (req, res) => {
  const { entity_type, entity_id, action, from, to, search, limit = 100, offset = 0 } = req.query;
  const { role, name } = req.user;

  let where = '1=1';
  const params = [];

  if (role === 'staff') {
    params.push(name);
    where += ` AND al.performed_by = $${params.length}`;
  }
  if (entity_type) {
    params.push(entity_type);
    where += ` AND al.entity_type = $${params.length}`;
  }
  if (entity_id) {
    params.push(parseInt(entity_id));
    where += ` AND al.entity_id = $${params.length}`;
  }
  if (action) {
    params.push(action);
    where += ` AND al.action = $${params.length}`;
  }
  if (from) {
    params.push(from);
    where += ` AND al.created_at >= $${params.length}::timestamp`;
  }
  if (to) {
    params.push(to);
    where += ` AND al.created_at <= $${params.length}::timestamp`;
  }
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (al.details ILIKE $${params.length} OR al.performed_by ILIKE $${params.length})`;
  }

  try {
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM activity_logs al WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated rows
    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    const { rows } = await pool.query(
      `SELECT al.* FROM activity_logs al WHERE ${where} ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );
    res.json({ logs: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEntityTypeHistory = async (req, res) => {
  const { entity_type } = req.params;
  const { role, name } = req.user;
  const { limit = 50, offset = 0 } = req.query;

  const params = [entity_type];
  let where = 'al.entity_type = $1';

  if (role === 'staff') {
    params.push(name);
    where += ` AND al.performed_by = $${params.length}`;
  }

  try {
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM activity_logs al WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated rows
    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    const { rows } = await pool.query(
      `SELECT al.* FROM activity_logs al WHERE ${where} ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );
    res.json({ logs: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEntityHistory = async (req, res) => {
  const { entity_type, entity_id } = req.params;
  const { role, name } = req.user;

  const params = [entity_type, parseInt(entity_id)];
  let where = 'al.entity_type = $1 AND al.entity_id = $2';

  if (role === 'staff') {
    params.push(name);
    where += ` AND al.performed_by = $${params.length}`;
  }

  try {
    const { rows } = await pool.query(
      `SELECT al.* FROM activity_logs al WHERE ${where} ORDER BY al.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEntityTypes = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT entity_type, COUNT(*) as count FROM activity_logs GROUP BY entity_type ORDER BY entity_type`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};