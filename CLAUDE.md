# Regole di Sviluppo per Claude

## TypeScript e Import
- Usare sempre `import type` per i tipi TypeScript
- **Path Corretti Import**:
  - `import apiClient from '@/services/api/client'` (NON `@/api/client`)
  - `import type { ApiResponse } from '@/types'` (NON `@/types/api`)
  - `import toast from 'react-hot-toast'` (NON `react-toastify`)
- Non usare `{ apiClient }` ma il default import
- Sempre verificare i path consultando altri file esistenti nella stessa feature prima di creare nuovi import

## API e Backend
- Uniformarsi alle strutture di risposta delle altre API esistenti nel progetto
- Gestire sempre i valori NaN convertendoli in null per il JSON
- Seguire i pattern esistenti per i service (object literal pattern, non classi)
- usare @jwt_required() nelle route a meno che non siano delle route di test
- Nei service del FE mettere il prefisso "api" nelle chiamate

## Frontend e GUI
- Usare sempre CoreUI per tutti i componenti dell'interfaccia
- Non usare Bootstrap o altri framework CSS
- Le tabelle devono sempre avere:
  - Paginazione completa (sopra e sotto la tabella)
  - Selettore numero elementi per pagina (10, 20, 50, 100)
  - Campo ricerca/filtro
  - Ordinamento per colonne principali
- Seguire i pattern di layout delle pagine esistenti

## Debug e Console
- Non lasciare console.log debug nel codice finale
- Usare console.log solo temporaneamente per troubleshooting
- Rimuovere sempre i log prima del commit

## Convenzioni Generali
- Seguire sempre i pattern esistenti nel progetto
- Non inventare nuovi pattern se esiste già una convenzione
- Controllare come sono implementate le funzionalità simili prima di iniziare

## Service e API
- Crea sempre il service per le chiamate API nella cartella service della features creata

## React Big Calendar e Gestione Date
- **Libreria**: `react-big-calendar` con `moment` localizer
- **Locale**: Configurare sempre `moment.locale('it')` per italiano
- **Import Pattern**:
  ```typescript
  import { Calendar, momentLocalizer } from 'react-big-calendar';
  import moment from 'moment';
  import 'moment/locale/it';
  import 'react-big-calendar/lib/css/react-big-calendar.css';
  ```
- **Eventi**: Formato con `start` e `end` come Date objects
- **Colori**: Usare `eventStyleGetter` per colorare eventi per categoria
- **Interattività**: Implementare `onSelectEvent` per dettagli e `onEventDrop` per drag & drop rescheduling
- **Messages**: Sempre tradurre in italiano (next, previous, today, month, week, etc.)

## Comandi Utili
- Test: `npm test` (se configurato)
- Lint: `npm run lint` (se configurato)
- Build: `npm run build`
- Server: `python -m run_v2.py` (dalla directory server_v2 del progetto)
- Controllo processi server: `wmic process where "name='python.exe'" get ProcessId,CommandLine`
- Kill processi Python: `taskkill /F /IM python.exe` (se necessario)

## Messaggi e Output
- NON usare mai emoji nei messaggi del server o nei log
- NON usare caratteri Unicode speciali che possono causare errori di encoding
- Usare solo testo ASCII per messaggi di sistema e log

## Avvio del Server
- Non avviare tu il server, se è già avviato ci sono due task attivi

## Gestione Stato
- Usare zustand per cache gestione stato di dati da db che non cambiano nel tempo esempio i conti

## Database
- Usare instance/studio_dima.db come database per eventuali nuove tabelle
- Tutti i database del progetto sono nella cartella instance/ (studio_dima.db, users.db, ricette_elettroniche.db, protocolli.db)
- Mai lavorare sui database nella root, usare sempre quelli in instance/

## Sistema Classificazione Fornitori
- Il sistema utilizza la tabella `classificazioni_costi` con gerarchia conto->branca->sottoconto
- Campi chiave: `contoid`, `brancaid`, `sottocontoid` (INTEGER, non codici testo)
- Tre tipi di classificazione:
  - **Completa**: contoid + brancaid + sottocontoid (confidence 95%)  
  - **Parziale**: solo contoid, brancaid=0, sottocontoid=0 (confidence 80%)
  - **Non classificato**: nessun dato
- Endpoint principale: `/api/classificazioni/fornitore/<id>/completa` (PUT)
- Service: `ClassificazioneCostiService.classifica_fornitore_completo()`

## Componenti Classificazione
- **ClassificazioneGerarchica**: Componente principale per select cascata conto->branca->sottoconto
- **ClassificazioneStatus**: Visualizzazione compatta con badge colorati (32x32px) + pulsante edit
- **Badge colori**: Verde=completo, Arancione=parziale (#ff8c00), Rosso=non classificato
- Prevenire loop infiniti con controlli `value !== newValue` negli autoSelect
- Sempre aggiungere `!updating` nelle condizioni di salvataggio automatico

## Select Components
- **SelectConto**, **SelectBranca**, **SelectSottoconto**: Componenti standardizzati CoreUI
- Usare sempre `CFormSelect` invece di `<select>` nativo
- Implementare `autoSelectIfSingle` con controlli anti-loop
- Dipendenze useEffect: includere sempre `value` per evitare chiamate duplicate
- Pattern: `onChange(e.target.value ? Number(e.target.value) : null)`

## Analytics e Ereditarietà 
- I materiali ereditano classificazioni dai fornitori tramite `analyze_fornitore_historical_patterns()`
- Priorità: Fornitori completi > Fornitori parziali > Pattern storici > Pattern nomi
- Endpoint suggestion: `/api/classificazioni/fornitore/<id>/suggest-categoria` (GET)
- Analytics dashboard in tab separato: `AnalyticsFornitori` component

## Gestione Errori API
- Sempre validare solo `contoid` come required nell'endpoint `/completa`  
- `brancaid` e `sottocontoid` possono essere 0 o null (convertiti a 0)
- Non usare `all([contoid, brancaid, sottocontoid])` che blocca classificazioni parziali
- Pattern response: `{success: boolean, data: object, error?: string}`
- usa contistore per recuperare elenco conti, branche e sottoconti
- risposte json del server a tre stati: success,warning,error da gestire nel BE opportunamente controllando chiave state con i tre valori per gestire toast verdi gialli o rossi
- i blueprint sono registrati in routes.py

## Performance e Ottimizzazioni API

### Principi di Caricamento Dati
- **MAI caricare tutto subito**: Implementare sempre lazy loading per dati non immediatamente visibili
- **Evitare chiamate API duplicate**: Controllare sempre se esistono già dati in cache prima di fare nuove chiamate
- **Lazy loading per tab**: Caricare dati solo per il tab attivo, non per tutti i tab contemporaneamente
- **Cache intelligente**: Usare Zustand con cache di 5-10 minuti per dati che non cambiano frequentemente

### Pattern Service Aggregati
- **Endpoint aggregati**: Preferire `/api/entita/categoria` che restituisce dati pre-calcolati invece di N chiamate separate
- **Service pattern**: `nomeEntitaService.apiNomeAzione()` con prefisso "api" per chiamate backend
- **Batch loading**: Se necessario caricare più dati, farlo in parallelo con `Promise.all()` non in sequenza

### Store Pattern con Zustand
- **Un store per feature**: Ogni feature deve avere il proprio store per dati complessi/cacheable
- **Cache duration**: CACHE_DURATION = 5 * 60 * 1000 (5 minuti standard)
- **Retry logic**: MAX_RETRIES = 3 con exponential backoff
- **Persist selettivo**: Salvare solo dati e timestamp, non stati di loading
- **Hook per categoria**: Esporre hook specializzati `useNomeCategoria(categoria)` per lazy loading

### UX e Loading States
- **Skeleton loading**: Usare sempre componenti skeleton invece di spinner generici
- **Progressive loading**: Mostrare struttura prima, dati poi
- **Fallback compatibile**: Mantenere sempre backward compatibility con caricamento diretto
- **Toast colorati**: Verde=success, Arancione=warning, Rosso=error

### Naming Conventions
- **Componenti specifici**: Mantenere nomi file .tsx specifici (CollaboratoriTab.tsx, UtenzeTab.tsx)
- **Codice generico**: Usare nomi generici per variabili/interfacce (fornitore, statisticheSpese, calcolaStatistiche)
- **Service files**: nomeEntitaService.ts per i service
- **Store files**: nomeEntita.store.ts per gli store Zustand
- **Utils files**: nomeEntita.ts per utilities (senza suffissi tipo "Utils")

## Regole Problem Solving e Migration V1->V2
- **Prima guarda V1**: Qualsiasi migration deve iniziare leggendo il file V1 corrispondente, non inventare da zero
- **Segui le istruzioni letteralmente**: Quando l'utente dice "parti dalla soap e vedi cosa vuole, a ritroso modifichi", fare esattamente quello
- **V1 funziona = non toccare la logica**: Se V1 "funziona liscio come l'olio", replicare la logica, non reinventarla
- **Ferma i cerotti**: Evitare soluzioni proxy/wrapper/workaround, sempre replicare V1 direttamente
- **Timeout di complessità**: Se dopo 10 minuti sto creando codice nuovo invece di copiare/adattare V1, fermarsi e ripartire da V1
- **Conferma prima di inventare**: Chiedere sempre conferma prima di creare logica nuova se esiste già in V1
- **Validazioni semplici**: Se mi perdo in validazioni/formati, tornare a vedere come fa V1