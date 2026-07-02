const pool = require('../config/db');
const ExcelJS = require('exceljs');
const { logActivity } = require('../services/activityLogger');

exports.receive = async (req, res) => {
  const { consumable_id, quantity, supplier, received_by, invoice_ref, batch_no, expiry_date, ordered_by, approved_by, grn, damaged_quantity, returned_quantity } = req.body;
  const performedBy = req.user ? req.user.name : received_by;
  if (!consumable_id || !quantity || !received_by) {
    return res.status(400).json({ error: 'consumable_id, quantity, received_by required' });
  }
  const facility_name = req.user ? req.user.facility_name || '' : '';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM consumables WHERE id=$1 FOR UPDATE', [consumable_id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Consumable not found' }); }
    const prevStock = rows[0].stock;
    const consumableName = rows[0].name;
    const netQty = Math.max(0, parseInt(quantity) - (parseInt(damaged_quantity) || 0) - (parseInt(returned_quantity) || 0));
    await client.query('UPDATE consumables SET stock=stock+$1, updated_at=NOW() WHERE id=$2', [netQty, consumable_id]);
    const log = await client.query(
      'INSERT INTO receive_logs (consumable_id,quantity,supplier,received_by,invoice_ref,facility_name,batch_no,expiry_date,ordered_by,approved_by,grn,damaged_quantity,returned_quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
      [consumable_id, quantity, supplier || '', received_by, invoice_ref || '', facility_name, batch_no || '', expiry_date || null, ordered_by || '', approved_by || '', grn || '', parseInt(damaged_quantity) || 0, parseInt(returned_quantity) || 0]
    );
    await client.query('COMMIT');

    logActivity({
      entity_type: 'receive',
      entity_id: log.rows[0].id,
      action: 'received',
      details: `${consumableName} (${quantity} units, net ${netQty}) received${supplier ? ' from ' + supplier : ''}${facility_name ? ' at ' + facility_name : ''}${grn ? ' GRN: ' + grn : ''}`,
      changes: {
        consumable_id,
        consumable_name: consumableName,
        quantity,
        net_quantity: netQty,
        supplier: supplier || '',
        previous_stock: prevStock,
        new_stock: prevStock + netQty,
        invoice_ref: invoice_ref || '',
        batch_no: batch_no || '',
        facility_name,
        grn: grn || '',
        ordered_by: ordered_by || '',
        approved_by: approved_by || '',
        damaged_quantity: parseInt(damaged_quantity) || 0,
        returned_quantity: parseInt(returned_quantity) || 0
      },
      performed_by: performedBy,
    });

    res.status(201).json({ log: log.rows[0], new_stock: prevStock + netQty });
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

exports.exportExcel = async (req, res) => {
  const { from, to } = req.query;
  let query = `
    SELECT rl.id, rl.received_at, c.name as consumable_name, cat.name as category_name,
           rl.quantity, rl.supplier, rl.received_by, rl.batch_no, rl.expiry_date,
           rl.invoice_ref, rl.damaged_quantity, rl.returned_quantity, rl.grn,
           rl.ordered_by, rl.approved_by, rl.facility_name
    FROM receive_logs rl
    JOIN consumables c ON rl.consumable_id = c.id
    JOIN categories cat ON c.category_id = cat.id
    WHERE 1=1
  `;
  const params = [];
  if (from) { params.push(from); query += ` AND rl.received_at >= $${params.length}`; }
  if (to) { params.push(to); query += ` AND rl.received_at <= $${params.length}`; }
  query += ' ORDER BY rl.received_at DESC';

  try {
    const { rows } = await pool.query(query, params);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Receive Logs');
    ws.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Received At', key: 'received_at', width: 22 },
      { header: 'Consumable', key: 'consumable_name', width: 28 },
      { header: 'Category', key: 'category_name', width: 20 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Supplier', key: 'supplier', width: 18 },
      { header: 'Received By', key: 'received_by', width: 18 },
      { header: 'Batch No.', key: 'batch_no', width: 16 },
      { header: 'Expiry Date', key: 'expiry_date', width: 16 },
      { header: 'Invoice Ref', key: 'invoice_ref', width: 18 },
      { header: 'Damaged Qty', key: 'damaged_quantity', width: 14 },
      { header: 'Returned Qty', key: 'returned_quantity', width: 14 },
      { header: 'GRN', key: 'grn', width: 16 },
      { header: 'Ordered By', key: 'ordered_by', width: 18 },
      { header: 'Approved By', key: 'approved_by', width: 18 },
      { header: 'Facility', key: 'facility_name', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((row) => ws.addRow({
      ...row,
      received_at: row.received_at ? new Date(row.received_at).toLocaleString() : '',
      expiry_date: row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : '',
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=receive-logs.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
