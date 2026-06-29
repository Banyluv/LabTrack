const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool = require('../config/db');

// Configure nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE name = $1', [username]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name, facility_name: user.facility_name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, facility_name: user.facility_name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.register = async (req, res) => {
  const { name, email, password, role, facility_name, state, lga } = req.body;
  const userEmail = email || `${(name || facility_name || 'user').toLowerCase().replace(/\s+/g, '.')}@labtrack.local`;
  if (!name || !password) return res.status(400).json({ error: 'Name and password are required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, role, facility_name, state, lga) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,role,facility_name,state,lga',
      [name, userEmail, hash, role || 'staff', facility_name || '', state || '', lga || '']
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,name,email,role,facility_name,state,lga,created_at FROM users WHERE id=$1', [req.user.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { name, email, facility_name, state, lga } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), facility_name = COALESCE($3, facility_name), state = COALESCE($4, state), lga = COALESCE($5, lga) WHERE id = $6 RETURNING id, name, email, role, facility_name, state, lga',
      [name || null, email || null, facility_name || null, state || null, lga || null, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Profile updated', user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const { rows } = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, email, role, facility_name, state, lga, status, created_at FROM users ORDER BY name");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE users SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END WHERE id = $1 RETURNING id, name, email, role, status",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE users SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END WHERE id = $1 RETURNING id, name, email, role, status",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    
    // Generate reset token
    const resetToken = jwt.sign({ id: rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
    
    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'LabTrack Password Reset',
      html: `
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });
    
    res.json({ message: 'Password reset link sent to your email' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hash = await bcrypt.hash(password, 10);
    
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, decoded.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
