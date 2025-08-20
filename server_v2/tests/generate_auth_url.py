"""
Genera URL di autenticazione Google Calendar per StudioDimaAI Server V2.
"""

import os
import json
from google_auth_oauthlib.flow import Flow

def generate_auth_url():
    """Genera URL di autenticazione OAuth2."""
    print("StudioDimaAI Server V2 - Google Calendar Auth URL Generator")
    print("=" * 65)
    
    credentials_path = "instance/credentials.json"
    
    if not os.path.exists(credentials_path):
        print(f"ERROR: credentials.json not found at {credentials_path}")
        return
    
    try:
        scopes = ['https://www.googleapis.com/auth/calendar']
        
        flow = Flow.from_client_secrets_file(
            credentials_path,
            scopes=scopes
        )
        
        # Use localhost for redirect
        flow.redirect_uri = 'http://localhost:8080/callback'
        
        # Generate auth URL
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        print("SUCCESS: Authentication URL generated")
        print("\nSTEPS TO COMPLETE AUTHENTICATION:")
        print("=" * 40)
        print("1. Copy this URL and open it in your browser:")
        print(f"\n{auth_url}\n")
        print("2. Complete Google authentication and authorization")
        print("3. After authorization, you'll be redirected to a localhost URL")
        print("4. Copy the 'code' parameter from that URL")
        print("5. Use the code to complete token setup")
        
        print(f"\nFlow state (for reference): {state}")
        
        # Save flow state for later use
        flow_data = {
            'auth_url': auth_url,
            'state': state,
            'redirect_uri': flow.redirect_uri,
            'scopes': scopes
        }
        
        with open('temp_auth_flow.json', 'w') as f:
            json.dump(flow_data, f, indent=2)
        
        print("\nFlow data saved to 'temp_auth_flow.json' for reference")
        
    except Exception as e:
        print(f"ERROR: Could not generate auth URL: {e}")

if __name__ == "__main__":
    generate_auth_url()