# Regole di Sviluppo per Claude

## TypeScript e Import

* Usare sempre `import type` per i tipi TypeScript
* Usare `import apiClient from '@/services/api/client'` (default import) per le chiamate API
* Non usare `{ apiClient }` ma il default import

## API e Backend

* Uniformarsi alle strutture di risposta delle altre API esistenti nel progetto
* Gestire sempre i valori NaN convertendoli in null per il JSON
* Seguire i pattern esistenti per i service (object literal pattern, non classi)
* usare @jwt_required() nelle route a meno che non siano delle route di test
* Nei service del FE mettere il prefisso "api" nelle chiamate

## Frontend e GUI

* Usare sempre CoreUI per tutti i componenti dell'interfaccia
* Non usare Bootstrap o altri framework CSS
* Le tabelle devono sempre avere:
  + Paginazione completa (sopra e sotto la tabella)
  + Selettore numero elementi per pagina (10, 20, 50, 100)
  + Campo ricerca/filtro
  + Ordinamento per colonne principali
* Seguire i pattern di layout delle pagine esistenti

## Debug e Console

* Non lasciare console.log debug nel codice finale
* Usare console.log solo temporaneamente per troubleshooting
* Rimuovere sempre i log prima del commit

## Convenzioni Generali

* Seguire sempre i pattern esistenti nel progetto
* Non inventare nuovi pattern se esiste già una convenzione
* Controllare come sono implementate le funzionalità simili prima di iniziare

## Service e API

* Crea sempre il service per le chiamate API nella cartella service della features creata

## Comandi Utili

* Test: `npm test` (se configurato)
* Lint: `npm run lint` (se configurato)
* Build: `npm run build`
* Server: `python -m run_v2.py` (dalla directory server_v2 del progetto)
* Controllo processi server: `wmic process where "name='python.exe'" get ProcessId,CommandLine`
* Kill processi Python: `taskkill /F /IM python.exe` (se necessario)

## Messaggi e Output

* NON usare mai emoji nei messaggi del server o nei log
* NON usare caratteri Unicode speciali che possono causare errori di encoding
* Usare solo testo ASCII per messaggi di sistema e log

## Avvio del Server

* Non avviare tu il server, se è già avviato ci sono due task attivi

## Gestione Stato

* Usare zustand per cache gestione stato di dati da db che non cambiano nel tempo esempio i conti

## Database

* Usare studio_dima.db come database per eventuali nuove tabelle
* **Auto-migrazione obbligatoria**: ogni blueprint o service che dipende da tabelle SQLite proprie deve includere una funzione `_ensure_tables()` con `CREATE TABLE IF NOT EXISTS` per ogni tabella necessaria. La funzione va chiamata all'inizio di ogni endpoint/funzione che accede a quelle tabelle. Usare un flag di modulo `_TABLES_READY = False` per eseguirla una sola volta per sessione. Il codice deve portare con sé i propri prerequisiti — zero script manuali, zero migration da eseguire a mano.

## Sistema Classificazione Fornitori

* Il sistema utilizza la tabella `classificazioni_costi` con gerarchia conto->branca->sottoconto
* Campi chiave: `contoid`, `brancaid`, `sottocontoid` (INTEGER, non codici testo)
* Tre tipi di classificazione:
  + **Completa**: contoid + brancaid + sottocontoid (confidence 95%)
  + **Parziale**: solo contoid, brancaid=0, sottocontoid=0 (confidence 80%)
  + **Non classificato**: nessun dato
* Endpoint principale: `/api/classificazioni/fornitore/<id>/completa` (PUT)
* Service: `ClassificazioneCostiService.classifica_fornitore_completo()`

## Componenti Classificazione

* **ClassificazioneGerarchica**: Componente principale per select cascata conto->branca->sottoconto
* **ClassificazioneStatus**: Visualizzazione compatta con badge colorati (32x32px) + pulsante edit
* **Badge colori**: Verde=completo, Arancione=parziale (#ff8c00), Rosso=non classificato
* Prevenire loop infiniti con controlli `value !== newValue` negli autoSelect
* Sempre aggiungere `!updating` nelle condizioni di salvataggio automatico

## Select Components

* **SelectConto**, **SelectBranca**, **SelectSottoconto**: Componenti standardizzati CoreUI
* Usare sempre `CFormSelect` invece di `<select>` nativo
* Implementare `autoSelectIfSingle` con controlli anti-loop
* Dipendenze useEffect: includere sempre `value` per evitare chiamate duplicate
* Pattern: `onChange(e.target.value ? Number(e.target.value) : null)`

## Analytics e Ereditarietà

* I materiali ereditano classificazioni dai fornitori tramite `analyze_fornitore_historical_patterns()`
* Priorità: Fornitori completi > Fornitori parziali > Pattern storici > Pattern nomi
* Endpoint suggestion: `/api/classificazioni/fornitore/<id>/suggest-categoria` (GET)
* Analytics dashboard in tab separato: `AnalyticsFornitori` component

## Gestione Errori API

* Sempre validare solo `contoid` come required nell'endpoint `/completa`
* `brancaid` e `sottocontoid` possono essere 0 o null (convertiti a 0)
* Non usare `all([contoid, brancaid, sottocontoid])` che blocca classificazioni parziali
* Pattern response: `{success: boolean, data: object, error?: string}`
* usa contistore per recuperare elenco conti, branche e sottoconti
* risposte json del server a tre stati: success,warning,error da gestire nel BE opportunamente controllando chiave state con i tre valori per gestire toast verdi gialli o rossi
* i blueprint sono registrati in routes.py

## Performance e Ottimizzazioni API

### Principi di Caricamento Dati

* **MAI caricare tutto subito**: Implementare sempre lazy loading per dati non immediatamente visibili
* **Evitare chiamate API duplicate**: Controllare sempre se esistono già dati in cache prima di fare nuove chiamate
* **Lazy loading per tab**: Caricare dati solo per il tab attivo, non per tutti i tab contemporaneamente
* **Cache intelligente**: Usare Zustand con cache di 5-10 minuti per dati che non cambiano frequentemente

### Pattern Service Aggregati

* **Endpoint aggregati**: Preferire `/api/entita/categoria` che restituisce dati pre-calcolati invece di N chiamate separate
* **Service pattern**: `nomeEntitaService.apiNomeAzione()` con prefisso "api" per chiamate backend
* **Batch loading**: Se necessario caricare più dati, farlo in parallelo con `Promise.all()` non in sequenza

### Store Pattern con Zustand

* **Un store per feature**: Ogni feature deve avere il proprio store per dati complessi/cacheable
* **Cache duration**: CACHE_DURATION = 5 * 60 * 1000 (5 minuti standard)
* **Retry logic**: MAX_RETRIES = 3 con exponential backoff
* **Persist selettivo**: Salvare solo dati e timestamp, non stati di loading
* **Hook per categoria**: Esporre hook specializzati `useNomeCategoria(categoria)` per lazy loading

### UX e Loading States

* **Skeleton loading**: Usare sempre componenti skeleton invece di spinner generici
* **Progressive loading**: Mostrare struttura prima, dati poi
* **Fallback compatibile**: Mantenere sempre backward compatibility con caricamento diretto
* **Toast colorati**: Verde=success, Arancione=warning, Rosso=error

### Naming Conventions

* **Componenti specifici**: Mantenere nomi file .tsx specifici (CollaboratoriTab.tsx, UtenzeTab.tsx)
* **Codice generico**: Usare nomi generici per variabili/interfacce (fornitore, statisticheSpese, calcolaStatistiche)
* **Service files**: nomeEntitaService.ts per i service
* **Store files**: nomeEntita.store.ts per gli store Zustand
* **Utils files**: nomeEntita.ts per utilities (senza suffissi tipo "Utils")

## Regole Problem Solving 

* **Prima guarda V2** non inventare da zero
* **Segui le istruzioni letteralmente**: Quando l'utente dice "parti dalla soap e vedi cosa vuole, a ritroso modifichi", fare esattamente quello
* **Ferma i cerotti**: Evitare soluzioni proxy/wrapper/workaround

---

# Roadmap e Contesto Strategico (aggiornato aprile 2026)

## Visione del progetto

StudioDimaAI è una piattaforma AI-first per la gestione integrata dello studio dentistico.
Obiettivo immediato: rendere i moduli esistenti coesi e usabili quotidianamente dallo staff.
Obiettivo a medio termine: scalare verso SaaS multi-tenant.

Fonte dati clinici: file DBF da gestionale Windent (parsing diretto già implementato).
LLM primario: Anthropic Claude. Fallback: OpenAI / Ollama locale.

## Principio architetturale fondamentale

> **Non usare l'AI dove basta la matematica.**
> Il layer deterministico (Python puro) calcola. L'AI interpreta, suggerisce, genera testo.

```
LAYER 1 - Deterministico (Python, veloce, gratuito, sempre disponibile)
  Calcolo gap agenda, efficiency score, KPI, forecast statistico, match pazienti

LAYER 2 - AI (Claude, on-demand, con fallback graceful al layer 1)
  Suggerimenti contestualizzati, interpretazione KPI, testi comunicazioni, recall messages
```

Se l'LLM non è disponibile, il sistema deve sempre restituire i dati del layer 1 con `state: warning`.

## Architettura cartelle attive

```
StudioDimaAI/
├── server_v2/              <-- BACKEND ATTIVO (Flask, Blueprints)
│   ├── api/                <-- Blueprint routes (registrati in routes.py)
│   ├── services/           <-- Logica business
│   │   ├── actions/        <-- Azioni automazioni (system_actions.py)
│   │   └── economics/      <-- Economics engine (kpi_engine, forecast, ecc.)
│   ├── core/               <-- Config, utils, constants_v2, exceptions
│   ├── repositories/       <-- Accesso dati DB
│   ├── run_v2.py           <-- Entry point server
│   └── config/             <-- Configurazioni ambiente
├── client_v2/              <-- FRONTEND ATTIVO (React + Vite + CoreUI + Zustand)
│   └── src/
│       ├── services/api/   <-- apiClient.ts
│       ├── features/       <-- Una cartella per feature (ai/, economics/, comunicazioni/, bot/, ecc.)
│       ├── components/     <-- Componenti UI riutilizzabili
│       └── store/          <-- Store Zustand
├── studio_dima.db          <-- Database SQLite attivo
└── CLAUDE.md               <-- Questo file
```

Le cartelle `server/` e `client/` (senza _v2) sono la versione precedente. Non modificarle.

## Stato implementazione moduli

### Moduli esistenti e funzionanti
- Parsing DBF Windent (appuntamenti, pazienti, prestazioni)
- Google Calendar sync
- Autenticazione JWT con ruoli
- Notifiche push e APScheduler
- Sistema classificazione fornitori (conto/branca/sottoconto)
- Test strutturati in server_v2/tests/
- Sistema reminder appuntamenti (SMS Brevo, 3h prima + follow-up 24h, deduplicazione in-memory + DB)
- Bot WhatsApp (Evolution API, webhook, tab conversazioni + tab risposte reminder)
- Sistema automazioni prestazioni (FileWatcher → PREVENT.DBF → trigger → 4 azioni: SMS, task, notifica)
- Economics engine parziale (kpi_engine, forecast_engine, monthly_aggregator in services/economics/)

### Moduli progettati ma da completare (priorità alta)

**AI Agenda (AREA A1+A2)**
File da creare in `server_v2/services/ai/` (cartella non ancora esistente):
- `agenda_analyzer.py` — calcolo gap, efficiency score, saturazione per poltrona
- `recall_matcher.py` — match pazienti candidati per gap fillable
- `llm_client.py` — client Claude/OpenAI/Ollama con fallback
- `ai_suggestion_service.py` — pipeline layer1 → layer2 con fallback graceful
- `ai_log_repository.py` — log suggerimenti e feedback loop
Route in `server_v2/api/v2_ai.py` (blueprint `ai_bp`):
- `GET /api/v2/ai/agenda/analyze?date=YYYY-MM-DD`
- `GET /api/v2/ai/agenda/candidates?date=YYYY-MM-DD`
- `GET /api/v2/ai/agenda/suggestions?date=YYYY-MM-DD`
- `POST /api/v2/ai/feedback`
Frontend in `client_v2/src/features/ai/`:
- `AgendaInsightsPage.tsx`, `AgendaGapCard.tsx`, `SuggestionsList.tsx`, `EfficiencyScore.tsx`
- `ai.service.ts`, `ai.store.ts` (cache 5 min, invalidazione su feedback)

**Vittor.ia — Economics engine (AREA A3+A4)**
Backend parzialmente implementato in `server_v2/services/economics/`:
- [x] `data_normalizer.py`, `monthly_aggregator.py`, `kpi_engine.py`
- [x] `seasonality_model.py`, `trend_model.py`, `forecast_engine.py`, `scenario_engine.py`
- [x] `collaboratori_engine.py`, `comparison_engine.py`, `prestazioni_engine.py`
- [ ] `kpi_interpreter.py` — interpretazione KPI via Claude (da creare)
Route esistente: `server_v2/api/v2_economics.py`
Route da aggiungere: `GET /api/v2/ai/kpi/interpret`
Frontend in `client_v2/src/features/economics/`: da completare
- Dashboard KPI, grafici produzione, forecast view, simulatore, chat dati in linguaggio naturale

**Claud.ia — Comunicazioni pazienti (AREA B4)**
Parzialmente implementato:
- [x] `patient_communications` tabella in studio_dima.db (schema con `response`, `communication_id`)
- [x] `appointment_confirmations` tabella per risposte WhatsApp
- [x] `appointment_reminder_service.py` — SMS Brevo 3h prima + follow-up 24h
- [x] Deduplicazione robusta: DB + in-memory set `_sent_this_session`
- [x] Route `GET /reminders/replies` — lista risposte con stato conferma
- [ ] `communication_service.py` — orchestratore multi-canale (da creare)
- [ ] Istruzioni post-visita personalizzate via Claude
- [ ] Recall intelligente con testo personalizzato
- [ ] Richiesta recensione automatica
- [ ] Gestione opt-out (`do_not_contact` flag paziente)
Frontend in `client_v2/src/features/bot/components/ReminderRepliesTab.tsx` (implementato)

### Moduli da creare (priorità media)
- B1 Protocolli: CRUD + AI generation + versionamento + ricerca full-text
- B2 Riunioni: agenda AI + verbale interattivo + action items
- B3 Magazzino: inventario + soglie + alert + ordini suggeriti

### Segnaposto futuri (non iniziare)
- Matt.ia: chatbot WhatsApp multi-turno per prenotazioni — bot base già funzionante (Evolution API + webhook), manca il layer conversazionale AI per prenotazioni. Richiede macchina dedicata always-on (non Acer Nitro 5).
- Lil.ia: trascrizione audio visita con Whisper + note cliniche
- Dal.ia: voice AI telefonica con VoIP (Twilio Voice + ElevenLabs)
- SaaS: migrazione PostgreSQL, multi-tenancy, Docker, billing Stripe

## Schema risposta JSON standard

Tutte le API usano questo schema a tre stati:
```json
{
  "state": "success|warning|error",
  "data": {},
  "message": "stringa opzionale"
}
```
- `success` → toast verde nel frontend
- `warning` → toast arancione (es. AI non disponibile, dati parziali)
- `error` → toast rosso

## Schema risposta AI suggestion

```json
{
  "state": "success",
  "data": {
    "summary": "Agenda al 72%. Poltrona 2 sotto-utilizzata al mattino.",
    "suggestions": [
      {
        "action": "insert_appointment|reorganize|recall",
        "gap_ref": "Poltrona 2|09:30",
        "patient_id": "P042",
        "patient_name": "Laura Verdi",
        "suggested_treatment": "Igiene professionale",
        "suggested_duration": 45,
        "priority": "high|medium|low",
        "reason": "Igiene scaduta da 220gg",
        "recall_message": "Testo messaggio recall personalizzato"
      }
    ],
    "alerts": [],
    "ai_available": true
  }
}
```

## Tabelle AI da creare in studio_dima.db

```sql
CREATE TABLE ai_suggestions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    suggestion_type TEXT NOT NULL,
    suggestion_data TEXT NOT NULL,
    action_taken TEXT DEFAULT 'pending',
    user_feedback TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT
);
```

Tabelle già esistenti (non ricreare):
- `patient_communications` — reminder SMS con schema: id, patient_id, patient_name, tipo, canale, stato, testo, scheduled_at, sent_at, response, communication_id, created_at
- `appointment_confirmations` — risposte WhatsApp ai reminder con schema: id, patient_id, appointment_date, response_type, message_text, received_at, processed

## Costi LLM stimati (da tenere sotto controllo)

| Operazione | Frequenza | Costo stimato GPT-4o-mini |
|---|---|---|
| Suggerimenti agenda | 1-2/giorno | ~$0.002 |
| Interpretazione KPI | 1/mese | ~$0.003 |
| Recall message | 3-5/giorno | ~$0.001 |
| Post-visita personalizzato | 2-5/giorno | ~$0.001 |
| **Totale mensile** | | **~$0.20-0.40** |

Rate limit: max 10 chiamate AI/ora (configurabile via env `AI_RATE_LIMIT_PER_HOUR`).

## Privacy e sicurezza dati

- I prompt AI NON contengono dati identificativi pazienti (nome, CF, telefono)
- L'AI riceve solo: ID anonimizzato, tipo trattamento, date, durate
- I dati paziente reali vengono recuperati dal DB locale dopo la risposta AI
- Con Ollama locale: zero dati escono dalla rete
- Con Claude/OpenAI: dati anonimizzati = rischio GDPR basso
- API key sempre in variabili d'ambiente, mai nel codice

## Ordine di lavoro consigliato per nuove sessioni

1. Leggere questo file per il contesto completo
2. Leggere i file esistenti nella feature su cui si sta lavorando (mai inventare da zero)
3. Implementare il layer deterministico prima del layer AI
4. Verificare che il fallback graceful funzioni prima di testare l'AI
5. Scrivere o aggiornare i test in `server_v2/tests/`
6. Non avviare il server (è già in esecuzione con due task attivi)
