#!/usr/bin/env python3
"""
Debug pattern FILES senza RECIPROC.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.materiali_migration_service import MaterialiMigrationService
from core.database_manager import DatabaseManager

def debug_files_patterns():
    """Debug pattern FILES."""
    
    print("🔍 Debug Pattern FILES")
    print("=" * 30)
    
    # Inizializza servizio
    db_manager = DatabaseManager()
    service = MaterialiMigrationService(db_manager)
    
    # Carica pattern
    patterns = service._load_existing_patterns()
    
    # Cerca pattern con FILES
    files_patterns = []
    for pattern in patterns:
        pattern_clean = service._clean_material_name(pattern['nome']).lower()
        if 'files' in pattern_clean:
            files_patterns.append({
                'nome': pattern['nome'],
                'clean': pattern_clean,
                'sottoconto': pattern['classification']['sottocontonome']
            })
    
    print(f"Pattern con FILES trovati: {len(files_patterns)}")
    
    # Separa con e senza RECIPROC
    reciproc_files = []
    manual_files = []
    
    for pattern in files_patterns:
        if 'reciproc' in pattern['clean']:
            reciproc_files.append(pattern)
        else:
            manual_files.append(pattern)
    
    print(f"\nFILES con RECIPROC: {len(reciproc_files)}")
    for pattern in reciproc_files[:3]:  # Prime 3
        print(f"   {pattern['nome']} → {pattern['sottoconto']}")
    
    print(f"\nFILES senza RECIPROC: {len(manual_files)}")
    for pattern in manual_files[:3]:  # Prime 3
        print(f"   {pattern['nome']} → {pattern['sottoconto']}")

if __name__ == "__main__":
    debug_files_patterns()
