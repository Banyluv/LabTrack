"""One-off import of additional Cross River facilities. Mirrors config/import_facilities.js.
Run with: python -m app.scripts.import_facilities
"""
import os

import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

FACILITIES = [
    {"name": "Ikot Enebong Health Post", "state": "Cross River", "lga": "Akpabuyo"},
    {"name": "Akani Esuk Health Centre", "state": "Cross River", "lga": "Odukpani"},
    {"name": "Anantigha PHC", "state": "Cross River", "lga": "Calabar South"},
    {"name": "Anderson PHC", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Aya Medical Centre", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Akpet Central Cottage HOS.", "state": "Cross River", "lga": "Biase"},
    {"name": "Bakor Medical Centre", "state": "Cross River", "lga": "Ikom"},
    {"name": "Calabar General Hospital", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Calabar South FHC Moore RD.", "state": "Cross River", "lga": "Calabar South"},
    {"name": "County Specialist Hospital", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "CRUTECH Medical Centre", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Diamond Hill Health Centre", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Eja Memorial Hospital", "state": "Cross River", "lga": "Calabar South"},
    {"name": "Dr Lawrence Henshaw Hospital", "state": "Cross River", "lga": "Calabar South"},
    {"name": "Ekana Medical Centre", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Faith Foundation Clinic", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Igbo-Imabana MPHC", "state": "Cross River", "lga": "Abi"},
    {"name": "Ikang Primary Health Centre", "state": "Cross River", "lga": "Bakassi"},
    {"name": "Ikot Ekpo Health Centre", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Melrose Hospital", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Mount Zion Medical Centre", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Obubra General Hospital", "state": "Cross River", "lga": "Obubra"},
    {"name": "MCH Obubra", "state": "Cross River", "lga": "Obubra"},
    {"name": "Peace Medical Centre", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Police Hospital", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "UCMC", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "UCTH Calabar", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Goldie Clinic", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Ikot Edem Odo Health Centre", "state": "Cross River", "lga": "Akpabuyo"},
    {"name": "Emmanuel Infirmary", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Akpabuyo St Joseph Hospital", "state": "Cross River", "lga": "Akpabuyo"},
    {"name": "Aningeje PHC", "state": "Cross River", "lga": "Akamkpa"},
    {"name": "Henshaw Town Health Post", "state": "Cross River", "lga": "Calabar South"},
    {"name": "UCTH Annex", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "GH Ukpem", "state": "Cross River", "lga": "Yakurr"},
    {"name": "Mfamosing PHC", "state": "Cross River", "lga": "Akamkpa"},
    {"name": "Oban Health Centre", "state": "Cross River", "lga": "Akamkpa"},
    {"name": "Nyahasang Clinic", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Ugep General Hospital", "state": "Cross River", "lga": "Yakurr"},
    {"name": "GH Obanliku", "state": "Cross River", "lga": "Obanliku"},
    {"name": "CHC Wanihem", "state": "Cross River", "lga": "Yakurr"},
    {"name": "CHC Oba", "state": "Cross River", "lga": "Akamkpa"},
    {"name": "GH Ogoja", "state": "Cross River", "lga": "Ogoja"},
    {"name": "Santa Maria Clinic Ogoja", "state": "Cross River", "lga": "Ogoja"},
    {"name": "Ekpo Abasi", "state": "Cross River", "lga": "Calabar South"},
    {"name": "Holy Family", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Ikot Ishie", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Katchuan Iruan Model PHC", "state": "Cross River", "lga": "Boki"},
    {"name": "CHC Okundi", "state": "Cross River", "lga": "Boki"},
    {"name": "Obudu Urban 1 PHC", "state": "Cross River", "lga": "Obudu"},
    {"name": "Obudu Clinic", "state": "Cross River", "lga": "Obudu"},
    {"name": "Okpoma General Hospital", "state": "Cross River", "lga": "Yala"},
    {"name": "Yala Lutheran Hospital", "state": "Cross River", "lga": "Yala"},
    {"name": "Sacred Heart Catholic Hospital", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Calabar Women and Children Hos.", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Ekorinim Health Centre", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Ekpri Obutong", "state": "Cross River", "lga": "Bakassi"},
    {"name": "Essierebom PHC", "state": "Cross River", "lga": "Akamkpa"},
    {"name": "Hiltop Health Care Foundation", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Mambo Clinic", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Kasuk PHC", "state": "Cross River", "lga": "Odukpani"},
    {"name": "GH Akamkpa", "state": "Cross River", "lga": "Akamkpa"},
    {"name": "Mma Efa PHC", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "TBL Monaya", "state": "Cross River", "lga": "Calabar Municipal"},
    {"name": "Model PHC Abouchiche", "state": "Cross River", "lga": "Ogoja"},
    {"name": "Catholic Maternal Hospital Ogoja", "state": "Cross River", "lga": "Ogoja"},
]


def import_facilities():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor()
    try:
        inserted = 0
        skipped = 0
        for f in FACILITIES:
            cur.execute(
                "INSERT INTO facilities (name, state, lga) VALUES (%s, %s, %s) ON CONFLICT (name) DO NOTHING RETURNING id",
                [f["name"], f["state"], f["lga"]],
            )
            if cur.fetchone():
                inserted += 1
                print(f"  + {f['name']} [{f['lga']}]")
            else:
                skipped += 1
                print(f"  - {f['name']} (already exists)")

        conn.commit()
        print(f"\nImport complete: {inserted} inserted, {skipped} skipped (already exist)")
    except Exception as err:
        conn.rollback()
        print(f"Import failed: {err}")
        raise SystemExit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    import_facilities()
