"""
Migration: Create materiali table for dental materials management.

This table will store materials information from VOCISPES.DBF with intelligent
filtering for dental-specific materials (resina, strisce, perni, cunei, etc.).
"""

import sqlite3
import os
from datetime import datetime

def get_db_path():
    """Get the SQLite database path."""
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'studio_dima.db')

def create_materiali_table():
    """Create the materiali table if it doesn't exist."""
    db_path = get_db_path()
    
    # Ensure instance directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create materiali table based on VOCISPES.DBF structure + enhancements
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS materiali (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                
                -- Dati base da VOCISPES.DBF
                codice_materiale TEXT,
                descrizione TEXT NOT NULL,
                codice_fornitore TEXT,
                prezzo DECIMAL(10,2),
                
                -- Dati arricchiti
                nome_fornitore TEXT,
                categoria_materiale TEXT,
                sottocategoria TEXT,
                unita_misura TEXT,
                
                -- Classificazione intelligente
                is_dental_material BOOLEAN DEFAULT 1,
                material_type TEXT, -- 'resina', 'strisce', 'perni', 'cunei', etc.
                confidence_score INTEGER DEFAULT 100,
                
                -- Gestione inventario
                quantita_disponibile DECIMAL(10,3) DEFAULT 0,
                quantita_minima DECIMAL(10,3) DEFAULT 0,
                costo_unitario DECIMAL(10,2),
                
                -- Metadati
                source_file TEXT DEFAULT 'VOCISPES.DBF',
                migrated_at TEXT DEFAULT (datetime('now')),
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                
                -- Flags di stato
                is_active BOOLEAN DEFAULT 1,
                is_favorite BOOLEAN DEFAULT 0,
                notes TEXT
            )
        """)
        
        # Create indexes for better performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiali_codice ON materiali(codice_materiale)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiali_descrizione ON materiali(descrizione)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiali_fornitore ON materiali(codice_fornitore)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiali_categoria ON materiali(categoria_materiale)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiali_type ON materiali(material_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiali_active ON materiali(is_active)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiali_dental ON materiali(is_dental_material)")
        
        # Create trigger to update updated_at timestamp
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS update_materiali_timestamp 
            AFTER UPDATE ON materiali
            BEGIN
                UPDATE materiali SET updated_at = datetime('now') WHERE id = NEW.id;
            END
        """)
        
        # Create view for active dental materials
        cursor.execute("""
            CREATE VIEW IF NOT EXISTS v_materiali_attivi AS
            SELECT 
                id, codice_materiale, descrizione, nome_fornitore,
                categoria_materiale, material_type, prezzo, costo_unitario,
                quantita_disponibile, quantita_minima,
                confidence_score, is_favorite, created_at
            FROM materiali 
            WHERE is_active = 1 AND is_dental_material = 1
            ORDER BY descrizione
        """)
        
        conn.commit()
        print(f"SUCCESS: Materiali table created successfully in {db_path}")
        print("Indexes and triggers created for optimal performance")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Error creating materiali table: {e}")
        raise
    finally:
        conn.close()

def drop_materiali_table():
    """Drop the materiali table (for development/testing)."""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        print("ERROR: Database file not found")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("DROP VIEW IF EXISTS v_materiali_attivi")
        cursor.execute("DROP TABLE IF EXISTS materiali")
        conn.commit()
        print("SUCCESS: Materiali table and view dropped successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Error dropping materiali table: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "drop":
        drop_materiali_table()
    else:
        create_materiali_table()
