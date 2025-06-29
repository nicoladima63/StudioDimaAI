#!/usr/bin/env python3
"""
Script di test per il modulo richiami
Eseguire dalla directory server/
"""

import sys
import os
from datetime import date, timedelta

# Aggiungi il path del progetto
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.recalls.service import RecallService
from app.recalls.utils import normalizza_numero_telefono, costruisci_messaggio_richiamo


def test_utils():
    """Test delle funzioni di utilità"""
    print("=== Test Utils ===")
    
    # Test normalizzazione telefono
    test_cases = [
        ("3331234567", "+393331234567"),
        ("00393331234567", "+393331234567"),
        ("+393331234567", "+393331234567"),
        ("", None),
        ("abc", None)
    ]
    
    for input_num, expected in test_cases:
        result = normalizza_numero_telefono(input_num)
        status = "✓" if result == expected else "✗"
        print(f"{status} {input_num} -> {result} (expected: {expected})")
    
    # Test costruzione messaggio
    test_richiamo = {
        'nome_completo': 'Mario Rossi',
        'tipo': '1',
        'data1': date.today() + timedelta(days=7)
    }
    
    messaggio = costruisci_messaggio_richiamo(test_richiamo)
    print(f"\nMessaggio di test:\n{messaggio}")


def test_service():
    """Test del service"""
    print("\n=== Test Service ===")
    
    service = RecallService()
    
    try:
        # Debug: vediamo la struttura dei dati DBF
        print("=== Debug DBF Structure ===")
        from dbfread import DBF
        from app.config.constants import PATH_ANAGRAFICA_DBF, COLONNE
        
        pazienti_dbf = DBF(PATH_ANAGRAFICA_DBF, encoding='latin-1')
        col = COLONNE['richiami']
        
        # Conta pazienti con richiami
        total_pazienti = 0
        pazienti_con_richiami = 0
        pazienti_con_date = 0
        
        for record in pazienti_dbf:
            total_pazienti += 1
            da_richiamare = record.get(col['da_richiamare'], False)
            if da_richiamare:
                pazienti_con_richiami += 1
                data_richiamo = record.get(col['data1'])
                if data_richiamo and isinstance(data_richiamo, date):
                    pazienti_con_date += 1
                    
                    # Mostra alcuni esempi
                    if pazienti_con_date <= 3:
                        print(f"Esempio richiamo: ID={record.get(col['id_paziente'])}, "
                              f"Nome={record.get('DB_PACOGNOME', '')} {record.get('DB_PANOME', '')}, "
                              f"Tipo={record.get(col['tipo'])}, "
                              f"Data={data_richiamo}, "
                              f"Mesi={record.get(col['mesi'])}, "
                              f"Ultima visita={record.get(col['ultima_visita'])}")
        
        print(f"Totale pazienti: {total_pazienti}")
        print(f"Pazienti con richiami attivi: {pazienti_con_richiami}")
        print(f"Pazienti con date richiamo: {pazienti_con_date}")
        
        # Test recupero richiami
        richiami = service.get_all_recalls(30)
        print(f"\nRichiami trovati (30 giorni): {len(richiami)}")
        
        if richiami:
            print(f"Primo richiamo: {richiami[0]}")
        
        # Test statistiche
        stats = service.get_recall_statistics(30)
        print(f"Statistiche: {stats}")
        
        # Test filtri
        scaduti = service.get_recalls_by_status('scaduto', 30)
        print(f"Richiami scaduti: {len(scaduti)}")
        
        in_scadenza = service.get_recalls_by_status('in_scadenza', 30)
        print(f"Richiami in scadenza: {len(in_scadenza)}")
        
    except Exception as e:
        print(f"Errore nel test del service: {str(e)}")
        import traceback
        traceback.print_exc()


def main():
    """Funzione principale di test"""
    print("Iniziando test del modulo richiami...\n")
    
    test_utils()
    test_service()
    
    print("\n=== Test Completati ===")


if __name__ == "__main__":
    main() 