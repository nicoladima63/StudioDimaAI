#!/usr/bin/env python3
"""
Script per estrarre certificati PEM dal file P12 per la produzione
"""

import os
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12
import getpass

def extract_certificates():
    """Estrae certificati dal file P12 per l'ambiente produzione"""
    
    # Path del file P12
    p12_file = Path("certs/DMRNCL63S21D612I.p12")
    
    if not p12_file.exists():
        print(f"❌ File P12 non trovato: {p12_file}")
        return False
    
    # Directory di output
    prod_cert_dir = Path("certs/prod")
    prod_cert_dir.mkdir(exist_ok=True)
    
    try:
        # Chiedi password P12
        password = getpass.getpass("🔐 Inserisci password del certificato P12: ").encode()
        
        # Carica il file P12
        print(f"📂 Caricamento {p12_file}...")
        with open(p12_file, 'rb') as f:
            p12_data = f.read()
        
        # Estrai certificato e chiave privata
        private_key, certificate, additional_certificates = pkcs12.load_key_and_certificates(
            p12_data, password
        )
        
        if not certificate or not private_key:
            print("❌ Impossibile estrarre certificato o chiave privata dal P12")
            return False
        
        # Salva certificato client
        cert_file = prod_cert_dir / "client_cert.pem"
        with open(cert_file, 'wb') as f:
            f.write(certificate.public_bytes(serialization.Encoding.PEM))
        print(f"✅ Certificato client salvato: {cert_file}")
        
        # Salva chiave privata
        key_file = prod_cert_dir / "client_key.pem"
        with open(key_file, 'wb') as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        print(f"✅ Chiave privata salvata: {key_file}")
        
        # Salva certificati aggiuntivi (se presenti)
        if additional_certificates:
            for i, cert in enumerate(additional_certificates):
                additional_cert_file = prod_cert_dir / f"additional_cert_{i}.pem"
                with open(additional_cert_file, 'wb') as f:
                    f.write(cert.public_bytes(serialization.Encoding.PEM))
                print(f"✅ Certificato aggiuntivo salvato: {additional_cert_file}")
        
        # Verifica certificati creati
        print(f"\n📋 CERTIFICATI PRODUZIONE ESTRATTI:")
        for cert_file in prod_cert_dir.glob("*.pem"):
            size = cert_file.stat().st_size
            print(f"   {cert_file.name}: {size} bytes")
        
        print(f"\n🎯 Estrazione completata!")
        print(f"📁 Certificati disponibili in: {prod_cert_dir}")
        
        return True
        
    except Exception as e:
        print(f"❌ Errore durante l'estrazione: {e}")
        return False

def main():
    print("🔐 ESTRAZIONE CERTIFICATI PRODUZIONE")
    print("=" * 50)
    
    if extract_certificates():
        print("\n✅ Certificati produzione pronti!")
        print("Ora puoi usare l'ambiente produzione per le ricette")
    else:
        print("\n❌ Estrazione fallita")
        print("Verifica la password del certificato P12")

if __name__ == "__main__":
    main()