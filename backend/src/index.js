require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/consumables', require('./routes/consumables'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/reports/quarterly', require('./routes/quarterlyReports'));
app.use('/api/units', require('./routes/units'));
app.use('/api/facilities', require('./routes/facilities'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api', require('./routes/transactions'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ LabTrack API running on http://localhost:${PORT}`));
