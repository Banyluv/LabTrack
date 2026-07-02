const pool = require('../config/db');
const ExcelJS = require('exceljs');
const { logActivity } = require('../services/activityLogger');

exports.createOrder = async (req, res) => {
  const { supplierId, items, notes } = req.body;
  const performedBy = req.user ? req.user.name : 'System';
  if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'supplierId and items (array) are required' });
  }
  for (const item of items) {
    if (!item.consumableId || !item.quantity) {
      return res.status(400).json({ error: 'Each item must have consumableId and quantity' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify supplier exists
    const { rows: suppRes } = await client.query('SELECT * FROM suppliers WHERE id=$1', [supplierId]);
    if (!suppRes.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Supplier not found' });
    }
    const supplierName = suppRes[0].name;

    // Create procurement order
    const order = await client.query(
      `INSERT INTO procurement_orders (supplier_id, status, notes)
       VALUES ($1, 'pending', $2) RETURNING *`,
      [supplierId, notes || '']
    );
    const orderId = order.rows[0].id;

    // Insert all order items
    const consumableNames = [];
    for (const item of items) {
      const { rows: consRes } = await client.query('SELECT * FROM consumables WHERE id=$1 FOR UPDATE', [item.consumableId]);
      if (!consRes.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Consumable with id ${item.consumableId} not found` });
      }
      consumableNames.push(consRes[0].name);

      await client.query(
        `INSERT INTO procurement_order_items (order_id, consumable_id, quantity, cost)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.consumableId, item.quantity, item.cost || 0]
      );
    }

    await client.query('COMMIT');

    const itemDetails = items.map((it, idx) =>
      `${consumableNames[idx]} (${it.quantity} units)`
    ).join(', ');

    logActivity({
      entity_type: 'procurement',
      entity_id: orderId,
      action: 'created',
      details: `Purchase order #${orderId} created with ${items.length} item(s): ${itemDetails} from ${supplierName}`,
      changes: {
        supplier: supplierName,
        items: items.map((it, idx) => ({
          consumable: consumableNames[idx],
          consumable_id: it.consumableId,
          quantity: it.quantity,
          cost: it.cost || 0,
        })),
        status: 'pending',
        notes: notes || '',
      },
      performed_by: performedBy,
    });

    // Return order with items
    const { rows: fullOrder } = await client.query(`
      SELECT po.*, s.name as supplier_name,
        (SELECT json_agg(json_build_object(
          'id', poi.id,
          'consumable_id', poi.consumable_id,
          'consumable_name', c2.name,
          'quantity', poi.quantity,
          'cost', poi.cost
        )) FROM procurement_order_items poi
        JOIN consumables c2 ON poi.consumable_id = c2.id
        WHERE poi.order_id = po.id) as items
      FROM procurement_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = $1
    `, [orderId]);

    res.status(201).json(fullOrder.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT po.*, s.name as supplier_name,
        (SELECT json_agg(json_build_object(
          'id', poi.id,
          'consumable_id', poi.consumable_id,
          'consumable_name', c2.name,
          'quantity', poi.quantity,
          'cost', poi.cost
        )) FROM procurement_order_items poi
        JOIN consumables c2 ON poi.consumable_id = c2.id
        WHERE poi.order_id = po.id) as items
      FROM procurement_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const performedBy = req.user ? req.user.name : 'System';
  if (!['pending', 'ordered', 'received', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be pending, ordered, received, or cancelled' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get order with items
    const { rows } = await client.query(
      `SELECT po.*, s.name as supplier_name,
        (SELECT json_agg(json_build_object(
          'id', poi.id,
          'consumable_id', poi.consumable_id,
          'consumable_name', c2.name,
          'quantity', poi.quantity,
          'cost', poi.cost
        ) ORDER BY poi.id) FROM procurement_order_items poi
        JOIN consumables c2 ON poi.consumable_id = c2.id
        WHERE poi.order_id = po.id) as items
      FROM procurement_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = $1 FOR UPDATE`,
      [id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }

    const order = rows[0];
    const oldStatus = order.status;
    const orderItems = order.items || [];

    // Track previous stock for activity log
    const stockSnapshots = {};
    for (const item of orderItems) {
      const { rows: cons } = await client.query('SELECT stock FROM consumables WHERE id=$1', [item.consumable_id]);
      stockSnapshots[item.consumable_id] = cons[0]?.stock || 0;
    }

    // Update stock when receiving
    if (status === 'received' && order.status !== 'received') {
      for (const item of orderItems) {
        await client.query('UPDATE consumables SET stock=stock+$1, updated_at=NOW() WHERE id=$2',
          [item.quantity, item.consumable_id]);
      }
    }
    // Revert stock if un-receiving
    if (status !== 'received' && order.status === 'received') {
      for (const item of orderItems) {
        const { rows: cons } = await client.query('SELECT stock FROM consumables WHERE id=$1', [item.consumable_id]);
        if (cons.length && cons[0].stock >= item.quantity) {
          await client.query('UPDATE consumables SET stock=stock-$1, updated_at=NOW() WHERE id=$2',
            [item.quantity, item.consumable_id]);
        }
      }
    }

    const updated = await client.query(
      'UPDATE procurement_orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, id]
    );
    await client.query('COMMIT');

    const itemDetails = orderItems.map(it =>
      `${it.consumable_name}: ${it.quantity} units (prev stock: ${stockSnapshots[it.consumable_id] || 0})`
    ).join('; ');

    logActivity({
      entity_type: 'procurement',
      entity_id: id,
      action: 'status_changed',
      details: `Purchase order #${id} status changed from '${oldStatus}' to '${status}'. Items: ${itemDetails}`,
      changes: {
        supplier: order.supplier_name,
        items: orderItems.map(it => ({
          consumable: it.consumable_name,
          consumable_id: it.consumable_id,
          quantity: it.quantity,
          previous_stock: stockSnapshots[it.consumable_id] || 0,
          new_stock: status === 'received' && oldStatus !== 'received'
            ? (stockSnapshots[it.consumable_id] || 0) + it.quantity
            : (stockSnapshots[it.consumable_id] || 0),
        })),
        previous_status: oldStatus,
        new_status: status,
      },
      performed_by: performedBy,
    });

    // Return updated order with items
    const { rows: fullOrder } = await client.query(`
      SELECT po.*, s.name as supplier_name,
        (SELECT json_agg(json_build_object(
          'id', poi.id,
          'consumable_id', poi.consumable_id,
          'consumable_name', c2.name,
          'quantity', poi.quantity,
          'cost', poi.cost
        ) ORDER BY poi.id) FROM procurement_order_items poi
        JOIN consumables c2 ON poi.consumable_id = c2.id
        WHERE poi.order_id = po.id) as items
      FROM procurement_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = $1
    `, [id]);

    res.json(fullOrder.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT po.id, po.created_at, s.name as supplier_name, po.status, po.notes, po.updated_at
      FROM procurement_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC
    `);

    // Get all items
    const orderIds = rows.map(r => r.id);
    let itemsMap = {};
    if (orderIds.length > 0) {
      const { rows: allItems } = await pool.query(`
        SELECT poi.order_id, poi.consumable_id, c.name as consumable_name, poi.quantity, poi.cost
        FROM procurement_order_items poi
        JOIN consumables c ON poi.consumable_id = c.id
        WHERE poi.order_id = ANY($1)
        ORDER BY poi.order_id, poi.id
      `, [orderIds]);
      for (const item of allItems) {
        if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
        itemsMap[item.order_id].push(item);
      }
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Procurement Orders');
    ws.columns = [
      { header: 'Order ID', key: 'id', width: 10 },
      { header: 'Created At', key: 'created_at', width: 22 },
      { header: 'Supplier', key: 'supplier_name', width: 22 },
      { header: 'Items', key: 'items', width: 50 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Updated At', key: 'updated_at', width: 22 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((row) => {
      const items = itemsMap[row.id] || [];
      const itemsStr = items.map(it =>
        `${it.consumable_name} (Qty: ${it.quantity}, Cost: ₦${(it.cost || 0).toLocaleString()})`
      ).join(' | ');
      ws.addRow({
        ...row,
        items: itemsStr || '—',
        created_at: row.created_at ? new Date(row.created_at).toLocaleString() : '',
        updated_at: row.updated_at ? new Date(row.updated_at).toLocaleString() : '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=procurement-orders.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};