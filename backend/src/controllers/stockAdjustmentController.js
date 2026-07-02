const pool = require('../config/db');
const { logActivity } = require('../services/activityLogger');

exports.create = async (req, res) => {
  const { consumable_id, quantity, reason, adjustment_type } = req.body;
  const performedBy = req.user ? req.user.name : 'System';
  if (!consumable_id || !quantity || !adjustment_type) {
    return res.status(400).json({ error: 'consumable_id, quantity, adjustment_type required' });
  }
  const adjTypes = ['loss', 'expired', 'damaged', 'positive_adjustment_from', 'negative_adjustment_to'];
  if (!adjTypes.includes(adjustment_type)) {
    return res.status(400).json({ error: `Invalid adjustment_type. Must be one of: ${adjTypes.join(', ')}` });
  }
  const stockIncreaseTypes = ['positive_adjustment_from'];
  const qty = Math.abs(parseInt(quantity));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM consumables WHERE id=$1 FOR UPDATE', [consumable_id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Consumable not found' }); }
    const prevStock = rows[0].stock;
    const consumableName = rows[0].name;
    const newStock = stockIncreaseTypes.includes(adjustment_type) ? prevStock + qty : prevStock - qty;
    if (newStock < 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Adjustment would result in negative stock' }); }
    await client.query('UPDATE consumables SET stock=$1, updated_at=NOW() WHERE id=$2', [newStock, consumable_id]);
    const log = await client.query(
      `INSERT INTO stock_adjustments (consumable_id, quantity, adjustment_type, reason, previous_stock, new_stock, performed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [consumable_id, qty, adjustment_type, reason || '', prevStock, newStock, performedBy]
    );
    await client.query('COMMIT');

    logActivity({
      entity_type: 'stock_adjustment',
      entity_id: log.rows[0].id,
      action: 'adjusted',
      details: `${consumableName} stock ${adjustment_type} of ${qty} units (${prevStock} → ${newStock})${reason ? ': ' + reason : ''}`,
      changes: {
        consumable_id,
        consumable_name: consumableName,
        quantity: qty,
        adjustment_type,
        reason: reason || '',
        previous_stock: prevStock,
        new_stock: newStock
      },
      performed_by: performedBy,
    });

    res.status(201).json({ adjustment: log.rows[0], new_stock: newStock });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getAll = async (req, res) => {
  const { from, to, consumable_id, type } = req.query;
  let query = `
    SELECT sa.*, c.name as consumable_name, cat.name as category_name, c.unit
    FROM stock_adjustments sa
    JOIN consumables c ON sa.consumable_id = c.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE 1=1
  `;
  const params = [];
  if (from) { params.push(from); query += ` AND sa.created_at >= $${params.length}`; }
  if (to) { params.push(to); query += ` AND sa.created_at <= $${params.length}`; }
  if (consumable_id) { params.push(consumable_id); query += ` AND sa.consumable_id = $${params.length}`; }
  if (type) { params.push(type); query += ` AND sa.adjustment_type = $${params.length}`; }
  query += ' ORDER BY sa.created_at DESC LIMIT 200';
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};