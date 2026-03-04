"""
Monthly Aggregator per il modulo Economics.
Aggrega i dati normalizzati in sommari mensili con cache SQLite.
"""

import logging
import math
import re
from datetime import datetime
from typing import Optional, List, Dict, Any

import pandas as pd


def _safe_num(val, default=0.0):
    """Converte NaN/Inf in un valore sicuro per JSON."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default

from core.database_manager import get_database_manager
from services.economics.data_normalizer import (
    get_df_production,
    get_df_appointments,
    get_df_costs,
    get_df_primanota,
)

logger = logging.getLogger(__name__)

# Tipi appuntamento da escludere dal calcolo ore cliniche
TIPI_NON_CLINICI = {'F', 'A'}  # Ferie/Assenza, Attivita/Manutenzione

# Ore disponibili al mese di default (configurabile)
ORE_DISPONIBILI_MESE = 160.0

# Pattern descrizione primanota da ESCLUDERE (spese personali, non studio)
_PRIMANOTA_ESCLUSIONI = [
    'giroconto',
    'giroc ',
    'martelli',
    'affitto.*firenze',
    'affitto.*allori',
    'via allori',
    'condominio.*firenze',
    'condominio.*allori',
    'prelievo personale',
    'bollo auto',
    'imu nicola',
    'imu.*caiano',
    'unipol',
    'motorini',
    'rata uni',
    'moto filippo',
]

# Compila i pattern una volta sola
_PRIMANOTA_ESCLUSIONI_RE = [re.compile(p, re.IGNORECASE) for p in _PRIMANOTA_ESCLUSIONI]


def _is_costo_studio(descrizione: str, tipo_operazione: int) -> bool:
    """
    Determina se un movimento primanota e' un costo dello studio.

    Args:
        descrizione: Testo descrittivo del movimento (DB_PRCHI)
        tipo_operazione: Tipo operazione (DB_PRTIPOP)

    Returns:
        True se e' un costo dello studio, False se e' personale/da escludere
    """
    # Tipo 4, 5, 8, 11 = costi operativi studio (sempre inclusi)
    # Tipo 1 = normalmente incasso paziente, ma qui abbiamo solo uscite (importi negativi)
    # quindi sono costi misclassificati nel gestionale
    if tipo_operazione in (1, 4, 5, 8, 11):
        return True

    # Tipo 6, 12 = misto, classifico per descrizione
    desc_lower = (descrizione or '').lower().strip()
    for pattern in _PRIMANOTA_ESCLUSIONI_RE:
        if pattern.search(desc_lower):
            return False

    return True


def _ensure_cache_table():
    """Crea la tabella cache se non esiste (con campi costi classificati)."""
    db = get_database_manager()
    with db.get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS economics_monthly_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anno INTEGER NOT NULL,
                mese INTEGER NOT NULL,
                produzione REAL DEFAULT 0,
                incasso REAL DEFAULT 0,
                ore_cliniche REAL DEFAULT 0,
                ricavo_orario REAL DEFAULT 0,
                costi_totali REAL DEFAULT 0,
                costi_diretti REAL DEFAULT 0,
                costi_indiretti REAL DEFAULT 0,
                costi_non_classificati REAL DEFAULT 0,
                costi_non_deducibili REAL DEFAULT 0,
                margine REAL DEFAULT 0,
                saturazione REAL DEFAULT 0,
                num_fatture INTEGER DEFAULT 0,
                num_appuntamenti INTEGER DEFAULT 0,
                num_spese INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(anno, mese)
            )
        """)
        # Migrazione: aggiungi colonne se non esistono (per cache esistenti)
        migrated = False
        for col_name in ('costi_diretti', 'costi_indiretti', 'costi_non_classificati', 'costi_non_deducibili', 'costi_primanota'):
            try:
                conn.execute(f"ALTER TABLE economics_monthly_cache ADD COLUMN {col_name} REAL DEFAULT 0")
                migrated = True
            except Exception:
                pass
        conn.commit()
        # Se la migrazione ha aggiunto colonne, invalida la cache vecchia
        if migrated:
            conn.execute("DELETE FROM economics_monthly_cache")
            conn.commit()
            logger.info("Cache economics invalidata per migrazione nuove colonne")


def _get_cached_data(anno: int) -> Optional[List[Dict[str, Any]]]:
    """Recupera dati dalla cache per un anno specifico."""
    try:
        db = get_database_manager()
        with db.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM economics_monthly_cache WHERE anno = ? ORDER BY mese",
                (anno,)
            )
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            if rows:
                data = [dict(zip(columns, row)) for row in rows]
                # Controlla se i dati sono stale (costi presenti ma nessuna classificazione)
                has_costi = any(r.get('costi_totali', 0) > 0 for r in data)
                has_classif = any(
                    r.get('costi_diretti', 0) > 0 or
                    r.get('costi_indiretti', 0) > 0 or
                    r.get('costi_non_deducibili', 0) > 0 or
                    r.get('costi_non_classificati', 0) > 0
                    for r in data
                )
                if has_costi and not has_classif:
                    logger.info(f"Cache anno {anno} stale (costi senza classificazione), invalidazione...")
                    conn.execute("DELETE FROM economics_monthly_cache WHERE anno = ?", (anno,))
                    conn.commit()
                    return None
                return data
    except Exception:
        pass
    return None


def _save_to_cache(records: List[Dict[str, Any]]):
    """Salva i dati aggregati nella cache SQLite."""
    _ensure_cache_table()
    db = get_database_manager()
    with db.get_connection() as conn:
        for rec in records:
            conn.execute("""
                INSERT OR REPLACE INTO economics_monthly_cache
                    (anno, mese, produzione, incasso, ore_cliniche, ricavo_orario,
                     costi_totali, costi_diretti, costi_indiretti, costi_non_classificati,
                     costi_non_deducibili, costi_primanota, margine, saturazione, num_fatture,
                     num_appuntamenti, num_spese, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rec['anno'], rec['mese'],
                rec['produzione'], rec['incasso'], rec['ore_cliniche'],
                rec['ricavo_orario'], rec['costi_totali'],
                rec.get('costi_diretti', 0), rec.get('costi_indiretti', 0),
                rec.get('costi_non_classificati', 0),
                rec.get('costi_non_deducibili', 0),
                rec.get('costi_primanota', 0),
                rec['margine'], rec['saturazione'],
                rec.get('num_fatture', 0),
                rec.get('num_appuntamenti', 0), rec.get('num_spese', 0),
                datetime.now().isoformat()
            ))
        conn.commit()


def invalidate_cache(anno: Optional[int] = None):
    """Invalida la cache per un anno specifico o tutta."""
    try:
        _ensure_cache_table()
        db = get_database_manager()
        with db.get_connection() as conn:
            if anno:
                conn.execute("DELETE FROM economics_monthly_cache WHERE anno = ?", (anno,))
            else:
                conn.execute("DELETE FROM economics_monthly_cache")
            conn.commit()
        logger.info(f"Cache invalidata" + (f" per anno {anno}" if anno else " (tutta)"))
    except Exception as e:
        logger.error(f"Errore invalidazione cache: {e}")


def get_monthly_summary(
    anno_inizio: Optional[int] = None,
    anno_fine: Optional[int] = None,
    use_cache: bool = True,
    ore_disponibili: float = ORE_DISPONIBILI_MESE
) -> List[Dict[str, Any]]:
    """
    Calcola il sommario mensile aggregando fatture, appuntamenti e spese.

    Args:
        anno_inizio: Anno di inizio (default: anno corrente)
        anno_fine: Anno di fine (default: uguale a anno_inizio)
        use_cache: Se True, usa la cache SQLite
        ore_disponibili: Ore disponibili al mese per calcolo saturazione

    Returns:
        Lista di dict con i dati mensili aggregati
    """
    if anno_inizio is None:
        anno_inizio = datetime.now().year
    if anno_fine is None:
        anno_fine = anno_inizio

    all_records = []

    for anno in range(anno_inizio, anno_fine + 1):
        # Prova cache
        if use_cache:
            cached = _get_cached_data(anno)
            if cached:
                all_records.extend(cached)
                logger.info(f"Monthly summary anno {anno}: cache hit ({len(cached)} mesi)")
                continue

        # Calcola da DBF
        year_records = _compute_monthly_for_year(anno, ore_disponibili)
        all_records.extend(year_records)

        # Salva in cache
        if year_records:
            try:
                _save_to_cache(year_records)
            except Exception as e:
                logger.warning(f"Errore salvataggio cache anno {anno}: {e}")

    return all_records


def _load_classificazioni_fornitori() -> Dict[str, int]:
    """
    Carica il mapping codice_fornitore -> tipo_di_costo dalla tabella classificazioni_costi.

    Returns:
        Dict con codice_riferimento -> tipo_di_costo (1=diretto, 2=indiretto, 3=non_deducibile)
    """
    mapping = {}
    try:
        db = get_database_manager()
        with db.get_connection() as conn:
            cursor = conn.execute(
                "SELECT codice_riferimento, tipo_di_costo FROM classificazioni_costi "
                "WHERE tipo_entita = 'fornitore'"
            )
            for row in cursor.fetchall():
                mapping[row[0]] = row[1]
        logger.info(f"Classificazioni fornitori caricate: {len(mapping)} fornitori classificati")
    except Exception as e:
        logger.warning(f"Impossibile caricare classificazioni fornitori: {e}")
    return mapping


def _compute_monthly_for_year(anno: int, ore_disponibili: float) -> List[Dict[str, Any]]:
    """Calcola i dati mensili per un singolo anno leggendo i DBF."""
    logger.info(f"Calcolo monthly summary per anno {anno} da DBF...")

    # Carica dati
    df_prod = get_df_production(anno=anno)
    df_app = get_df_appointments(anno=anno)
    df_costs = get_df_costs(anno=anno)
    df_prima = get_df_primanota(anno=anno)

    # Carica classificazioni fornitori per split costi
    classif_map = _load_classificazioni_fornitori()

    records = []

    for mese in range(1, 13):
        # Produzione (fatture)
        prod_mese = df_prod[df_prod['mese'] == mese] if not df_prod.empty else pd.DataFrame()
        produzione = _safe_num(prod_mese['importo'].sum()) if not prod_mese.empty else 0.0
        incasso = produzione  # Per ora produzione = incasso (fatture emesse)
        num_fatture = len(prod_mese)

        # Ore cliniche (appuntamenti, escludendo Ferie e Manutenzione)
        app_mese = df_app[df_app['mese'] == mese] if not df_app.empty else pd.DataFrame()
        if not app_mese.empty:
            app_clinici = app_mese[~app_mese['tipo'].isin(TIPI_NON_CLINICI)]
            ore_cliniche = _safe_num(app_clinici['durata_minuti'].sum() / 60.0)
            num_appuntamenti = len(app_clinici)
        else:
            ore_cliniche = 0.0
            num_appuntamenti = 0

        # Costi (spese fornitori) con classificazione diretti/indiretti
        costs_mese = df_costs[df_costs['mese'] == mese] if not df_costs.empty else pd.DataFrame()
        costi_totali = 0.0
        costi_diretti = 0.0
        costi_indiretti = 0.0
        costi_non_deducibili = 0.0
        costi_non_classificati = 0.0
        costi_primanota = 0.0
        num_spese = 0

        if not costs_mese.empty:
            num_spese = len(costs_mese)
            for _, spesa in costs_mese.iterrows():
                importo = _safe_num(spesa['costo_totale'])
                costi_totali += importo
                cod_forn = spesa.get('codice_fornitore', '')
                tipo = classif_map.get(cod_forn)
                if tipo == 1:
                    costi_diretti += importo
                elif tipo == 2:
                    costi_indiretti += importo
                elif tipo == 3:
                    costi_non_deducibili += importo
                else:
                    costi_non_classificati += importo

        # Costi primanota (stipendi, tasse, INPS, assicurazioni, ecc.)
        prima_mese = df_prima[df_prima['mese'] == mese] if not df_prima.empty else pd.DataFrame()
        if not prima_mese.empty:
            for _, mov in prima_mese.iterrows():
                desc = mov.get('descrizione', '')
                tipo_op = mov.get('tipo_operazione', 0)
                if _is_costo_studio(desc, tipo_op):
                    importo = _safe_num(mov['importo'])
                    costi_primanota += importo

        # Aggrega primanota in costi indiretti e totali
        costi_indiretti += costi_primanota
        costi_totali += costi_primanota

        # Calcoli derivati
        ricavo_orario = _safe_num(produzione / ore_cliniche) if ore_cliniche > 0 else 0.0
        margine = _safe_num(produzione - costi_totali)
        saturazione = _safe_num(ore_cliniche / ore_disponibili * 100) if ore_disponibili > 0 else 0.0

        records.append({
            'anno': anno,
            'mese': mese,
            'produzione': round(produzione, 2),
            'incasso': round(incasso, 2),
            'ore_cliniche': round(ore_cliniche, 2),
            'ricavo_orario': round(ricavo_orario, 2),
            'costi_totali': round(costi_totali, 2),
            'costi_diretti': round(costi_diretti, 2),
            'costi_indiretti': round(costi_indiretti, 2),
            'costi_non_deducibili': round(costi_non_deducibili, 2),
            'costi_non_classificati': round(costi_non_classificati, 2),
            'costi_primanota': round(costi_primanota, 2),
            'margine': round(margine, 2),
            'saturazione': round(saturazione, 2),
            'num_fatture': num_fatture,
            'num_appuntamenti': num_appuntamenti,
            'num_spese': num_spese,
        })

    tot_primanota = sum(r['costi_primanota'] for r in records)
    logger.info(f"Monthly summary anno {anno}: {sum(r['num_fatture'] for r in records)} fatture, "
                f"{sum(r['num_appuntamenti'] for r in records)} appuntamenti, "
                f"{sum(r['num_spese'] for r in records)} spese, "
                f"primanota studio: {tot_primanota:.2f}")
    return records
