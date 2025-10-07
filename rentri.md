# RENTRI V2 Refactoring e Migrazione: Analisi e Piano

Questo documento analizza lo stato attuale della migrazione dell'integrazione RENTRI dalla V1 alla V2 e propone un piano per completare il refactoring e l'importazione delle funzionalità.

## 1. Stato Attuale

### 1.1. Implementazione RENTRI V1 (Backend: `server/app/api/api_rentri.py`, `server/app/rentri/rentri_client.py`)

La V1 offre un set completo di funzionalità per la "registrazione smaltimento rifiuti", esposte tramite un Blueprint Flask (`api_rentri.py`) che interagisce con il `RentriClient` V1. Le funzionalità includono la gestione di operatori, registri, movimenti, FIR e upload di documenti. L'autenticazione è gestita tramite JWT.

### 1.2. Implementazione RENTRI V2 (Backend: `server_v2/services/rentri_service.py`)

La V2 ha refactorizzato la logica di interazione con l'API RENTRI esterna in `server_v2/services/rentri_service.py`. Questo servizio presenta miglioramenti significativi:
*   **Gestione Centralizzata dell'Ambiente**: Utilizza `EnvironmentManager` per gestire gli ambienti (DEV/PROD) in modo più strutturato.
*   **Autenticazione JWT Esplicita**: Gestisce la generazione e il refresh del token JWT in modo più robusto.
*   **Metodo Generico per Richieste API**: Centralizza la logica per le chiamate API autenticate, inclusa la gestione dei retry.
*   **Funzionalità Core**: Contiene metodi corrispondenti a gran parte delle funzionalità RENTRI presenti in V1 (operatori, registri, movimenti, FIR, upload documenti).

### 1.3. Esposizione API V2

Attualmente, non sono stati trovati endpoint API RENTRI V2 dedicati (es. un `v2_rentri.py`) che espongano le funzionalità del `RentriService` V2. Gli unici riferimenti RENTRI in V2 sono:
*   Endpoint di gestione ambiente (`server_v2/api/v2_environment.py`) che permette di testare la configurazione RENTRI.
*   Un endpoint `/api/v2/rentri/test-search` chiamato dal frontend (`client_v2/src/components/environment/specialized/RentriModeSwitch.tsx`), ma la sua implementazione backend non è stata trovata. Questo endpoint suggerisce una nuova funzionalità V2 focalizzata sulle "ricerche immobiliari", diversa dalla "registrazione smaltimento rifiuti" della V1.

## 2. Analisi delle Mancanze in V2 e Discrepanze

### 2.1. Funzionalità V1 non ancora esposte in V2 (a livello di `RentriService`):

Le seguenti funzionalità presenti nell'API V1 non hanno un corrispettivo diretto o chiaro nel `RentriService` V2:
*   `get_controllo_iscrizione` (V1: `/operatori/<identificativo>/controllo-iscrizione`)
*   `get_status_anagrafica` (V1: `/anagrafiche/status`)
*   `get_anagrafica_operatore` (V1: `/anagrafiche/operatori/<codice_fiscale>`)

### 2.2. Discrepanze Funzionali:

*   **`post_operatore_registro` (V1) vs `post_registro` (V2)**: È necessario verificare se il metodo `post_registro` del `RentriService` V2 copre semanticamente la funzionalità di `post_operatore_registro` della V1, o se richiede adattamenti/un nuovo metodo.
*   **Focus Funzionale**: La V1 si concentra sulla "registrazione smaltimento rifiuti", mentre il frontend V2 suggerisce un focus sulle "ricerche immobiliari". Questo implica che la V2 potrebbe richiedere l'implementazione di nuove funzionalità RENTRI non presenti in V1.

### 2.3. Mancanza di Endpoint API V2 Dedicati:

La principale lacuna è l'assenza di un Blueprint Flask dedicato in V2 per esporre le funzionalità del `RentriService`.

## 3. Piano per Completare il Refactoring e l'Importazione

L'obiettivo è migrare le funzionalità RENTRI dalla V1 alla V2, adottando la nuova architettura basata su `server_v2/services/rentri_service.py` e introducendo gli endpoint API V2 necessari.

### 3.1. Backend (`server_v2`)

1.  **Creare `server_v2/api/v2_rentri.py`**:
    *   Creare un nuovo file che definisca un Blueprint Flask per gli endpoint RENTRI V2 (es. `rentri_v2_bp`).
    *   Registrare questo Blueprint in `server_v2/app_v2.py`.

2.  **Esporre i Metodi del `RentriService` V2**:
    *   Per ogni metodo rilevante in `server_v2/services/rentri_service.py` (es. `get_operatori`, `post_registro`, `get_fir_pdf`), creare un endpoint API corrispondente in `server_v2/api/v2_rentri.py`.
    *   Questi endpoint dovranno:
        *   Importare `RentriService` e `EnvironmentManager`.
        *   Istanziare `RentriService` (ottenendo l'ambiente corrente tramite `EnvironmentManager`).
        *   Chiamare il metodo appropriato del `RentriService`.
        *   Gestire i parametri della richiesta e restituire risposte JSON standardizzate.
        *   Applicare l'autenticazione JWT (`@jwt_required()`).

3.  **Implementare le Funzionalità V1 Mancanti nel `RentriService` V2**:
    *   Aggiungere i metodi `get_controllo_iscrizione`, `get_status_anagrafica`, `get_anagrafica_operatore` a `server_v2/services/rentri_service.py`.
    *   Esporre questi nuovi metodi tramite endpoint API in `server_v2/api/v2_rentri.py`.

4.  **Risolvere la Discrepanza `post_operatore_registro`**:
    *   Verificare se `RentriService.post_registro` può essere adattato per coprire la funzionalità di `post_operatore_registro` della V1. In caso contrario, implementare un metodo specifico.

5.  **Implementare `/api/v2/rentri/test-search`**:
    *   Aggiungere un nuovo metodo (es. `test_search_immobili`) a `server_v2/services/rentri_service.py` che simuli o effettui una ricerca immobiliare tramite le API RENTRI (se disponibili).
    *   Creare un endpoint API corrispondente in `server_v2/api/v2_rentri.py` per esporre questa funzionalità.

### 3.2. Frontend (`client_v2`)

1.  **Aggiornare le Chiamate API**:
    *   Modificare i componenti frontend in `client_v2` che interagiscono con RENTRI per chiamare i nuovi endpoint API V2 definiti in `server_v2/api/v2_rentri.py`.
    *   Aggiornare la chiamata a `/api/v2/rentri/test-search` nel `RentriModeSwitch.tsx` per puntare all'endpoint backend appena implementato.

2.  **Adattare l'Interfaccia Utente**:
    *   Se la funzionalità "ricerche immobiliari" è un nuovo focus, adattare l'interfaccia utente per supportare questa nuova feature.

## 4. Considerazioni Aggiuntive

*   **Test**: Creare o aggiornare i test unitari e di integrazione per tutti i nuovi endpoint e le modifiche al `RentriService` V2.
*   **Documentazione OpenAPI/Swagger**: Aggiornare la documentazione API per riflettere i nuovi endpoint V2.
*   **Pulizia V1**: Una volta completata la migrazione e verificata la stabilità della V2, considerare la rimozione del codice RENTRI V1 obsoleto.
*   **Coerenza Funzionale**: Assicurarsi che tutte le funzionalità RENTRI della V1 siano replicate o migliorate nella V2, a meno che non siano state intenzionalmente deprecate.
*   **Certificati e Credenziali**: Verificare che le configurazioni per i certificati e le credenziali RENTRI siano correttamente gestite e accessibili sia per l'ambiente di sviluppo che di produzione in V2.
