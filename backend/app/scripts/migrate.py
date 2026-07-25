"""Creates/updates all tables and columns. Safe to re-run — mirrors config/migrate.js.
Run with: python -m app.scripts.migrate
"""
import os

import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

STATEMENTS = [
    """CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        facility_name VARCHAR(255) DEFAULT '',
        state VARCHAR(100) DEFAULT '',
        lga VARCHAR(100) DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS consumables (
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
    )""",
    """CREATE TABLE IF NOT EXISTS dispatch_logs (
        id SERIAL PRIMARY KEY,
        consumable_id INTEGER REFERENCES consumables(id),
        quantity INTEGER NOT NULL,
        destination VARCHAR(200) NOT NULL,
        dispatched_by VARCHAR(100) NOT NULL,
        notes TEXT,
        dispatched_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS receive_logs (
        id SERIAL PRIMARY KEY,
        consumable_id INTEGER REFERENCES consumables(id),
        quantity INTEGER NOT NULL,
        supplier VARCHAR(200),
        received_by VARCHAR(100) NOT NULL,
        invoice_ref VARCHAR(100),
        facility_name VARCHAR(255) DEFAULT '',
        received_at TIMESTAMP DEFAULT NOW()
    )""",
    "ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS facility_name VARCHAR(255) DEFAULT ''",
    "ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100) DEFAULT ''",
    "ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100) DEFAULT ''",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS sku VARCHAR(100) DEFAULT ''",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS max_stock INTEGER DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS safety_stock INTEGER DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS emergency_order_point INTEGER DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS monthly_consumption NUMERIC(12,2) DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS avg_consumption NUMERIC(12,2) DEFAULT 0",
    "ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS ordered_by VARCHAR(100) DEFAULT ''",
    "ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100) DEFAULT ''",
    "ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS grn VARCHAR(100) DEFAULT ''",
    "ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS damaged_quantity INTEGER DEFAULT 0",
    "ALTER TABLE receive_logs ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0",
    "ALTER TABLE dispatch_logs ADD COLUMN IF NOT EXISTS issued_quantity INTEGER DEFAULT 0",
    "ALTER TABLE dispatch_logs ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0",
    "ALTER TABLE dispatch_logs ADD COLUMN IF NOT EXISTS receiving_officer VARCHAR(100) DEFAULT ''",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS daily_usage NUMERIC(12,2) DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS mos NUMERIC(12,2) DEFAULT 0",
    """CREATE TABLE IF NOT EXISTS consumable_requests (
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
    )""",
    "ALTER TABLE consumable_requests ADD COLUMN IF NOT EXISTS requesting_officer VARCHAR(100) DEFAULT ''",
    """CREATE TABLE IF NOT EXISTS facilities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        state VARCHAR(100) DEFAULT '',
        lga VARCHAR(100) DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS facility_name VARCHAR(255) DEFAULT ''",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT ''",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS lga VARCHAR(100) DEFAULT ''",
    "ALTER TABLE facilities ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT ''",
    "ALTER TABLE facilities ADD COLUMN IF NOT EXISTS lga VARCHAR(100) DEFAULT ''",
    "ALTER TABLE consumable_requests ADD COLUMN IF NOT EXISTS approved_quantity INTEGER DEFAULT 0",
    "ALTER TABLE consumable_requests ADD COLUMN IF NOT EXISTS admin_comment TEXT DEFAULT ''",
    "ALTER TABLE facilities ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100) DEFAULT ''",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS expiry_date DATE",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS sku VARCHAR(100) DEFAULT ''",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS max_stock INTEGER DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS safety_stock INTEGER DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS emergency_order_point INTEGER DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS monthly_consumption NUMERIC(12,2) DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS avg_consumption NUMERIC(12,2) DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS daily_usage NUMERIC(12,2) DEFAULT 0",
    "ALTER TABLE consumables ADD COLUMN IF NOT EXISTS mos NUMERIC(12,2) DEFAULT 0",
    """CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(100),
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS quarterly_reports (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        period VARCHAR(100),
        month VARCHAR(50),
        year INTEGER,
        file_name VARCHAR(255),
        sheet_name VARCHAR(255),
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS stock_transfers (
        id SERIAL PRIMARY KEY,
        consumable_id INTEGER REFERENCES consumables(id),
        from_facility_id INTEGER REFERENCES facilities(id),
        to_facility_id INTEGER REFERENCES facilities(id),
        quantity INTEGER NOT NULL,
        transferred_by VARCHAR(100) NOT NULL,
        notes TEXT,
        transferred_at TIMESTAMP DEFAULT NOW()
    )""",
    "ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS received_by VARCHAR(100)",
    "ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100)",
    """CREATE TABLE IF NOT EXISTS procurement_orders (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES suppliers(id),
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    "ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS supplier_id INTEGER",
    "ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''",
    """CREATE TABLE IF NOT EXISTS procurement_order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES procurement_orders(id) ON DELETE CASCADE,
        consumable_id INTEGER REFERENCES consumables(id),
        quantity INTEGER NOT NULL,
        cost NUMERIC(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='procurement_orders' AND column_name='consumable_id') THEN
          EXECUTE 'ALTER TABLE procurement_orders DROP CONSTRAINT IF EXISTS procurement_orders_consumable_id_fkey';
          INSERT INTO procurement_order_items (order_id, consumable_id, quantity, cost)
          SELECT id, consumable_id, quantity, COALESCE(cost, 0)
          FROM procurement_orders
          WHERE consumable_id IS NOT NULL;
          ALTER TABLE procurement_orders DROP COLUMN consumable_id;
          ALTER TABLE procurement_orders DROP COLUMN quantity;
          ALTER TABLE procurement_orders DROP COLUMN cost;
        END IF;
      END $$""",
    """CREATE TABLE IF NOT EXISTS stock_adjustments (
        id SERIAL PRIMARY KEY,
        consumable_id INTEGER REFERENCES consumables(id),
        quantity INTEGER NOT NULL,
        adjustment_type VARCHAR(20) NOT NULL,
        reason TEXT DEFAULT '',
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        performed_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        action VARCHAR(50) NOT NULL,
        details TEXT,
        changes JSONB DEFAULT '{}',
        performed_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        data JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        link VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)",
    """CREATE TABLE IF NOT EXISTS daily_usage_logs (
        id SERIAL PRIMARY KEY,
        consumable_id INTEGER REFERENCES consumables(id),
        quantity INTEGER NOT NULL,
        used_by VARCHAR(100) NOT NULL,
        notes TEXT DEFAULT '',
        batch_no VARCHAR(100) DEFAULT '',
        expiry_date DATE,
        usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_daily_usage_logs_date ON daily_usage_logs(usage_date DESC)",
    "CREATE INDEX IF NOT EXISTS idx_daily_usage_logs_consumable ON daily_usage_logs(consumable_id)",
    "ALTER TABLE daily_usage_logs ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100) DEFAULT ''",
    "ALTER TABLE daily_usage_logs ADD COLUMN IF NOT EXISTS expiry_date DATE",
]


def migrate():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor()
    try:
        for stmt in STATEMENTS:
            cur.execute(stmt)
        conn.commit()
        print("Migration completed successfully")
    except Exception as err:
        conn.rollback()
        print(f"Migration failed: {err}")
        raise SystemExit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    migrate()
