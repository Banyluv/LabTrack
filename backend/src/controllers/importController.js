const pool = require('../config/db');
const csv = require('csv-parser');
const fs = require('fs');

exports.importCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => results.push(row))
    .on('end', async () => {
      let created = 0, updated = 0, errors = 0;
      for (const row of results) {
        try {
          if (!row.name || !row.unit) { errors++; continue; }
          const catRes = await pool.query('SELECT id FROM categories WHERE name = $1', [row.category || 'General']);
          let catId;
          if (catRes.rows.length) catId = catRes.rows[0].id;
          else {
            const newCat = await pool.query("INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id", [row.category || 'General']);
            catId = newCat.rows[0].id;
          }
          const stock = parseInt(row.stock) || 0;
          const existing = await pool.query('SELECT id FROM consumables WHERE name = $1', [row.name]);
          if (existing.rows.length) {
            await pool.query('UPDATE consumables SET category_id=$1, unit=$2, stock=$3, reorder_quantity=$4, price=$5 WHERE id=$6',
              [catId, row.unit, stock, parseInt(row.reorder_quantity) || 0, parseFloat(row.price) || 0, existing.rows[0].id]);
            updated++;
          } else {
            await pool.query('INSERT INTO consumables (name, category_id, unit, stock, reorder_quantity, price) VALUES ($1,$2,$3,$4,$5,$6)',
              [row.name, catId, row.unit, stock, parseInt(row.reorder_quantity) || 0, parseFloat(row.price) || 0]);
            created++;
          }
        } catch (e) { errors++; }
      }
      fs.unlinkSync(req.file.path);
      res.json({ total_rows: results.length, created_or_updated: created + updated, errors });
    })
    .on('error', (err) => res.status(500).json({ error: err.message }));
};
