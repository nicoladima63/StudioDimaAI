import os.path
import socket
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# Definisci gli scope necessari.
SCOPES = ['https://www.googleapis.com/auth/calendar']
# L'email dell'account da autorizzare
LOGIN_HINT = 'studiodrnicoladimartino@gmail.com'

# Rileva ambiente e imposta path corretti
def get_file_paths():
    # Se siamo nella cartella scripts, torna indietro
    if os.path.basename(os.getcwd()) == 'scripts':
        base_dir = os.path.dirname(os.getcwd())
        credentials_file = os.path.join(base_dir, 'credentials.json')
        token_file = os.path.join(base_dir, 'token.json')
    # Se siamo nella root del progetto
    elif os.path.exists('server/credentials.json'):
        credentials_file = 'server/credentials.json'
        token_file = 'server/token.json'
    # Se credentials.json è nella directory corrente
    elif os.path.exists('credentials.json'):
        credentials_file = 'credentials.json'
        token_file = 'token.json'
    else:
        # Fallback: cerca in tutte le possibili location
        possible_paths = [
            'server/credentials.json',
            'credentials.json',
            '../credentials.json',
            os.path.join(os.path.dirname(__file__), '..', 'credentials.json')
        ]
        credentials_file = None
        for path in possible_paths:
            if os.path.exists(path):
                credentials_file = path
                token_file = path.replace('credentials.json', 'token.json')
                break
    
    return credentials_file, token_file

# Rileva se siamo in produzione (server remoto)
def is_production():
    hostname = socket.gethostname().lower()
    return 'serverdima' in hostname or 'server' in hostname

CREDENTIALS_FILE, TOKEN_FILE = get_file_paths()

def main():
    """
    Esegue il flusso di autenticazione OAuth2 per locale e produzione.
    """
    print(f"Ambiente: {'PRODUZIONE' if is_production() else 'SVILUPPO'}")
    print(f"Credentials: {CREDENTIALS_FILE}")
    print(f"Token: {TOKEN_FILE}")
    
    if os.path.exists(TOKEN_FILE):
        print(f"File '{TOKEN_FILE}' già esistente.")
        if is_production():
            response = input("Vuoi rigenerare il token? (y/N): ")
            if response.lower() != 'y':
                return
        else:
            print("Se vuoi ri-autenticare, cancellalo prima.")
            return
        os.remove(TOKEN_FILE)

    if not CREDENTIALS_FILE or not os.path.exists(CREDENTIALS_FILE):
        print(f"ERRORE: File credentials non trovato!")
        print(f"Percorso cercato: {CREDENTIALS_FILE}")
        return

    # Crea il flusso dal file delle credenziali client.
    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)

    # Parametri OAuth
    auth_url_kwargs = {
        'access_type': 'offline',
        'prompt': 'consent',
        'login_hint': LOGIN_HINT
    }

    try:
        if is_production():
            print("\nMODALITA' PRODUZIONE")
            print("=" * 60)
            print("IMPORTANTE: Il browser NON si aprira' automaticamente!")
            print("Segui questi passi:")
            print("1. Copia l'URL che apparira' sotto")
            print("2. Aprilo nel browser del TUO PC (non del server)")
            print("3. Autorizza l'applicazione")
            print("4. Torna qui quando completato")
            print("=" * 60)
            
            # Per produzione: usa porta dinamica e apri browser sul server
            # L'admin completerà l'auth via accesso remoto
            print("Avvio autenticazione con browser locale del server...")
            
            creds = flow.run_local_server(
                port=0,  # Porta dinamica per evitare conflitti
                open_browser=True,  # Apri browser SUL SERVER
                authorization_prompt_message='Autorizza l\'accesso nel browser che si è appena aperto sul server...',
                **auth_url_kwargs
            )
        else:
            print("\nMODALITA' SVILUPPO")
            creds = flow.run_local_server(
                port=0,
                authorization_prompt_message='Per favore, autorizza l\'accesso nel browser che si è appena aperto...',
                **auth_url_kwargs
            )
    except Exception as e:
        print(f"Errore durante autenticazione: {e}")
        return

    # Salva le credenziali
    with open(TOKEN_FILE, 'w') as token:
        token.write(creds.to_json())
    print(f"Autenticazione completata!")
    print(f"Token salvato: {TOKEN_FILE}")

if __name__ == '__main__':
    main() 