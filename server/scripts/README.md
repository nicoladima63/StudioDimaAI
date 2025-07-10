# Script di Utilità

Questa cartella contiene script di utilità per la gestione e configurazione del progetto StudioDimaAI.

## Script Disponibili

### `authenticate_google.py`
Script per l'autenticazione OAuth2 con Google Calendar API:
- Genera il file `token.json` per l'accesso al calendario Google
- Richiede il file `credentials.json` dalla Google Cloud Console
- Configura l'account `studiodrnicoladimartino@gmail.com`

**Esecuzione:**
```bash
cd server
python scripts/authenticate_google.py
```

**Prerequisiti:**
- File `server/credentials.json` scaricato da Google Cloud Console
- Librerie: `google-auth`, `google-auth-oauthlib`

### `init_db.py`
Script per l'inizializzazione del database:
- Elimina e ricrea tutte le tabelle del database
- Crea l'utente admin di default
- Credenziali: username=`admin`, password=`admin123`

**Esecuzione:**
```bash
cd server
python scripts/init_db.py
```

**Prerequisiti:**
- Database configurato in `server/app/config/config.py`
- Librerie: `flask-sqlalchemy`

### `estrai_appuntamenti.py`
Script per estrarre appuntamenti dal database DBF di Windent:
- Legge il file `APPUNTA.DBF` dal server
- Filtra per mese e anno specificati
- Mostra dettagli degli appuntamenti

**Esecuzione:**
```bash
cd server
python scripts/estrai_appuntamenti.py
```

**Prerequisiti:**
- Accesso al server `\\SERVERDIMA\Pixel\WINDENT\`
- Librerie: `pandas`, `dbf`

## File di Configurazione

I seguenti file rimangono nella cartella `server/` per compatibilità:

- `token.json` - Token di autenticazione Google (generato da `authenticate_google.py`)
- `sync_state.json` - Stato di sincronizzazione del sistema
- `app.log` - Log dell'applicazione

## Note

- Tutti gli script usano import assoluti per compatibilità con la nuova struttura
- Gli script sono indipendenti e possono essere eseguiti singolarmente
- Alcuni script richiedono configurazioni specifiche (certificati, accesso al server, etc.) 