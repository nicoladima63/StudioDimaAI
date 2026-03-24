# Studio Analytics - Metrics Definition

## Production Metrics

### Produzione (Production)
- **Source**: FATTURE.DBF via `data_normalizer.get_df_production()`
- **Formula**: Sum of `DB_FAIMPON` for all invoices with importo > 0
- **Unit**: EUR
- **Granularity**: Monthly, YTD, Annual

### Ore Cliniche (Clinical Hours)
- **Source**: APPUNTA.DBF via `data_normalizer.get_df_appointments()`
- **Formula**: Sum of `(ora_fine - ora_inizio)` in hours, excluding types F (Ferie) and A (Attivita)
- **Time format**: DBF stores times as `ore.minuti` (e.g., 9.30 = 9:30, 17.25 = 17:25)
- **Conversion**: `minutes = int(val) * 60 + round((val - int(val)) * 100)`

### Saturazione (Saturation %)
- **Formula**: `(ore_cliniche / 160) * 100` where 160 = available hours per month
- **Unit**: Percentage

### Chair Utilization (NEW - detect_inefficiencies)
- **Source**: Appointments grouped by (date, studio)
- **Formula**: `occupied_minutes / (working_days * 480) * 100` per chair
- **Working day**: 8 hours = 480 minutes (9:00-13:00, 14:00-18:00)

## Cost Metrics

### Costi Diretti (Direct Costs)
- **Source**: SPESAFOR.DBF + classificazioni_costi table (tipo=1)
- **Definition**: Variable costs tied to patient treatment
- **Examples**: Laboratory materials, dental supplies

### Costi Indiretti (Indirect Costs)
- **Source**: SPESAFOR.DBF (tipo=2) + PRIMANO.DBF (payroll, taxes, insurance)
- **Definition**: Fixed overhead costs
- **Primanota categories**: Stipendi, INPS, tributi F24, assicurazioni

### Costi Non Deducibili (Non-Deductible Costs)
- **Source**: SPESAFOR.DBF (tipo=3)
- **Definition**: Personal/non-deductible expenses

## Margin Metrics

### Margine (Margin)
- **Formula**: `produzione - costi_totali`
- **Unit**: EUR

### Margine % (Margin Percentage)
- **Formula**: `(margine / produzione) * 100`

### Margine di Contribuzione (Contribution Margin)
- **Formula**: `1 - (costi_diretti / produzione)`
- **Used for**: Break-even calculation

### Break-Even Mensile (Monthly Break-Even)
- **Formula**: `costi_fissi_medi_mensili / margine_contribuzione`
- **Fixed costs**: costi_indiretti + costi_non_deducibili + costi_non_classificati

## Performance Metrics

### Ricavo Medio Ora (Revenue Per Hour)
- **Formula**: `produzione_ytd / ore_cliniche_ytd`
- **Unit**: EUR/hour

### Production per Operator
- **Note**: No direct invoice-to-doctor link exists. Production is distributed proportionally to clinical hours per doctor.

## Forecast Metrics

### Three Scenarios
| Scenario | Trend Factor | Pipeline Conversion |
|----------|-------------|-------------------|
| Conservative | 0.9 | 30% |
| Realistic | 1.0 | 50% |
| Optimistic | 1.1 | 70% |

### Pipeline Preventivi
- **Source**: PREVENT.DBF, stato=1 (Da Eseguire)
- **Formula**: Sum of `spesa` for pending treatment plans

### Seasonality Index
- **Source**: 5 years of monthly production data
- **Formula**: `media_produzione_mese / media_globale_mensile`
- **Interpretation**: >1 = above average month, <1 = below average

### Trend Factor
- **Source**: Linear regression on annual production
- **Formula**: `1 + (crescita_annuale_pct / 100)`

## Inefficiency Metrics

### Unused Chair Time
- **Definition**: Gaps >= 30 minutes between appointments on the same chair/day
- **Includes**: Time before first appointment (from 9:00) and after last (to 18:00)
- **Unit**: Minutes, aggregated to hours

### Fragmentation
- **Definition**: Gaps between 5-20 minutes between consecutive appointments
- **Impact**: Too short to book another patient, wasted time

### Prime Slot Utilization
- **Prime slots**: 9:00-12:00
- **Low revenue types**: S (Controllo), I (Igiene), V (Prima visita), U (Gnatologia), M (Privato)
- **Metric**: % of prime-slot appointments used for low-revenue procedures

### No-Show Rate (Estimated)
- **Method**: Cross-reference appointments with executed treatments (stato=3 in PREVENT.DBF)
- **Match key**: (date, doctor)
- **Caveat**: Heuristic - consultations and follow-ups may not generate PREVENT entries

## Collaboratori (Doctor Profitability)

### Compensation Types
| Type | Rule | Example |
|------|------|---------|
| Titolare | No cost (owner) | Dr. Di Martino |
| Percentuale | Fixed % of production | 45% or 70% |
| Per Intervento | Fixed EUR per qualifying procedure | 300 EUR x surgery |

### Margine Studio (per doctor)
- **Formula**: `produzione_medico - compenso_medico`

## Data Sources

| DBF File | Content | Key Fields |
|----------|---------|------------|
| FATTURE.DBF | Invoices | DB_FADATA, DB_FAIMPON |
| APPUNTA.DBF | Appointments | DB_APDATA, DB_APOREIN, DB_APOREOU, DB_GUARDIA, DB_APMEDIC, DB_APSTUDI |
| SPESAFOR.DBF | Supplier costs | DB_SPDATA, DB_SPCOSTO, DB_SPCOIVA, DB_SPFOCOD |
| PRIMANO.DBF | Cash journal | DB_PRDATA, DB_PRTOTAL, DB_PRCHI, DB_PRTIPOP |
| PREVENT.DBF | Treatments | DB_PRDATA, DB_PRSPESA, DB_GUARDIA, DB_PRMEDIC |
| ONORARIO.DBF | Fee schedule | DB_CODE, DB_ONTIPO, DB_ONDESCR |
| PAZIENTI.DBF | Patients | DB_CODE, DB_PANOME |

## Constants Reference

### Doctors (MEDICI)
| ID | Name |
|----|------|
| 1 | Dr. Nicola Di Martino |
| 2 | Dr.ssa Lara |
| 3 | Dr. Roberto Calvisi |
| 4 | Dr. Giacomo D Orlandi |
| 5 | Dr.ssa Anet Jablonvsky |
| 6 | Dr.ssa Rossella Pisante |

### Service Categories (CATEGORIE_PRESTAZIONI)
| ID | Name |
|----|------|
| 1 | Parte generale |
| 2 | Conservativa |
| 3 | Endodonzia |
| 4 | Parodontologia |
| 5 | Chirurgia |
| 6 | Implantologia |
| 7 | Protesi Fissa |
| 8 | Protesi Mobile |
| 9 | Ortodonzia |
| 10 | Pedodonzia |
| 11 | Igiene orale |
| 12 | Chirurgia implantare |
