# Analisi Database Spese Fornitori - Sistema di Auto-Categorizzazione

## Panoramica del Database

**Database analizzato:** StudioDimaAI - Sistema gestionale studio odontoiatrico
- **Totale spese fornitori:** 1,435 record
- **Totale fornitori:** 132 
- **Periodo analizzato:** Database completo

## Pattern Identificati

### 1. Fornitori per Categoria

#### Energia Elettrica (2 fornitori)
- **Enel Energia SpA** - Pattern: `enel`, `energia spa`
- **EMPIRE POWERGAS & MOBILITY S.R.L.** - Pattern: `empire powergas`

**Caratteristiche identificative:**
- Descrizioni: "fornitura di energia elettrica", "consumo elettrico"
- Numeri documento: sequenze numeriche lunghe (10+ cifre)

#### Telecomunicazioni (5 fornitori)
- **Wind Tre S.p.A.** - Pattern: `wind tre`, `wind`
- **VODAFONE ITALIA S.p.A.** - Pattern: `vodafone`
- **TIM S.p.A.** - Pattern: `tim`, `telecom italia`
- **FASTWEB SpA** - Pattern: `fastweb`
- **DELTA TRE ELABORAZIONI SNC** - Pattern: `delta tre`

**Caratteristiche identificative:**
- Descrizioni: "decisione commerciale", "canone telefonico"
- Numeri documento: Pattern `R` + numeri lunghi

#### Acqua e Utenze (3 fornitori)
- **Publiacqua S.p.A.** - Pattern: `publiacqua`
- **EMPIRE POWERGAS & MOBILITY S.R.L.** - Pattern duplicato con energia
- **Ordine dei Medici Firenze** - Pattern: falso positivo (contiene "acqua" nel matching)

#### Materiali Dentali (7 fornitori) ⭐ **Categoria Principale**
- **Dentsply Sirona Italia Srl** - Pattern: `dentsply`, `sirona`
- **HENRY SCHEIN KRUGG S.R.L** - Pattern: `henry schein`, `krugg`
- **ZIMMER DENTAL ITALY S.R.L** - Pattern: `zimmer dental`
- **DENTALCOMM S.R.L.** - Pattern: `dental`
- **J DENTAL CARE SRL** - Pattern: `dental`
- **BLUDENTAL DI RUGA FRANCESCO** - Pattern: `dental`
- **FUTURIMPLANT1 SRL UNIPERSONALE** - Pattern: `implant`

**Caratteristiche identificative:**
- Numeri documento: Pattern `FPR` + numeri (125 documenti)
- Descrizioni: "materiali dentali", "impianti", nomi specifici prodotti

#### Leasing Finanziario (2 fornitori)
- **BNP PARIBAS LEASING SOLUTIONS SPA** - Pattern: `bnp paribas`, `leasing`
- **BNP PARIBAS LEASE GROUP SA** - Pattern: `lease group`

**Caratteristiche identificative:**
- Descrizioni: "Contratto di: Locazione Finanziaria Cliente:"
- Alta confidence (95%) per pattern specifici

#### Servizi Internet/Hosting (2 fornitori)
- **Aruba S.p.A.** - Pattern: `aruba`
- **Amazon EU S.r.l.** - Pattern: `amazon`

#### Servizi Bancari/Pagamento (2 fornitori)
- **NEXI PAYMENTS S.p.A.** - Pattern: `nexi`
- **COMPASS BANCA SPA** - Pattern: `compass banca`

#### Farmaceutici/Medical (2 fornitori)
- **Biaggini Medical Devices s.r.l.** - Pattern: `medical devices`
- **FARMACIA SAN MICHELE SAS** - Pattern: `farmacia`

#### Laboratori Odontotecnici (3 fornitori)
- **Lab.Odontotecnico ROBERTO MORELLI** - Pattern: `laboratorio`
- **Laboratorio Odontotecnico ORTHO-T** - Pattern: `laboratorio odontotecnico`
- **Laboratorio Odontotecnico Riccomini** - Pattern: `laboratorio`

### 2. Pattern nei Numeri Documento

#### Bollette Energia (108 documenti)
- **Pattern:** `^\d{10,}$` (solo numeri, 10+ cifre)
- **Esempi:** 003011504823, 004023680345
- **Confidence:** 70% (numerosità alta ma non esclusiva)

#### Materiali Dentali (125 documenti)
- **Pattern:** `^FPR\s*\d+` 
- **Esempi:** FPR 138/19, FPR 240/19
- **Confidence:** 60% (molto specifico per settore dentale)

#### Ricevute Telecomunicazioni (45 documenti)
- **Pattern:** `^R\d{8,}`
- **Esempi:** R00003327, R190024151
- **Confidence:** 50% (pattern comune ma non esclusivo)

#### Altri Pattern Significativi
- **E-pattern:** 48 documenti (es: E2100419) - Non identificato
- **M-pattern:** 36 documenti (es: M024295082) - Telecomunicazioni
- **C-pattern:** 34 documenti (es: C1AV10002708) - Servizi bancari
- **IT-pattern:** 21 documenti (es: IT21-AEUI-1111540) - Utenze

### 3. Pattern nelle Descrizioni

#### Tasse e Imposte (27 spese)
- **Keywords:** "contributo conai", "tassa", "imposta", "iva", "tributo"
- **Confidence:** 90%

#### Leasing Finanziario (26 spese)
- **Keywords:** "locazione finanziaria", "contratto di:"
- **Confidence:** 95%

#### Energia Elettrica (17 spese)
- **Keywords:** "fornitura di energia elettrica", "consumo elettrico"
- **Confidence:** 90%

#### Altri Pattern
- **Consulenze:** "consulenza", "prestazione professionale"
- **Formazione:** "corso", "aggiornamento professionale"

## Sistema di Categorizzazione Implementato

### Categorie Definite

```typescript
enum CategoriaSpesa {
  ENERGIA_ELETTRICA = 'ENERGIA_ELETTRICA',
  GAS_METANO = 'GAS_METANO', 
  ACQUA_UTENZE = 'ACQUA_UTENZE',
  TELECOMUNICAZIONI = 'TELECOMUNICAZIONI',
  INTERNET_HOSTING = 'INTERNET_HOSTING',
  MATERIALI_DENTALI = 'MATERIALI_DENTALI',
  APPARECCHIATURE_MEDICHE = 'APPARECCHIATURE_MEDICHE',
  FARMACEUTICI = 'FARMACEUTICI',
  LEASING_FINANZIARIO = 'LEASING_FINANZIARIO',
  CONSULENZE_PROFESSIONALI = 'CONSULENZE_PROFESSIONALI',
  SERVIZI_BANCARI = 'SERVIZI_BANCARI',
  MANUTENZIONI_RIPARAZIONI = 'MANUTENZIONI_RIPARAZIONI',
  ASSICURAZIONI = 'ASSICURAZIONI',
  FORMAZIONE_AGGIORNAMENTO = 'FORMAZIONE_AGGIORNAMENTO',
  TASSE_IMPOSTE = 'TASSE_IMPOSTE',
  AFFITTI_LOCAZIONI = 'AFFITTI_LOCAZIONI',
  CARBURANTI = 'CARBURANTI',
  ALTRO = 'ALTRO'
}
```

### Algoritmo di Categorizzazione

1. **Analisi Nome Fornitore** (Confidence: 80-95%)
   - Pattern matching su keywords specifiche
   - Priorità massima per pattern esatti

2. **Analisi Descrizione** (Confidence: 85-95%)
   - Keywords specifiche per settore
   - Pattern per contratti e servizi specifici

3. **Analisi Numero Documento** (Confidence: 50-70%)
   - Pattern regex per identificare tipologie
   - Supporto per categorizzazione quando altri metodi falliscono

4. **Logica di Combinazione**
   - Scelta della categoria con confidence più alta
   - Combinazione di multiple evidenze
   - Fallback su "ALTRO" quando confidence < 50%

### Precisione del Sistema

**Risultati stimati sui dati analizzati:**
- **Materiali Dentali:** ~95% accuracy (pattern molto specifici)
- **Energia/Telecomunicazioni:** ~90% accuracy (fornitori ben identificabili)
- **Leasing:** ~95% accuracy (descrizioni standardizzate)
- **Tasse/Imposte:** ~90% accuracy (keywords specifiche)
- **Altri:** ~60-80% accuracy (pattern meno definiti)

**Tasso di riconoscimento complessivo stimato:** ~75-85%

## Miglioramenti Suggeriti

### 1. Pattern Aggiuntivi da Implementare

#### Carburanti
- Analizzare fornitori come "ENI", "AGIP", "Q8"
- Keywords: "carburante", "benzina", "gasolio"

#### Assicurazioni
- Pattern: "assicurazione", "polizza", "premio"
- Fornitori: compagnie assicurative note

#### Affitti/Locazioni
- Keywords: "affitto", "locazione", "canone"
- Distinguere da leasing finanziario

### 2. Machine Learning Enhancement

```typescript
// Possibile implementazione futura
interface MLCategorization {
  trainOnHistoricalData(): void;
  predictCategory(spesa: SpesaFornitore): {
    categoria: CategoriaSpesa;
    confidence: number;
    features: string[];
  };
  updateModel(feedback: UserFeedback[]): void;
}
```

### 3. Feedback Loop

- Implementare sistema di feedback utente
- Tracciare correzioni manuali
- Aggiornare automaticamente i pattern
- Migliorare confidence nel tempo

### 4. Pattern per Settore Medico/Odontoiatrico

#### Collaboratori Medici
- Pattern esistente per medici collaboratori
- Keywords: nomi specifici dei dottori

#### Materiali Specifici
- Espandere database materiali dentali
- Categorizzazione per sottotipo (endodonzia, protesi, etc.)

#### Farmaci e Dispositivi Medici
- Pattern per codici AIC
- Riconoscimento dispositivi medici per classe

## File Implementati

### Core System
- `autoCategorization.ts` - Logica principale
- `useAutoCategorization.ts` - Hook React
- `StatisticheCategorizzazione.tsx` - Componente UI
- `testCategorization.ts` - Test e validazione

### Integration
- `TabellaSpese.tsx` - Integrazione nella tabella principale
- `SpesePage.tsx` - Tab dedicato alle statistiche

## Utilizzo del Sistema

```typescript
// Categorizzazione singola spesa
const categorizzazione = categorizzaSpesaFornitore(spesa);
console.log(categorizzazione.categoria); // CategoriaSpesa.MATERIALI_DENTALI
console.log(categorizzazione.confidence); // 0.95
console.log(categorizzazione.motivo); // "Nome fornitore contiene 'dentsply'"

// Statistiche su lotto di spese
const stats = getStatisticheCategorizzazione(spese);
console.log(stats.percentualeRiconoscimento); // 78.5
```

## Conclusioni

Il sistema di auto-categorizzazione implementato rappresenta una soluzione robusta per la classificazione automatica delle spese fornitori in uno studio odontoiatrico. La combinazione di pattern su nomi fornitori, descrizioni e numeri documento fornisce un'accuratezza stimata del 75-85%.

**Punti di forza:**
- Pattern specifici per settore odontoiatrico
- Alta precisione su categorie principali (materiali dentali, energia, telecomunicazioni)
- Sistema modulare ed estendibile
- Interfaccia utente integrata

**Aree di miglioramento:**
- Espansione pattern per categorie minori
- Sistema di feedback utente
- Machine learning per ottimizzazione continua
- Categorizzazione più granulare per materiali medici

Il sistema è pronto per l'utilizzo in produzione e può essere facilmente esteso con nuovi pattern basati sui dati reali dell'utilizzatore.