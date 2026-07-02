const pool = require('../config/db');
const ExcelJS = require('exceljs');
const { logActivity } = require('../services/activityLogger');

exports.transfer = async (req, res) => {
  const { consumableId, fromFacilityId, toFacilityId, quantity, transferred_by, received_by, approved_by, notes } = req.body;
  const performedBy = req.user ? req.user.name : transferred_by;
  if (!consumableId || !fromFacilityId || !toFacilityId || !quantity || !transferred_by) {
    return res.status(400).json({ error: 'consumableId, fromFacilityId, toFacilityId, quantity, transferred_by required' });
  }
  if (fromFacilityId === toFacilityId) {
    return res.status(400).json({ error: 'Source and destination facilities must be different' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verify consumable exists and has enough stock
    const { rows: consumables } = await client.query('SELECT * FROM consumables WHERE id=$1 FOR UPDATE', [consumableId]);
    if (!consumables.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Consumable not found' }); }
    if (consumables[0].stock < quantity) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Insufficient stock. Available: ${consumables[0].stock}` }); }
    // Verify facilities exist and get names
    const { rows: fromFac } = await client.query('SELECT id, name FROM facilities WHERE id=$1', [fromFacilityId]);
    if (!fromFac.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Source facility not found' }); }
    const { rows: toFac } = await client.query('SELECT id, name FROM facilities WHERE id=$1', [toFacilityId]);
    if (!toFac.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Destination facility not found' }); }
    // Deduct from source facility stock (we track overall stock for now)
    await client.query('UPDATE consumables SET stock=stock-$1, updated_at=NOW() WHERE id=$2', [quantity, consumableId]);
    // Record transfer
    const log = await client.query(
      `INSERT INTO stock_transfers (consumable_id, from_facility_id, to_facility_id, quantity, transferred_by, received_by, approved_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [consumableId, fromFacilityId, toFacilityId, quantity, transferred_by, received_by || '', approved_by || '', notes || '']
    );
    await client.query('COMMIT');

    // Log activity
    logActivity({
      entity_type: 'stock_transfer',
      entity_id: log.rows[0].id,
      action: 'transferred',
      details: `${consumables[0].name} (${quantity} units) transferred from ${fromFac[0].name} to ${toFac[0].name}`,
      changes: {
        consumable_id: consumableId,
        consumable_name: consumables[0].name,
        from_facility: fromFac[0].name,
        to_facility: toFac[0].name,
        quantity,
        previous_stock: consumables[0].stock,
        new_stock: consumables[0].stock - quantity,
        notes: notes || ''
      },
      performed_by: performedBy,
    });

    res.status(201).json({ transfer: log.rows[0], new_stock: consumables[0].stock - quantity });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getTransfers = async (req, res) => {
  const { from, to, consumable_id } = req.query;
  let query = `
    SELECT st.*, c.name as consumable_name, f1.name as from_facility, f2.name as to_facility
    FROM stock_transfers st
    JOIN consumables c ON st.consumable_id = c.id
    JOIN facilities f1 ON st.from_facility_id = f1.id
    JOIN facilities f2 ON st.to_facility_id = f2.id
    WHERE 1=1
  `;
  const params = [];
  if (from) { params.push(from); query += ` AND st.transferred_at >= $${params.length}`; }
  if (to) { params.push(to); query += ` AND st.transferred_at <= $${params.length}`; }
  if (consumable_id) { params.push(consumable_id); query += ` AND st.consumable_id = $${params.length}`; }
  query += ' ORDER BY st.transferred_at DESC';
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};