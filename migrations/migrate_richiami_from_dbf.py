"""
Migration: Import existing richiami data from DBF gestionale to SQLite table.

This migration reads existing richiamo data from the DBF PAZIENTI file
and imports it into our new richiami table.
"""

import sqlite3
import os
import logging
from datetime import datetime, timedelta
from services.pazienti_service import PazientiService
from services.richiami_service import RichiamiService

logger = logging.getLogger(__name__)

def migrate_richiami_from_dbf():
    """Migrate existing richiami data from DBF to SQLite."""
    print("Starting migration of richiami from DBF gestionale...")
    
    try:
        # Initialize services
        pazienti_service = PazientiService()
        richiami_service = RichiamiService()
        
        # Get all pazienti with richiami data
        print("Fetching pazienti from DBF...")
        result = pazienti_service.get_pazienti_paginated(page=1, per_page=10000)
        
        if not result['success']:
            print(f"ERROR: Could not fetch pazienti: {result.get('error')}")
            return
        
        pazienti = result['data']['pazienti']
        print(f"Found {len(pazienti)} pazienti in DBF")
        
        migrated_count = 0
        skipped_count = 0
        error_count = 0
        
        for paziente in pazienti:
            try:
                paziente_id = paziente.get('id')
                nome = paziente.get('nome', 'N/A')
                da_richiamare = paziente.get('da_richiamare', '').strip()
                tipo_richiamo = paziente.get('tipo_richiamo', '').strip()
                tempo_richiamo = paziente.get('mesi_richiamo')  # Note: field name difference
                ultima_visita = paziente.get('ultima_visita')
                
                # Skip if no richiamo data
                if not da_richiamare or da_richiamare not in ['S', 'N', 'R']:
                    skipped_count += 1
                    continue
                
                # Check if already exists in richiami table
                existing = richiami_service.get_richiami_paziente(paziente_id)
                if existing['success'] and existing['data']:
                    print(f"SKIP: Paziente {paziente_id} ({nome}) already has richiami records")
                    skipped_count += 1
                    continue
                
                # Create richiamo record
                create_result = richiami_service.create_richiamo(
                    paziente_id=paziente_id,
                    nome=nome,
                    data_ultima_visita=ultima_visita,
                    tipo_richiamo=tipo_richiamo if tipo_richiamo else None,
                    tempo_richiamo=tempo_richiamo if tempo_richiamo and isinstance(tempo_richiamo, int) else None
                )
                
                if create_result['success']:
                    # Update status to match DBF
                    status_result = richiami_service.update_richiamo_status(
                        paziente_id=paziente_id,
                        da_richiamare=da_richiamare,
                        data_richiamo=None  # We'll calculate this based on ultima_visita + tempo
                    )
                    
                    if status_result['success']:
                        migrated_count += 1
                        status_text = {
                            'S': 'DA RICHIAMARE',
                            'N': 'NON RICHIAMARE', 
                            'R': 'RICHIAMATO'
                        }.get(da_richiamare, da_richiamare)
                        
                        tipo_text = f" (tipo: {tipo_richiamo})" if tipo_richiamo else ""
                        tempo_text = f" ogni {tempo_richiamo} mesi" if tempo_richiamo else ""
                        
                        print(f"OK: {paziente_id} ({nome}) -> {status_text}{tipo_text}{tempo_text}")
                    else:
                        print(f"ERROR: Could not update status for {paziente_id}: {status_result.get('error')}")
                        error_count += 1
                else:
                    print(f"ERROR: Could not create richiamo for {paziente_id}: {create_result.get('error')}")
                    error_count += 1
                    
            except Exception as e:
                print(f"ERROR: Exception processing paziente {paziente.get('id', 'UNKNOWN')}: {e}")
                error_count += 1
                continue
        
        print(f"\nMIGRATION COMPLETED:")
        print(f"  Migrated: {migrated_count}")
        print(f"  Skipped: {skipped_count}")
        print(f"  Errors: {error_count}")
        print(f"  Total processed: {len(pazienti)}")
        
    except Exception as e:
        print(f"FATAL ERROR in migration: {e}")
        logger.error(f"Migration failed: {e}")

def check_migration_status():
    """Check current status of migration."""
    print("Checking migration status...")
    
    try:
        richiami_service = RichiamiService()
        stats = richiami_service.get_statistiche_richiami()
        
        if stats['success']:
            data = stats['data']
            print(f"Current richiami table:")
            print(f"  Total records: {data['totale']}")
            print(f"  Da fare: {data['da_fare']}")
            print(f"  Scaduti: {data['scaduti']}")
            print(f"  Completati: {data['completati']}")
        else:
            print(f"ERROR: Could not get statistics: {stats.get('error')}")
            
    except Exception as e:
        print(f"ERROR checking status: {e}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        check_migration_status()
    else:
        print("RICHIAMI MIGRATION TOOL")
        print("======================")
        print("This will import existing richiamo data from DBF gestionale into SQLite.")
        print("Existing records in richiami table will be skipped.")
        print("")
        
        confirm = input("Proceed with migration? (y/N): ")
        if confirm.lower() == 'y':
            migrate_richiami_from_dbf()
        else:
            print("Migration cancelled.")
    
    print("\nTo check current status: python migrate_richiami_from_dbf.py status")