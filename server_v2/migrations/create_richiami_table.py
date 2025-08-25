"""
Migration: Create richiami table for patient recall management.

This table will store recall information separately from the main gestionale DBF files.
"""

import sqlite3
import os
from datetime import datetime

def get_db_path():
    """Get the SQLite database path."""
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'studio_dima.db')

def create_richiami_table():
    """Create the richiami table if it doesn't exist."""
    db_path = get_db_path()
    
    # Ensure instance directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create richiami table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS richiami (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                paziente_id TEXT NOT NULL,
                nome TEXT NOT NULL,
                data_ultima_visita TEXT,
                data_richiamo TEXT,
                richiamato_il TEXT,
                tipo_richiamo TEXT,
                tempo_richiamo INTEGER,
                da_richiamare TEXT CHECK(da_richiamare IN ('S', 'N', 'R')) DEFAULT 'S',
                sms_sent BOOLEAN DEFAULT 0,
                note TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        
        # Create indexes for better performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_richiami_paziente_id ON richiami(paziente_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_richiami_data_richiamo ON richiami(data_richiamo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_richiami_da_richiamare ON richiami(da_richiamare)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_richiami_sms_sent ON richiami(sms_sent)")
        
        # Create trigger to update updated_at timestamp
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS update_richiami_timestamp 
            AFTER UPDATE ON richiami
            BEGIN
                UPDATE richiami SET updated_at = datetime('now') WHERE id = NEW.id;
            END
        """)
        
        conn.commit()
        print(f"SUCCESS: Richiami table created successfully in {db_path}")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Error creating richiami table: {e}")
        raise
    finally:
        conn.close()

def drop_richiami_table():
    """Drop the richiami table (for development/testing)."""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        print("ERROR: Database file not found")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("DROP TABLE IF EXISTS richiami")
        conn.commit()
        print("SUCCESS: Richiami table dropped successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Error dropping richiami table: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "drop":
        drop_richiami_table()
    else:
        create_richiami_table()