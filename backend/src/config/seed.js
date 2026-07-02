require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const categories = [
  { name: 'Hematology', description: 'Blood count and coagulation tests' },
  { name: 'Chemistry', description: 'Biochemistry and metabolic panels' },
  { name: 'Microbiology', description: 'Culture media and swabs' },
  { name: 'Immunology', description: 'ELISA and immunoassay kits' },
  { name: 'Serology', description: 'Rapid diagnostic tests' },
  { name: 'Urinalysis', description: 'Urine testing consumables' },
  { name: 'Histology', description: 'Tissue processing supplies' },
  { name: 'Blood Bank', description: 'Blood grouping and transfusion' },
  { name: 'Molecular', description: 'PCR and molecular diagnostics' },
  { name: 'General', description: 'General laboratory supplies' },
];

const facilities = [
  { name: 'UCTH Calabar',          state: 'Cross River', lga: 'Calabar Municipal' },
  { name: 'General Hospital Calabar', state: 'Cross River', lga: 'Calabar South' },
  { name: 'Navy Hospital Calabar',    state: 'Cross River', lga: 'Calabar Municipal' },
  { name: 'Police Clinic Calabar',    state: 'Cross River', lga: 'Calabar Municipal' },
  { name: 'CBS Health Centre',        state: 'Cross River', lga: 'Calabar South' },
  { name: 'UNICAL Teaching Hospital', state: 'Cross River', lga: 'Calabar Municipal' },
  { name: 'Faith Foundation Hospital',state: 'Cross River', lga: 'Calabar Municipal' },
  { name: 'Eja Memorial Hospital',    state: 'Cross River', lga: 'Calabar South' },
  { name: 'Ogoja General Hospital',   state: 'Cross River', lga: 'Ogoja' },
  { name: 'Ugep General Hospital',    state: 'Cross River', lga: 'Yakurr' },
];

const units = [
  'pack (1x100)',
  'bottle (1x1)',
  'box (1x1)',
  'pack (1x500)',
  'Roll (1x1)',
  'Pieces (1x1)',
  'Pack (1x25)',
  'Roll (1x100)',
  'pack (1x10)',
  'Rim (1x1)',
  'Pieces',
];

/* stock 0 = out of stock, stock <= reorder = low stock, stock > reorder = adequate */
const consumables = [
  // ─── Hematology / Blood Collection ───
  { name: 'Antibacterial wet wipe',              cat: 'General',    unit: 'pack (1x100)', stock: 30, reorder: 10, price: 1800 },
  { name: 'Antiviral Disinfectant spray',        cat: 'General',    unit: 'bottle (1x1)', stock: 8,  reorder: 3,  price: 4500 },
  { name: 'Cryovial box',                        cat: 'General',    unit: 'box (1x1)',    stock: 0,  reorder: 0,  price: 6500 },
  { name: 'Cryovial tubes x500',                 cat: 'General',    unit: 'pack (1x500)', stock: 4,  reorder: 2,  price: 18000 },
  { name: 'EDTA Vacutainer Tubes 10 ml x 100',   cat: 'Hematology', unit: 'pack (1x100)', stock: 8,  reorder: 5,  price: 4500 },
  { name: 'EDTA Vacutainer Tubes 5 ml',          cat: 'Hematology', unit: 'pack (1x100)', stock: 3,  reorder: 2,  price: 3200 },
  { name: 'Vaccutainer Needle (21G)',             cat: 'Hematology', unit: 'pack (1x100)', stock: 12, reorder: 5,  price: 2800 },
  { name: 'Vaccutainer Needle (22G)',             cat: 'Hematology', unit: 'pack (1x100)', stock: 10, reorder: 5,  price: 2800 },
  { name: 'Cotton Wool',                         cat: 'General',    unit: 'Roll (1x1)',   stock: 8,  reorder: 3,  price: 3500 },

  // ─── Methylated Spirits ───
  { name: 'Methylated spirit (200ml)',  cat: 'General', unit: 'bottle (1x1)', stock: 12, reorder: 5,  price: 1200 },
  { name: 'Methylated spirit (250ml)',  cat: 'General', unit: 'bottle (1x1)', stock: 10, reorder: 5,  price: 1500 },
  { name: 'Methylated spirit (2litres)',cat: 'General', unit: 'bottle (1x1)', stock: 6,  reorder: 3,  price: 4500 },
  { name: 'Methylated spirit (4litres)',cat: 'General', unit: 'bottle (1x1)', stock: 0,  reorder: 0,  price: 7500 },

  // ─── Gloves ───
  { name: 'Hand gloves (XL)',  cat: 'General', unit: 'box (1x1)', stock: 2,  reorder: 1,  price: 4800 },
  { name: 'Hand Gloves (L)',   cat: 'General', unit: 'box (1x1)', stock: 15, reorder: 5,  price: 4800 },
  { name: 'Hand Gloves (M)',   cat: 'General', unit: 'box (1x1)', stock: 20, reorder: 5,  price: 4800 },
  { name: 'Glove',             cat: 'General', unit: 'box (1x1)', stock: 10, reorder: 5,  price: 3500 },

  // ─── Markers ───
  { name: 'Laboratory Marker',      cat: 'General', unit: 'pack (1x10)',  stock: 25, reorder: 10, price: 1500 },
  { name: 'Lab. Marker (big mouth)',cat: 'General', unit: 'pack (1x10)',  stock: 8,  reorder: 5,  price: 2200 },

  // ─── Cleaning / Disinfection ───
  { name: 'Bleach',                      cat: 'General', unit: 'bottle (1x1)', stock: 1,  reorder: 0,  price: 2200 },
  { name: 'Bench Pad',                   cat: 'General', unit: 'box (1x1)',    stock: 12, reorder: 5,  price: 3200 },

  // ─── Waste & Sharps ───
  { name: 'Color coded bin liners (red)',    cat: 'General', unit: 'Roll (1x100)', stock: 10, reorder: 5,  price: 3800 },
  { name: 'Color coded bin liners (yellow)', cat: 'General', unit: 'Roll (1x100)', stock: 8,  reorder: 5,  price: 3800 },
  { name: 'Color coded bin liners (black)',  cat: 'General', unit: 'Roll (1x100)', stock: 15, reorder: 5,  price: 3500 },
  { name: 'Antiseptic Liquid Soap (500ml)',  cat: 'General', unit: 'bottle (1x1)', stock: 7,  reorder: 3,  price: 2800 },
  { name: 'Sharp Box 25 x 1',               cat: 'General', unit: 'box (1x1)',     stock: 0,  reorder: 0,  price: 5500 },

  // ─── Sample Collection & Storage ───
  { name: 'Pasteur Pipette x500', cat: 'General',    unit: 'pack (1x500)', stock: 6,  reorder: 3,  price: 7500 },
  { name: 'Urine Sample bottle',  cat: 'Urinalysis', unit: 'Pack (1x25)',  stock: 20, reorder: 10, price: 3200 },

  // ─── PPE ───
  { name: 'Lab Coat',          cat: 'General', unit: 'Pieces (1x1)', stock: 8,  reorder: 3,  price: 8500 },
  { name: 'Tourniquet',        cat: 'Hematology', unit: 'Pieces (1x1)', stock: 6,  reorder: 3,  price: 1500 },
  { name: 'Nose mask',         cat: 'General', unit: 'box (1x1)',    stock: 25, reorder: 10, price: 2500 },
  { name: 'Alcohol pad',       cat: 'General', unit: 'box (1x1)',    stock: 5,  reorder: 4,  price: 2500 },

  // ─── Hand Sanitizers ───
  { name: 'Hand sanitizer (100ml)',  cat: 'General', unit: 'bottle (1x1)', stock: 50, reorder: 10, price: 1200 },
  { name: 'Hand Sanitizer (250ml)',  cat: 'General', unit: 'bottle (1x1)', stock: 12, reorder: 5,  price: 2500 },
  { name: 'Hand Sanitizer (500ml)',  cat: 'General', unit: 'bottle (1x1)', stock: 0,  reorder: 0,  price: 4000 },

  // ─── Stationery & Office ───
  { name: 'Tissue box',                  cat: 'General', unit: 'box (1x1)',    stock: 40, reorder: 15, price: 1800 },
  { name: 'Pen in pieces (10 packs by 50)',cat:'General', unit: 'pack (1x10)',  stock: 15, reorder: 5,  price: 8500 },
  { name: 'Note book',                   cat: 'General', unit: 'Pieces (1x1)', stock: 30, reorder: 10, price: 1200 },
  { name: 'Timer',                       cat: 'General', unit: 'Pieces (1x1)', stock: 5,  reorder: 2,  price: 3500 },
  { name: 'Arch file jacket',            cat: 'General', unit: 'Pieces (1x1)', stock: 12, reorder: 5,  price: 1800 },
  { name: 'Calculator',                  cat: 'General', unit: 'Pieces (1x1)', stock: 3,  reorder: 2,  price: 4500 },
  { name: 'Jabloo box',                  cat: 'General', unit: 'box (1x1)',    stock: 10, reorder: 5,  price: 2800 },
  { name: 'Printing Paper',              cat: 'General', unit: 'Rim (1x1)',    stock: 50, reorder: 20, price: 5500 },

  // ─── PPE (more) ───
  { name: 'Eye Shield',        cat: 'General', unit: 'Pieces (1x1)', stock: 0,  reorder: 0,  price: 3000 },
  { name: 'Safety Eye Goggle', cat: 'General', unit: 'Pieces (1x1)', stock: 4,  reorder: 2,  price: 3500 },
  { name: 'Needle Holder',     cat: 'General', unit: 'Pieces (1x1)', stock: 5,  reorder: 2,  price: 4000 },

  // ─── Printer Toners ───
  { name: 'Toner 59A',   cat: 'General', unit: 'Pieces (1x1)', stock: 2,  reorder: 1,  price: 35000 },
  { name: 'Toner 83A',   cat: 'General', unit: 'Pieces (1x1)', stock: 1,  reorder: 0,  price: 38000 },
  { name: 'Toner 1106A', cat: 'General', unit: 'Pieces (1x1)', stock: 4,  reorder: 2,  price: 32000 },

  // ─── Equipment / Specialized ───
  { name: 'Thermometer',              cat: 'General',    unit: 'Pieces (1x1)', stock: 0, reorder: 0, price: 6500 },
  { name: 'Isopropyl alcohol',        cat: 'General',    unit: 'bottle (1x1)', stock: 5, reorder: 3, price: 3800 },
  { name: 'BD Facspresto cartrige',   cat: 'Immunology', unit: 'Pieces (1x1)', stock: 3, reorder: 2, price: 55000 },
  { name: 'Kim Wipes',                cat: 'General',    unit: 'box (1x1)',    stock: 0, reorder: 0, price: 4200 },
];

const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Admin user
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password
    `, ['admin', 'admin@labtrack.com', hash, 'admin']);

    // Staff user with facility
    const staffHash = await bcrypt.hash('staff123', 10);
    await client.query(`
      INSERT INTO users (name, email, password, role, facility_name, state, lga)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, facility_name = EXCLUDED.facility_name
    `, ['staff@generalhospital', 'staff@generalhospital', staffHash, 'staff', 'General Hospital Calabar', 'Cross River', 'Calabar South']);

    // Categories
    const catMap = {};
    for (const cat of categories) {
      const res = await client.query(`
        INSERT INTO categories (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id, name
      `, [cat.name, cat.description]);
      catMap[res.rows[0].name] = res.rows[0].id;
    }

    // Units
    const unitMap = {};
    for (const unit of units) {
      const res = await client.query(`
        INSERT INTO units (name)
        VALUES ($1)
        ON CONFLICT (name) DO NOTHING
        RETURNING id, name
      `, [unit]);
      if (res.rows.length) {
        unitMap[res.rows[0].name] = res.rows[0].id;
      } else {
        const existing = await client.query('SELECT id FROM units WHERE name = $1', [unit]);
        unitMap[existing.rows[0].name] = existing.rows[0].id;
      }
    }

    // Facilities
    const facMap = {};
    for (const f of facilities) {
      const res = await client.query(`
        INSERT INTO facilities (name, state, lga)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET state = EXCLUDED.state, lga = EXCLUDED.lga
        RETURNING id, name
      `, [f.name, f.state, f.lga]);
      if (res.rows.length) {
        facMap[res.rows[0].name] = res.rows[0].id;
      } else {
        const existing = await client.query('SELECT id FROM facilities WHERE name = $1', [f.name]);
        facMap[existing.rows[0].name] = existing.rows[0].id;
      }
    }

    // Clear existing data
    await client.query('DELETE FROM dispatch_logs');
    await client.query('DELETE FROM receive_logs');
    await client.query('DELETE FROM consumable_requests');
    await client.query('DELETE FROM consumables');

    // Consumables
    const insertedIds = {};
    for (const item of consumables) {
      const result = await client.query(`
        INSERT INTO consumables (name, category_id, unit, stock, reorder_quantity, price)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [item.name, catMap[item.cat], item.unit, item.stock, item.reorder, item.price]);
      insertedIds[item.name] = result.rows[0].id;
    }

    // Seed some receive logs with General Hospital Calabar facility so staff users see data
    const staffFacility = 'General Hospital Calabar';
    const itemsToReceive = [
      'Antibacterial wet wipe', 'Antiviral Disinfectant spray', 'Cryovial tubes x500',
      'EDTA Vacutainer Tubes 10 ml x 100', 'Vaccutainer Needle (21G)', 'Cotton Wool',
      'Hand Gloves (L)', 'Hand Gloves (M)', 'Laboratory Marker',
      'Bleach', 'Bench Pad', 'Color coded bin liners (red)',
      'Pasteur Pipette x500', 'Lab Coat', 'Nose mask', 'Alcohol pad',
      'Hand sanitizer (100ml)', 'Tissue box', 'Note book', 'Printing Paper'
    ];
    for (const name of itemsToReceive) {
      if (insertedIds[name]) {
        await client.query(`
          INSERT INTO receive_logs (consumable_id, quantity, supplier, received_by, invoice_ref, facility_name)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [insertedIds[name], 5, 'MediSupplies Ltd', 'Staff User', 'INV-001', staffFacility]);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Seed completed. Admin login: admin / admin123');
    console.log(`   ${consumables.length} consumable items inserted.`);
    console.log(`   ${units.length} units created.`);
    console.log(`   ${facilities.length} facilities created.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
};

seed();