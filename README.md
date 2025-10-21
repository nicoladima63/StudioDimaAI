# StudioDimaAI bellissimo

Sistema modulare per l’analisi economica, operativa e clinica di uno studio dentistico.

---

## 📋 Scopo del progetto

StudioDimaAI consente di:
- Analizzare dati clinici e amministrativi (da DBF Windent)
- Generare KPI gestionali e report
- Visualizzare dashboard interattive
- Gestire richiami, fatture, pazienti, calendario, prescrizioni elettroniche
- Automatizzare test e procedure di manutenzione

---

## ⚙️ Architettura e tecnologie

### Backend (Python 3.10+, Flask)
- **Struttura modulare**: servizi, API, utility, modelli, config separati
- **Persistenza utenti/ruoli**: SQLite (default), estendibile
- **Lettura dati clinici**: parsing diretto file `.DBF`
- **API RESTful**: tutte le route sono centralizzate in `server/app/api/`
- **Servizi**: logica business in `server/app/services/`
- **Utility**: funzioni riutilizzabili in `server/app/utils/`
- **Script di utilità**: in `server/scripts/` (init db, autenticazione Google, estrazione dati)
- **Testing**: tutti i test in `server/tests/`

### Frontend (React + Vite)
- **Organizzazione per feature**: ogni area in `client/src/features/<feature>`
- **Chiamate API centralizzate**: in `client/src/api/apiClient.ts` e `client/src/api/services/`
- **Gestione stato**: Zustand
- **Componenti Core UI**: layout e widget riutilizzabili
- **Routing protetto**: gestione ruoli e autenticazione
- **Dashboard, filtri, report**: pagine dinamiche e interattive

---

## 🏗️ Struttura del progetto

```
StudioDimaAI/
├── server/
│   ├── app/           # Codice backend (api, servizi, modelli, utility, config)
│   ├── scripts/       # Script di utilità (init db, autenticazione, estrazione dati)
│   ├── tests/         # Test automatici (unitari, integrazione, API)
│   ├── token.json     # Token Google Calendar (generato)
│   ├── sync_state.json# Stato sincronizzazione (runtime)
│   └── app.log        # Log applicazione backend
├── client/
│   ├── src/
│   │   ├── api/           # Chiamate API centralizzate
│   │   ├── features/      # Ogni feature in sottocartella (auth, pazienti, recalls, ecc.)
│   │   ├── components/    # Componenti UI riutilizzabili
│   │   ├── pages/         # Pagine principali
│   │   └── ...            # Altri moduli (router, context, ecc.)
│   ├── public/
│   ├── package.json
│   └── ...
├── requirements.txt   # Dipendenze Python
├── README.md
└── ...
```

---

## 🚀 Come avviare il progetto

### 1. Clona la repository
```bash
git clone https://github.com/nicoladima63/StudioDimaAI.git
cd StudioDimaAI
```

### 2. Configura l’ambiente

- **Backend**: copia/crea file `.env` in `server/app/config/` se necessario (database, percorsi, segreti)
- **Frontend**: copia/crea file `.env` in `client/` (URL API, chiavi, ecc.)
- **Google Calendar**: posiziona `credentials.json` in `server/` e genera `token.json` con lo script dedicato

### 3. Installa le dipendenze

- **Backend**:
  ```bash
  cd server
  pip install -r ../requirements.txt
  ```
- **Frontend**:
  ```bash
  cd client
  npm install
  ```

### 4. Avvia i servizi

- **Backend**:
  ```bash
  cd server
  python -m app.run
  ```
- **Frontend**:
  ```bash
  cd client
  npm run dev
  ```

---

## 🧪 Testing

Tutti i test sono in `server/tests/`:
- Test unitari e di integrazione per servizi, API, utility
- Test specifici per moduli (recalls, ricetta bianca, rentri, ecc.)
- Esegui con:
  ```bash
  cd server
  pytest tests/
  ```

---

## 🛠️ Script di utilità

Gli script sono in `server/scripts/`:
- **init_db.py**: inizializza il database e crea l’utente admin
- **authenticate_google.py**: genera il token per Google Calendar
- **estrai_appuntamenti.py**: estrae appuntamenti da DBF Windent

Vedi `server/scripts/README.md` per dettagli e istruzioni.

---

## 📌 Note e best practice

- Tutte le chiamate API dal frontend devono passare da `apiClient.ts` o dai servizi centralizzati
- Gli import sono assoluti e coerenti in tutto il backend
- I test sono centralizzati e facilmente eseguibili
- I percorsi di rete (DBF) devono essere validi e accessibili dal backend
- I log sono scritti in `server/app.log`
- Per cambiare ambiente (dev/prod), aggiorna le variabili d’ambiente e riavvia i servizi

---

## 📚 Risorse e supporto

- [Documentazione Google Calendar API](https://developers.google.com/calendar/api)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [React Documentation](https://react.dev/)
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)

---

## 🧰 Suggerimenti per sviluppo e debug

- Usa sempre import assoluti nei moduli Python
- Centralizza la logica di business nei servizi
- Mantieni la struttura per feature anche nel frontend
- Esegui i test frequentemente per evitare regressioni
- Consulta i README nelle sottocartelle per istruzioni specifiche

---

Per domande o contributi, apri una issue o contatta il maintainer.

