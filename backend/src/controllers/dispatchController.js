const pool = require('../config/db');

exports.dispatch = async (req, res) => {
  const { consumable_id, quantity, destination, dispatched_by, notes } = req.body;
  if (!consumable_id || !quantity || !destination || !dispatched_by) {
    return res.status(400).json({ error: 'consumable_id, quantity, destination, dispatched_by required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM consumables WHERE id=$1 FOR UPDATE', [consumable_id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Consumable not found' }); }
    if (rows[0].stock < quantity) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Insufficient stock. Available: ${rows[0].stock}` }); }
    await client.query('UPDATE consumables SET stock=stock-$1, updated_at=NOW() WHERE id=$2', [quantity, consumable_id]);
    const log = await client.query(
      'INSERT INTO dispatch_logs (consumable_id,quantity,destination,dispatched_by,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [consumable_id, quantity, destination, dispatched_by, notes || '']
    );
    await client.query('COMMIT');
    res.status(201).json({ log: log.rows[0], new_stock: rows[0].stock - quantity });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getLogs = async (req, res) => {
  const { from, to, consumable_id, destination } = req.query;
  let query = `
    SELECT dl.*, c.name as consumable_name, cat.name as category_name
    FROM dispatch_logs dl
    JOIN consumables c ON dl.consumable_id = c.id
    JOIN categories cat ON c.category_id = cat.id
    WHERE 1=1
  `;
  const params = [];
  if (from) { params.push(from); query += ` AND dl.dispatched_at >= $${params.length}`; }
  if (to) { params.push(to); query += ` AND dl.dispatched_at <= $${params.length}`; }
  if (consumable_id) { params.push(consumable_id); query += ` AND dl.consumable_id = $${params.length}`; }
  if (destination) { params.push(`%${destination}%`); query += ` AND dl.destination ILIKE $${params.length}`; }
  query += ' ORDER BY dl.dispatched_at DESC';
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
