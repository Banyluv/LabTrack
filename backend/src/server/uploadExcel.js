const multer = require('multer');
const xlsx = require('xlsx');
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'cryptoapp',
  password: 'your_password',
  port: 5432,
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Create this folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Function to process Excel and insert into database
const processExcel = async (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  
  for (const row of data) {
    // Adjust column names based on your Excel file
    await pool.query(
      'INSERT INTO your_table (column1, column2, column3) VALUES ($1, $2, $3)',
      [row.Column1, row.Column2, row.Column3]
    );
  }
  return data.length;
};

// Express route for upload
app.post('/admin/upload-excel', upload.single('excelFile'), async (req, res) => {
  try {
    const rowCount = await processExcel(req.file.path);
    res.json({ success: true, message: `${rowCount} rows uploaded` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});