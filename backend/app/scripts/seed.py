"""Seeds demo data: admin/staff users, categories, units, facilities, suppliers, consumables.
Mirrors config/seed.js. Run with: python -m app.scripts.seed
"""
import os

import bcrypt
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

CATEGORIES = [
    {"name": "Hematology", "description": "Blood count and coagulation tests"},
    {"name": "Chemistry", "description": "Biochemistry and metabolic panels"},
    {"name": "Microbiology", "description": "Culture media and swabs"},
    {"name": "Immunology", "description": "ELISA and immunoassay kits"},
    {"name": "Serology", "description": "Rapid diagnostic tests"},
    {"name": "Urinalysis", "description": "Urine testing consumables"},
    {"name": "Histology", "description": "Tissue processing supplies"},
    {"name": "Blood Bank", "description": "Blood grouping and transfusion"},
    {"name": "Molecular", "description": "PCR and molecular diagnostics"},
    {"name": "General", "description": "General laboratory supplies"},
]

FACILITIES = [
    {"name": "UCTH Calabar", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "General Hospital Calabar", "state": "Cross River", "lga": "Calabar South"},
    {"name": "Navy Hospital Calabar", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Police Clinic Calabar", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "CBS Health Centre", "state": "Cross River", "lga": "Calabar South"},
    {"name": "UNICAL Teaching Hospital", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Faith Foundation Hospital", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Eja Memorial Hospital", "state": "Cross River", "lga": "Calabar South"},
    {"name": "Ogoja General Hospital", "state": "Cross River", "lga": "Ogoja"},
    {"name": "Ugep General Hospital", "state": "Cross River", "lga": "Yakurr"},
]

UNITS = [
    "pack (1x100)", "bottle (1x1)", "box (1x1)", "pack (1x500)", "Roll (1x1)",
    "Pieces (1x1)", "Pack (1x25)", "Roll (1x100)", "pack (1x10)", "Rim (1x1)", "Pieces",
]

# stock 0 = out of stock, stock <= reorder = low stock, stock > reorder = adequate
CONSUMABLES = [
    {"name": "Antibacterial wet wipe", "cat": "General", "unit": "pack (1x100)", "stock": 30, "reorder": 10, "price": 1800},
    {"name": "Antiviral Disinfectant spray", "cat": "General", "unit": "bottle (1x1)", "stock": 8, "reorder": 3, "price": 4500},
    {"name": "Cryovial box", "cat": "General", "unit": "box (1x1)", "stock": 0, "reorder": 0, "price": 6500},
    {"name": "Cryovial tubes x500", "cat": "General", "unit": "pack (1x500)", "stock": 4, "reorder": 2, "price": 18000},
    {"name": "EDTA Vacutainer Tubes 10 ml x 100", "cat": "Hematology", "unit": "pack (1x100)", "stock": 8, "reorder": 5, "price": 4500},
    {"name": "EDTA Vacutainer Tubes 5 ml", "cat": "Hematology", "unit": "pack (1x100)", "stock": 3, "reorder": 2, "price": 3200},
    {"name": "Vaccutainer Needle (21G)", "cat": "Hematology", "unit": "pack (1x100)", "stock": 12, "reorder": 5, "price": 2800},
    {"name": "Vaccutainer Needle (22G)", "cat": "Hematology", "unit": "pack (1x100)", "stock": 10, "reorder": 5, "price": 2800},
    {"name": "Cotton Wool", "cat": "General", "unit": "Roll (1x1)", "stock": 8, "reorder": 3, "price": 3500},
    {"name": "Methylated spirit (200ml)", "cat": "General", "unit": "bottle (1x1)", "stock": 12, "reorder": 5, "price": 1200},
    {"name": "Methylated spirit (250ml)", "cat": "General", "unit": "bottle (1x1)", "stock": 10, "reorder": 5, "price": 1500},
    {"name": "Methylated spirit (2litres)", "cat": "General", "unit": "bottle (1x1)", "stock": 6, "reorder": 3, "price": 4500},
    {"name": "Methylated spirit (4litres)", "cat": "General", "unit": "bottle (1x1)", "stock": 0, "reorder": 0, "price": 7500},
    {"name": "Hand gloves (XL)", "cat": "General", "unit": "box (1x1)", "stock": 2, "reorder": 1, "price": 4800},
    {"name": "Hand Gloves (L)", "cat": "General", "unit": "box (1x1)", "stock": 15, "reorder": 5, "price": 4800},
    {"name": "Hand Gloves (M)", "cat": "General", "unit": "box (1x1)", "stock": 20, "reorder": 5, "price": 4800},
    {"name": "Glove", "cat": "General", "unit": "box (1x1)", "stock": 10, "reorder": 5, "price": 3500},
    {"name": "Laboratory Marker", "cat": "General", "unit": "pack (1x10)", "stock": 25, "reorder": 10, "price": 1500},
    {"name": "Lab. Marker (big mouth)", "cat": "General", "unit": "pack (1x10)", "stock": 8, "reorder": 5, "price": 2200},
    {"name": "Bleach", "cat": "General", "unit": "bottle (1x1)", "stock": 1, "reorder": 0, "price": 2200},
    {"name": "Bench Pad", "cat": "General", "unit": "box (1x1)", "stock": 12, "reorder": 5, "price": 3200},
    {"name": "Color coded bin liners (red)", "cat": "General", "unit": "Roll (1x100)", "stock": 10, "reorder": 5, "price": 3800},
    {"name": "Color coded bin liners (yellow)", "cat": "General", "unit": "Roll (1x100)", "stock": 8, "reorder": 5, "price": 3800},
    {"name": "Color coded bin liners (black)", "cat": "General", "unit": "Roll (1x100)", "stock": 15, "reorder": 5, "price": 3500},
    {"name": "Antiseptic Liquid Soap (500ml)", "cat": "General", "unit": "bottle (1x1)", "stock": 7, "reorder": 3, "price": 2800},
    {"name": "Sharp Box 25 x 1", "cat": "General", "unit": "box (1x1)", "stock": 0, "reorder": 0, "price": 5500},
    {"name": "Pasteur Pipette x500", "cat": "General", "unit": "pack (1x500)", "stock": 6, "reorder": 3, "price": 7500},
    {"name": "Urine Sample bottle", "cat": "Urinalysis", "unit": "Pack (1x25)", "stock": 20, "reorder": 10, "price": 3200},
    {"name": "Lab Coat", "cat": "General", "unit": "Pieces (1x1)", "stock": 8, "reorder": 3, "price": 8500},
    {"name": "Tourniquet", "cat": "Hematology", "unit": "Pieces (1x1)", "stock": 6, "reorder": 3, "price": 1500},
    {"name": "Nose mask", "cat": "General", "unit": "box (1x1)", "stock": 25, "reorder": 10, "price": 2500},
    {"name": "Alcohol pad", "cat": "General", "unit": "box (1x1)", "stock": 5, "reorder": 4, "price": 2500},
    {"name": "Hand sanitizer (100ml)", "cat": "General", "unit": "bottle (1x1)", "stock": 50, "reorder": 10, "price": 1200},
    {"name": "Hand Sanitizer (250ml)", "cat": "General", "unit": "bottle (1x1)", "stock": 12, "reorder": 5, "price": 2500},
    {"name": "Hand Sanitizer (500ml)", "cat": "General", "unit": "bottle (1x1)", "stock": 0, "reorder": 0, "price": 4000},
    {"name": "Tissue box", "cat": "General", "unit": "box (1x1)", "stock": 40, "reorder": 15, "price": 1800},
    {"name": "Pen in pieces (10 packs by 50)", "cat": "General", "unit": "pack (1x10)", "stock": 15, "reorder": 5, "price": 8500},
    {"name": "Note book", "cat": "General", "unit": "Pieces (1x1)", "stock": 30, "reorder": 10, "price": 1200},
    {"name": "Timer", "cat": "General", "unit": "Pieces (1x1)", "stock": 5, "reorder": 2, "price": 3500},
    {"name": "Arch file jacket", "cat": "General", "unit": "Pieces (1x1)", "stock": 12, "reorder": 5, "price": 1800},
    {"name": "Calculator", "cat": "General", "unit": "Pieces (1x1)", "stock": 3, "reorder": 2, "price": 4500},
    {"name": "Jabloo box", "cat": "General", "unit": "box (1x1)", "stock": 10, "reorder": 5, "price": 2800},
    {"name": "Printing Paper", "cat": "General", "unit": "Rim (1x1)", "stock": 50, "reorder": 20, "price": 5500},
    {"name": "Eye Shield", "cat": "General", "unit": "Pieces (1x1)", "stock": 0, "reorder": 0, "price": 3000},
    {"name": "Safety Eye Goggle", "cat": "General", "unit": "Pieces (1x1)", "stock": 4, "reorder": 2, "price": 3500},
    {"name": "Needle Holder", "cat": "General", "unit": "Pieces (1x1)", "stock": 5, "reorder": 2, "price": 4000},
    {"name": "Toner 59A", "cat": "General", "unit": "Pieces (1x1)", "stock": 2, "reorder": 1, "price": 35000},
    {"name": "Toner 83A", "cat": "General", "unit": "Pieces (1x1)", "stock": 1, "reorder": 0, "price": 38000},
    {"name": "Toner 1106A", "cat": "General", "unit": "Pieces (1x1)", "stock": 4, "reorder": 2, "price": 32000},
    {"name": "Thermometer", "cat": "General", "unit": "Pieces (1x1)", "stock": 0, "reorder": 0, "price": 6500},
    {"name": "Isopropyl alcohol", "cat": "General", "unit": "bottle (1x1)", "stock": 5, "reorder": 3, "price": 3800},
    {"name": "BD Facspresto cartrige", "cat": "Immunology", "unit": "Pieces (1x1)", "stock": 3, "reorder": 2, "price": 55000},
    {"name": "Kim Wipes", "cat": "General", "unit": "box (1x1)", "stock": 0, "reorder": 0, "price": 4200},
]

SUPPLIERS = [
    {"name": "MediSupplies Ltd", "contact_person": "John Okon", "email": "john@medisupplies.com", "phone": "08012345678", "address": "15 Marian Road, Calabar"},
    {"name": "LabEquip Nigeria", "contact_person": "Sarah Ekanem", "email": "sarah@labequip.ng", "phone": "08087654321", "address": "42 Target Street, Calabar"},
    {"name": "BioMed Solutions", "contact_person": "Emmanuel Bassey", "email": "emma@biomed.ng", "phone": "08023456789", "address": "8 Etta Agbor Road, Calabar"},
    {"name": "HealthPlus Distributors", "contact_person": "Grace Otu", "email": "grace@healthplus.com", "phone": "08034567890", "address": "22 Ndidem Usang Iso, Calabar"},
    {"name": "Prime Lab Supplies", "contact_person": "David Asuquo", "email": "david@primelab.ng", "phone": "08045678901", "address": "Plot 12, State Housing Estate, Calabar"},
]

ITEMS_TO_RECEIVE = [
    "Antibacterial wet wipe", "Antiviral Disinfectant spray", "Cryovial tubes x500",
    "EDTA Vacutainer Tubes 10 ml x 100", "Vaccutainer Needle (21G)", "Cotton Wool",
    "Hand Gloves (L)", "Hand Gloves (M)", "Laboratory Marker",
    "Bleach", "Bench Pad", "Color coded bin liners (red)",
    "Pasteur Pipette x500", "Lab Coat", "Nose mask", "Alcohol pad",
    "Hand sanitizer (100ml)", "Tissue box", "Note book", "Printing Paper",
]


def seed():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        admin_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt(10)).decode()
        cur.execute(
            """INSERT INTO users (name, email, password, role)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password""",
            ["admin", "admin@labtrack.com", admin_hash, "admin"],
        )

        staff_hash = bcrypt.hashpw(b"staff123", bcrypt.gensalt(10)).decode()
        cur.execute(
            """INSERT INTO users (name, email, password, role, facility_name, state, lga)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, facility_name = EXCLUDED.facility_name""",
            ["staff@generalhospital", "staff@generalhospital", staff_hash, "staff", "General Hospital Calabar", "Cross River", "Calabar South"],
        )

        cat_map = {}
        for cat in CATEGORIES:
            cur.execute(
                """INSERT INTO categories (name, description) VALUES (%s, %s)
                   ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
                   RETURNING id, name""",
                [cat["name"], cat["description"]],
            )
            row = cur.fetchone()
            cat_map[row["name"]] = row["id"]

        for unit in UNITS:
            cur.execute("INSERT INTO units (name) VALUES (%s) ON CONFLICT (name) DO NOTHING", [unit])

        for f in FACILITIES:
            cur.execute(
                """INSERT INTO facilities (name, state, lga) VALUES (%s, %s, %s)
                   ON CONFLICT (name) DO UPDATE SET state = EXCLUDED.state, lga = EXCLUDED.lga""",
                [f["name"], f["state"], f["lga"]],
            )

        cur.execute("DELETE FROM dispatch_logs")
        cur.execute("DELETE FROM receive_logs")
        cur.execute("DELETE FROM consumable_requests")
        cur.execute("DELETE FROM procurement_order_items")
        cur.execute("DELETE FROM procurement_orders")
        cur.execute("DELETE FROM consumables")

        for s in SUPPLIERS:
            cur.execute(
                """INSERT INTO suppliers (name, contact_person, email, phone, address)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (name) DO UPDATE SET contact_person = EXCLUDED.contact_person, email = EXCLUDED.email, phone = EXCLUDED.phone, address = EXCLUDED.address""",
                [s["name"], s["contact_person"], s["email"], s["phone"], s["address"]],
            )

        inserted_ids = {}
        for item in CONSUMABLES:
            cur.execute(
                """INSERT INTO consumables (name, category_id, unit, stock, reorder_quantity, price)
                   VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                [item["name"], cat_map[item["cat"]], item["unit"], item["stock"], item["reorder"], item["price"]],
            )
            inserted_ids[item["name"]] = cur.fetchone()["id"]

        staff_facility = "General Hospital Calabar"
        for name in ITEMS_TO_RECEIVE:
            if name in inserted_ids:
                cur.execute(
                    """INSERT INTO receive_logs (consumable_id, quantity, supplier, received_by, invoice_ref, facility_name)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    [inserted_ids[name], 5, "MediSupplies Ltd", "Staff User", "INV-001", staff_facility],
                )

        conn.commit()
        print("Seed completed. Admin login: admin / admin123")
        print(f"   {len(CONSUMABLES)} consumable items inserted.")
        print(f"   {len(UNITS)} units created.")
        print(f"   {len(FACILITIES)} facilities created.")
    except Exception as err:
        conn.rollback()
        print(f"Seed failed: {err}")
        raise SystemExit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed()
