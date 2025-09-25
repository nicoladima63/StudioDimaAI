"""
Migration: Create regole_monitoraggio table for prestazioni monitoring rules.

This table will store monitoring rules that couple prestazione types with callback functions
for the monitoring system.
"""

import sqlite3
import os
from datetime import datetime

def get_db_path():
    """Get the SQLite database path."""
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'studio_dima.db')

def create_regole_monitoraggio_table():
    """Create the regole_monitoraggio table if it doesn't exist."""
    db_path = get_db_path()
    
    # Ensure instance directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create regole_monitoraggio table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS regole_monitoraggio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                
                -- Identificativi prestazione
                tipo_prestazione_id TEXT NOT NULL,           -- ID prestazione da ONORARIO.DBF
                categoria_prestazione INTEGER,               -- Categoria prestazione (1-12)
                nome_prestazione TEXT,                       -- Nome prestazione per riferimento
                
                -- Configurazione callback
                callback_function TEXT NOT NULL,             -- Nome funzione callback
                parametri_callback TEXT,                     -- JSON con parametri specifici
                priorita INTEGER DEFAULT 100,                -- Priorità esecuzione (1-1000)
                
                -- Configurazione monitoraggio
                attiva BOOLEAN DEFAULT 1,                    -- Regola attiva/disattiva
                monitor_type TEXT DEFAULT 'PERIODIC_CHECK',  -- Tipo monitoraggio
                interval_seconds INTEGER DEFAULT 30,         -- Intervallo controllo
                
                -- Metadati
                descrizione TEXT,                            -- Descrizione regola
                created_by TEXT DEFAULT 'system',            -- Chi ha creato la regola
                created_at TEXT DEFAULT (datetime('now')),   -- Data creazione
                updated_at TEXT DEFAULT (datetime('now')),   -- Data ultimo aggiornamento
                
                -- Flags di stato
                is_system_rule BOOLEAN DEFAULT 0,            -- Regola di sistema (non modificabile)
                last_executed TEXT,                          -- Ultima esecuzione
                execution_count INTEGER DEFAULT 0,           -- Contatore esecuzioni
                success_count INTEGER DEFAULT 0,             -- Contatore successi
                error_count INTEGER DEFAULT 0,               -- Contatore errori
                
                -- Note e configurazione aggiuntiva
                notes TEXT,
                metadata TEXT                                -- JSON con metadati aggiuntivi
            )
        """)
        
        # Create indexes for better performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_regole_tipo_prestazione ON regole_monitoraggio(tipo_prestazione_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_regole_categoria ON regole_monitoraggio(categoria_prestazione)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_regole_attiva ON regole_monitoraggio(attiva)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_regole_callback ON regole_monitoraggio(callback_function)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_regole_priorita ON regole_monitoraggio(priorita)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_regole_system ON regole_monitoraggio(is_system_rule)")
        
        # Create trigger to update updated_at timestamp
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS update_regole_monitoraggio_timestamp 
            AFTER UPDATE ON regole_monitoraggio
            BEGIN
                UPDATE regole_monitoraggio SET updated_at = datetime('now') WHERE id = NEW.id;
            END
        """)
        
        # Create view for active monitoring rules
        cursor.execute("""
            CREATE VIEW IF NOT EXISTS v_regole_monitoraggio_attive AS
            SELECT 
                id, tipo_prestazione_id, categoria_prestazione, nome_prestazione,
                callback_function, parametri_callback, priorita, monitor_type,
                interval_seconds, descrizione, created_by, last_executed,
                execution_count, success_count, error_count, notes
            FROM regole_monitoraggio 
            WHERE attiva = 1
            ORDER BY priorita ASC, categoria_prestazione ASC, tipo_prestazione_id ASC
        """)
        
        # Create view for rules by category
        cursor.execute("""
            CREATE VIEW IF NOT EXISTS v_regole_per_categoria AS
            SELECT 
                categoria_prestazione,
                COUNT(*) as totale_regole,
                COUNT(CASE WHEN attiva = 1 THEN 1 END) as regole_attive,
                COUNT(CASE WHEN is_system_rule = 1 THEN 1 END) as regole_sistema,
                AVG(execution_count) as media_esecuzioni,
                AVG(success_count * 100.0 / NULLIF(execution_count, 0)) as tasso_successo
            FROM regole_monitoraggio 
            GROUP BY categoria_prestazione
            ORDER BY categoria_prestazione
        """)
        
        conn.commit()
        print(f"SUCCESS: Regole monitoraggio table created successfully in {db_path}")
        print("Indexes, triggers and views created for optimal performance")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Error creating regole_monitoraggio table: {e}")
        raise
    finally:
        conn.close()

def drop_regole_monitoraggio_table():
    """Drop the regole_monitoraggio table (for development/testing)."""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        print("ERROR: Database file not found")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("DROP VIEW IF EXISTS v_regole_per_categoria")
        cursor.execute("DROP VIEW IF EXISTS v_regole_monitoraggio_attive")
        cursor.execute("DROP TABLE IF EXISTS regole_monitoraggio")
        conn.commit()
        print("SUCCESS: Regole monitoraggio table and views dropped successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Error dropping regole_monitoraggio table: {e}")
        raise
    finally:
        conn.close()

def insert_sample_rules():
    """Insert some sample monitoring rules for testing."""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        print("ERROR: Database file not found")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Sample rules for different prestazioni
        sample_rules = [
            {
                'tipo_prestazione_id': 'ZZZZEC',
                'categoria_prestazione': 1,
                'nome_prestazione': 'Visita di controllo',
                'callback_function': 'log_prestazione_eseguita',
                'parametri_callback': '{"log_level": "info", "include_paziente": true}',
                'priorita': 100,
                'descrizione': 'Log quando viene eseguita una visita di controllo',
                'is_system_rule': 1
            },
            {
                'tipo_prestazione_id': 'ZZZZIG',
                'categoria_prestazione': 11,
                'nome_prestazione': 'Igiene orale',
                'callback_function': 'notify_igiene_completata',
                'parametri_callback': '{"send_sms": true, "template": "igiene_completata"}',
                'priorita': 200,
                'descrizione': 'Notifica quando viene completata igiene orale',
                'is_system_rule': 1
            },
            {
                'tipo_prestazione_id': 'ZZZZCO',
                'categoria_prestazione': 2,
                'nome_prestazione': 'Conservativa',
                'callback_function': 'update_costo_materiali',
                'parametri_callback': '{"track_materials": true, "auto_calculate": true}',
                'priorita': 150,
                'descrizione': 'Aggiorna costi materiali per prestazioni conservative',
                'is_system_rule': 0
            }
        ]
        
        for rule in sample_rules:
            cursor.execute("""
                INSERT OR IGNORE INTO regole_monitoraggio 
                (tipo_prestazione_id, categoria_prestazione, nome_prestazione, 
                 callback_function, parametri_callback, priorita, descrizione, is_system_rule)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rule['tipo_prestazione_id'],
                rule['categoria_prestazione'],
                rule['nome_prestazione'],
                rule['callback_function'],
                rule['parametri_callback'],
                rule['priorita'],
                rule['descrizione'],
                rule['is_system_rule']
            ))
        
        conn.commit()
        print(f"SUCCESS: Inserted {len(sample_rules)} sample monitoring rules")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Error inserting sample rules: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "drop":
            drop_regole_monitoraggio_table()
        elif sys.argv[1] == "sample":
            create_regole_monitoraggio_table()
            insert_sample_rules()
        else:
            print("Usage: python create_regole_monitoraggio_table.py [drop|sample]")
    else:
        create_regole_monitoraggio_table()
