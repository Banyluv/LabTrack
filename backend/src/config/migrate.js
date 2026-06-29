require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        facility_name VARCHAR(255) DEFAULT '',
        state VARCHAR(100) DEFAULT '',
        lga VARCHAR(100) DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS consumables (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        unit VARCHAR(100) NOT NULL,
        stock INTEGER DEFAULT 0,
        reorder_quantity INTEGER DEFAULT 0,
        price NUMERIC(12,2) DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dispatch_logs (
        id SERIAL PRIMARY KEY,
        consumable_id INTEGER REFERENCES consumables(id),
        quantity INTEGER NOT NULL,
        destination VARCHAR(200) NOT NULL,
        dispatched_by VARCHAR(100) NOT NULL,
        notes TEXT,
        dispatched_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS receive_logs (
        id SERIAL PRIMARY KEY,
        consumable_id INTEGER REFERENCES consumables(id),
        quantity INTEGER NOT NULL,
        supplier VARCHAR(200),
        received_by VARCHAR(100) NOT NULL,
        invoice_ref VARCHAR(100),
        facility_name VARCHAR(255) DEFAULT '',
        received_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ── 5a. Add facility_name to receive_logs if column missing ──
    await client.query(`ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS facility_name VARCHAR(255) DEFAULT ''`);
    // ── 5b. Add batch_no and expiry_date to receive_logs ──
    await client.query(`ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100) DEFAULT ''`);
    await client.query(`ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL`);
    // ── 5c. Add batch_no and expiry_date to consumables ──
    await client.query(`ALTER TABLE consumables ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100) DEFAULT ''`);
    await client.query(`ALTER TABLE consumables ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS consumable_requests (
        id SERIAL PRIMARY KEY,
        consumable_id INTEGER REFERENCES consumables(id),
        user_id INTEGER REFERENCES users(id),
        quantity INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        requested_by VARCHAR(100) NOT NULL,
        approved_by VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS facilities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        state VARCHAR(100) DEFAULT '',
        lga VARCHAR(100) DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add columns if they don't exist (for existing tables)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS facility_name VARCHAR(255) DEFAULT ''`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT ''`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lga VARCHAR(100) DEFAULT ''`);
    await client.query(`ALTER TABLE facilities ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT ''`);
    await client.query(`ALTER TABLE facilities ADD COLUMN IF NOT EXISTS lga VARCHAR(100) DEFAULT ''`);
    await client.query(`ALTER TABLE consumable_requests ADD COLUMN IF NOT EXISTS approved_quantity INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE consumable_requests ADD COLUMN IF NOT EXISTS admin_comment TEXT DEFAULT ''`);
    await client.query(`ALTER TABLE facilities ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(100),
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quarterly_reports (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        period VARCHAR(100),
        month VARCHAR(50),
        year INTEGER,
        file_name VARCHAR(255),
        sheet_name VARCHAR(255),
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
};

migrate();
