const pool = require('../config/db');

exports.getAll = async (req, res) => {
  const { category, search, status } = req.query;
  const { role, facility_name } = req.user;
  const isStaff = role === 'staff' && facility_name;

  if (isStaff) {
    // Staff: show facility-level stock computed from dispatch_logs
    let query = `
      SELECT c.id, c.name, c.category_id, cat.name as category_name, c.unit, c.description,
             COALESCE(fs.facility_stock, 0) as stock,
             c.reorder_quantity, c.price
      FROM consumables c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN (
        SELECT consumable_id, SUM(quantity) as facility_stock
        FROM dispatch_logs
        WHERE destination = $1
        GROUP BY consumable_id
      ) fs ON fs.consumable_id = c.id
      WHERE COALESCE(fs.facility_stock, 0) > 0
    `;
    const params = [facility_name];
    if (category) { params.push(category); query += ` AND cat.name = $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND c.name ILIKE $${params.length}`; }
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
  let query = `
    SELECT c.*, cat.name as category_name
    FROM consumables c
    LEFT JOIN categories cat ON c.category_id = cat.id
  `;
  const params = [];
  query += ` WHERE 1=1`;
  if (category) { params.push(category); query += ` AND cat.name = $${params.length}`; }
  if (search) { params.push(`%${search}%`); query += ` AND c.name ILIKE $${params.length}`; }
  if (status === 'low') query += ` AND c.stock > 0 AND c.stock <= c.reorder_quantity`;
  if (status === 'out') query += ` AND c.stock = 0`;
  if (status === 'ok') query += ` AND c.stock > c.reorder_quantity`;
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
                c.reorder_quantity, c.price
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
  const { name, category_id, unit, stock, reorder_quantity, price, description } = req.body;
  if (!name || !category_id || !unit) return res.status(400).json({ error: 'name, category_id, unit required' });
  const st = typeof stock === 'number' ? stock : parseInt(stock) || 0;
  const rq = typeof reorder_quantity === 'number' ? reorder_quantity : parseInt(reorder_quantity) || 0;
  if (st > 0 && rq > 0 && rq >= st) return res.status(400).json({ error: 'Reorder quantity must be less than current stock' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO consumables (name,category_id,unit,stock,reorder_quantity,price,description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [name, category_id, unit, st, rq, price || 0, description || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { name, category_id, unit, reorder_quantity, price, description } = req.body;
  try {
    // Fetch current stock to validate reorder_quantity
    const cur = await pool.query('SELECT stock FROM consumables WHERE id=$1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Not found' });
    const currentStock = cur.rows[0].stock;
    const rq = typeof reorder_quantity === 'number' ? reorder_quantity : (reorder_quantity !== undefined ? parseInt(reorder_quantity) : undefined);
    if (currentStock > 0 && rq !== undefined && !isNaN(rq) && rq >= currentStock) {
      return res.status(400).json({ error: 'Reorder quantity must be less than current stock' });
    }
    const { rows } = await pool.query(
      `UPDATE consumables SET name=COALESCE($1,name), category_id=COALESCE($2,category_id),
       unit=COALESCE($3,unit), reorder_quantity=COALESCE($4,reorder_quantity), price=COALESCE($5,price),
       description=COALESCE($6,description), updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, category_id, unit, rq, price, description, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await pool.query('DELETE FROM consumables WHERE id=$1', [req.params.id]);
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
  try {
    const total = await pool.query('SELECT COUNT(*) FROM consumables');
    const low = await pool.query('SELECT COUNT(*) FROM consumables WHERE stock > 0 AND stock <= reorder_quantity');
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