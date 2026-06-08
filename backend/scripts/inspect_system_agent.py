import os
import sys
import json
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://ragleaf:ragleaf_pass@localhost:1300/ragleaf_db")
print(f"Connecting to database at {DATABASE_URL}...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT id, public_id, name, appearance, allowed_domains FROM agents WHERE public_id = 'ag_ragleaf_system01';")
    row = cursor.fetchone()
    if row:
        print("✅ System Agent Found:")
        print(f"ID: {row[0]}")
        print(f"Public ID: {row[1]}")
        print(f"Name: {row[2]}")
        print(f"Appearance: {json.dumps(row[3], indent=2)}")
        print(f"Allowed Domains: {row[4]}")
    else:
        print("❌ System Agent ag_ragleaf_system01 NOT found in database.")
    
    # Let's list all agents just in case
    print("\nListing all agents in database:")
    cursor.execute("SELECT id, public_id, name FROM agents;")
    for r in cursor.fetchall():
        print(f"- {r[0]} | {r[1]} | {r[2]}")
        
    conn.close()
except Exception as e:
    print(f"❌ Error: {e}")
