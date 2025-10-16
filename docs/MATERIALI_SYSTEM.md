# 🦷 Sistema Gestione Materiali - StudioDimaAI V2

## 📋 Panoramica

Il sistema di gestione materiali permette di creare un archivio digitale dei materiali dentali importandoli dal gestionale legacy (VOCISPES.DBF) con filtri intelligenti per identificare automaticamente i materiali utili per lo studio dentistico.

## 🏗️ Architettura

### Componenti Principali

1. **MaterialiMigrationService** - Servizio per migrazione da VOCISPES.DBF
2. **MaterialiService** - Servizio CRUD per gestione materiali
3. **Tabella materiali** - Database SQLite con struttura completa
4. **API Endpoints** - REST API per frontend e integrazioni

### Struttura Database

```sql
CREATE TABLE materiali (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Dati base da VOCISPES.DBF
    codice_materiale TEXT,
    descrizione TEXT NOT NULL,
    codice_fornitore TEXT,
    prezzo DECIMAL(10,2),
    
    -- Dati arricchiti
    nome_fornitore TEXT,
    categoria_materiale TEXT,
    sottocategoria TEXT,
    unita_misura TEXT,
    
    -- Classificazione intelligente
    is_dental_material BOOLEAN DEFAULT 1,
    material_type TEXT, -- 'resina', 'strisce', 'perni', 'cunei', etc.
    confidence_score INTEGER DEFAULT 100,
    
    -- Gestione inventario
    quantita_disponibile DECIMAL(10,3) DEFAULT 0,
    quantita_minima DECIMAL(10,3) DEFAULT 0,
    costo_unitario DECIMAL(10,2),
    
    -- Metadati
    source_file TEXT DEFAULT 'VOCISPES.DBF',
    migrated_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    -- Flags di stato
    is_active BOOLEAN DEFAULT 1,
    is_favorite BOOLEAN DEFAULT 0,
    notes TEXT
);
```

## 🧠 Sistema di Classificazione Intelligente

### Categorie Materiali Dentali

Il sistema riconosce automaticamente questi tipi di materiali:

- **resina**: Materiali compositi, flow, resine da otturazione
- **strisce**: Strisce matrici, matrix strips
- **perni**: Perni in fibra, post endodontici
- **cunei**: Cunei interdentali, wedges
- **fili**: Fili retrattori gengivali
- **cementi**: Cementi da cementazione, adesivi, bonding
- **anestesia**: Carpule anestetiche, articaina, lidocaina
- **suture**: Fili chirurgici, suture riassorbibili
- **disinfettanti**: Clorexidina, perossido, ipoclorito
- **protesi**: Materiali da impronta, siliconi, alginati
- **endodonzia**: Lime, guttaperca, sealer, irriganti
- **chirurgia**: Bisturi, elevatori, sindesmotomi
- **igiene**: Paste profilattiche, fluoruri
- **radiologia**: Pellicole, sensori, bite
- **laboratorio**: Gessi, cere, articolatori

### Algoritmo di Filtraggio

1. **Esclusione Automatica**: Materiali amministrativi/non dentali
2. **Riconoscimento Parole Chiave**: Match con dizionario termini dentali
3. **Pattern Recognition**: Unità di misura mediche, percentuali, termini sterili
4. **Scoring di Confidenza**: 0-100% basato su multiple corrispondenze

## 🚀 Utilizzo

### 1. Creazione Tabella

```bash
cd server_v2
python migrations/create_materiali_table.py
```

### 2. Test Sistema

```bash
# Test completo
python scripts/test_materiali_migration.py --all

# Test specifici
python scripts/test_materiali_migration.py --test-connection
python scripts/test_materiali_migration.py --preview
python scripts/test_materiali_migration.py --migrate
python scripts/test_materiali_migration.py --status
```

### 3. API Endpoints

#### Preview Migrazione
```http
GET /api/materiali/migrate/preview
Authorization: Bearer <token>
```

#### Esecuzione Migrazione
```http
POST /api/materiali/migrate/execute
Authorization: Bearer <token>
Content-Type: application/json

{
    "confidence_threshold": 40,
    "overwrite_existing": true,
    "dry_run": false
}
```

#### Status Migrazione
```http
GET /api/materiali/migrate/status
Authorization: Bearer <token>
```

#### Test Connessione VOCISPES.DBF
```http
GET /api/materiali/migrate/test-connection
Authorization: Bearer <token>
```

### 4. Ricerca Materiali

```http
GET /api/v2/materials?search=resina&page=1&page_size=20
Authorization: Bearer <token>
```

## 📊 Esempio Output

### Preview Migrazione
```json
{
    "success": true,
    "data": {
        "statistics": {
            "total_records": 5420,
            "dental_materials": 1847,
            "excluded_materials": 3573,
            "filter_efficiency": 34.06
        },
        "material_types": {
            "resina": 234,
            "anestesia": 187,
            "cementi": 156,
            "fili": 98,
            "unknown": 1172
        },
        "sample_materials": [
            {
                "descrizione": "RESINA COMPOSITA FLOW A2",
                "material_type": "resina",
                "confidence_score": 95,
                "categoria_materiale": "Materiali da Otturazione"
            }
        ]
    }
}
```

### Risultato Migrazione
```json
{
    "success": true,
    "data": {
        "duration_seconds": 12.45,
        "total_records_processed": 5420,
        "dental_materials_found": 1847,
        "migration_stats": {
            "inserted": 1823,
            "updated": 24,
            "errors": 0
        }
    }
}
```

## 🔧 Configurazione

### Parametri Migrazione

- **confidence_threshold**: Soglia minima di confidenza (default: 40)
- **overwrite_existing**: Sovrascrive materiali esistenti (default: true)
- **dry_run**: Simulazione senza modifiche (default: false)

### Path VOCISPES.DBF

Il sistema usa `DBFOptimizedReader` per risolvere automaticamente il path:
- **Produzione**: `\\SERVERDIMA\Pixel\WINDENT\DATI\VOCISPES.DBF`
- **Sviluppo**: `windent/DATI/VOCISPES.DBF`

## 🐛 Troubleshooting

### Errori Comuni

1. **File non trovato**: Verificare path VOCISPES.DBF e permessi
2. **Tabella non esiste**: Eseguire migrazione tabella prima
3. **Encoding errors**: File DBF usa encoding latin-1
4. **Performance lenta**: File DBF molto grandi, usare chunked reading

### Log e Debug

```python
import logging
logging.getLogger('server_v2.services.materiali_migration_service').setLevel(logging.DEBUG)
```

## 🔄 Aggiornamenti Futuri

- [ ] Machine Learning per classificazione automatica
- [ ] Integrazione con fornitori per prezzi aggiornati  
- [ ] Sistema notifiche scorte minime
- [ ] Barcode scanning per inventario
- [ ] Integrazione con fatturazione elettronica
