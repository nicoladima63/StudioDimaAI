# Regole di Sviluppo per Claude

## TypeScript e Import
- Usare sempre `import type` per i tipi TypeScript
- Usare `import apiClient from '@/api/client'` (default import) per le chiamate API
- Non usare `{ apiClient }` ma il default import

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

## Comandi Utili
- Test: `npm test` (se configurato)
- Lint: `npm run lint` (se configurato)
- Build: `npm run build`
- Server: `python -m server.app.run` (dalla directory root del progetto)
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
- Usare studio_dima.db come database per eventuali nuove tabelle

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