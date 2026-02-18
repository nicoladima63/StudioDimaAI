"""
Script to generate VAPID keys for Web Push notifications.
Run this once to generate keys, then save them in your config.
"""

import tempfile
import os
from py_vapid import Vapid01


def generate_vapid_keys():
    """Generate VAPID key pair."""
    vapid = Vapid01()
    vapid.generate_keys()

    # Create temporary files (save_key expects file paths, not file objects)
    with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.key') as private_file:
        private_path = private_file.name

    with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.pub') as public_file:
        public_path = public_file.name

    try:
        # Save keys to temporary files
        vapid.save_key(private_path)
        vapid.save_public_key(public_path)

        # Read keys back as strings
        with open(private_path, 'r') as f:
            private_key = f.read().strip()

        with open(public_path, 'r') as f:
            public_key = f.read().strip()

    finally:
        # Clean up temporary files
        if os.path.exists(private_path):
            os.unlink(private_path)
        if os.path.exists(public_path):
            os.unlink(public_path)

    # Display keys
    print("=" * 60)
    print("VAPID Keys Generated Successfully!")
    print("=" * 60)
    print("\nAdd these to your server configuration:\n")
    print(f'VAPID_PRIVATE_KEY = "{private_key}"')
    print(f'\nVAPID_PUBLIC_KEY = "{public_key}"')
    print("\nVAPID_CLAIMS = {")
    print('    "sub": "mailto:admin@studiodima.com"  # Change to your email')
    print("}")
    print("\n" + "=" * 60)
    print("\nIMPORTANT: Save the PRIVATE key securely!")
    print("The PUBLIC key should be used in the frontend.")
    print("=" * 60)


if __name__ == "__main__":
    generate_vapid_keys()
