const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM units ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM units WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Unit name is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO units (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Unit already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Unit name is required' });
  try {
    const { rows } = await pool.query(
      'UPDATE units SET name = $1 WHERE id = $2 RETURNING *',
      [name, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Unit already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await pool.query('DELETE FROM units WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};