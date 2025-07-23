"""
Modulo per autenticazione JWT AGID con certificato .p12 (alg: RS256).
Genera JWT, calcola hash SHA-256 del body, costruisce Agid-JWT-Signature.
"""
import base64
import hashlib
import json
import time
import uuid
from typing import Dict
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
import jwt
from dotenv import load_dotenv
import os
import sys
from pathlib import Path
from cryptography.hazmat.primitives import serialization

load_dotenv()
P12_PATH = os.getenv('RENTRI_P12_PATH', 'DMRNCL63S21D612I.P12')
P12_PASSWORD = os.getenv('RENTRI_P12_PASSWORD', '').encode('utf-8')

def get_project_root():
    # Cerca la root salendo finché trova la cartella certs
    p = Path(__file__).resolve()
    for parent in [p] + list(p.parents):
        if (parent / 'certs').exists():
            return parent
    # Fallback: torna a 4 livelli sopra
    return p.parents[4]

def get_env(demo=False):
    if demo:
        audience = os.getenv('RENTRI_DEMO_AUDIENCE', 'rentrigov.demo.api')
        url_base = os.getenv('RENTRI_DEMO_URL', 'https://demoapi.rentri.gov.it')
    else:
        audience = os.getenv('RENTRI_AUDIENCE', 'https://api.rentri.gov.it')
        url_base = 'https://api.rentri.gov.it'
    issuer = os.getenv('RENTRI_ISSUER', 'TUO_CODICE_FISCALE_O_PARTITA_IVA')
    return audience, issuer, url_base

def load_private_key():
    # Risolvi il path rispetto alla root del progetto (dove c'è certs/)
    abs_path = get_project_root() / P12_PATH
    if not abs_path.exists():
        raise FileNotFoundError(f"Certificato P12 non trovato: {abs_path}")
    from cryptography.hazmat.primitives.serialization import pkcs12
    with open(abs_path, 'rb') as f:
        p12_data = f.read()
    private_key, certificate, _ = pkcs12.load_key_and_certificates(p12_data, P12_PASSWORD)
    return private_key, certificate

def genera_jwt(demo=False):
    now = int(time.time())
    audience, issuer, _ = get_env(demo)
    payload = {
        'jti': str(uuid.uuid4()),
        'iss': issuer,
        'aud': audience,
        'iat': now,
        'nbf': now,
        'exp': now + 300  # 5 minuti
    }
    if demo:
        token = jwt.encode(payload, 'demo_secret_key', algorithm='HS256')
    else:
        private_key, _ = load_private_key()
        private_key_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        # Scegli algoritmo in base al tipo di chiave
        if private_key.__class__.__name__.startswith("EC"):
            alg = "ES256"
        else:
            alg = "RS256"
        token = jwt.encode(payload, private_key_pem, algorithm=alg)
    return token

def calcola_digest_sha256(body_json: str) -> str:
    sha = hashlib.sha256()
    sha.update(body_json.encode('utf-8'))
    digest = base64.b64encode(sha.digest()).decode('utf-8')
    return f"SHA-256={digest}"

def genera_agid_jwt_signature(jwt_token: str, digest: str, demo=False) -> str:
    if demo:
        return base64.b64encode(b'demo_signature').decode('utf-8')
    private_key, _ = load_private_key()
    if private_key.__class__.__name__.startswith("EC"):
        from cryptography.hazmat.primitives.asymmetric import ec
        signature = private_key.sign(
            digest.encode('utf-8'),
            ec.ECDSA(hashes.SHA256())
        )
    else:
        signature = private_key.sign(
            digest.encode('utf-8'),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
    return base64.b64encode(signature).decode('utf-8')

def get_auth_headers(body_json: str, demo=False) -> Dict[str, str]:
    jwt_token = genera_jwt(demo=demo)
    digest = calcola_digest_sha256(body_json)
    agid_signature = genera_agid_jwt_signature(jwt_token, digest, demo=demo)
    return {
        'Authorization': f'Bearer {jwt_token}',
        'Digest': digest,
        'Agid-JWT-Signature': agid_signature
    }

if __name__ == "__main__":
    demo = '--demo' in sys.argv
    ambiente = 'DEMO' if demo else 'PRODUZIONE'
    print(f"Ambiente selezionato: {ambiente}")
    try:
        body = '{}'
        token = genera_jwt(demo=demo)
        print(f"Token JWT: {token}\n")
        headers = get_auth_headers(body, demo=demo)
        print("Headers per autenticazione:")
        for k, v in headers.items():
            print(f"{k}: {v}")
    except Exception as e:
        print(f"[ERRORE] {e}")
