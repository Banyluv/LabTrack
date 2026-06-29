const pool = require('../config/db');

exports.receive = async (req, res) => {
  const { consumable_id, quantity, supplier, received_by, invoice_ref, batch_no, expiry_date } = req.body;
  if (!consumable_id || !quantity || !received_by) {
    return res.status(400).json({ error: 'consumable_id, quantity, received_by required' });
  }
  const facility_name = req.user.facility_name || '';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM consumables WHERE id=$1 FOR UPDATE', [consumable_id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Consumable not found' }); }
    await client.query('UPDATE consumables SET stock=stock+$1, updated_at=NOW() WHERE id=$2', [quantity, consumable_id]);
    const log = await client.query(
      'INSERT INTO receive_logs (consumable_id,quantity,supplier,received_by,invoice_ref,facility_name,batch_no,expiry_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [consumable_id, quantity, supplier || '', received_by, invoice_ref || '', facility_name, batch_no || '', expiry_date || null]
    );
    await client.query('COMMIT');
    res.status(201).json({ log: log.rows[0], new_stock: rows[0].stock + quantity });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getLogs = async (req, res) => {
  const { from, to } = req.query;
  const { role, name } = req.user;
  const isStaff = role === 'staff';
  let query = `
    SELECT rl.*, c.name as consumable_name, cat.name as category_name
    FROM receive_logs rl
    JOIN consumables c ON rl.consumable_id = c.id
    JOIN categories cat ON c.category_id = cat.id
    WHERE 1=1
  `;
  const params = [];
  if (isStaff) { params.push(name); query += ` AND rl.received_by = $${params.length}`; }
  if (from) { params.push(from); query += ` AND rl.received_at >= $${params.length}`; }
  if (to) { params.push(to); query += ` AND rl.received_at <= $${params.length}`; }
  query += ' ORDER BY rl.received_at DESC';
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
