#!/usr/bin/env python3
"""
Debug dettagliato del pattern matching.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.materiali_migration_service import MaterialiMigrationService
from core.database_manager import DatabaseManager

def debug_pattern_matching():
    """Debug pattern matching."""
    
    print("🔍 Debug Pattern Matching Dettagliato")
    print("=" * 50)
    
    # Inizializza servizio
    db_manager = DatabaseManager()
    service = MaterialiMigrationService(db_manager)
    
    # Carica pattern
    patterns = service._load_existing_patterns()
    
    # Test specifico
    test_product = 'RECIPROC BLUE PUNTE CARTA R40'
    print(f"Prodotto da testare: {test_product}")
    
    # Mostra tutti i pattern RECIPROC
    reciproc_patterns = [p for p in patterns if 'reciproc' in p['nome'].lower()]
    print(f"\nPattern RECIPROC trovati: {len(reciproc_patterns)}")
    
    for i, pattern in enumerate(reciproc_patterns):
        print(f"\n{i+1}. {pattern['nome']}")
        print(f"   Sottoconto: {pattern['classification']['sottocontonome']}")
        
        # Testa similarità
        similarity = service._calculate_similarity(
            service._clean_material_name(test_product),
            service._clean_material_name(pattern['nome'])
        )
        print(f"   Similarità: {similarity:.2f} ({similarity*100:.0f}%)")

if __name__ == "__main__":
    debug_pattern_matching()
