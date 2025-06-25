# StudioDimaAI - Analisi Economica e Operativa Studio Dentistico

## 📋 Scopo del progetto
StudioDimaAI è un sistema modulare e scalabile per analizzare l’andamento economico e operativo di uno studio dentistico.  
Permette di elaborare dati clinici e amministrativi, generare KPI gestionali, visualizzare dashboard interattive e esportare report in vari formati.

---

## ⚙️ Tecnologie e architettura

### Backend
- Linguaggio: **Python 3.10+**
- Framework web: **Flask**
- Persistenza utenti e ruoli: **SQLite**
- Lettura dati clinici e amministrativi da file `.DBF` tramite modulo `db_handler.py`
- API RESTful modulari, divise per funzionalità:
  - `/api/auth/` → Autenticazione, gestione utenti e ruoli
  - `/api/analytics/` → KPI, statistiche, dashboard
  - `/api/export/` → Esportazione report (PDF, XLSX, DOC)
  - `/api/tests/` → Endpoint per test automatizzati
  - `/api/ml/` → Futuri modelli predittivi e analisi avanzate

### Frontend
- Framework: **React** con **Vite**
- Routing protetto con gestione ruoli (admin, segreteria, assistente)
- Pagine dinamiche per dashboard, filtri e report
- Autenticazione e sessioni gestite via JWT o simile
- Pagina dedicata per esecuzione test automatici e debug

---

## 🏗️ Struttura del progetto
---

StudioDimaAI/
├── server/ # Backend Python Flask
│ ├── app/
│ │ ├── auth/
│ │ ├── routes/
│ │ ├── services/
│ │ ├── utils/
│ │ ├── ml/
│ │ ├── logs/
│ │ ├── config.py
│ │ └── run.py
│ └── requirements.txt
├── client/ # Frontend React + Vite
│ ├── public/
│ ├── src/
│ │ ├── api/
│ │ ├── auth/
│ │ ├── components/
│ │ ├── pages/
│ │ └── routes.jsx
│ ├── .env
│ └── package.json
├── core/ # Moduli esistenti, es. db_handler.py
├── config/
│ ├── .env
│ └── config.py
├── data/
├── logs/
├── README.md
└── .gitignore

---

## 🔄 Processo di sviluppo e manutenzione

1. **Configurare `.env`** per backend e frontend (URL API, segreti, credenziali Google Calendar, ecc.)
2. **Avviare il backend** con `python run.py` (porta 5000, accessibile in LAN)
3. **Avviare il frontend react+vite** con `npm run dev` (porta 5173)
4. **Accedere via browser** all’interfaccia utente, fare login e navigare nelle sezioni dashboard
5. **Eseguire test automatici** tramite pagina dedicata `/tests`
6. **Espandere i moduli** aggiungendo nuove API o componenti React come necessario
7. **Monitorare i log** in `analytics/app/logs/access.log`

---

## 📌 Note importanti

- Il database dei dati clinici e amministrativi è in formato `.DBF`, letto tramite `db_handler.py`
- L’autenticazione è gestita a livello frontend con login e ruoli, mentre il backend protegge le API con token semplice
- L’architettura è pensata per uso in LAN, con possibile evoluzione per accesso remoto e analisi predittive
- I test automatici sono integrati per garantire affidabilità e facilitare lo sviluppo incrementale
- Le esportazioni report sono flessibili e modulari, con formati configurabili

---

## 🧰 Istruzioni per future conversazioni con ChatGPT

Quando riprendi la discussione, puoi fornire questo riassunto per evitare di ripartire da zero:

> "Sto lavorando al progetto StudioDimaAI, un’app per analisi economiche e operative di uno studio dentistico. Backend in Python Flask con SQLite per utenti, frontend React + Vite, dati letti da DBF tramite modulo `db_handler.py`. Abbiamo gestito login con ruoli, API protette da token, test automatici richiamabili da frontend, esportazioni PDF/XLSX/DOC, e pensiamo a futuri moduli ML.  
> Ti fornisco la struttura e il contesto completo se serve."

---

## 🚀 Come clonare il repository e aprirlo in Visual Studio Code

1. Assicurati di avere installato:
   - [Git](https://git-scm.com/downloads)
   - [Visual Studio Code](https://code.visualstudio.com/)

2. Apri il terminale (Prompt dei comandi, PowerShell, Terminale Mac/Linux).

3. Clona il repository con il comando:
   git clone https://github.com/nicoladima63/StudioDimaAI.git
   cd StudioDimaAI
   code .

