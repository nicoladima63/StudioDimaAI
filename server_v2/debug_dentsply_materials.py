#!/usr/bin/env python3
"""
Debug per capire perché i materiali Dentsply non hanno nomi corretti.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.materiali_migration_service import MaterialiMigrationService
from core.database_manager import DatabaseManager

def debug_dentsply_materials():
    """Debug materiali Dentsply."""
    
    print("🔍 Debug Materiali Dentsply")
    print("=" * 40)
    
    # Inizializza servizio
    db_manager = DatabaseManager()
    service = MaterialiMigrationService(db_manager)
    
    # Leggi dati DBF
    print("\n1. Lettura dati DBF...")
    materials_data = service.read_spesafo_data()
    print(f"   Materiali totali: {len(materials_data)}")
    
    # Filtra per Dentsply
    dentsply_materials = [
        material for material in materials_data 
        if material.get('fornitoreid', '') == 'ZZZZZO'
    ]
    print(f"   Materiali Dentsply: {len(dentsply_materials)}")
    
    # Mostra primi 10 materiali Dentsply con tutti i campi
    print("\n2. Primi 10 materiali Dentsply (tutti i campi):")
    for i, material in enumerate(dentsply_materials[:10]):
        print(f"\n   Materiale {i+1}:")
        for key, value in material.items():
            print(f"     {key}: {value}")
    
    # Cerca prodotti specifici
    print("\n3. Ricerca prodotti specifici:")
    target_products = [
        'RECIPROC BLUE FILES',
        'RECIPROC BLUE PAPER',
        'CELTRA DUO',
        'SDR FLOW'
    ]
    
    for target in target_products:
        found = False
        for material in dentsply_materials:
            nome = material.get('nome', '')
            if target.lower() in nome.lower():
                print(f"   ✅ Trovato '{target}' in: {nome}")
                found = True
                break
        
        if not found:
            print(f"   ❌ '{target}' NON TROVATO")

if __name__ == "__main__":
    debug_dentsply_materials()
