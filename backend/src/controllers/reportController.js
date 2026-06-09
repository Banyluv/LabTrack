const pool = require('../config/db');
const ExcelJS = require('exceljs');

const getPeriodFilter = (period) => {
  switch (period) {
    case 'daily': return `dispatched_at >= CURRENT_DATE`;
    case 'weekly': return `dispatched_at >= CURRENT_DATE - INTERVAL '7 days'`;
    case 'monthly': return `dispatched_at >= date_trunc('month', CURRENT_DATE)`;
    case 'yearly': return `dispatched_at >= date_trunc('year', CURRENT_DATE)`;
    default: return '1=1';
  }
};

exports.getReport = async (req, res) => {
  const { period = 'monthly', from, to } = req.query;
  let dateFilter = from && to
    ? `dl.dispatched_at BETWEEN '${from}' AND '${to}'`
    : `dl.${getPeriodFilter(period)}`;
  try {
    const summary = await pool.query(`
      SELECT
        SUM(dl.quantity) as total_dispatched,
        COUNT(dl.id) as total_events,
        COUNT(DISTINCT dl.consumable_id) as unique_items,
        COUNT(DISTINCT dl.destination) as destinations
      FROM dispatch_logs dl
      WHERE ${dateFilter}
    `);

    const byItem = await pool.query(`
      SELECT c.id, c.name, cat.name as category, SUM(dl.quantity) as qty, COUNT(dl.id) as events, c.stock as remaining
      FROM dispatch_logs dl
      JOIN consumables c ON dl.consumable_id = c.id
      JOIN categories cat ON c.category_id = cat.id
      WHERE ${dateFilter}
      GROUP BY c.id, c.name, cat.name, c.stock
      ORDER BY qty DESC
    `);

    const byCategory = await pool.query(`
      SELECT cat.name as category, SUM(dl.quantity) as qty, COUNT(dl.id) as events
      FROM dispatch_logs dl
      JOIN consumables c ON dl.consumable_id = c.id
      JOIN categories cat ON c.category_id = cat.id
      WHERE ${dateFilter}
      GROUP BY cat.name
      ORDER BY qty DESC
    `);

    const byDestination = await pool.query(`
      SELECT dl.destination, SUM(dl.quantity) as qty, COUNT(dl.id) as events
      FROM dispatch_logs dl
      WHERE ${dateFilter}
      GROUP BY dl.destination
      ORDER BY qty DESC
    `);

    const received = await pool.query(`
      SELECT COALESCE(SUM(quantity),0) as total_received, COUNT(id) as events
      FROM receive_logs
      WHERE received_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    res.json({
      summary: summary.rows[0],
      by_item: byItem.rows,
      by_category: byCategory.rows,
      by_destination: byDestination.rows,
      received: received.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.exportExcel = async (req, res) => {
  const { period = 'monthly' } = req.query;
  const dateFilter = `dl.${getPeriodFilter(period)}`;
  try {
    const { rows } = await pool.query(`
      SELECT dl.id, dl.dispatched_at, c.name as consumable, cat.name as category,
             dl.quantity, dl.destination, dl.dispatched_by, dl.notes
      FROM dispatch_logs dl
      JOIN consumables c ON dl.consumable_id = c.id
      JOIN categories cat ON c.category_id = cat.id
      WHERE ${dateFilter}
      ORDER BY dl.dispatched_at DESC
    `);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Dispatch Report');
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Date', key: 'dispatched_at', width: 20 },
      { header: 'Consumable', key: 'consumable', width: 30 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Destination', key: 'destination', width: 25 },
      { header: 'Dispatched By', key: 'dispatched_by', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach(r => ws.addRow({ ...r, dispatched_at: new Date(r.dispatched_at).toLocaleString() }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=dispatch-report-${period}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
