const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM facilities ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM facilities WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { name, state, lga } = req.body;
  if (!name) return res.status(400).json({ error: 'Facility name is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO facilities (name, state, lga) VALUES ($1,$2,$3) RETURNING *',
      [name, state || '', lga || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Facility already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { name, state, lga } = req.body;
  if (!name) return res.status(400).json({ error: 'Facility name is required' });
  try {
    const { rows } = await pool.query(
      'UPDATE facilities SET name = $1, state = $2, lga = $3 WHERE id = $4 RETURNING *',
      [name, state || '', lga || '', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Facility already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await pool.query('DELETE FROM facilities WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};