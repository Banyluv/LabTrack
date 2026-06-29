const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM suppliers ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, contact_person || '', email || '', phone || '', address || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Supplier already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name is required' });
  try {
    const { rows } = await pool.query(
      'UPDATE suppliers SET name=$1, contact_person=$2, email=$3, phone=$4, address=$5 WHERE id=$6 RETURNING *',
      [name, contact_person || '', email || '', phone || '', address || '', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Supplier already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await pool.query('DELETE FROM suppliers WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
