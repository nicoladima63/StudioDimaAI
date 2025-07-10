# PDR - Sistema Analisi KPI Studio Odontoiatrico

## 1. ANALISI DEI REQUISITI

### Contesto
- Studio odontoiatrico con ~186k€ annui, 900 fatture/anno
- Storico dati: 2002-2025 (23 anni)
- Database: Visual FoxPro (.dbf)
- Stack: Python/Pandas (BE) + React/Recharts (FE)

### KPI Target
1. **Incassi nel tempo** (andamento mensile/trimestrale/annuale)
2. **Contribuzione per tipologia prestazione**
3. **Fidelizzazione pazienti** (frequenza, retention)
4. **Metodi di pagamento** (distribuzione e trend)

## 2. ARCHITETTURA DATI

### Tabelle Principali
```
FATTURE.DBF (struttura da definire)
├── Data fattura
├── Importo
├── Codice paziente
├── Metodo pagamento
├── Tipo prestazione
└── Altri campi...

PAZIENTI.DBF
├── DB_CODE (chiave primaria)
├── DB_PANOME (nome paziente)
├── DB_PALAST (ultima visita)
├── DB_PACONSE (consenso)
└── Altri campi anagrafici...

ACCONTI.DBF
├── DB_ACELCOD (codice paziente)
├── DB_ACDATA (data acconto)
├── DB_ACLIRE (importo)
└── DB_ACFANUM (numero fattura)

PREVENT.DBF
├── DB_PRELCOD (codice paziente)
├── DB_PRDATA (data preventivo)
├── DB_PRSPESA (spesa preventivata)
└── DB_PRLAVOR (tipo lavoro)
```

## 3. STRUTTURA BACKEND (Basata sul tuo pattern esistente)

### 3.1 Struttura Cartelle
```
app/
├── incassi/
│   ├── __init__.py
│   ├── service.py          # IncassiService
│   └── controller.py       # Blueprint incassi_bp
├── contribuzione/
│   ├── __init__.py
│   ├── service.py          # ContribuzioneService
│   └── controller.py       # Blueprint contribuzione_bp
├── fidelizzazione/
│   ├── __init__.py
│   ├── service.py          # FidelizzazioneService
│   └── controller.py       # Blueprint fidelizzazione_bp
├── pagamenti/
│   ├── __init__.py
│   ├── service.py          # PagamentiService
│   └── controller.py       # Blueprint pagamenti_bp
└── core/
    └── analytics_handler.py   # Handler specifico per analisi
```

### 3.2 Service Pattern (Come PazientiService)
```python
# app/incassi/service.py
from dbfread import DBF
from server.app.core.db_handler import DBHandler
from server.app.config.constants import get_dbf_path

class IncassiService:
    def __init__(self):
        self.acconti_path = get_dbf_path('acconti')
        self.pazienti_path = get_dbf_path('pazienti') 
        self.db_handler = DBHandler()
    
    def get_incassi_trend(self, date_from=None, date_to=None):
        """Analisi trend incassi"""
        pass
```

### 3.3 Controller Pattern (Come PazientiController)
```python
# app/incassi/controller.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from .service import IncassiService

incassi_bp = Blueprint('incassi', __name__, url_prefix='/api/incassi')
service = IncassiService()

@incassi_bp.route('/trend', methods=['GET'])
@jwt_required()
def get_trend():
    try:
        # Parsing parametri query
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        data = service.get_incassi_trend(date_from, date_to)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
```

## 4. ENDPOINT API DESIGN

### 4.1 Incassi
```
GET /api/incassi/trend
Query params: period=[monthly|quarterly|yearly], year_from, year_to

GET /api/incassi/summary
Query params: date_from, date_to

GET /api/incassi/comparison
Query params: current_period, previous_period
```

### 4.2 Contribuzione
```
GET /api/contribuzione/per-prestazione
Query params: period, date_from, date_to

GET /api/contribuzione/top-prestazioni
Query params: limit, period
```

### 4.3 Fidelizzazione
```
GET /api/fidelizzazione/retention-rate
Query params: period, cohort_type

GET /api/fidelizzazione/pazienti-attivi
Query params: months_threshold, date_from, date_to

GET /api/fidelizzazione/frequenza-visite
Query params: date_from, date_to
```

### 4.4 Pagamenti
```
GET /api/pagamenti/distribuzione
Query params: period, date_from, date_to

GET /api/pagamenti/trend-metodi
Query params: period, year_from, year_to
```

## 5. MODELLI DATI

### 5.1 Dataclasses Python
```python
@dataclass
class FatturaDTO:
    id: str
    data: datetime
    importo: float
    codice_paziente: str
    metodo_pagamento: str
    tipo_prestazione: str
    
@dataclass
class IncassoTrendDTO:
    periodo: str
    importo: float
    numero_fatture: int
    valore_medio: float
    
@dataclass
class ContribuzioneDTO:
    tipo_prestazione: str
    importo_totale: float
    numero_prestazioni: int
    percentuale_contribuzione: float
```

## 6. FRONTEND COMPONENTS

### 6.1 Struttura Dashboard
```
src/components/kpi/
├── IncassiAnalysis/
│   ├── IncassiTrendChart.jsx
│   ├── IncassiSummary.jsx
│   └── IncassiComparison.jsx
├── Contribuzione/
│   ├── ContribuzioneChart.jsx
│   └── TopPrestazioniTable.jsx
├── Fidelizzazione/
│   ├── RetentionChart.jsx
│   └── PazientiAttiviCard.jsx
└── Pagamenti/
    ├── DistribuzionePagamentiChart.jsx
    └── TrendMetodiChart.jsx
```

### 6.2 Recharts Components
```javascript
// Grafici necessari
- BarChart (incassi mensili/trimestrali)
- LineChart (trend nel tempo)
- PieChart (distribuzione metodi pagamento)
- AreaChart (contribuzione per prestazione)
- ComposedChart (confronti multi-metriche)
```

## 7. LOGICA BUSINESS SPECIFICA

### 7.1 Implementazione Specifica DBF
```python
# app/incassi/service.py
class IncassiService:
    def get_incassi_trend(self, date_from=None, date_to=None):
        incassi = []
        for record in DBF(self.acconti_path, encoding='latin-1'):
            # Filtro date se specificato
            if date_from and record.get('DB_ACDATA') < date_from:
                continue
            if date_to and record.get('DB_ACDATA') > date_to:
                continue
                
            incassi.append({
                'data': record.get('DB_ACDATA'),
                'importo': record.get('DB_ACLIRE', 0),
                'codice_paziente': record.get('DB_ACELCOD'),
                'medico': record.get('DB_ACMEDIC'),
                'numero_fattura': record.get('DB_ACFANUM')
            })
        return self._calcola_trend(incassi)
    
    def _calcola_trend(self, incassi):
        """Raggruppa per periodo e calcola trend"""
        # Logica pandas per raggruppamento
        import pandas as pd
        df = pd.DataFrame(incassi)
        # Implementazione specifica...
```

### 7.2 Calcolo Contribuzione
```python
def calcola_contribuzione_prestazione(self, tipo_prestazione, periodo):
    """
    Logica:
    1. Raggruppa fatture per tipo prestazione
    2. Calcola % sul totale incassi
    3. Analizza trend temporale
    """
```

### 7.3 Analisi Stagionalità
```python
def analisi_stagionalita(self, anni_analisi):
    """
    Logica:
    1. Raggruppa per mese/trimestre
    2. Calcola medie storiche
    3. Identifica pattern ricorrenti
    """
```

## 8. FASI DI SVILUPPO

### FASE 1: Setup Base (1-2 settimane)
- [ ] Creazione cartelle incassi/, contribuzione/, fidelizzazione/, pagamenti/
- [ ] Implementazione IncassiService con pattern esistente
- [ ] Primo endpoint /api/incassi/trend con JWT
- [ ] Test integrazione con get_dbf_path('acconti')
- [ ] Aggiornamento routes/__init__.py per blueprint registration

### FASE 2: Analisi Incassi (1 settimana)
- [ ] Endpoint trend incassi
- [ ] Componenti grafici incassi
- [ ] Filtri e drill-down
- [ ] Confronti YoY

### FASE 3: Analisi Contribuzione (1 settimana)
- [ ] Mappatura tipi prestazione
- [ ] Logica contribuzione
- [ ] Grafici contribuzione
- [ ] Top prestazioni

### FASE 4: Analisi Fidelizzazione (1-2 settimane)
- [ ] Logica retention rate
- [ ] Identificazione pazienti attivi
- [ ] Analisi frequenza visite
- [ ] Dashboard fidelizzazione

### FASE 5: Analisi Pagamenti (1 settimana)
- [ ] Distribuzione metodi pagamento
- [ ] Trend temporali pagamenti
- [ ] Correlazioni importi/metodi

### FASE 6: Ottimizzazioni (1 settimana)
- [ ] Caching query frequenti
- [ ] Ottimizzazione performance
- [ ] Export dati
- [ ] Testing e debug

## 9. CONSIDERAZIONI TECNICHE

### 9.1 Performance
- **Caching**: Cache query pesanti (trend storici)
- **Indicizzazione**: Considera indici su date e codici paziente
- **Paginazione**: Per liste lunghe (>1000 record)

### 9.2 Encoding DBF
- Gestione charset italiano (cp1252/latin1)
- Validazione dati incompleti/corrotti
- Handling date format Visual FoxPro

### 9.3 Sicurezza
- Validazione input date ranges
- Sanitizzazione parametri query
- Rate limiting su endpoint pesanti

## 10. METRICHE E MONITORAGGIO

### 10.1 KPI Calcolate
```python
# Esempi di calcoli
incasso_medio_mensile = sum(incassi_mese) / len(mesi)
crescita_yoy = (incasso_anno_corrente - incasso_anno_precedente) / incasso_anno_precedente * 100
retention_rate_6m = pazienti_ritornati_6m / nuovi_pazienti * 100
top_prestazione_contribuzione = max(contribuzioni_per_prestazione)
```

### 10.2 Validazioni Dati
- Controllo coerenza date
- Validazione importi negativi
- Identificazione outliers
- Segnalazione dati mancanti

## 11. DELIVERABLES

### 11.1 Codice
- Backend Python con API REST
- Frontend React con dashboard
- Documentazione API
- Script deployment

### 11.2 Dashboard Features
- Filtri temporali avanzati
- Grafici interattivi
- Drill-down su dati
- Export CSV/Excel basic

### 11.3 Documentazione
- Setup e installazione
- Guida utente dashboard
- API documentation
- Troubleshooting guide

## 12. STIMA TEMPI

**Totale stimato: 6-8 settimane**
- Sviluppo: 80% del tempo
- Testing: 15% del tempo  
- Documentazione: 5% del tempo

**Milestone principali:**
- Settimana 2: Prima versione incassi
- Settimana 4: Dashboard completa base
- Settimana 6: Tutte le KPI implementate
- Settimana 8: Ottimizzazioni e deploy

---

**Note**: Questo PDR è modulare e può essere adattato in base alle priorità specifiche. Si consiglia di iniziare con l'analisi incassi per validare l'approccio tecnico prima di procedere con le altre KPI.
