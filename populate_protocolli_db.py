#!/usr/bin/env python3
"""
Script per popolare il database protocolli con i dati del JSON
"""

import os
import sys
import sqlite3
import json

# Aggiungi il path del progetto
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Importa le funzioni del database
from server.app.core.protocolli_db import init_protocolli_db, DB_PATH, INSTANCE_DIR

def populate_database():
    """Popola il database con i dati dai file JSON"""
    
    print("Inizializzazione database protocolli...")
    
    # Assicurati che la directory instance esista
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    
    # Inizializza il database se non esiste
    if not os.path.exists(DB_PATH):
        print("Creazione database...")
        init_protocolli_db()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Pulizia dati esistenti...")
        # Pulisci i dati esistenti
        cursor.execute('DELETE FROM diagnosi_farmaci')
        cursor.execute('DELETE FROM farmaci_base') 
        cursor.execute('DELETE FROM diagnosi')
        
        print("Caricamento farmaci base...")
        # Carica farmaci base dal JSON
        farmaci_json_path = os.path.join(os.path.dirname(__file__), 'server/app/ricetta_elettronica/data/farmaci_test_sicuri.json')
        print(f"Cerco farmaci in: {farmaci_json_path}")
        if os.path.exists(farmaci_json_path):
            with open(farmaci_json_path, 'r', encoding='utf-8') as f:
                farmaci_data = json.load(f)
                
            farmaci_count = 0
            for farmaco in farmaci_data.get('farmaci', []):
                cursor.execute('''
                    INSERT OR REPLACE INTO farmaci_base 
                    (codice, nome, principio_attivo, classe, forma_farmaceutica)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    farmaco.get('codice', ''),
                    farmaco.get('nome', ''),
                    farmaco.get('principio_attivo', ''),
                    farmaco.get('classe', ''),
                    farmaco.get('forma_farmaceutica', '')
                ))
                farmaci_count += 1
            
            print(f"   {farmaci_count} farmaci caricati")
        else:
            print(f"   File farmaci non trovato: {farmaci_json_path}")
        
        print("Caricamento diagnosi e protocolli...")
        # Carica diagnosi e protocolli dal JSON
        protocolli_json_path = os.path.join(os.path.dirname(__file__), 'server/app/ricetta_elettronica/data/protocolli_terapeutici.json')
        print(f"Cerco protocolli in: {protocolli_json_path}")
        if os.path.exists(protocolli_json_path):
            with open(protocolli_json_path, 'r', encoding='utf-8') as f:
                protocolli_data = json.load(f)
                
            diagnosi_count = 0
            associazioni_count = 0
            
            # Il JSON ha il formato: protocolli_odontoiatrici -> {diagnosi_key -> {diagnosi, farmaci_raccomandati}}
            for diagnosi_id, protocollo in protocolli_data.get('protocolli_odontoiatrici', {}).items():
                diagnosi_info = protocollo.get('diagnosi', {})
                
                # Inserisci diagnosi
                cursor.execute('''
                    INSERT OR REPLACE INTO diagnosi (id, codice, descrizione)
                    VALUES (?, ?, ?)
                ''', (
                    diagnosi_id,
                    diagnosi_info.get('codice', ''),
                    diagnosi_info.get('descrizione', '')
                ))
                diagnosi_count += 1
                print(f"   {diagnosi_id}: {diagnosi_info.get('codice', '')} - {diagnosi_info.get('descrizione', '')}")
                
                # Carica farmaci raccomandati per questa diagnosi
                for farmaco_raccomandato in protocollo.get('farmaci_raccomandati', []):
                    farmaco_info = farmaco_raccomandato.get('farmaco', {})
                    posologie = farmaco_raccomandato.get('posologie_standard', [])
                    
                    # Per ogni posologia crea un'associazione
                    for i, posologia_info in enumerate(posologie):
                        cursor.execute('''
                            INSERT OR REPLACE INTO diagnosi_farmaci 
                            (diagnosi_id, farmaco_codice, posologia, durata, note, ordine)
                            VALUES (?, ?, ?, ?, ?, ?)
                        ''', (
                            diagnosi_id,
                            farmaco_info.get('codice', ''),
                            posologia_info.get('posologia', ''),
                            posologia_info.get('durata', ''),
                            posologia_info.get('note', ''),
                            i
                        ))
                        associazioni_count += 1
                        print(f"      {farmaco_info.get('nome', '')}: {posologia_info.get('posologia', '')} per {posologia_info.get('durata', '')}")
            
            print(f"   {diagnosi_count} diagnosi caricate")
            print(f"   {associazioni_count} associazioni farmaci caricate")
        else:
            print(f"   File protocolli non trovato: {protocolli_json_path}")
        
        conn.commit()
        print("Dati salvati nel database")
        
        # Verifica finale
        print("\nVerifica dati caricati:")
        cursor.execute('SELECT COUNT(*) FROM diagnosi')
        diagnosi_count = cursor.fetchone()[0]
        print(f"   Diagnosi: {diagnosi_count}")
        
        cursor.execute('SELECT COUNT(*) FROM farmaci_base') 
        farmaci_count = cursor.fetchone()[0]
        print(f"   Farmaci base: {farmaci_count}")
        
        cursor.execute('SELECT COUNT(*) FROM diagnosi_farmaci')
        associazioni_count = cursor.fetchone()[0]
        print(f"   Associazioni: {associazioni_count}")
        
        print(f"\nDatabase popolato con successo!")
        print(f"Percorso database: {DB_PATH}")
        
    except Exception as e:
        print(f"❌ Errore durante il popolamento: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("Script popolamento database protocolli")
    print("=" * 50)
    
    try:
        populate_database()
        print("\nCOMPLETATO! Il database è ora popolato con i dati dal JSON.")
        print("Puoi riavviare il server e utilizzare la gestione protocolli.")
    except Exception as e:
        print(f"\nERRORE: {e}")
        print("Controlla i file JSON e riprova.")
        sys.exit(1)