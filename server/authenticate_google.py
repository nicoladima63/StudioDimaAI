import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# Definisci gli scope necessari.
SCOPES = ['https://www.googleapis.com/auth/calendar']
# L'email dell'account da autorizzare
LOGIN_HINT = 'studiodrnicoladimartino@gmail.com'
CREDENTIALS_FILE = 'server/credentials.json'
TOKEN_FILE = 'server/token.json'

def main():
    """
    Esegue il flusso di autenticazione OAuth2 una tantum per ottenere il token.json
    per un utente specifico.
    """
    creds = None
    if os.path.exists(TOKEN_FILE):
        print(f"File '{TOKEN_FILE}' già esistente. Se vuoi ri-autenticare, cancellalo prima.")
        return

    if not os.path.exists(CREDENTIALS_FILE):
        print(f"Errore: Il file delle credenziali '{CREDENTIALS_FILE}' non è stato trovato.")
        print("Assicurati di averlo scaricato dalla Google Cloud Console e di averlo posizionato correttamente.")
        return

    # Crea il flusso dal file delle credenziali client.
    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)

    # Costruisci i parametri per l'URL di autorizzazione.
    # 'access_type='offline'' è cruciale per ottenere un refresh_token.
    # 'prompt='consent'' assicura che l'utente veda la schermata di consenso
    # e che un refresh_token sia restituito.
    # 'login_hint' preseleziona l'account utente.
    auth_url_kwargs = {
        'access_type': 'offline',
        'prompt': 'consent',
        'login_hint': LOGIN_HINT
    }

    creds = flow.run_local_server(
        port=0,
        authorization_prompt_message='Per favore, autorizza l\'accesso nel browser che si è appena aperto...',
        **auth_url_kwargs
    )

    # Salva le credenziali (incluso il refresh_token) per usi futuri.
    with open(TOKEN_FILE, 'w') as token:
        token.write(creds.to_json())
    print(f"Autenticazione completata. File '{TOKEN_FILE}' creato con successo.")

if __name__ == '__main__':
    main()