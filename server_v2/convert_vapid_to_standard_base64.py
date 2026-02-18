"""
Script per convertire chiave VAPID PEM in base64 STANDARD (non URL-safe).
"""
# La tua chiave pubblica PEM (dal .env)
public_key_pem = """-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEsbKSs9giufcqatkEKo3VXxPPctdZ
4/vvL3O6jbaCeUwf94D5rH6KplKPxJ7dPO3vMIu42smmQa5VZyzsUP967g==
-----END PUBLIC KEY-----"""

# Estrai solo il base64 (questo è già in formato STANDARD, non URL-safe)
base64_key = public_key_pem.replace('-----BEGIN PUBLIC KEY-----', '') \
                           .replace('-----END PUBLIC KEY-----', '') \
                           .replace('\n', '') \
                           .replace('\r', '') \
                           .strip()

print("=" * 60)
print("Chiave VAPID in formato base64 STANDARD (per .env):")
print("=" * 60)
print(f"\nVAPID_PUBLIC_KEY_BASE64={base64_key}")
print("\nLunghezza:", len(base64_key))
print("\n" + "=" * 60)
print("Usa questa chiave al posto della versione PEM o URL-safe")
print("=" * 60)
