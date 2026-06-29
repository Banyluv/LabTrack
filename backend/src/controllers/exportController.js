const pool = require('../config/db');
const ExcelJS = require('exceljs');

exports.exportInventory = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, cat.name as category, c.unit, c.stock, c.reorder_quantity, c.price, c.description
       FROM consumables c LEFT JOIN categories cat ON c.category_id = cat.id ORDER BY cat.name, c.name`
    );
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Inventory');
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Unit', key: 'unit', width: 12 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Reorder Qty', key: 'reorder_quantity', width: 12 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Description', key: 'description', width: 30 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach(r => ws.addRow(r));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
