import os
import time
import requests
import jwt
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization

load_dotenv()

PRIVATE_KEY_PATH = os.getenv("PRIVATE_KEY_PATH")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_AUDIENCE = os.getenv("CLIENT_AUDIENCE")
RENTRI_TOKEN_URL = "https://api.rentri.gov.it/auth/token"  # Adatta se diverso

# 1. Carica la chiave privata
with open(PRIVATE_KEY_PATH, "rb") as f:
    private_key = f.read()

with open("server/app/rentri/certs/rentri_private.pem", "rb") as f:
    key = serialization.load_pem_private_key(f.read(), password=None)
    print("Tipo chiave privata:", type(key))

# 2. Crea il JWT firmato
now = int(time.time())
payload = {
    "iss": CLIENT_ID,
    "sub": CLIENT_ID,
    "aud": CLIENT_AUDIENCE,
    "iat": now,
    "exp": now + 60 * 5  # valido 5 minuti
}
jwt_assertion = jwt.encode(payload, private_key, algorithm="RS256")
# 3. Richiedi il token Bearer a RENTRI
data = {
    "grant_type": "client_credentials",
    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    "client_assertion": jwt_assertion
}
response = requests.post(RENTRI_TOKEN_URL, data=data)
print("Status code:", response.status_code)
print("Response:", response.text)

if response.status_code == 200:
    access_token = response.json()["access_token"]
    # Salva il token per usi successivi
    with open("rentri-doc/rentri_access_token.txt", "w") as f:
        f.write(access_token)
    print("Access token salvato in rentri-doc/rentri_access_token.txt")
else:
    print("Errore nell'autenticazione!")
