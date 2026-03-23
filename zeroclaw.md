📄 PDR – Integrazione ZeroClaw nel backend Python
🎯 Obiettivo

Integrare un motore agent-based (ZeroClaw) per:

analisi intelligente agenda
suggerimenti operativi
automazioni (richiami, ottimizzazione slot)
interfaccia conversazionale in dashboard
🧱 Architettura target
Frontend (React)
    ↓
Backend Python (FastAPI)
    ↓
Layer AI (ZeroClaw client)
    ↓
ZeroClaw runtime (servizio separato)
    ↓
LLM (OpenAI / Ollama)
📁 Struttura nel tuo progetto

Senza rompere quanto hai già:

app/
 ├── core/
 │    ├── sync_utils.py
 │    ├── ...
 │
 ├── config/
 │    ├── constants.py
 │
 ├── ai/                         ← NUOVO
 │    ├── zeroclaw_client.py
 │    ├── agents/
 │    │     ├── agenda_optimizer.json
 │    │     ├── recall_manager.json
 │    │     ├── kpi_analyst.json
 │    │
 │    ├── services/
 │    │     ├── agenda_ai.py
 │    │     ├── recall_ai.py
 │    │     ├── kpi_ai.py
 │
 ├── api/
 │    ├── routes_ai.py
⚙️ Fase 1 – Setup base
1. Avvio ZeroClaw
installazione runtime
esecuzione locale (porta es. 3000)
2. Connessione LLM

Scegli una modalità:

veloce → OpenAI / OpenRouter
locale → Ollama
🔌 Fase 2 – Client Python

Creare wrapper centralizzato:

# app/ai/zeroclaw_client.py

import requests

class ZeroClawClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url

    def run_agent(self, agent, payload):
        response = requests.post(
            f"{self.base_url}/agents/run",
            json={
                "agent": agent,
                "input": payload
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()
🧠 Fase 3 – Definizione agenti
1. Agenda Optimizer

Input:

appuntamenti
durata
slot liberi

Output:

buchi produttivi
suggerimenti riempimento
2. Recall Manager

Input:

pazienti
storico
inattivi

Output:

lista contatti
priorità
messaggio suggerito
3. KPI Analyst

Input:

output script KPI (già esistenti)

Output:

insight
anomalie
raccomandazioni
🔄 Fase 4 – Service layer AI

Esempio:

# app/ai/services/agenda_ai.py

from app.ai.zeroclaw_client import ZeroClawClient

zc = ZeroClawClient()

def analyze_agenda(appointments, kpi):
    return zc.run_agent(
        "agenda_optimizer",
        {
            "appointments": appointments,
            "kpi": kpi
        }
    )
🌐 Fase 5 – API backend
# app/api/routes_ai.py

from fastapi import APIRouter
from app.ai.services.agenda_ai import analyze_agenda

router = APIRouter()

@router.post("/ai/agenda/analyze")
def agenda_analysis(data: dict):
    return analyze_agenda(
        data["appointments"],
        data.get("kpi", {})
    )
🖥️ Fase 6 – Integrazione frontend

React:

chiamata endpoint /ai/...
visualizzazione:
suggerimenti
alert
KPI interpretati
🤖 Fase 7 – Automazioni (step avanzato)

Trigger possibili:

slot libero → suggerimento recall
agenda sotto soglia → alert
KPI negativi → analisi automatica

Esecuzione:

cronjob Python
oppure event-based (consigliato)
📊 Fase 8 – Logging e controllo

Aggiungere:

log richieste AI
costo chiamate (se API)
fallback in caso errore
⚠️ Vincoli e decisioni
Deterministico vs AI
Python (core/) → logica certa
ZeroClaw → decisioni / suggerimenti