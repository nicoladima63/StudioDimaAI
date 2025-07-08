from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

with open("server/app/rentri/certs/rentri_private.pem", "rb") as f:
    private_key = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())

print("Tipo chiave:", type(private_key))
print("Nome classe:", private_key.__class__.__name__)
