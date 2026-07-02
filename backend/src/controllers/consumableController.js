const pool = require('../config/db');
const { logActivity } = require('../services/activityLogger');

exports.getAll = async (req, res) => {
  const { category, search, status, history_date, all } = req.query;
  const { role, facility_name } = req.user;
  const isStaff = role === 'staff' && facility_name;

  // Build WHERE clauses for optional category + search filters (reusable in both branches)
  const buildFilters = (paramsArr, afterDateIdx) => {
    let clauses = '';
    if (category) { paramsArr.push(category); clauses += ` AND cat.name = ${afterDateIdx + 1}`; afterDateIdx++; }
    if (search) { paramsArr.push(`%${search}%`); clauses += ` AND c.name ILIKE ${afterDateIdx + 1}`; afterDateIdx++; }
    return clauses;
  };

  // If ?all=true, show all consumables regardless of role (for request dropdown)
  if (all === 'true') {
    const params = [];
    let query = `
      SELECT c.id, c.name, c.category_id, cat.name as category_name, c.unit, c.description,
             c.stock, c.reorder_quantity, c.price, c.sku, c.min_stock, c.max_stock, c.safety_stock,
             c.emergency_order_point, c.monthly_consumption, c.avg_consumption, c.daily_usage, c.mos
       FROM consumables c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE 1=1
    `;
    query += buildFilters(params, 0);
    query += ' ORDER BY cat.name, c.name';
    try {
      const { rows } = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (isStaff) {
    // Staff: show stock from their own received logs
    const userName = req.user.name;
    const params = [userName];
    let query = '';
    if (history_date) {
      params.push(history_date);
      query = `
        SELECT c.id, c.name, c.category_id, cat.name as category_name, c.unit, c.description,
               COALESCE(rs.user_stock, 0) as stock,
               c.reorder_quantity, c.price, c.sku, c.min_stock, c.max_stock, c.safety_stock,
               c.emergency_order_point, c.monthly_consumption, c.avg_consumption, c.daily_usage, c.mos
        FROM consumables c
        LEFT JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN (
          SELECT consumable_id, SUM(quantity) as user_stock
          FROM receive_logs
          WHERE received_by = $1 AND received_at <= $2::timestamp
          GROUP BY consumable_id
        ) rs ON rs.consumable_id = c.id
        WHERE COALESCE(rs.user_stock, 0) > 0
      `;
    } else {
      query = `
        SELECT c.id, c.name, c.category_id, cat.name as category_name, c.unit, c.description,
               COALESCE(rs.user_stock, 0) as stock,
               c.reorder_quantity, c.price, c.sku, c.min_stock, c.max_stock, c.safety_stock,
               c.emergency_order_point, c.monthly_consumption, c.avg_consumption, c.daily_usage, c.mos
        FROM consumables c
        LEFT JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN (
          SELECT consumable_id, SUM(quantity) as user_stock
          FROM receive_logs
          WHERE received_by = $1
          GROUP BY consumable_id
        ) rs ON rs.consumable_id = c.id
        WHERE COALESCE(rs.user_stock, 0) > 0
      `;
    }
    query += buildFilters(params, params.length);
    query += ' ORDER BY cat.name, c.name';
    try {
      const { rows } = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // Admin: show central warehouse stock
  const params = [];
  let selectStock;
  if (history_date) {
    // Compute stock as-of history_date:
    // stock_on_date = current_stock + dispatches_after_date - receives_after_date
    params.push(history_date);
    selectStock = `
      SELECT c.*, cat.name as category_name,
             GREATEST(0, c.stock
               + COALESCE(d.disp_after, 0)
               - COALESCE(r.recv_after, 0)) as stock
      FROM consumables c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN (
        SELECT consumable_id, SUM(quantity) as disp_after
        FROM dispatch_logs
        WHERE dispatched_at > $1::timestamp
        GROUP BY consumable_id
      ) d ON d.consumable_id = c.id
      LEFT JOIN (
        SELECT consumable_id, SUM(quantity) as recv_after
        FROM receive_logs
        WHERE received_at > $1::timestamp
        GROUP BY consumable_id
      ) r ON r.consumable_id = c.id
    `;
  } else {
    selectStock = `
      SELECT c.*, cat.name as category_name
      FROM consumables c
      LEFT JOIN categories cat ON c.category_id = cat.id
    `;
  }
  let query = selectStock;
  query += ` WHERE 1=1`;
  query += buildFilters(params, history_date ? 1 : 0);
  const stockExpr = `GREATEST(0, c.stock${history_date ? ' + COALESCE(d.disp_after, 0) - COALESCE(r.recv_after, 0)' : ''})`;
  if (status === 'out') query += ` AND ${stockExpr} = 0`;
  if (status === 'emergency') query += ` AND ${stockExpr} > 0 AND c.emergency_order_point > 0 AND ${stockExpr} <= c.emergency_order_point`;
  if (status === 'safety') query += ` AND ${stockExpr} > 0 AND c.safety_stock > 0 AND ${stockExpr} <= c.safety_stock AND (c.emergency_order_point IS NULL OR c.emergency_order_point <= 0 OR ${stockExpr} > c.emergency_order_point)`;
  if (status === 'low') query += ` AND ${stockExpr} > 0 AND COALESCE(c.min_stock, 0) > 0 AND ${stockExpr} < c.min_stock AND (c.safety_stock IS NULL OR c.safety_stock <= 0 OR ${stockExpr} > c.safety_stock)`;
  if (status === 'ok') query += ` AND ${stockExpr} > 0 AND (c.min_stock IS NULL OR c.min_stock <= 0 OR ${stockExpr} >= c.min_stock) AND (c.safety_stock IS NULL OR c.safety_stock <= 0 OR ${stockExpr} > c.safety_stock) AND (c.emergency_order_point IS NULL OR c.emergency_order_point <= 0 OR ${stockExpr} > c.emergency_order_point)`;
  query += ' ORDER BY cat.name, c.name';
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  const { role, facility_name } = req.user;
  const isStaff = role === 'staff' && facility_name;

  if (isStaff) {
    try {
      const { rows } = await pool.query(
        `SELECT c.id, c.name, c.category_id, cat.name as category_name, c.unit, c.description,
                COALESCE(fs.facility_stock, 0) as stock,
                c.reorder_quantity, c.price, c.sku, c.min_stock, c.max_stock, c.safety_stock,
                c.emergency_order_point, c.monthly_consumption, c.avg_consumption, c.daily_usage, c.mos
         FROM consumables c
         LEFT JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN (
           SELECT consumable_id, SUM(quantity) as facility_stock
           FROM dispatch_logs
           WHERE destination = $1
           GROUP BY consumable_id
         ) fs ON fs.consumable_id = c.id
         WHERE c.id = $2`,
        [facility_name, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.json(rows[0]);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    const { rows } = await pool.query(
      'SELECT c.*, cat.name as category_name FROM consumables c LEFT JOIN categories cat ON c.category_id=cat.id WHERE c.id=$1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { name, category_id, unit, stock, reorder_quantity, price, description, batch_no, expiry_date, sku, min_stock, max_stock, safety_stock, emergency_order_point, monthly_consumption, avg_consumption, daily_usage, mos } = req.body;
  const performedBy = req.user ? req.user.name : 'System';
  if (!name || !category_id || !unit) return res.status(400).json({ error: 'name, category_id, unit required' });
  const st = typeof stock === 'number' ? stock : parseInt(stock) || 0;
  const rq = typeof reorder_quantity === 'number' ? reorder_quantity : parseInt(reorder_quantity) || 0;
  if (st > 0 && rq > 0 && rq >= st) return res.status(400).json({ error: 'Reorder quantity must be less than current stock' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO consumables (name,category_id,unit,stock,reorder_quantity,price,description,batch_no,expiry_date,sku,min_stock,max_stock,safety_stock,emergency_order_point,monthly_consumption,avg_consumption,daily_usage,mos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [name, category_id, unit, st, rq, price || 0, description || '', batch_no || '', expiry_date || null, sku || '', min_stock || 0, max_stock || 0, safety_stock || 0, emergency_order_point || 0, monthly_consumption || 0, avg_consumption || 0, daily_usage || 0, mos || 0]
    );

    logActivity({
      entity_type: 'consumable',
      entity_id: rows[0].id,
      action: 'created',
      details: `Consumable '${name}' added with initial stock of ${st} ${unit}`,
      changes: {
        name,
        category_id,
        unit,
        initial_stock: st,
        reorder_quantity: rq,
        price: price || 0
      },
      performed_by: performedBy,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { name, category_id, unit, reorder_quantity, price, description, batch_no, expiry_date, sku, min_stock, max_stock, safety_stock, emergency_order_point, monthly_consumption, avg_consumption, daily_usage, mos } = req.body;
  const performedBy = req.user ? req.user.name : 'System';
  try {
    const cur = await pool.query('SELECT * FROM consumables WHERE id=$1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Not found' });
    const oldData = cur.rows[0];
    const currentStock = oldData.stock;
    const rq = typeof reorder_quantity === 'number' ? reorder_quantity : (reorder_quantity !== undefined ? parseInt(reorder_quantity) : undefined);
    if (currentStock > 0 && rq !== undefined && !isNaN(rq) && rq >= currentStock) {
      return res.status(400).json({ error: 'Reorder quantity must be less than current stock' });
    }
    const { rows } = await pool.query(
      `UPDATE consumables SET name=COALESCE($1,name), category_id=COALESCE($2,category_id),
       unit=COALESCE($3,unit), reorder_quantity=COALESCE($4,reorder_quantity), price=COALESCE($5,price),
       description=COALESCE($6,description), batch_no=COALESCE($8,batch_no), expiry_date=COALESCE($9,expiry_date),
       sku=COALESCE($10,sku), min_stock=COALESCE($11,min_stock), max_stock=COALESCE($12,max_stock),
       safety_stock=COALESCE($13,safety_stock), emergency_order_point=COALESCE($14,emergency_order_point),
       monthly_consumption=COALESCE($15,monthly_consumption), avg_consumption=COALESCE($16,avg_consumption),
       daily_usage=COALESCE($17,daily_usage), mos=COALESCE($18,mos), updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, category_id, unit, rq, price, description, req.params.id, batch_no, expiry_date, sku, min_stock, max_stock, safety_stock, emergency_order_point, monthly_consumption, avg_consumption, daily_usage, mos]
    );

    logActivity({
      entity_type: 'consumable',
      entity_id: parseInt(req.params.id),
      action: 'updated',
      details: `Consumable '${rows[0].name}' updated`,
      changes: {
        before: { name: oldData.name, category_id: oldData.category_id, unit: oldData.unit, price: oldData.price, reorder_quantity: oldData.reorder_quantity },
        after: { name: rows[0].name, category_id: rows[0].category_id, unit: rows[0].unit, price: rows[0].price, reorder_quantity: rows[0].reorder_quantity }
      },
      performed_by: performedBy,
    });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  const performedBy = req.user ? req.user.name : 'System';
  try {
    const { rows: existing } = await pool.query('SELECT name, unit FROM consumables WHERE id=$1', [req.params.id]);
    const consName = existing[0]?.name || 'Unknown';
    await pool.query('DELETE FROM consumables WHERE id=$1', [req.params.id]);

    logActivity({
      entity_type: 'consumable',
      entity_id: parseInt(req.params.id),
      action: 'deleted',
      details: `Consumable '${consName}' deleted`,
      changes: {},
      performed_by: performedBy,
    });

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addCategory = async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  const { role, name, facility_name } = req.user;
  const isStaff = role === 'staff' && facility_name;
  try {
    if (isStaff) {
      const userName = name;
      // Staff: stats from own received stock, mirroring inventory query
      const stats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE COALESCE(rs.user_stock, 0) >= 10) as ok,
          COUNT(*) FILTER (WHERE COALESCE(rs.user_stock, 0) > 0 AND COALESCE(rs.user_stock, 0) < 10) as low,
          COUNT(*) FILTER (WHERE COALESCE(rs.user_stock, 0) = 0) as out
        FROM consumables c
        LEFT JOIN (
          SELECT consumable_id, SUM(quantity) as user_stock
          FROM receive_logs
          WHERE received_by = $1
          GROUP BY consumable_id
        ) rs ON rs.consumable_id = c.id
        WHERE COALESCE(rs.user_stock, 0) > 0
      `, [userName]);
      const row = stats.rows[0];
      return res.json({
        total: parseInt(row.total),
        low: parseInt(row.low),
        out: parseInt(row.out),
        ok: parseInt(row.ok),
        dispatched_today: 0,
        total_dispatched: 0,
        total_received: 0,
        recent_dispatches: [],
      });
    }

    // Admin: warehouse-level stats
    const total = await pool.query('SELECT COUNT(*) FROM consumables');
    const low = await pool.query('SELECT COUNT(*) FROM consumables WHERE stock > 0 AND stock < 10');
    const out = await pool.query('SELECT COUNT(*) FROM consumables WHERE stock = 0');
    const today = await pool.query(`SELECT COALESCE(SUM(quantity),0) as total FROM dispatch_logs WHERE dispatched_at::date = CURRENT_DATE`);
    const allDisp = await pool.query('SELECT COALESCE(SUM(quantity),0) as total FROM dispatch_logs');
    const allRecv = await pool.query('SELECT COALESCE(SUM(quantity),0) as total FROM receive_logs');
    const recentDisp = await pool.query(`
      SELECT dl.*, c.name as consumable_name, cat.name as category_name
      FROM dispatch_logs dl
      JOIN consumables c ON dl.consumable_id = c.id
      JOIN categories cat ON c.category_id = cat.id
      ORDER BY dl.dispatched_at DESC LIMIT 5
    `);
    res.json({
      total: parseInt(total.rows[0].count),
      low: parseInt(low.rows[0].count),
      out: parseInt(out.rows[0].count),
      ok: parseInt(total.rows[0].count) - parseInt(low.rows[0].count) - parseInt(out.rows[0].count),
      dispatched_today: parseInt(today.rows[0].total),
      total_dispatched: parseInt(allDisp.rows[0].total),
      total_received: parseInt(allRecv.rows[0].total),
      recent_dispatches: recentDisp.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
