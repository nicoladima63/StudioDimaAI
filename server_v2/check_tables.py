import sqlite3

conn = sqlite3.connect('instance/studio_dima.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]

print(f"Numero tabelle: {len(tables)}")
print("Tutte le tabelle nel database:")
for table in tables:
    print(f"- {table}")

# Look for classification tables
classif_tables = [t for t in tables if 'classif' in t.lower()]
print(f"\nTabelle con 'classif': {classif_tables}")

# Check materiali table
if 'materiali' in tables:
    print(f"\nStruttura tabella materiali:")
    cursor.execute("PRAGMA table_info(materiali)")
    for row in cursor.fetchall():
        print(f"  {row[1]} - {row[2]}")
    
    # Count records
    cursor.execute("SELECT COUNT(*) FROM materiali")
    count = cursor.fetchone()[0]
    print(f"  Record in materiali: {count}")

# If we find a classification table, show its structure
if classif_tables:
    table_name = classif_tables[0]
    print(f"\nStruttura tabella {table_name}:")
    cursor.execute(f"PRAGMA table_info({table_name})")
    for row in cursor.fetchall():
        print(f"  {row[1]} - {row[2]}")
    
    # Count records
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    print(f"  Record in {table_name}: {count}")

conn.close()
