"""
Monthly Aggregator per il modulo Economics.
Aggrega i dati normalizzati in sommari mensili con cache SQLite.
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

import pandas as pd

from core.database_manager import get_database_manager
from services.economics.data_normalizer import (
    get_df_production,
    get_df_appointments,
    get_df_costs,
)

logger = logging.getLogger(__name__)

# Tipi appuntamento da escludere dal calcolo ore cliniche
TIPI_NON_CLINICI = {'F', 'A'}  # Ferie/Assenza, Attivita/Manutenzione

# Ore disponibili al mese di default (configurabile)
ORE_DISPONIBILI_MESE = 160.0


def _ensure_cache_table():
    """Crea la tabella cache se non esiste."""
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
                margine REAL DEFAULT 0,
                saturazione REAL DEFAULT 0,
                num_fatture INTEGER DEFAULT 0,
                num_appuntamenti INTEGER DEFAULT 0,
                num_spese INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(anno, mese)
            )
        """)
        conn.commit()


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
                return [dict(zip(columns, row)) for row in rows]
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
                     costi_totali, margine, saturazione, num_fatture, num_appuntamenti,
                     num_spese, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rec['anno'], rec['mese'],
                rec['produzione'], rec['incasso'], rec['ore_cliniche'],
                rec['ricavo_orario'], rec['costi_totali'], rec['margine'],
                rec['saturazione'], rec.get('num_fatture', 0),
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


def _compute_monthly_for_year(anno: int, ore_disponibili: float) -> List[Dict[str, Any]]:
    """Calcola i dati mensili per un singolo anno leggendo i DBF."""
    logger.info(f"Calcolo monthly summary per anno {anno} da DBF...")

    # Carica dati
    df_prod = get_df_production(anno=anno)
    df_app = get_df_appointments(anno=anno)
    df_costs = get_df_costs(anno=anno)

    records = []

    for mese in range(1, 13):
        # Produzione (fatture)
        prod_mese = df_prod[df_prod['mese'] == mese] if not df_prod.empty else pd.DataFrame()
        produzione = float(prod_mese['importo'].sum()) if not prod_mese.empty else 0.0
        incasso = produzione  # Per ora produzione = incasso (fatture emesse)
        num_fatture = len(prod_mese)

        # Ore cliniche (appuntamenti, escludendo Ferie e Manutenzione)
        app_mese = df_app[df_app['mese'] == mese] if not df_app.empty else pd.DataFrame()
        if not app_mese.empty:
            app_clinici = app_mese[~app_mese['tipo'].isin(TIPI_NON_CLINICI)]
            ore_cliniche = float(app_clinici['durata_ore'].sum())
            num_appuntamenti = len(app_clinici)
        else:
            ore_cliniche = 0.0
            num_appuntamenti = 0

        # Costi (spese fornitori)
        costs_mese = df_costs[df_costs['mese'] == mese] if not df_costs.empty else pd.DataFrame()
        costi_totali = float(costs_mese['costo_totale'].sum()) if not costs_mese.empty else 0.0
        num_spese = len(costs_mese)

        # Calcoli derivati
        ricavo_orario = (produzione / ore_cliniche) if ore_cliniche > 0 else 0.0
        margine = produzione - costi_totali
        saturazione = (ore_cliniche / ore_disponibili * 100) if ore_disponibili > 0 else 0.0

        records.append({
            'anno': anno,
            'mese': mese,
            'produzione': round(produzione, 2),
            'incasso': round(incasso, 2),
            'ore_cliniche': round(ore_cliniche, 2),
            'ricavo_orario': round(ricavo_orario, 2),
            'costi_totali': round(costi_totali, 2),
            'margine': round(margine, 2),
            'saturazione': round(saturazione, 2),
            'num_fatture': num_fatture,
            'num_appuntamenti': num_appuntamenti,
            'num_spese': num_spese,
        })

    logger.info(f"Monthly summary anno {anno}: {sum(r['num_fatture'] for r in records)} fatture, "
                f"{sum(r['num_appuntamenti'] for r in records)} appuntamenti, "
                f"{sum(r['num_spese'] for r in records)} spese")
    return records
