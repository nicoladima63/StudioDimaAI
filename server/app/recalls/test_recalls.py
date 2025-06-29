#!/usr/bin/env python3
"""
Script di test per il modulo richiami
"""

import sys
import os
from datetime import date, timedelta

# Aggiungi il path del progetto
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from recalls.service import RecallService
from recalls.utils import normalizza_numero_telefono, costruisci_messaggio_richiamo


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
        # Test recupero richiami
        richiami = service.get_all_recalls(30)
        print(f"Richiami trovati (30 giorni): {len(richiami)}")
        
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


def main():
    """Funzione principale di test"""
    print("Iniziando test del modulo richiami...\n")
    
    test_utils()
    test_service()
    
    print("\n=== Test Completati ===")


if __name__ == "__main__":
    main() 