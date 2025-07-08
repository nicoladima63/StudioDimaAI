import getpass
from cryptography.hazmat.primitives.serialization import pkcs12, Encoding, PrivateFormat, NoEncryption
from cryptography.hazmat.primitives import serialization

# Percorso del file .p12
P12_PATH = "rentri-doc/DMRNCL63S21D612I.p12"
PRIVATE_KEY_OUT = "rentri-doc/rentri_private.pem"
CERT_OUT = "rentri-doc/rentri_cert.pem"

while True:
    password = getpass.getpass("Inserisci la password del file .p12: ")
    try:
        with open(P12_PATH, "rb") as f:
            p12_data = f.read()
        private_key, cert, additional_certs = pkcs12.load_key_and_certificates(
            p12_data,
            password.encode() if password else None
        )
        print("\n👉 Tipo chiave privata:", type(private_key))
        print("👉 Nome classe:", private_key.__class__.__name__)

        if "RSA" in private_key.__class__.__name__:
            print("✅ La chiave è RSA, puoi usarla con RS256.")
        elif "EC" in private_key.__class__.__name__:
            print("❌ La chiave è EC (ellittica) → NON compatibile con RS256 (RENTRI).")
        else:
            print("⚠️ Tipo di chiave sconosciuto o non supportato.")

        break
    except Exception as e:
        print(f"Password errata o file non valido: {e}\nRiprova oppure premi Ctrl+C per uscire.")

# Salva la chiave privata
if private_key:
    with open(PRIVATE_KEY_OUT, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.PKCS8,
            encryption_algorithm=NoEncryption()
        ))
    print(f"Chiave privata salvata in: {PRIVATE_KEY_OUT}")

# Salva il certificato
if cert:
    with open(CERT_OUT, "wb") as f:
        f.write(cert.public_bytes(Encoding.PEM))
    print(f"Certificato salvato in: {CERT_OUT}")

# (Opzionale) Salva eventuali certificati intermedi
if additional_certs:
    for i, ca in enumerate(additional_certs):
        ca_path = f"rentri-doc/rentri_ca_{i+1}.pem"
        with open(ca_path, "wb") as f:
            f.write(ca.public_bytes(Encoding.PEM))
        print(f"CA intermedia salvata in: {ca_path}")