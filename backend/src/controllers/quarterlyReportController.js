const pool = require('../config/db');

exports.importReport = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Excel file is required' });

  try {
    const workbook = require('xlsx').readFile(req.file.path, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = require('xlsx').utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    const titleRow = rows[0] || [];
    const title = titleRow[0] ? String(titleRow[0]).trim() : 'Quarterly Report';
    const monthYear = title.match(/([A-Za-z]+)\s+(\d{4})/);

    const period = req.body.period || title.split('\t')[0] || null;
    const month = monthYear ? monthYear[1] : null;
    const year = monthYear ? parseInt(monthYear[2], 10) : null;

    const { rows: inserted } = await pool.query(
      `INSERT INTO quarterly_reports (title, period, month, year, file_name, sheet_name, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [title, period, month, year, req.file.originalname, sheetName, { rows }]
    );

    res.json({ report: inserted[0], message: `Imported ${rows.length} rows from ${sheetName}` });
  } catch (err) {
    console.error('Quarterly import failed:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.listReports = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, title, period, month, year, file_name, sheet_name, created_at,
             jsonb_array_length(data->'rows') as row_count
      FROM quarterly_reports
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReport = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM quarterly_reports WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Report not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
