"""
Batch migration script for richiami data.

Reads all patients from gestionale (DBF) with tipo_richiamo set
and inserts them into the richiami table if they don't already exist.
"""

import sqlite3
import os
import sys
import logging
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.pazienti_service import PazientiService
from core.database_manager import DatabaseManager
from core.config_manager import get_config

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_existing_richiami():
    """Get all existing paziente_ids from richiami table."""
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), 
        'instance', 
        'studio_dima.db'
    )
    
    existing = set()
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT paziente_id FROM richiami")
            existing = {row[0] for row in cursor.fetchall()}
            conn.close()
            logger.info(f"Found {len(existing)} existing richiami records")
        except Exception as e:
            logger.error(f"Error reading existing richiami: {e}")
    
    return existing

def batch_insert_richiami(pazienti_to_insert):
    """Insert pazienti in batch into richiami table."""
    if not pazienti_to_insert:
        logger.info("No patients to insert")
        return 0
    
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), 
        'instance', 
        'studio_dima.db'
    )
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Prepare batch insert data
        insert_data = []
        for paziente in pazienti_to_insert:
            # Calculate data_richiamo if possible
            data_richiamo = None
            if paziente.get('ultima_visita') and paziente.get('tempo_richiamo'):
                try:
                    ultima = datetime.fromisoformat(paziente['ultima_visita'].replace('Z', '+00:00'))
                    richiamo_date = ultima + timedelta(days=paziente['tempo_richiamo'] * 30)
                    data_richiamo = richiamo_date.isoformat()[:10]
                except (ValueError, TypeError):
                    pass
            
            insert_data.append((
                paziente['id'],                                    # paziente_id
                paziente.get('nome', f"Paziente {paziente['id']}"), # nome
                paziente.get('ultima_visita'),                     # data_ultima_visita
                data_richiamo,                                     # data_richiamo
                paziente.get('tipo_richiamo', '1'),               # tipo_richiamo
                paziente.get('tempo_richiamo', 6),                # tempo_richiamo
                paziente.get('da_richiamare', 'S')                # da_richiamare
            ))
        
        # Execute batch insert
        cursor.executemany("""
            INSERT INTO richiami (
                paziente_id, nome, data_ultima_visita, data_richiamo,
                tipo_richiamo, tempo_richiamo, da_richiamare
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, insert_data)
        
        conn.commit()
        inserted_count = cursor.rowcount
        conn.close()
        
        logger.info(f"Successfully inserted {inserted_count} richiami records")
        return inserted_count
        
    except Exception as e:
        logger.error(f"Error during batch insert: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return 0

def main():
    """Main migration function."""
    print("=== RICHIAMI BATCH MIGRATION ===")
    logger.info("Starting richiami batch migration...")
    
    try:
        # Initialize services
        print("Initializing DatabaseManager...")
        db_manager = DatabaseManager()
        print("Initializing PazientiService...")
        pazienti_service = PazientiService(db_manager)
        print("PazientiService initialized OK")
        
        # Get existing richiami to avoid duplicates
        print("Getting existing richiami...")
        existing_richiami = get_existing_richiami()
        print(f"Found {len(existing_richiami)} existing richiami")
        
        # Get all pazienti from gestionale (like PazientiStore does)
        print("Reading all pazienti from gestionale...")
        logger.info("Reading all pazienti from gestionale...")
        
        # Use the same approach as PazientiStore - get all at once
        result = pazienti_service.get_pazienti_paginated(page=1, per_page=999999)
        
        if not result['success'] or not result['data']['pazienti']:
            logger.error("Failed to load pazienti from gestionale")
            return
        
        pazienti = result['data']['pazienti']
        total_found = len(pazienti)
        total_to_migrate = 0
        pazienti_to_insert = []
        
        print(f"Loaded {total_found} pazienti from gestionale")
        
        # Show first record for debugging
        # if pazienti:
        #     print("=== FIRST PATIENT RECORD ===")
        #     first_patient = pazienti[0]
        #     for key, value in first_patient.items():
        #         print(f"  {key}: {value}")
        #     print("=== END FIRST RECORD ===")
        
        # Filter pazienti that need migration
        print("Filtering pazienti that need migration...")
        for paziente in pazienti:
            paziente_id = paziente.get('id')
            tipo_richiamo = paziente.get('tipo_richiamo')
            
            # Check if patient has tipo_richiamo and is not already in richiami table
            if paziente_id not in existing_richiami:
                pazienti_to_insert.append(paziente)
                total_to_migrate += 1
        
        print(f"Filtering completed. Found {total_to_migrate} patients to migrate")
        
        logger.info(f"Found {total_found} total patients")
        logger.info(f"Found {total_to_migrate} patients to migrate (have tipo_richiamo but not in richiami table)")
        
        if total_to_migrate == 0:
            logger.info("No migration needed - all patients with tipo_richiamo already exist in richiami table")
            return
        
        # Show some examples
        logger.info("Examples of patients to migrate:")
        for i, p in enumerate(pazienti_to_insert[:5]):
            logger.info(f"  {i+1}. {p['id']} - {p.get('nome', 'N/A')} - tipo: {p.get('tipo_richiamo')} - tempo: {p.get('tempo_richiamo')}")
        
        # Confirm migration
        if len(sys.argv) > 1 and sys.argv[1] == '--execute':
            # Execute migration
            inserted = batch_insert_richiami(pazienti_to_insert)
            logger.info(f"Migration completed! Inserted {inserted} records")
        else:
            logger.info("DRY RUN - Add --execute flag to actually perform the migration")
            logger.info(f"Command: python scripts/migrate_richiami_batch.py --execute")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()