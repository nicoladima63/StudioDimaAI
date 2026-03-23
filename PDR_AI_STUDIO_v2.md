# PDR v2 - Modulo AI Studio Dentistico

## Obiettivo

Aggiungere un layer di intelligenza artificiale al gestionale esistente per:
- Analisi automatica efficienza agenda (per poltrona e operatore)
- Suggerimenti operativi azionabili (con pazienti candidati e trattamenti)
- Richiami intelligenti integrati nel flusso agenda
- Interpretazione KPI tramite il motore economics gia esistente
- Feedback loop per migliorare i suggerimenti nel tempo

## Principio architetturale

> **Non usare l'AI dove basta la matematica.**
> Il layer deterministico (Python) calcola. L'AI interpreta e suggerisce.

```
LAYER 1 - Deterministico (Python puro, gratis, veloce)
  Calcolo gap, efficiency score, saturazione, match pazienti

LAYER 2 - AI (LLM, on-demand)
  Suggerimenti contestualizzati, prioritizzazione, messaggi recall
```

---

## Architettura

```
React (CoreUI)
    |
Flask Backend (Blueprint ai_bp registrato in routes.py)
    |
    +-- ai_service.py (orchestratore)
    |     |
    |     +-- agenda_analyzer.py    (DETERMINISTICO - calcoli puri)
    |     +-- recall_matcher.py     (DETERMINISTICO - match pazienti)
    |     +-- llm_client.py         (AI - chiamata diretta LLM)
    |     +-- kpi_interpreter.py    (AI - interpreta output economics)
    |
    +-- economics/ (GIA ESISTENTE - kpi_engine, forecast, etc.)
    |
    +-- repositories/
          +-- ai_log_repository.py  (feedback loop)
```

**Nessun servizio esterno aggiuntivo.** Il backend Flask chiama direttamente le API OpenAI/Ollama. I file JSON degli agenti diventano configurazione dei prompt, non un runtime separato.

---

## Struttura file

```
server_v2/
  app/
    services/
      ai/                              <-- NUOVO
        __init__.py
        llm_client.py                  # Client diretto OpenAI/Ollama
        agenda_analyzer.py             # Layer 1: calcoli deterministici agenda
        recall_matcher.py              # Layer 1: match pazienti per gap
        ai_suggestion_service.py       # Layer 2: suggerimenti AI
        kpi_interpreter.py             # Layer 2: interpretazione KPI
        prompts/
          agenda_optimizer.json        # Config prompt (gia esistente, adattato)
          kpi_analyst.json             # Config prompt KPI
    repositories/
      ai_log_repository.py            # Log suggerimenti e feedback
    api/
      v2_ai.py                        # Blueprint routes AI

client_v2/
  src/
    features/
      ai/                             <-- NUOVO
        pages/
          AgendaInsightsPage.tsx
        components/
          AgendaGapCard.tsx            # Singolo gap con azioni
          SuggestionsList.tsx          # Lista suggerimenti azionabili
          EfficiencyScore.tsx          # Score visuale per poltrona
          AiChatPanel.tsx              # Chat contestuale (fase avanzata)
        services/
          ai.service.ts
        types.ts
    store/
      ai.store.ts                     # Cache suggerimenti con Zustand
```

---

## Fase 1 - Layer deterministico agenda

### agenda_analyzer.py

Calcola TUTTO senza LLM. Input: appuntamenti dal DBF (gia normalizzati da `appointment_normalizer.py`).

**Calcoli:**

| Metrica | Logica |
|---------|--------|
| Gap tra appuntamenti | Per ogni poltrona: `next.start - prev.end` |
| Gap fillable | `duration >= 30 min` e dentro orario lavorativo |
| Efficiency score | `(tempo_occupato / tempo_disponibile) * 100` per poltrona |
| Saturazione globale | Media pesata efficiency per poltrona |
| Cluster inefficienti | Sequenze di gap < 15min che sommate > 30min |
| Sovraccarico | Poltrona con overlap o > 8h consecutive stesso operatore |

**Input schema:**

```python
{
    "date": "2026-03-23",
    "appointments": [
        {
            "start": "09:00",
            "end": "09:30",
            "duration_minutes": 30,
            "patient_id": "P001",
            "patient_name": "Mario Rossi",
            "treatment": "Igiene",
            "chair": "Poltrona 1",         # OBBLIGATORIO
            "operator": "Dr. Bianchi",      # OBBLIGATORIO
            "status": "confermato"
        }
    ],
    "working_hours": {
        "start": "08:30",
        "end": "19:00"
    },
    "chairs": ["Poltrona 1", "Poltrona 2", "Poltrona 3"]
}
```

**Output schema:**

```python
{
    "date": "2026-03-23",
    "global_efficiency": 72.5,
    "by_chair": {
        "Poltrona 1": {
            "efficiency": 85.0,
            "total_hours": 8.5,
            "occupied_hours": 7.2,
            "appointment_count": 12,
            "operator": "Dr. Bianchi"
        },
        "Poltrona 2": {
            "efficiency": 60.0,
            "total_hours": 8.5,
            "occupied_hours": 5.1,
            "appointment_count": 8,
            "operator": "Dr. Verdi"
        }
    },
    "gaps": [
        {
            "chair": "Poltrona 2",
            "start": "09:30",
            "end": "10:30",
            "duration_minutes": 60,
            "fillable": true,
            "position": "mid_morning",       # contesto temporale
            "prev_treatment": "Estrazione",   # cosa c'e prima
            "next_treatment": "Conservativa"  # cosa c'e dopo
        }
    ],
    "issues": [
        {
            "type": "large_gap",
            "chair": "Poltrona 2",
            "description": "Gap 60min tra 09:30-10:30",
            "severity": "high"
        }
    ]
}
```

### Endpoint

```
GET /api/v2/ai/agenda/analyze?date=2026-03-23
```

Risposta `state: success/warning/error` come da convenzione progetto.

---

## Fase 2 - Recall matcher (deterministico)

### recall_matcher.py

Per ogni gap fillable, cerca pazienti candidati. Usa i dati DBF pazienti + storico.

**Criteri di match (in ordine di priorita):**

1. Igiene scaduta (ultima igiene > 6 mesi)
2. Trattamento pendente da preventivo accettato
3. Recall programmato non ancora fissato
4. Paziente inattivo da > 12 mesi con storico alto valore

**Filtri:**

- Durata trattamento compatibile con durata gap
- Stesso tipo poltrona (se il gap e' su poltrona chirurgica, non suggerire igiene)
- Paziente non gia in agenda nella stessa settimana

**Output per gap:**

```python
{
    "gap_ref": "Poltrona 2|09:30",
    "candidates": [
        {
            "patient_id": "P042",
            "patient_name": "Laura Verdi",
            "reason": "igiene_scaduta",
            "last_visit": "2025-08-15",
            "days_since_last": 220,
            "suggested_treatment": "Igiene professionale",
            "suggested_duration": 45,
            "phone": "333-1234567",
            "priority_score": 92        # 0-100 calcolato
        }
    ]
}
```

### Endpoint

```
GET /api/v2/ai/agenda/candidates?date=2026-03-23
```

Restituisce analisi agenda + candidati in un'unica risposta aggregata.

---

## Fase 3 - LLM Client

### llm_client.py

Client diretto, nessun runtime esterno. Supporta OpenAI e Ollama.

```python
# server_v2/app/services/ai/llm_client.py

import requests
from app.core.flask_config import Config

class LLMClient:
    def __init__(self):
        self.provider = Config.AI_PROVIDER  # "openai" | "ollama"
        self.model = Config.AI_MODEL        # "gpt-4o-mini" | "llama3"
        self.api_key = Config.AI_API_KEY
        self.base_url = Config.AI_BASE_URL  # ollama: http://localhost:11434

    def complete(self, system_prompt, user_message, response_format=None):
        """Chiamata LLM con gestione provider."""
        if self.provider == "openai":
            return self._call_openai(system_prompt, user_message, response_format)
        elif self.provider == "ollama":
            return self._call_ollama(system_prompt, user_message)

    def _call_openai(self, system, user, response_format):
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ],
            "temperature": 0.3  # bassa per output strutturato
        }
        if response_format:
            payload["response_format"] = response_format
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers, json=payload, timeout=30
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    def _call_ollama(self, system, user):
        payload = {
            "model": self.model,
            "system": system,
            "prompt": user,
            "stream": False
        }
        resp = requests.post(
            f"{self.base_url}/api/generate",
            json=payload, timeout=60
        )
        resp.raise_for_status()
        return resp.json()["response"]
```

**Configurazione in flask_config.py:**

```python
AI_PROVIDER = os.getenv("AI_PROVIDER", "ollama")  # default locale
AI_MODEL = os.getenv("AI_MODEL", "llama3")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_BASE_URL = os.getenv("AI_BASE_URL", "http://localhost:11434")
```

---

## Fase 4 - Suggerimenti AI

### ai_suggestion_service.py

Prende l'output deterministico (Fase 1+2) e lo arricchisce con l'AI.

**L'AI riceve dati gia calcolati, non dati grezzi.** Il prompt include:

```
Dati agenda gia analizzati:
- Efficiency globale: 72.5%
- 3 gap trovati (di cui 2 fillable)
- 5 pazienti candidati per recall

Gap 1: Poltrona 2, 09:30-10:30 (60min)
  Candidati: Laura Verdi (igiene scaduta, 220gg), Marco Neri (conservativa pendente)

Gap 2: Poltrona 1, 14:00-14:30 (30min)
  Candidati: nessuno compatibile

Sulla base di questi dati, fornisci suggerimenti operativi strutturati.
```

**Output AI (JSON strutturato, azionabile):**

```python
{
    "summary": "Agenda al 72%. Poltrona 2 sotto-utilizzata al mattino.",
    "suggestions": [
        {
            "action": "insert_appointment",
            "gap_ref": "Poltrona 2|09:30",
            "patient_id": "P042",
            "patient_name": "Laura Verdi",
            "suggested_treatment": "Igiene professionale",
            "suggested_duration": 45,
            "priority": "high",
            "reason": "Igiene scaduta da 220gg, gap perfetto per seduta 45min",
            "recall_message": "Buongiorno Laura, e' passato un po' dall'ultima igiene. Avremmo disponibilita domani mattina alle 9:30, le andrebbe bene?"
        },
        {
            "action": "reorganize",
            "description": "Spostare controllo delle 14:00 (Poltrona 1) alle 14:00 (Poltrona 2) per liberare slot lungo su Poltrona 1",
            "priority": "medium",
            "reason": "Poltrona 1 ha operatore specializzato, meglio lasciare slot per interventi"
        }
    ],
    "alerts": [
        {
            "type": "underutilization",
            "message": "Poltrona 2 al 60% - trend negativo rispetto a settimana scorsa (68%)",
            "severity": "warning"
        }
    ]
}
```

### Endpoint

```
GET /api/v2/ai/agenda/suggestions?date=2026-03-23
```

Pipeline: `agenda_analyzer` -> `recall_matcher` -> `ai_suggestion_service`

**Fallback**: se LLM non disponibile, restituisce solo output deterministico (Fase 1+2) con `state: warning` e messaggio "Suggerimenti AI non disponibili, dati analitici comunque validi".

---

## Fase 5 - KPI Interpreter

### kpi_interpreter.py

Usa l'output di `kpi_engine.py` (gia esistente) e lo passa all'LLM per interpretazione.

**NON ricalcola nulla.** Chiama `kpi_engine.get_current_kpi()` e passa il risultato all'AI.

```python
def interpret_kpi(kpi_data, comparison_data=None):
    """
    kpi_data: output di kpi_engine.get_current_kpi()
    comparison_data: output di comparison_engine (opzionale)
    """
    prompt = build_kpi_prompt(kpi_data, comparison_data)
    return llm_client.complete(
        system_prompt=KPI_SYSTEM_PROMPT,
        user_message=prompt
    )
```

**Output:**

```python
{
    "insights": [
        "La produzione di marzo e' in linea col forecast (+2.3%)",
        "I costi materiali sono cresciuti del 12% vs trimestre precedente"
    ],
    "anomalies": [
        {
            "metric": "costo_materiali",
            "expected": 4200,
            "actual": 4700,
            "deviation_pct": 11.9,
            "possible_cause": "Aumento ordini fornitore X"
        }
    ],
    "recommendations": [
        "Verificare listino fornitore X, possibile rinegoziazione",
        "Produzione Poltrona 2 sotto media: verificare agenda operatore"
    ]
}
```

### Endpoint

```
GET /api/v2/ai/kpi/interpret?period=2026-03
```

---

## Fase 6 - Feedback loop

### Tabella `ai_suggestions_log`

```sql
CREATE TABLE ai_suggestions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    suggestion_type TEXT NOT NULL,        -- 'insert_appointment', 'reorganize', 'recall'
    suggestion_data TEXT NOT NULL,         -- JSON del suggerimento
    action_taken TEXT DEFAULT 'pending',   -- 'accepted', 'dismissed', 'modified'
    user_feedback TEXT,                    -- nota opzionale
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT
);
```

### Endpoint feedback

```
POST /api/v2/ai/feedback
{
    "suggestion_id": 42,
    "action": "accepted" | "dismissed" | "modified",
    "feedback": "Paziente non raggiungibile telefonicamente"
}
```

### Utilizzo nel prompt

Dopo N suggerimenti loggati, il contesto AI include:

```
Storico feedback recente:
- Suggerimenti igiene accettati: 78%
- Suggerimenti riorganizzazione accettati: 23%
- Motivo dismissal piu frequente: "paziente non disponibile"

Adatta i suggerimenti di conseguenza.
```

---

## Fase 7 - Frontend

### AgendaInsightsPage.tsx

Tab nella sezione agenda o dashboard dedicata. Struttura:

```
+-----------------------------------------------+
| Data: [23/03/2026]  [<] [>]                   |
+-----------------------------------------------+
| Efficiency globale: 72.5%  [===========---]   |
+-----------------------------------------------+
| PER POLTRONA                                   |
| [Poltrona 1] 85% ████████░░ Dr.Bianchi 12 app |
| [Poltrona 2] 60% ██████░░░░ Dr.Verdi    8 app |
+-----------------------------------------------+
| GAP TROVATI (2 azionabili)                     |
|                                                |
| 09:30-10:30 | Poltrona 2 | 60min              |
| [Laura V. - Igiene scaduta]  [Chiama] [Ins.]  |
| [Marco N. - Conservativa]    [Chiama] [Ins.]  |
|                                                |
| 14:00-14:30 | Poltrona 1 | 30min              |
| Nessun candidato compatibile                   |
+-----------------------------------------------+
| AI SUGGESTIONS                                 |
| > Spostare controllo 14:00 P1 -> P2  [Applica]|
| > P2 sotto-utilizzata: trend -8% vs sett.scorsa|
+-----------------------------------------------+
```

**Componenti CoreUI:**
- `CCard` per ogni sezione
- `CProgress` per efficiency bars
- `CBadge` per severity (danger/warning/success)
- `CButton` per azioni (Chiama, Inserisci, Applica)
- `CTable` per lista gap con paginazione

**Interazioni:**
- "Chiama" -> apre modale con numero + messaggio recall pre-compilato
- "Inserisci" -> apre form nuovo appuntamento pre-compilato (data, ora, poltrona, paziente, trattamento)
- "Applica" -> esegue riorganizzazione suggerita
- Ogni azione logga nel feedback loop (Fase 6)

### ai.service.ts

```typescript
const aiService = {
    async apiAnalyzeAgenda(date: string) {
        const response = await apiClient.get(`/ai/agenda/analyze`, { params: { date } })
        return response.data
    },
    async apiGetSuggestions(date: string) {
        const response = await apiClient.get(`/ai/agenda/suggestions`, { params: { date } })
        return response.data
    },
    async apiInterpretKpi(period: string) {
        const response = await apiClient.get(`/ai/kpi/interpret`, { params: { period } })
        return response.data
    },
    async apiSendFeedback(suggestionId: number, action: string, feedback?: string) {
        const response = await apiClient.post(`/ai/feedback`, {
            suggestion_id: suggestionId,
            action_taken: action,
            feedback
        })
        return response.data
    }
}
```

### ai.store.ts (Zustand)

Cache suggerimenti per 5 minuti. Invalida cache su feedback inviato.

---

## Fase 8 - Automazioni (event-based)

Integrazione con `scheduler_service.py` gia esistente (APScheduler).

| Trigger | Azione | Frequenza |
|---------|--------|-----------|
| Ogni mattina ore 7:00 | Analisi agenda del giorno -> push notification se efficiency < 60% | Giornaliera |
| Slot cancellato | Ricalcolo gap + suggerimenti recall per quello slot | Event-based |
| Fine mese | Interpretazione KPI mensile -> report automatico | Mensile |
| Gap > 60min trovato | Notifica in-app con candidati recall | Real-time |

Usa `push_notification_service.py` e `notification_service.py` gia esistenti.

---

## Costi e limiti

### Stima chiamate LLM

| Operazione | Frequenza stimata | Token medi | Costo GPT-4o-mini |
|------------|-------------------|------------|-------------------|
| Suggerimenti agenda | 1-2/giorno | ~2000 | ~$0.002 |
| Interpretazione KPI | 1/mese | ~3000 | ~$0.003 |
| Recall message | 3-5/giorno | ~500 | ~$0.001 |
| **Totale mensile** | | | **~$0.15-0.30** |

Con Ollama locale: $0.

### Limiti

- L'AI non ha accesso diretto al DB: riceve solo dati pre-elaborati dal layer deterministico
- Timeout 30s per chiamate LLM, fallback a solo deterministico
- Rate limit: max 10 chiamate AI/ora (configurabile)
- Nessun dato paziente sensibile inviato all'LLM esterno (solo ID, no nome/telefono nel prompt)

---

## Ordine di implementazione

| Fase | Cosa | Dipende da | Valore |
|------|------|------------|--------|
| 1 | agenda_analyzer.py (deterministico) | Nulla | Alto - funziona subito senza LLM |
| 2 | recall_matcher.py (deterministico) | Fase 1 | Alto - pazienti candidati per gap |
| 3 | llm_client.py | Nulla (parallelo a 1-2) | Infrastruttura |
| 4 | ai_suggestion_service.py | Fasi 1,2,3 | Alto - arricchimento AI |
| 5 | Frontend AgendaInsights | Fasi 1,2,4 | Alto - visibilita utente |
| 6 | Feedback loop | Fase 5 | Medio - migliora nel tempo |
| 7 | kpi_interpreter.py | Fase 3 | Medio - economics gia ha HealthPulse |
| 8 | Automazioni | Fasi 4,5 | Basso - nice-to-have |

**Le Fasi 1-2 danno valore immediato anche senza LLM configurato.**

---

## Privacy e sicurezza

- I prompt AI NON contengono dati identificativi pazienti (nome, CF, telefono)
- L'AI riceve solo: ID anonimizzato, tipo trattamento, date, durate
- Il recall_matcher restituisce i dati paziente dal DB locale, non dall'AI
- Con Ollama: zero dati escono dalla rete locale
- Con OpenAI: verificare compliance GDPR (dati anonimizzati = rischio basso)
- API key in variabile d'ambiente, mai in codice
