const pool = require('../config/db');
const ExcelJS = require('exceljs');
const { logActivity } = require('../services/activityLogger');

exports.dispatch = async (req, res) => {
  const { consumable_id, quantity, destination, dispatched_by, notes, issued_quantity, returned_quantity, receiving_officer } = req.body;
  const performedBy = req.user ? req.user.name : dispatched_by;
  if (!consumable_id || !quantity || !destination || !dispatched_by) {
    return res.status(400).json({ error: 'consumable_id, quantity, destination, dispatched_by required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM consumables WHERE id=$1 FOR UPDATE', [consumable_id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Consumable not found' }); }
    if (rows[0].stock < quantity) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Insufficient stock. Available: ${rows[0].stock}` }); }
    const prevStock = rows[0].stock;
    const consumableName = rows[0].name;
    await client.query('UPDATE consumables SET stock=stock-$1, updated_at=NOW() WHERE id=$2', [quantity, consumable_id]);
    const issQty = parseInt(issued_quantity) || quantity;
    const retQty = parseInt(returned_quantity) || 0;
    const log = await client.query(
      'INSERT INTO dispatch_logs (consumable_id,quantity,destination,dispatched_by,notes,issued_quantity,returned_quantity,receiving_officer) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [consumable_id, quantity, destination, dispatched_by, notes || '', issQty, retQty, receiving_officer || '']
    );
    await client.query('COMMIT');

    logActivity({
      entity_type: 'dispatch',
      entity_id: log.rows[0].id,
      action: 'dispatched',
      details: `${consumableName} (${quantity} units, issued: ${issQty}) dispatched to ${destination}${receiving_officer ? ' received by ' + receiving_officer : ''}`,
      changes: {
        consumable_id,
        consumable_name: consumableName,
        quantity,
        issued_quantity: issQty,
        returned_quantity: retQty,
        destination,
        previous_stock: prevStock,
        new_stock: prevStock - quantity,
        notes: notes || '',
        receiving_officer: receiving_officer || ''
      },
      performed_by: performedBy,
    });

    res.status(201).json({ log: log.rows[0], new_stock: prevStock - quantity });
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

exports.exportExcel = async (req, res) => {
  const { from, to, destination } = req.query;
  let query = `
    SELECT dl.id, dl.dispatched_at, c.name as consumable_name, cat.name as category_name,
           dl.quantity, dl.destination, dl.dispatched_by, dl.issued_quantity, dl.returned_quantity, dl.receiving_officer, dl.notes
    FROM dispatch_logs dl
    JOIN consumables c ON dl.consumable_id = c.id
    JOIN categories cat ON c.category_id = cat.id
    WHERE 1=1
  `;
  const params = [];
  if (from) { params.push(from); query += ` AND dl.dispatched_at >= $${params.length}`; }
  if (to) { params.push(to); query += ` AND dl.dispatched_at <= $${params.length}`; }
  if (destination) { params.push(`%${destination}%`); query += ` AND dl.destination ILIKE $${params.length}`; }
  query += ' ORDER BY dl.dispatched_at DESC';

  try {
    const { rows } = await pool.query(query, params);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Dispatch Logs');
    ws.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Dispatched At', key: 'dispatched_at', width: 22 },
      { header: 'Consumable', key: 'consumable_name', width: 28 },
      { header: 'Category', key: 'category_name', width: 20 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Destination', key: 'destination', width: 24 },
      { header: 'Dispatched By', key: 'dispatched_by', width: 18 },
      { header: 'Issued Qty', key: 'issued_quantity', width: 14 },
      { header: 'Returned Qty', key: 'returned_quantity', width: 14 },
      { header: 'Receiving Officer', key: 'receiving_officer', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((row) => ws.addRow({
      ...row,
      dispatched_at: row.dispatched_at ? new Date(row.dispatched_at).toLocaleString() : '',
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=dispatch-logs.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
