const pool = require('../config/db');
const { sendApprovedEmail, sendRejectedEmail } = require('../services/emailService');
const { logActivity } = require('../services/activityLogger');
const { sendNotification } = require('../services/notificationService');

exports.createRequest = async (req, res) => {
  const { consumable_id, quantity, notes, requesting_officer } = req.body;
  const user_id = req.user.id;
  const requested_by = req.user.name;
  const performedBy = req.user.name;
  
  if (!consumable_id || !quantity) {
    return res.status(400).json({ error: 'Consumable ID and quantity are required' });
  }
  
  try {
    // Get consumable name first
    const { rows: cons } = await pool.query('SELECT name, unit FROM consumables WHERE id=$1', [consumable_id]);
    const consumableName = cons[0]?.name || 'Unknown';

    const { rows } = await pool.query(
      `INSERT INTO consumable_requests (consumable_id, user_id, quantity, status, requested_by, notes, requesting_officer)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6)
       RETURNING *`,
      [consumable_id, user_id, quantity, requested_by, notes || '', requesting_officer || '']
    );

    logActivity({
      entity_type: 'request',
      entity_id: rows[0].id,
      action: 'created',
      details: `Request created for ${consumableName} (${quantity} ${cons[0]?.unit || 'units'}) by ${requested_by}`,
      changes: {
        consumable: consumableName,
        quantity,
        status: 'pending',
        notes: notes || ''
      },
      performed_by: performedBy,
    });

    // Notify all admin users about the new request
    try {
      const { rows: admins } = await pool.query(
        "SELECT id FROM users WHERE LOWER(role) IN ('admin', 'super_admin')"
      );
      for (const admin of admins) {
        sendNotification({
          user_id: admin.id,
          type: 'request_created',
          title: 'New Consumable Request',
          message: `${requested_by} requested ${quantity} ${cons[0]?.unit || 'units'} of ${consumableName}`,
          data: { request_id: rows[0].id, consumable: consumableName, quantity, unit: cons[0]?.unit, requested_by: requested_by, performed_by: performedBy },
          link: '/dashboard/approve-requests',
        });
      }
    } catch (notifErr) {
      console.error('[Notification] Failed to notify admins:', notifErr.message);
    }

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
              c.stock as current_stock,
              c.min_stock,
              c.max_stock,
              c.safety_stock,
              c.emergency_order_point,
              c.monthly_consumption,
              c.avg_consumption,
              c.sku,
              c.category_id,
              c.reorder_quantity
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
              c.min_stock,
              c.max_stock,
              c.safety_stock,
              c.emergency_order_point,
              c.monthly_consumption,
              c.avg_consumption,
              c.sku,
              c.reorder_quantity,
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
  const { notes, approved_quantity, admin_comment } = req.body;
  const approved_by = req.user.name;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get the request along with user info for email
    const { rows: requests } = await client.query(
      `SELECT cr.*, u.email as user_email, u.name as user_name, u.facility_name as user_facility
       FROM consumable_requests cr
       JOIN users u ON cr.user_id = u.id
       WHERE cr.id = $1
       FOR UPDATE OF cr`,
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
    
    // Check current stock and get consumable name/unit
    const { rows: consumables } = await client.query(
      'SELECT stock, name, unit FROM consumables WHERE id = $1 FOR UPDATE',
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
    const destination = request.user_facility || 'Facility';
    
    await client.query(
      `INSERT INTO dispatch_logs (consumable_id, quantity, destination, dispatched_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [request.consumable_id, qty, destination, approved_by, notes || '']
    );
    
    // Update request with approved quantity, admin comment, and status
    // Preserve original staff notes; append admin notes if provided
    const finalNotes = notes 
      ? (request.notes ? request.notes + ' | [Admin]: ' + notes : '[Admin]: ' + notes)
      : request.notes;
    
    const { rows } = await client.query(
      `UPDATE consumable_requests 
       SET status = 'approved', 
           approved_by = $1, 
           approved_quantity = $2, 
           notes = $3,
           admin_comment = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [approved_by, qty, finalNotes, admin_comment || '', request_id]
    );
    
    await client.query('COMMIT');

    logActivity({
      entity_type: 'request',
      entity_id: parseInt(request_id),
      action: 'approved',
      details: `Request #${request_id} for ${consumable.name} approved: ${qty} ${consumable.unit} dispatched to ${destination}`,
      changes: {
        consumable: consumable.name,
        requested_quantity: request.quantity,
        approved_quantity: qty,
        previous_status: 'pending',
        new_status: 'approved',
        previous_stock: consumable.stock,
        new_stock: consumable.stock - qty,
        destination,
        admin_comment: admin_comment || ''
      },
      performed_by: approved_by,
    });
    
    // Send email notification to staff (fire-and-forget)
    if (request.user_email) {
      sendApprovedEmail({
        email: request.user_email,
        name: request.user_name || request.requested_by,
        consumableName: consumable.name,
        quantity: request.quantity,
        unit: consumable.unit,
        approvedQuantity: qty,
        adminComment: admin_comment || '',
        requestId: request_id,
      }).catch(err => console.error('[Email] Approved email failed:', err.message));
    }

    // Send in-app notification to the requester
    try {
      sendNotification({
        user_id: request.user_id,
        type: 'request_approved',
        title: 'Request Approved',
        message: `Your request for ${request.quantity} ${consumable.unit} of ${consumable.name} has been approved. ${qty} ${consumable.unit} dispatched.${admin_comment ? ' Reason: ' + admin_comment : ''}`,
        data: {
          request_id: parseInt(request_id),
          consumable: consumable.name,
          quantity_requested: request.quantity,
          quantity_approved: qty,
          unit: consumable.unit,
          admin_comment: admin_comment || '',
          performed_by: approved_by,
        },
        link: '/dashboard/requests',
      });
    } catch (notifErr) {
      console.error('[Notification] Failed to notify requester:', notifErr.message);
    }
    
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
  const { notes, admin_comment } = req.body;
  const approved_by = req.user.name;
  
  try {
    // Get request with user info for email
    const { rows: existingRows } = await pool.query(
      `SELECT cr.*, c.name as consumable_name, c.unit, u.email as user_email, u.name as user_name
       FROM consumable_requests cr
       JOIN consumables c ON cr.consumable_id = c.id
       JOIN users u ON cr.user_id = u.id
       WHERE cr.id = $1`,
      [request_id]
    );
    
    if (!existingRows.length) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const existing = existingRows[0];
    
    // Preserve original staff notes; append admin notes if provided
    const originalNotes = existing.notes || '';
    const finalNotes = notes 
      ? (originalNotes ? originalNotes + ' | [Admin]: ' + notes : '[Admin]: ' + notes)
      : originalNotes;
    
    const { rows } = await pool.query(
      `UPDATE consumable_requests 
       SET status = 'rejected', 
           approved_by = $1, 
           notes = $2,
           admin_comment = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [approved_by, finalNotes, admin_comment || '', request_id]
    );

    logActivity({
      entity_type: 'request',
      entity_id: parseInt(request_id),
      action: 'rejected',
      details: `Request #${request_id} for ${existing.consumable_name} (${existing.quantity} ${existing.unit}) rejected`,
      changes: {
        consumable: existing.consumable_name,
        quantity: existing.quantity,
        previous_status: 'pending',
        new_status: 'rejected',
        admin_comment: admin_comment || ''
      },
      performed_by: approved_by,
    });
    
    // Send email notification to staff (fire-and-forget)
    if (existing.user_email) {
      sendRejectedEmail({
        email: existing.user_email,
        name: existing.user_name || existing.requested_by,
        consumableName: existing.consumable_name,
        quantity: existing.quantity,
        unit: existing.unit,
        adminComment: admin_comment || '',
        requestId: request_id,
      }).catch(err => console.error('[Email] Rejected email failed:', err.message));
    }

    // Send in-app notification to the requester
    try {
      sendNotification({
        user_id: existing.user_id,
        type: 'request_rejected',
        title: 'Request Rejected',
        message: `Your request for ${existing.quantity} ${existing.unit} of ${existing.consumable_name} was rejected.${admin_comment ? ' Reason: ' + admin_comment : ''}`,
        data: {
          request_id: parseInt(request_id),
          consumable: existing.consumable_name,
          quantity_requested: existing.quantity,
          unit: existing.unit,
          admin_comment: admin_comment || '',
          performed_by: approved_by,
        },
        link: '/dashboard/requests',
      });
    } catch (notifErr) {
      console.error('[Notification] Failed to notify requester:', notifErr.message);
    }
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};