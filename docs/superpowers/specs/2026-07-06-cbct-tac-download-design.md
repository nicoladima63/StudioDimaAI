# Design: Download automatico TAC/CBCT da portale Alliance Medical

Data: 2026-07-06

## Contesto e obiettivo

Oggi il flusso di recupero delle TAC (CBCT) dei pazienti è manuale: login sul portale `myDentalShare` (Alliance Medical), ricerca dell'esame nella lista, download dell'archivio `.rar` protetto da password, estrazione con WinRAR, copia della cartella estratta in `\\servernas\cbct\<paziente>`.

Obiettivo: sostituire questo flusso manuale con una pagina dedicata in StudioDimaAI che mostra la lista degli esami disponibili sul portale e permette di scaricarli/estrarli con un click, con verifica automatica di quali sono già stati scaricati.

## Il portale sorgente

`https://portaledentisti.alliancemedical.it/accounts/login/` — applicazione Django server-rendered ("myDentalShare"), non una SPA:
- Login: form HTML standard con `csrfmiddlewaretoken` nascosto + campi `username`/`password`, POST su `/accounts/login/`
- Dopo il login, il portale reindirizza a `/?next=/package-list/` → la pagina lista esami è `/package-list/`
- Nessun JavaScript pesante lato client: automatizzabile con richieste HTTP dirette (`requests` + `BeautifulSoup`), senza browser headless

## Flusso end-to-end

```
[client_v2] Pagina "Download TAC" (/cbct)
      │  GET /api/v2/cbct/esami
      ▼
[server_v2] v2_cbct.py (blueprint)
      ▼
CbctService.list_esami()
  1. requests.Session() → GET pagina login → estrae csrftoken
  2. POST credenziali (da .env) → sessione autenticata
  3. GET pagina lista esami → parsing HTML (BeautifulSoup)
  4. Confronta con tabella cbct_downloads (studio_dima.db) → marca "già scaricato"
      ▼
Risposta al FE: lista esami [{portal_exam_id, paziente, data_esame, stato, download_url}]

--- click "Scarica" su una riga ---

[client_v2] POST /api/v2/cbct/esami/<portal_exam_id>/scarica
      ▼
CbctService.scarica_esame(portal_exam_id)
  1. Sessione autenticata (login se necessario) → GET link download → salva .rar in file temporaneo
  2. Estrazione con 7-Zip (subprocess, password da .env) in:
     \\servernas\cbct\NOME_COGNOME__YYYYMMDD\
  3. Cancellazione del .rar temporaneo
  4. Registrazione download in cbct_downloads (studio_dima.db)
      ▼
Risposta a 3 stati (success/warning/error)
```

Convenzione nome cartella: `NOME_COGNOME__YYYYMMDD` (doppio underscore prima della data), come già usato manualmente oggi.

## Backend (server_v2)

**Nuovo service** `services/cbct_service.py`
- `_login(session)`: GET pagina login, estrae `csrfmiddlewaretoken`, POST credenziali
- `list_esami()`: GET lista esami autenticata, parsing HTML → `[{portal_exam_id, paziente, data_esame, download_url}]`
- `scarica_esame(portal_exam_id)`: download `.rar` in temp, estrazione via 7-Zip in `\\servernas\cbct\<cartella>\`, cleanup, registrazione DB

**Nuovo blueprint** `api/v2_cbct.py` (registrato in `routes.py`)
- `GET /api/v2/cbct/esami` → lista esami con stato già-scaricato
- `POST /api/v2/cbct/esami/<portal_exam_id>/scarica` → esegue download + estrazione + registrazione

Route protette con `@jwt_required()`. Risposta a 3 stati (`success`/`warning`/`error`) come da convenzione progetto.

**Nuova tabella** in `studio_dima.db` (via `_ensure_tables()`, pattern auto-migrazione obbligatorio da CLAUDE.md):
```sql
CREATE TABLE IF NOT EXISTS cbct_downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portal_exam_id TEXT NOT NULL UNIQUE,
    paziente TEXT NOT NULL,
    data_esame TEXT NOT NULL,
    cartella_nas TEXT NOT NULL,
    downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    downloaded_by INTEGER
);
```

**Config** (`.env`, mai nel codice):
- `ALLIANCE_USERNAME`, `ALLIANCE_PASSWORD` — credenziali portale
- `ALLIANCE_ARCHIVE_PASSWORD` — password estrazione RAR
- `CBCT_NAS_PATH` — es. `\\servernas\cbct`
- `SEVENZIP_PATH` — path a `7z.exe` su serverdima

## Frontend (client_v2)

Il progetto sta migrando da CoreUI a shadcn/ui (Radix + Tailwind) per le nuove feature — CoreUI resta solo sulle pagine non ancora migrate. Questa feature nuova va fatta **interamente in shadcn/ui**, seguendo il pattern già stabilito in `features/settings/pages/AutomationPage.tsx` (unico esempio esistente shadcn-puro con tabella + badge + azioni per riga).

**Nuova feature** `client_v2/src/features/cbct/`
- `pages/DownloadTacPage.tsx`:
  - Solo componenti `@/components/ui/*` (Button, Badge, Card, Skeleton, Input), niente CoreUI
  - Layout dual: card-list su mobile (`md:hidden`), tabella HTML con classi Tailwind su desktop (`hidden md:block`) — non esiste ancora un componente tabella shadcn condiviso, si costruisce il markup manuale come in AutomationPage
  - Colonne: Paziente, Data esame, Stato (badge `success`=scaricato / `muted`=da scaricare), Azione (bottone "Scarica" con spinner `Loader2` durante l'operazione)
  - Campo di ricerca per nome paziente (client-side). **Niente paginazione**: la lista arriva live dal portale ad ogni refresh ed è verosimilmente corta; se il portale stesso pagina i risultati, si replica quella paginazione
  - Pulsante "Aggiorna lista" in alto
- `services/cbct.service.ts`: pattern da `automation.service.ts` — `import apiClient from '@/services/api/client'`, chiamate senza slash iniziale, risposta letta da `response.data.data`, export named + default
- Nessuno store Zustand (dati non cacheable, cambiano ad ogni refresh)

**Navigazione**: nuova voce di primo livello in `components/layout/_nav.tsx` (`{ name: 'Download TAC', to: '/cbct', iconName: 'ScanLine' }` — icona lucide indicativa, da confermare in implementazione), visibile a tutti (nessun `allowedRoles` specifico).

## Gestione errori

- Login al portale fallito (credenziali errate / portale irraggiungibile) → `error`
- Download `.rar` fallito (link scaduto, sessione scaduta) → `error`, con un tentativo di re-login automatico
- Estrazione fallita (password errata, 7-Zip non trovato, NAS irraggiungibile) → `error` con messaggio specifico (non generico)
- Esame già scaricato e riscaricato manualmente → comportamento da definire in fase di test (warning con conferma, o blocco diretto)

## Dipendenze

- Server: installazione di **7-Zip** su serverdima (unico prerequisito non-Python, NAS e serverdima già comunicano in rete)
- Python: nessuna nuova libreria (requests, beautifulsoup4 già presenti); estrazione via `subprocess` (stdlib) che invoca `7z.exe`

## Rischi aperti / da validare in implementazione

- URL lista esami confermato: `/package-list/` (redirect post-login `/?next=/package-list/`). Struttura HTML esatta della pagina (nomi campi, formato data, URL di download, eventuale paginazione lato portale) non ancora ispezionata con un login autenticato reale — da verificare con credenziali di test durante l'implementazione
- Da verificare se il link di download è diretto o richiede un passaggio intermedio (es. generazione asincrona del file)
- Comportamento esatto in caso di ri-download di un esame già scaricato (warning vs blocco) da decidere durante i test

## Criteri di successo

- Dalla pagina "Download TAC" è possibile vedere la lista esami del portale e capire a colpo d'occhio quali sono già stati scaricati
- Un click su "Scarica" produce la cartella `NOME_COGNOME__YYYYMMDD` con i file estratti in `\\servernas\cbct\`, senza intervento manuale (nessun login, nessun WinRAR)
- Errori di rete/credenziali/estrazione sono segnalati chiaramente all'utente, non falliscono silenziosamente
