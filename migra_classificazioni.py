"""
Script per migrare le classificazioni da classificazioni_costi.db a studio_dima.db
"""
import sqlite3
import os

def migra_classificazioni():
    instance_path = "server/instance"
    source_db = os.path.join(instance_path, "classificazioni_costi.db")
    target_db = os.path.join(instance_path, "studio_dima.db")
    
    if not os.path.exists(source_db):
        print("File classificazioni_costi.db non trovato, nessuna migrazione necessaria")
        return
    
    if not os.path.exists(target_db):
        print("File studio_dima.db non trovato, creazione...")
        # Crea il database target vuoto
        with sqlite3.connect(target_db) as conn:
            pass
    
    # Connetti a entrambi i database
    conn_source = sqlite3.connect(source_db)
    conn_target = sqlite3.connect(target_db)
    
    try:
        # Crea la tabella nel database target se non esiste
        conn_target.execute('''
            CREATE TABLE IF NOT EXISTS classificazioni_costi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codice_riferimento TEXT NOT NULL,
                tipo_entita TEXT NOT NULL CHECK (tipo_entita IN ('fornitore', 'spesa')),
                tipo_di_costo INTEGER NOT NULL CHECK (tipo_di_costo IN (1, 2, 3)),
                categoria INTEGER,
                categoria_conto TEXT,
                note TEXT,
                data_classificazione DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_modifica DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE(codice_riferimento, tipo_entita)
            )
        ''')
        
        # Indici
        conn_target.execute('''
            CREATE INDEX IF NOT EXISTS idx_codice_tipo 
            ON classificazioni_costi(codice_riferimento, tipo_entita)
        ''')
        
        conn_target.execute('''
            CREATE INDEX IF NOT EXISTS idx_tipo_costo 
            ON classificazioni_costi(tipo_di_costo)
        ''')
        
        # Copia i dati
        cursor_source = conn_source.execute("SELECT * FROM classificazioni_costi")
        rows = cursor_source.fetchall()
        
        if rows:
            print(f"Migrando {len(rows)} classificazioni...")
            
            # Ottieni i nomi delle colonne
            column_names = [description[0] for description in cursor_source.description]
            print(f"Colonne: {column_names}")
            
            # Insert con gestione conflitti
            placeholders = ', '.join(['?' for _ in column_names])
            conn_target.executemany(
                f"INSERT OR REPLACE INTO classificazioni_costi ({', '.join(column_names)}) VALUES ({placeholders})",
                rows
            )
            
            conn_target.commit()
            print(f"Migrazione completata: {len(rows)} record copiati")
        else:
            print("Nessun record da migrare")
        
        # Verifica
        count = conn_target.execute("SELECT COUNT(*) FROM classificazioni_costi").fetchone()[0]
        print(f"Record totali in studio_dima.db: {count}")
        
    except Exception as e:
        print(f"Errore durante la migrazione: {e}")
        conn_target.rollback()
    
    finally:
        conn_source.close()
        conn_target.close()

if __name__ == "__main__":
    migra_classificazioni()