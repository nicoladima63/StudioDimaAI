"""
Script per convertire chiavi VAPID PEM in base64 URL-safe su una linea.
"""
import base64

# La tua chiave pubblica PEM (dal .env)
public_key_pem = """-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEsbKSs9giufcqatkEKo3VXxPPctdZ
4/vvL3O6jbaCeUwf94D5rH6KplKPxJ7dPO3vMIu42smmQa5VZyzsUP967g==
-----END PUBLIC KEY-----"""

# Estrai solo il base64
base64_key = public_key_pem.replace('-----BEGIN PUBLIC KEY-----', '') \
                           .replace('-----END PUBLIC KEY-----', '') \
                           .replace('\n', '') \
                           .replace('\r', '') \
                           .strip()

# Converti in bytes
key_bytes = base64.b64decode(base64_key)

# Converti in base64 URL-safe
url_safe_base64 = base64.urlsafe_b64encode(key_bytes).decode('utf-8').rstrip('=')

print("=" * 60)
print("Chiave VAPID in formato base64 URL-safe (per .env):")
print("=" * 60)
print(f"\nVAPID_PUBLIC_KEY_URLSAFE={url_safe_base64}")
print("\n" + "=" * 60)
print("Usa questa chiave al posto della versione PEM")
print("=" * 60)
