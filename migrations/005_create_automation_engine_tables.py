
import sqlite3
import json

def upgrade(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Step 1: Create the new 'actions' table
    cursor.execute("""
    CREATE TABLE actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        parameters_json TEXT,
        is_system_action BOOLEAN DEFAULT 1
    )
    """)

    # Step 2: Create the new 'automation_rules' table
    cursor.execute("""
    CREATE TABLE automation_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        
        trigger_type TEXT NOT NULL DEFAULT 'prestazione',
        trigger_id TEXT NOT NULL,
        
        action_id INTEGER NOT NULL,
        action_params_json TEXT,
        
        attiva BOOLEAN DEFAULT 1,
        priorita INTEGER DEFAULT 100,
        
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        
        FOREIGN KEY (action_id) REFERENCES actions(id)
    )
    """)
    
    # Step 3: Seed the 'actions' table with existing callback functions
    # First, get distinct callback functions from the old table
    try:
        cursor.execute("SELECT DISTINCT callback_function FROM regole_monitoraggio")
        existing_callbacks = cursor.fetchall()
    except sqlite3.OperationalError:
        # This will happen if regole_monitoraggio doesn't exist, which is fine
        # in a fresh setup.
        existing_callbacks = []

    actions_map = {}
    for (callback_name,) in existing_callbacks:
        if callback_name == 'send_sms_link':
            description = "Invia un SMS con un link a una pagina web"
            params = json.dumps(['page_slug', 'template_key', 'sender', 'url_params'])
        else:
            description = f"Azione di sistema: {callback_name}"
            params = json.dumps([])
            
        cursor.execute("""
        INSERT INTO actions (name, description, parameters_json, is_system_action)
        VALUES (?, ?, ?, ?)
        """, (callback_name, description, params, 1))
        actions_map[callback_name] = cursor.lastrowid

    # Step 4: Migrate data from 'regole_monitoraggio' to 'automation_rules'
    if existing_callbacks:
        cursor.execute("SELECT * FROM regole_monitoraggio")
        old_rules = cursor.fetchall()
        
        # Get column names to map by name instead of index
        old_cols = [description[0] for description in cursor.description]

        for old_rule in old_rules:
            rule_dict = dict(zip(old_cols, old_rule))
            
            callback_name = rule_dict.get('callback_function')
            action_id = actions_map.get(callback_name)

            if not action_id:
                # Should not happen if the seeding step worked, but as a fallback
                cursor.execute("INSERT INTO actions (name) VALUES (?)", (callback_name,))
                action_id = cursor.lastrowid
                actions_map[callback_name] = action_id

            cursor.execute("""
            INSERT INTO automation_rules (
                name, description, trigger_type, trigger_id, 
                action_id, action_params_json, attiva, priorita, 
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rule_dict.get('nome_prestazione', 'Regola Migrata'),
                rule_dict.get('descrizione', ''),
                'prestazione',
                rule_dict['tipo_prestazione_id'],
                action_id,
                rule_dict.get('parametri_callback'),
                rule_dict.get('attiva', 1),
                rule_dict.get('priorita', 100),
                rule_dict.get('created_at'),
                rule_dict.get('updated_at')
            ))

    # Step 5: Drop the old table (if it exists)
    cursor.execute("DROP TABLE IF EXISTS regole_monitoraggio")
    cursor.execute("DROP VIEW IF EXISTS v_regole_monitoraggio_attive")
    cursor.execute("DROP VIEW IF EXISTS v_regole_per_categoria")


    conn.commit()
    conn.close()
    print("Migration '005_create_automation_engine_tables.py' applied successfully.")

def downgrade(db_path):
    # This is a destructive downgrade. It's complex to revert the data perfectly.
    # For this project, we'll just drop the new tables and recreate the old one empty.
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("DROP TABLE IF EXISTS automation_rules")
    cursor.execute("DROP TABLE IF EXISTS actions")

    # Recreate the old 'regole_monitoraggio' table structure
    cursor.execute("""
    CREATE TABLE regole_monitoraggio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo_prestazione_id TEXT NOT NULL,
        categoria_prestazione INTEGER,
        nome_prestazione TEXT,
        callback_function TEXT NOT NULL,
        parametri_callback TEXT,
        priorita INTEGER DEFAULT 100,
        attiva BOOLEAN DEFAULT 1,
        monitor_type TEXT DEFAULT 'PERIODIC_CHECK',
        interval_seconds INTEGER DEFAULT 30,
        descrizione TEXT,
        created_by TEXT DEFAULT 'system',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        is_system_rule BOOLEAN DEFAULT 0,
        last_executed TEXT,
        execution_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        notes TEXT,
        metadata TEXT
    )
    """)

    conn.commit()
    conn.close()
    print("Downgrade for '005_create_automation_engine_tables.py' applied. New tables dropped, old table structure recreated (empty).")

if __name__ == '__main__':
    # Simple CLI to run upgrade or downgrade
    import sys
    if len(sys.argv) != 2 or sys.argv[1] not in ['upgrade', 'downgrade']:
        print("Usage: python 005_create_automation_engine_tables.py [upgrade|downgrade]")
        sys.exit(1)
        
    db_path = 'server_v2/instance/studio_dima.db'
    
    if sys.argv[1] == 'upgrade':
        upgrade(db_path)
    elif sys.argv[1] == 'downgrade':
        downgrade(db_path)
