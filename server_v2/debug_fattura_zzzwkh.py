#!/usr/bin/env python3
"""
Debug specifico per la fattura ZZZWKH del fornitore ZZZZZO (Dentsply)
"""

import os
from dbfread import DBF

def debug_fattura_zzzwkh():
    """Debug della fattura ZZZZYC"""
    
    print("FATTURA ZZZZYC")
    print("=" * 20)
    
    # Percorsi dei file DBF
    spesafo_path = os.path.join('..', 'windent', 'DATI', 'SPESAFOR.DBF')
    
    try:
        # Cerca fattura ZZZZYC
        with DBF(spesafo_path, encoding='latin-1') as spesafo_table:
            for record in spesafo_table:
                if record is None:
                    continue
                
                id_fattura = record.get('DB_CODE', '')
                if str(id_fattura).strip() == 'ZZZZYC':
                    fornitoreid = record.get('DB_SPFOCOD', '')
                    numero_doc = record.get('DB_SPNUMER', '')
                    
                    print(f"FatturaID: {id_fattura}")
                    print(f"Numero: {numero_doc}")
                    print(f"Fornitore: {fornitoreid}")
                    print()
                    
                    # Dettagli
                    print("DETTAGLI:")
                    for field_name, value in record.items():
                        if value and str(value).strip():
                            print(f"  {field_name}: {value}")
                    break
            else:
                print("❌ Fattura ZZZZYC non trovata")
        
        # Ora chiama l'API v1 per i dettagli
        print("\n" + "="*50)
        print("CHIAMATA API V1 PER DETTAGLI")
        print("="*50)
        
        import requests
        
        try:
            # Chiama l'endpoint v1 per i dettagli
            url = "http://localhost:5000/api/spese-fornitori/ZZZZYC/dettagli"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API Response: {response.status_code}")
                
                if data.get('success') and data.get('data'):
                    dettagli = data['data']
                    print(f"Righe dettagli trovate: {len(dettagli)}")
                    print()
                    
                    for i, dettaglio in enumerate(dettagli):
                        print(f"RIGA {i+1}:")
                        print(f"  Codice: {dettaglio.get('codice_articolo', '')}")
                        print(f"  Descrizione: {dettaglio.get('descrizione', '')}")
                        print(f"  Quantità: {dettaglio.get('quantita', 0)}")
                        print(f"  Prezzo: {dettaglio.get('prezzo_unitario', 0)}")
                        print(f"  IVA: {dettaglio.get('aliquota_iva', 0)}%")
                        print(f"  Totale: {dettaglio.get('totale_riga', 0)}")
                        print()
                else:
                    print(f"❌ Nessun dettaglio: {data}")
            else:
                print(f"❌ API Error: {response.status_code}")
                print(f"Response: {response.text}")
                
        except requests.exceptions.ConnectionError:
            print("❌ Server v1 non raggiungibile (localhost:5000)")
        except Exception as e:
            print(f"❌ Errore API: {e}")
        
    except Exception as e:
        print(f"❌ Errore: {e}")

if __name__ == "__main__":
    debug_fattura_zzzwkh()
