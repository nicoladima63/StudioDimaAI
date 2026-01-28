
import sqlite3
import os

db_path = 'server_v2/instance/database.sqlite'
if os.path.exists(db_path):
    print(f'Checking {db_path}...')
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall()]
        print(f'Tables: {tables}')
        conn.close()
    except Exception as e:
        print(f'Error: {e}')
else:
    print(f'{db_path} does not exist')
