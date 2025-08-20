"""
Setup Google Calendar OAuth2 authentication for StudioDimaAI Server V2.
This script will guide you through the OAuth2 flow to generate token.json.
"""

import os
import json
import webbrowser
from google_auth_oauthlib.flow import Flow

def setup_oauth2_flow():
    """Setup OAuth2 flow per Google Calendar."""
    print("StudioDimaAI Server V2 - Google Calendar Authentication Setup")
    print("=" * 70)
    
    # Check credentials file
    credentials_path = "instance/credentials.json"
    if not os.path.exists(credentials_path):
        print(f"ERROR: credentials.json not found at {credentials_path}")
        print("Please download the credentials file from Google Cloud Console")
        return False
    
    print(f"FOUND: credentials.json at {credentials_path}")
    
    # Setup OAuth2 flow
    try:
        scopes = ['https://www.googleapis.com/auth/calendar']
        
        flow = Flow.from_client_secrets_file(
            credentials_path,
            scopes=scopes
        )
        
        # Use localhost for redirect (desktop app style)
        flow.redirect_uri = 'http://localhost:8080/callback'
        
        # Get authorization URL
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        print("\nSTEP 1: Opening browser for Google authentication...")
        print(f"If browser doesn't open, visit this URL:\n{auth_url}")
        
        # Try to open browser
        try:
            webbrowser.open(auth_url)
        except Exception:
            print("Could not open browser automatically")
        
        print("\nSTEP 2: Complete authentication in browser")
        print("STEP 3: Copy the authorization code from the browser")
        print("        (It will be in the URL after you authorize)")
        
        # Get authorization code from user
        auth_code = input("\nPaste the authorization code here: ").strip()
        
        if not auth_code:
            print("ERROR: No authorization code provided")
            return False
        
        # Exchange code for token
        print("\nSTEP 4: Exchanging code for access token...")
        
        flow.fetch_token(code=auth_code)
        
        # Save credentials
        token_path = "instance/token.json"
        
        with open(token_path, 'w') as token_file:
            token_file.write(flow.credentials.to_json())
        
        print(f"SUCCESS: Token saved to {token_path}")
        
        # Test the credentials
        from googleapiclient.discovery import build
        
        service = build('calendar', 'v3', credentials=flow.credentials)
        calendars_result = service.calendarList().list().execute()
        calendars = calendars_result.get('items', [])
        
        print(f"\nSUCCESS: Found {len(calendars)} accessible calendars:")
        for calendar in calendars[:5]:  # Show first 5
            print(f"  - {calendar.get('summary', 'Unnamed')}")
        
        print(f"\nGoogle Calendar authentication setup completed successfully!")
        return True
        
    except Exception as e:
        print(f"ERROR: OAuth2 setup failed: {e}")
        return False

def verify_existing_token():
    """Verifica se esiste già un token valido."""
    token_path = "instance/token.json"
    
    if os.path.exists(token_path):
        print("FOUND: Existing token.json file")
        
        try:
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
            from googleapiclient.discovery import build
            
            with open(token_path, 'r') as f:
                token_data = json.load(f)
            
            scopes = ['https://www.googleapis.com/auth/calendar']
            creds = Credentials.from_authorized_user_info(token_data, scopes)
            
            if creds.valid:
                print("SUCCESS: Existing token is valid")
                
                # Test API access
                service = build('calendar', 'v3', credentials=creds)
                calendars_result = service.calendarList().list().execute()
                calendars = calendars_result.get('items', [])
                
                print(f"SUCCESS: Can access {len(calendars)} calendars")
                return True
                
            elif creds.expired and creds.refresh_token:
                print("INFO: Token expired, attempting refresh...")
                creds.refresh(Request())
                
                # Save refreshed token
                with open(token_path, 'w') as f:
                    f.write(creds.to_json())
                
                print("SUCCESS: Token refreshed successfully")
                return True
            else:
                print("WARNING: Token is invalid or expired without refresh capability")
                return False
                
        except Exception as e:
            print(f"ERROR: Token verification failed: {e}")
            return False
    else:
        print("INFO: No existing token found")
        return False

def main():
    """Main setup function."""
    print("Checking existing authentication...")
    
    if verify_existing_token():
        print("\nGoogle Calendar authentication is already working!")
        print("No setup needed.")
        return
    
    print("\nSetting up new Google Calendar authentication...")
    print("\nIMPORTANT: You will need to:")
    print("1. Have a Google account with Calendar API access")
    print("2. Complete the OAuth2 consent screen")
    print("3. Grant calendar permissions to the application")
    
    proceed = input("\nProceed with setup? (y/n): ").lower().strip()
    
    if proceed == 'y':
        setup_oauth2_flow()
    else:
        print("Setup cancelled.")

if __name__ == "__main__":
    main()