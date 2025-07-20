from cryptography.hazmat.primitives.serialization import pkcs12

with open("server/app/rentri/certs/rentri_rsa_certificato.p12", "rb") as f:
    p12_data = f.read()

private_key, cert, additional = pkcs12.load_key_and_certificates(p12_data, b"LA_TUA_PASSWORD".encode())
