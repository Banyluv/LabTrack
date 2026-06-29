const pool = require('../config/db');

exports.createRequest = async (req, res) => {
  const { consumable_id, quantity, notes } = req.body;
  const user_id = req.user.id;
  const requested_by = req.user.name;
  
  if (!consumable_id || !quantity) {
    return res.status(400).json({ error: 'Consumable ID and quantity are required' });
  }
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO consumable_requests (consumable_id, user_id, quantity, status, requested_by, notes)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING *`,
      [consumable_id, user_id, quantity, requested_by, notes || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserRequests = async (req, res) => {
  const user_id = req.user.id;
  
  try {
    const { rows } = await pool.query(
      `SELECT cr.*, 
              c.name as consumable_name, 
              c.unit,
              c.stock as current_stock
       FROM consumable_requests cr
       JOIN consumables c ON cr.consumable_id = c.id
       WHERE cr.user_id = $1
       ORDER BY cr.created_at DESC`,
      [user_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cr.*, 
              c.name as consumable_name, 
              c.unit, 
              c.stock as consumable_stock, 
              u.name as user_name, 
              u.email as user_email, 
              u.facility_name as user_facility
       FROM consumable_requests cr
       JOIN consumables c ON cr.consumable_id = c.id
       JOIN users u ON cr.user_id = u.id
       ORDER BY cr.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.approveRequest = async (req, res) => {
  const { request_id } = req.params;
  const { notes, approved_quantity, admin_comment } = req.body; // Added admin_comment
  const approved_by = req.user.name;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get the request
    const { rows: requests } = await client.query(
      'SELECT * FROM consumable_requests WHERE id = $1 FOR UPDATE',
      [request_id]
    );
    
    if (!requests.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const request = requests[0];
    
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }
    
    // Determine quantity to approve
    const qty = approved_quantity !== undefined ? parseInt(approved_quantity) : request.quantity;
    if (isNaN(qty) || qty <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Approved quantity must be a positive number' });
    }
    
    // Check current stock
    const { rows: consumables } = await client.query(
      'SELECT stock, name FROM consumables WHERE id = $1 FOR UPDATE',
      [request.consumable_id]
    );
    
    if (!consumables.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Consumable not found' });
    }
    
    const consumable = consumables[0];
    
    if (consumable.stock < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Insufficient stock. Requested: ${qty}, Available: ${consumable.stock}` 
      });
    }
    
    // Deduct stock
    await client.query(
      'UPDATE consumables SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
      [qty, request.consumable_id]
    );
    
    // Create dispatch log
    const { rows: users } = await client.query(
      'SELECT facility_name FROM users WHERE id = $1',
      [request.user_id]
    );
    const destination = users.length > 0 ? users[0].facility_name || 'Facility' : 'Facility';
    
    await client.query(
      `INSERT INTO dispatch_logs (consumable_id, quantity, destination, dispatched_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [request.consumable_id, qty, destination, approved_by, notes || '']
    );
    
    // Update request with approved quantity, admin comment, and status
    const { rows } = await client.query(
      `UPDATE consumable_requests 
       SET status = 'approved', 
           approved_by = $1, 
           approved_quantity = $2, 
           notes = $3,
           admin_comment = $4,  -- Store admin's comment/reason
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [approved_by, qty, notes || '', admin_comment || '', request_id]
    );
    
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.rejectRequest = async (req, res) => {
  const { request_id } = req.params;
  const { notes, admin_comment } = req.body; // Added admin_comment
  const approved_by = req.user.name;
  
  try {
    const { rows } = await pool.query(
      `UPDATE consumable_requests 
       SET status = 'rejected', 
           approved_by = $1, 
           notes = $2,
           admin_comment = $3,  -- Store admin's comment/reason
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [approved_by, notes || '', admin_comment || '', request_id]
    );
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};