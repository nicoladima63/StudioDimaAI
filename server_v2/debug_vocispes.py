#!/usr/bin/env python3
"""
Debug per verificare la struttura di VOCISPES.DBF
"""

import os
from dbfread import DBF

def debug_vocispes():
    """Debug della struttura di VOCISPES.DBF"""
    
    vocispes_path = os.path.join('..', 'windent', 'DATI', 'VOCISPES.DBF')
    
    if not os.path.exists(vocispes_path):
        print(f"❌ File non trovato: {vocispes_path}")
        return
    
    print("🔍 DEBUG VOCISPES.DBF")
    print("=" * 40)
    
    try:
        with DBF(vocispes_path, encoding='latin-1') as table:
            print(f"Record totali: {len(table)}")
            print(f"Campi disponibili: {len(table.field_names)}")
            
            print(f"\nNomi dei campi:")
            for i, field in enumerate(table.field_names):
                print(f"  {i+1:2d}. {field}")
            
            # Prova a leggere il primo record
            print(f"\nPrimo record (raw):")
            first_record = next(iter(table))
            if first_record:
                for field_name in table.field_names:
                    value = first_record.get(field_name)
                    print(f"  {field_name}: {repr(value)} (tipo: {type(value)})")
            
            # Prova con encoding diverso
            print(f"\nTentativo con encoding 'cp1252':")
            try:
                with DBF(vocispes_path, encoding='cp1252') as table2:
                    first_record2 = next(iter(table2))
                    if first_record2:
                        for field_name in table2.field_names[:5]:  # Solo primi 5 campi
                            value = first_record2.get(field_name)
                            if isinstance(value, bytes):
                                try:
                                    decoded = value.decode('cp1252')
                                    print(f"  {field_name}: {decoded}")
                                except:
                                    print(f"  {field_name}: [errore decodifica]")
                            else:
                                print(f"  {field_name}: {value}")
            except Exception as e:
                print(f"  Errore con cp1252: {e}")
            
    except Exception as e:
        print(f"❌ Errore: {e}")

if __name__ == "__main__":
    debug_vocispes()
