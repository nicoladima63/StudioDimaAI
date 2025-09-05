#!/usr/bin/env python3
"""
Debug per capire i nomi dei sottoconti.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.database_manager import DatabaseManager

def debug_sottoconti():
    """Debug nomi sottoconti."""
    
    print("🔍 Debug Sottoconti")
    print("=" * 30)
    
    db_manager = DatabaseManager()
    
    # Controlla tabella sottoconti
    print("\n1. Tabella sottoconti:")
    sottoconti = db_manager.execute_query("SELECT id, nome FROM sottoconti WHERE id IN (7, 19, 91)")
    
    for sottoconto in sottoconti:
        print(f"   ID {sottoconto['id']}: {sottoconto['nome']}")
    
    # Controlla materiali esistenti
    print("\n2. Materiali esistenti con sottoconto:")
    materials = db_manager.execute_query("""
        SELECT nome, sottocontonome 
        FROM materiali 
        WHERE nome LIKE '%RECIPROC%' AND sottocontonome IS NOT NULL
        LIMIT 5
    """)
    
    for material in materials:
        print(f"   {material['nome']} → {material['sottocontonome']}")

if __name__ == "__main__":
    debug_sottoconti()
