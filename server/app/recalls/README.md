# Modulo Richiami - StudioDimaAI

## Panoramica

Il modulo richiami gestisce i richiami automatici dei pazienti basandosi sui dati contenuti nel file `PAZIENTI.DBF`. Il sistema identifica i pazienti che necessitano di richiami e fornisce funzionalità per visualizzare, filtrare e gestire questi richiami.

## Struttura del Modulo

```
recalls/
├── __init__.py          # Inizializzazione modulo
├── utils.py             # Funzioni di utilità
├── service.py           # Logica di business
├── controller.py        # Endpoint API
├── test_recalls.py      # Script di test
└── README.md           # Documentazione
```

## Funzionalità

### 1. Lettura Dati DBF
- Legge i dati dei richiami dal file `PAZIENTI.DBF`
- Filtra i pazienti con `DB_PARICHI = True`
- Estrae informazioni su tipo richiamo, date, ultima visita

### 2. Gestione Richiami
- **Stati**: scaduto, in_scadenza, futuro
- **Tipi**: Generico, Igiene, Rx Impianto, Controllo, Impianto, Ortodonzia
- **Filtri**: per stato, tipo, soglia giorni

### 3. Statistiche
- Conteggio richiami per stato
- Distribuzione per tipo
- Analisi temporale

## API Endpoints

### GET /api/recalls/
Ottiene tutti i richiami con filtri opzionali

**Parametri:**
- `days` (int): soglia giorni (default: 90)
- `status` (string): filtro stato (scaduto, in_scadenza, futuro)
- `tipo` (string): filtro tipo richiamo

**Risposta:**
```json
{
  "success": true,
  "data": [...],
  "count": 25,
  "filters": {
    "days_threshold": 90,
    "status": null,
    "tipo": null
  }
}
```

### GET /api/recalls/statistics
Ottiene statistiche sui richiami

**Parametri:**
- `days` (int): soglia giorni (default: 90)

**Risposta:**
```json
{
  "success": true,
  "data": {
    "totale": 25,
    "scaduti": 5,
    "in_scadenza": 10,
    "futuri": 10,
    "per_tipo": {
      "Igiene": 8,
      "Controllo": 12,
      "Impianto": 5
    }
  }
}
```

### GET /api/recalls/{richiamo_id}/message
Ottiene il messaggio preparato per un richiamo specifico

**Risposta:**
```json
{
  "success": true,
  "data": {
    "richiamo": {...},
    "messaggio": "Ciao Mario Rossi, Ti ricordiamo che è tempo...",
    "telefono": "+393331234567"
  }
}
```

### POST /api/recalls/update-dates
Aggiorna le date dei richiami basandosi sull'ultima visita

**Risposta:**
```json
{
  "success": true,
  "data": {
    "aggiornati": 15,
    "errori": 2,
    "totale_processati": 17
  },
  "message": "Aggiornati 15 richiami su 17 processati"
}
```

### GET /api/recalls/export
Esporta i richiami (attualmente in JSON, futuro CSV)

### GET /api/recalls/test
Endpoint di test per verificare il funzionamento

## Struttura Dati Richiamo

```json
{
  "id_paziente": "12345",
  "nome_completo": "Mario Rossi",
  "telefono": "+393331234567",
  "tipo_codice": "1",
  "tipo_descrizione": "Generico",
  "mesi_richiamo": 6,
  "ultima_visita": "2024-01-15",
  "data_richiamo": "2024-07-15",
  "data_richiamo_2": "2024-08-15",
  "da_richiamare": true,
  "giorni_scadenza": 45,
  "stato": "in_scadenza"
}
```

## Costanti DBF

Le colonne utilizzate sono definite in `config/constants.py`:

```python
COLONNE['richiami'] = {
    'id_paziente': 'DB_CODE',
    'da_richiamare': 'DB_PARICHI',
    'mesi': 'DB_PARITAR',
    'tipo': 'DB_PARIMOT',
    'data1': 'DB_PAMODA1',
    'data2': 'DB_PAMODA2',
    'ultima_visita': 'DB_PAULTVI'
}
```

## Tipi di Richiamo

```python
TIPO_RICHIAMI = {
    '1': 'Generico',
    '2': 'Igiene',
    '3': 'Rx Impianto',
    '4': 'Controllo',
    '5': 'Impianto',
    '6': 'Ortodonzia'
}
```

## Utilizzo

### Test del Modulo
```bash
cd server/app
python recalls/test_recalls.py
```

### Avvio Server
```bash
cd server
python -m app.run
```

### Test API
```bash
# Ottieni token di autenticazione
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Test richiami
curl -X GET http://localhost:5000/api/recalls/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Note di Implementazione

1. **Lettura DBF**: Il sistema legge direttamente dal file DBF senza modificarlo
2. **Calcoli**: Le date di richiamo vengono calcolate dinamicamente
3. **Telefoni**: I numeri vengono normalizzati nel formato internazionale italiano
4. **Messaggi**: I messaggi sono personalizzati per tipo di richiamo e paziente
5. **Filtri**: Supporto per filtri multipli e combinati

## Prossimi Sviluppi

- [ ] Integrazione con Twilio per invio SMS/WhatsApp
- [ ] Sistema di notifiche automatiche
- [ ] Export in formato CSV/Excel
- [ ] Interfaccia web per gestione richiami
- [ ] Storico invii e tracking
- [ ] Personalizzazione messaggi per medico 