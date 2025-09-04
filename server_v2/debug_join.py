#!/usr/bin/env python3
"""
Debug del join per capire perché non trova materiali validi
"""

import os
from dbfread import DBF

def debug_join():
    """Debug del join"""
    
    print("🔍 DEBUG JOIN")
    print("=" * 30)
    print("Inizio debug...")
    
    # Percorsi dei file DBF
    vocispes_path = os.path.join('..', 'windent', 'DATI', 'VOCISPES.DBF')
    spesafo_path = os.path.join('..', 'windent', 'DATI', 'SPESAFOR.DBF')
    fornitor_path = os.path.join('..', 'windent', 'DATI', 'FORNITOR.DBF')
    
    try:
        # 1. Carica SPESAFOR
        print("1. SPESAFOR.DBF:")
        spesafo_map = {}
        with DBF(spesafo_path, encoding='latin-1') as spesafo_table:
            count = 0
            for record in spesafo_table:
                if count >= 10:  # Solo primi 10
                    break
                if record is None:
                    continue
                
                spfocod = record.get('DB_SPFOCOD', '')
                code = record.get('DB_CODE', '')
                print(f"   {spfocod} -> {code}")
                
                if spfocod and code:
                    spesafo_map[spfocod] = code
                count += 1
        
        print(f"   Mappings totali: {len(spesafo_map)}")
        
        # 2. Carica FORNITOR
        print("\n2. FORNITOR.DBF:")
        fornitor_map = {}
        with DBF(fornitor_path, encoding='latin-1') as fornitor_table:
            count = 0
            for record in fornitor_table:
                if count >= 10:  # Solo primi 10
                    break
                if record is None:
                    continue
                
                code = record.get('DB_CODE', '')
                nome = record.get('DB_FONOME', '')
                print(f"   {code} -> {nome}")
                
                if code and nome:
                    fornitor_map[code] = nome
                count += 1
        
        print(f"   Fornitori totali: {len(fornitor_map)}")
        
        # 3. Testa VOCISPES
        print("\n3. VOCISPES.DBF (primi 20 record):")
        with DBF(vocispes_path, encoding='latin-1') as table:
            count = 0
            for record in table:
                if count >= 20:
                    break
                if record is None:
                    continue
                
                vospcod = record.get('DB_VOSPCOD', '')
                descrizione = record.get('DB_VODESCR', '')
                prezzo = float(record.get('DB_VOPREZZ', 0))
                
                # Trova fornitoreid tramite SPESAFOR
                fornitoreid = spesafo_map.get(vospcod, '')
                
                # Trova nome fornitore tramite FORNITOR
                fornitorenome = fornitor_map.get(fornitoreid, '')
                
                print(f"   {count+1:2d}. {vospcod} | {descrizione[:30]:<30} | €{prezzo} | FornitoreID: {fornitoreid} | Nome: {fornitorenome[:20]}")
                
                count += 1
        
        # 4. Verifica se ci sono match
        print("\n4. VERIFICA MATCH:")
        matches = 0
        with DBF(vocispes_path, encoding='latin-1') as table:
            count = 0
            for record in table:
                if count >= 100:
                    break
                if record is None:
                    continue
                
                vospcod = record.get('DB_VOSPCOD', '')
                descrizione = record.get('DB_VODESCR', '')
                prezzo = float(record.get('DB_VOPREZZ', 0))
                
                fornitoreid = spesafo_map.get(vospcod, '')
                fornitorenome = fornitor_map.get(fornitoreid, '')
                
                if descrizione and fornitoreid and fornitorenome and prezzo > 0:
                    matches += 1
                
                count += 1
        
        print(f"   Record testati: {count}")
        print(f"   Match trovati: {matches}")
        
    except Exception as e:
        print(f"❌ Errore: {e}")

if __name__ == "__main__":
    debug_join()
