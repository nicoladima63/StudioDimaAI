#!/usr/bin/env python3
"""
Debug per capire da dove viene il codice articolo.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.materiali_migration_service import MaterialiMigrationService
from core.database_manager import DatabaseManager

def debug_codice_articolo():
    """Debug codice articolo."""
    
    print("🔍 Debug Codice Articolo")
    print("=" * 30)
    
    # Inizializza servizio
    db_manager = DatabaseManager()
    service = MaterialiMigrationService(db_manager)
    
    # Leggi dati DBF
    materials_data = service.read_spesafo_data()
    
    # Filtra per Umbra (ZZZZZZ)
    umbra_materials = [
        material for material in materials_data 
        if material.get('fornitoreid', '') == 'ZZZZZZ'
    ]
    
    print(f"Materiali Umbra trovati: {len(umbra_materials)}")
    
    # Mostra primi 5 con tutti i campi
    print("\nPrimi 5 materiali Umbra (tutti i campi):")
    for i, material in enumerate(umbra_materials[:5]):
        print(f"\n{i+1}. Materiale:")
        for key, value in material.items():
            print(f"   {key}: {value}")

if __name__ == "__main__":
    debug_codice_articolo()
