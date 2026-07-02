const pool = require('../config/db');
const { logActivity } = require('../services/activityLogger');

// Log daily usage of a consumable (deducts stock)
exports.logUsage = async (req, res) => {
  const { consumable_id, quantity, used_by, notes, batch_no, expiry_date } = req.body;
  if (!consumable_id || !quantity || !used_by) {
    return res.status(400).json({ error: 'consumable_id, quantity, used_by are required' });
  }
  if (quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM consumables WHERE id=$1 FOR UPDATE', [consumable_id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Consumable not found' });
    }
    if (rows[0].stock < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient stock. Available: ${rows[0].stock}` });
    }

    const prevStock = rows[0].stock;
    const consumableName = rows[0].name;

    await client.query('UPDATE consumables SET stock=stock-$1, updated_at=NOW() WHERE id=$2', [quantity, consumable_id]);

    const usageDate = req.body.usage_date || new Date().toISOString().slice(0, 10);

    const log = await client.query(
      `INSERT INTO daily_usage_logs (consumable_id, quantity, used_by, notes, batch_no, expiry_date, usage_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [consumable_id, quantity, used_by, notes || '', batch_no || '', expiry_date || null, usageDate]
    );

    await client.query('COMMIT');

    logActivity({
      entity_type: 'daily_usage',
      entity_id: log.rows[0].id,
      action: 'logged',
      details: `${consumableName}: ${quantity} units used by ${used_by} on ${usageDate}`,
      changes: {
        consumable_id,
        consumable_name: consumableName,
        quantity,
        used_by,
        usage_date: usageDate,
        previous_stock: prevStock,
        new_stock: prevStock - quantity,
        notes: notes || '',
      },
      performed_by: req.user ? req.user.name : used_by,
    });

    res.status(201).json({ log: log.rows[0], new_stock: prevStock - quantity });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// Get all usage logs with optional filters
exports.getLogs = async (req, res) => {
  const { from, to, consumable_id, used_by, limit } = req.query;
  let query = `
    SELECT dul.*, c.name as consumable_name, cat.name as category_name, u.name as unit_name
    FROM daily_usage_logs dul
    JOIN consumables c ON dul.consumable_id = c.id
    JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN units u ON c.unit = u.name
    WHERE 1=1
  `;
  const params = [];

  if (from) { params.push(from); query += ` AND dul.usage_date >= $${params.length}`; }
  if (to) { params.push(to); query += ` AND dul.usage_date <= $${params.length}`; }
  if (consumable_id) { params.push(parseInt(consumable_id)); query += ` AND dul.consumable_id = $${params.length}`; }
  if (used_by) { params.push(`%${used_by}%`); query += ` AND dul.used_by ILIKE $${params.length}`; }

  query += ' ORDER BY dul.usage_date DESC, dul.created_at DESC';

  if (limit) {
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
  }

  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get today's usage summary
exports.getTodaySummary = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) as total_entries,
        COALESCE(SUM(dul.quantity), 0) as total_units_used,
        COUNT(DISTINCT dul.consumable_id) as unique_items,
        COUNT(DISTINCT dul.used_by) as unique_users,
        json_agg(json_build_object(
          'id', dul.id,
          'consumable_name', c.name,
          'category_name', cat.name,
          'unit', u.name,
          'quantity', dul.quantity,
          'used_by', dul.used_by,
          'notes', dul.notes,
          'batch_no', dul.batch_no,
          'expiry_date', dul.expiry_date,
          'usage_date', dul.usage_date,
          'created_at', dul.created_at
        ) ORDER BY dul.created_at DESC) as entries
      FROM daily_usage_logs dul
      JOIN consumables c ON dul.consumable_id = c.id
      JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN units u ON c.unit = u.name
      WHERE dul.usage_date = CURRENT_DATE
    `);

    const summary = rows[0] || { total_entries: 0, total_units_used: 0, unique_items: 0, unique_users: 0, entries: [] };
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a usage log entry (restores stock)
exports.deleteLog = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM daily_usage_logs WHERE id=$1 FOR UPDATE', [id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usage log not found' });
    }

    const log = rows[0];

    // Restore stock
    await client.query('UPDATE consumables SET stock=stock+$1, updated_at=NOW() WHERE id=$2', [log.quantity, log.consumable_id]);

    await client.query('DELETE FROM daily_usage_logs WHERE id=$1', [id]);

    await client.query('COMMIT');

    res.json({ message: 'Usage log deleted and stock restored', restored_quantity: log.quantity });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};