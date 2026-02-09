
import sqlite3
import json


import os

POSSIBLE_PATHS = [
    'instance/studio_dima.db',
    'studio_dima.db',
    'database.db'
]

def get_db_path():
    for path in POSSIBLE_PATHS:
        if os.path.exists(path):
            return path
    return None

def inspect_rules():
    db_path = get_db_path()
    if not db_path:
        print("Error: Could not find database file.")
        return

    print(f"Using database: {db_path}")
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        print("--- Automation Rules ---")
        cursor.execute("SELECT id, name, trigger_id, monitor_id, action_params_json, attiva FROM automation_rules")
        rows = cursor.fetchall()
        
        for row in rows:
            print(f"ID: {row['id']}")
            print(f"Name: {row['name']}")
            print(f"Trigger: {row['trigger_id']}")
            print(f"Monitor: {row['monitor_id']}")
            print(f"Params: {row['action_params_json']}")
            print("-" * 20)
            
            # Auto-fix: Delete rules with empty params (created during bug)
            if row['action_params_json'] == '{}':
                print(f"*** DELETING BROKEN RULE ID {row['id']} ({row['name']}) ***")
                cursor.execute("DELETE FROM automation_rules WHERE id = ?", (row['id'],))
                conn.commit()

        conn.close()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        print("--- Automation Rules ---")
        cursor.execute("SELECT id, name, trigger_id, monitor_id, action_params_json, attiva FROM automation_rules")
        rows = cursor.fetchall()
        
        for row in rows:
            print(f"ID: {row['id']}")
            print(f"Name: {row['name']}")
            print(f"Trigger ID: {row['trigger_id']}")
            print(f"Monitor ID: {row['monitor_id']}")
            print(f"Active: {row['attiva']}")
            print(f"Params: {row['action_params_json']}")
            print("-" * 20)
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_rules()
