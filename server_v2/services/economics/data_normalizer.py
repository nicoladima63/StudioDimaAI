"""
Data Normalizer per il modulo Economics.
Legge i file DBF e produce DataFrame pandas normalizzati e coerenti.
"""

import logging
import dbf
import pandas as pd
from datetime import datetime, date
from typing import Optional
from decimal import Decimal

from core.config_manager import get_config
from core.constants_v2 import COLONNE, DBF_TABLES, TIPI_APPUNTAMENTO, MEDICI, PRIMANOTA_MOVIMENTI_INTERNI
from utils.dbf_utils import clean_dbf_value

logger = logging.getLogger(__name__)


def _get_dbf_path(table_key: str) -> str:
    """Risolve il path del file DBF usando il config_manager."""
    config = get_config()
    return config.get_dbf_path(table_key)


def _safe_float(value, default=0.0) -> float:
    """Converte un valore in float in modo sicuro."""
    if value is None:
        return default
    try:
        if isinstance(value, Decimal):
            return float(value)
        return float(value)
    except (ValueError, TypeError):
        return default


def _safe_int(value, default=0) -> int:
    """Converte un valore in int in modo sicuro."""
    if value is None:
        return default
    try:
        if isinstance(value, Decimal):
            return int(value)
        return int(value)
    except (ValueError, TypeError):
        return default


def _dbf_time_to_minutes(val: float) -> int:
    """
    Converte un orario in formato DBF (es. 17.25 = 17:25) in minuti totali.
    Il formato DBF usa ore.minuti dove i minuti sono in base 60 (0-59).
    Esempio: 9.30 = 9:30 = 570 min, 17.25 = 17:25 = 1045 min.
    """
    ore = int(val)
    minuti = round((val - ore) * 100)
    return ore * 60 + minuti


def _safe_date(value) -> Optional[date]:
    """Converte un valore in date in modo sicuro."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def get_df_production(anno: Optional[int] = None) -> pd.DataFrame:
    """
    Legge FATTURE.DBF e restituisce un DataFrame normalizzato.

    Colonne output: fatturaid, pazienteid, data, importo, numero, modo_pagamento
    """
    col = COLONNE.get('fatture')
    if not col:
        # Fallback ai nomi DBF diretti se non in COLONNE
        col = {
            'fatturaid': 'DB_CODE',
            'fatturapazienteid': 'DB_FAPACOD',
            'fatturadata': 'DB_FADATA',
            'fatturaimporto': 'DB_FAIMPON',
            'fatturanumero': 'DB_FANUMER',
            'fatturamodopagamento': 'DB_FAPAGAM',
        }

    # Mapping: nome DBF field -> nome logico nel DF output
    # FATTURE non e' in COLONNE standard, usiamo i nomi noti dal progetto
    field_map = {
        'DB_CODE': 'fatturaid',
        'DB_FAPACOD': 'pazienteid',
        'DB_FADATA': 'data',
        'DB_FAIMPON': 'importo',
        'DB_FANUMER': 'numero',
        'DB_FAPAGAM': 'modo_pagamento',
    }

    records = []
    try:
        path = _get_dbf_path('fatture')
        with dbf.Table(path, codepage='cp1252') as table:
            for record in table:
                try:
                    raw_date = getattr(record, 'db_fadata', None)
                    record_date = _safe_date(raw_date)

                    if record_date is None:
                        continue

                    if anno is not None and record_date.year != anno:
                        continue

                    importo = _safe_float(getattr(record, 'db_faimpon', 0))
                    if importo <= 0:
                        continue

                    records.append({
                        'fatturaid': clean_dbf_value(getattr(record, 'db_code', '')),
                        'pazienteid': clean_dbf_value(getattr(record, 'db_fapacod', '')),
                        'data': record_date,
                        'importo': importo,
                        'numero': clean_dbf_value(getattr(record, 'db_fanumer', '')),
                        'modo_pagamento': clean_dbf_value(getattr(record, 'db_fapagam', '')),
                    })
                except Exception:
                    continue
    except Exception as e:
        logger.error(f"Errore lettura FATTURE.DBF: {e}")

    df = pd.DataFrame(records)
    if not df.empty:
        df['data'] = pd.to_datetime(df['data'])
        df['anno'] = df['data'].dt.year
        df['mese'] = df['data'].dt.month

    logger.info(f"get_df_production: {len(df)} fatture caricate" + (f" (anno={anno})" if anno else ""))
    return df


def get_df_appointments(anno: Optional[int] = None) -> pd.DataFrame:
    """
    Legge APPUNTA.DBF e restituisce un DataFrame normalizzato.

    Colonne output: data, ora_inizio, ora_fine, pazienteid, tipo, tipo_nome, medico, medico_nome, studio, durata_minuti
    """
    col = COLONNE['appuntamenti']

    records = []
    try:
        path = _get_dbf_path('APPUNTA')
        with dbf.Table(path, codepage='cp1252') as table:
            for record in table:
                try:
                    raw_date = getattr(record, col['data'].lower(), None)
                    record_date = _safe_date(raw_date)

                    if record_date is None:
                        continue

                    if anno is not None and record_date.year != anno:
                        continue

                    tipo = clean_dbf_value(getattr(record, col['tipo'].lower(), ''))
                    ora_inizio = _safe_float(getattr(record, col['ora_inizio'].lower(), 0))
                    ora_fine = _safe_float(getattr(record, col['ora_fine'].lower(), 0))
                    medico_id = _safe_int(getattr(record, col['medico'].lower(), 0))

                    # Converte da formato DBF (ore.minuti base 60) a minuti totali
                    min_inizio = _dbf_time_to_minutes(ora_inizio)
                    min_fine = _dbf_time_to_minutes(ora_fine)
                    durata_minuti = max(0, min_fine - min_inizio) if min_fine > min_inizio else 0

                    records.append({
                        'data': record_date,
                        'ora_inizio': ora_inizio,
                        'ora_fine': ora_fine,
                        'pazienteid': clean_dbf_value(getattr(record, col['id_paziente'].lower(), '')),
                        'tipo': tipo,
                        'tipo_nome': TIPI_APPUNTAMENTO.get(tipo, f'Tipo sconosciuto ({tipo})'),
                        'medico': medico_id,
                        'medico_nome': MEDICI.get(medico_id, f'Medico {medico_id}'),
                        'studio': _safe_int(getattr(record, col['studio'].lower(), 1)),
                        'durata_minuti': durata_minuti,
                    })
                except Exception:
                    continue
    except Exception as e:
        logger.error(f"Errore lettura APPUNTA.DBF: {e}")

    df = pd.DataFrame(records)
    if not df.empty:
        df['data'] = pd.to_datetime(df['data'])
        df['anno'] = df['data'].dt.year
        df['mese'] = df['data'].dt.month

    logger.info(f"get_df_appointments: {len(df)} appuntamenti caricati" + (f" (anno={anno})" if anno else ""))
    return df


def get_df_costs(anno: Optional[int] = None) -> pd.DataFrame:
    """
    Legge SPESAFOR.DBF e restituisce un DataFrame normalizzato.

    Colonne output: id, codice_fornitore, descrizione, costo_netto, costo_iva, data_spesa, costo_totale
    """
    col = COLONNE['spese_fornitori']

    records = []
    try:
        path = _get_dbf_path('spese')
        with dbf.Table(path, codepage='cp1252') as table:
            for record in table:
                try:
                    raw_date = getattr(record, col['data_spesa'].lower(), None)
                    record_date = _safe_date(raw_date)

                    if record_date is None:
                        continue

                    if anno is not None and record_date.year != anno:
                        continue

                    costo_netto = _safe_float(getattr(record, col['costo_netto'].lower(), 0))
                    costo_iva = _safe_float(getattr(record, col['costo_iva'].lower(), 0))

                    records.append({
                        'id': clean_dbf_value(getattr(record, col['id'].lower(), '')),
                        'codice_fornitore': clean_dbf_value(getattr(record, col['codice_fornitore'].lower(), '')),
                        'descrizione': clean_dbf_value(getattr(record, col['descrizione'].lower(), '')),
                        'costo_netto': costo_netto,
                        'costo_iva': costo_iva,
                        'data_spesa': record_date,
                        'costo_totale': costo_netto + costo_iva,
                    })
                except Exception:
                    continue
    except Exception as e:
        logger.error(f"Errore lettura SPESAFOR.DBF: {e}")

    df = pd.DataFrame(records)
    if not df.empty:
        df['data_spesa'] = pd.to_datetime(df['data_spesa'])
        df['anno'] = df['data_spesa'].dt.year
        df['mese'] = df['data_spesa'].dt.month

    logger.info(f"get_df_costs: {len(df)} spese caricate" + (f" (anno={anno})" if anno else ""))
    return df


def get_df_estimates(anno: Optional[int] = None) -> pd.DataFrame:
    """
    Legge PREVENT.DBF e restituisce un DataFrame normalizzato.

    Colonne output: id_piano, codice_prestazione, data, spesa, medico, stato, stato_nome
    """
    col = COLONNE['preventivi']

    STATO_MAP = {1: 'Da Eseguire', 2: 'In Corso', 3: 'Eseguito'}

    records = []
    try:
        path = _get_dbf_path('preventivi')
        with dbf.Table(path, codepage='cp1252') as table:
            for record in table:
                try:
                    raw_date = getattr(record, col['data_prestazione'].lower(), None)
                    record_date = _safe_date(raw_date)

                    if anno is not None and record_date is not None and record_date.year != anno:
                        continue

                    stato = _safe_int(getattr(record, col['stato_prestazione'].lower(), 0))
                    spesa = _safe_float(getattr(record, col['spesa'].lower(), 0))

                    records.append({
                        'id_piano': clean_dbf_value(getattr(record, col['id_piano'].lower(), '')),
                        'codice_prestazione': clean_dbf_value(getattr(record, col['codice_prestazione'].lower(), '')),
                        'data': record_date,
                        'spesa': spesa,
                        'medico': _safe_int(getattr(record, col['medico'].lower(), 0)),
                        'stato': stato,
                        'stato_nome': STATO_MAP.get(stato, f'Stato sconosciuto ({stato})'),
                    })
                except Exception:
                    continue
    except Exception as e:
        logger.error(f"Errore lettura PREVENT.DBF: {e}")

    df = pd.DataFrame(records)
    if not df.empty and 'data' in df.columns:
        df['data'] = pd.to_datetime(df['data'])
        df['anno'] = df['data'].dt.year
        df['mese'] = df['data'].dt.month

    logger.info(f"get_df_estimates: {len(df)} preventivi caricati" + (f" (anno={anno})" if anno else ""))
    return df


def get_df_payments(anno: Optional[int] = None) -> pd.DataFrame:
    """Alias di get_df_production - le fatture rappresentano i pagamenti/incassi."""
    return get_df_production(anno=anno)


def get_df_primanota(anno: Optional[int] = None) -> pd.DataFrame:
    """
    Legge PRIMANO.DBF e restituisce un DataFrame normalizzato con solo le uscite.

    Esclude movimenti interni cassa-banca (tipo_operazione 3 e 7).
    Gli importi negativi vengono resi positivi (valore assoluto).

    Colonne output: data, importo, descrizione, tipo_operazione, tipo_chi, conto
    """
    col = COLONNE['primanota']

    records = []
    try:
        path = _get_dbf_path('primanota')
        with dbf.Table(path, codepage='cp1252') as table:
            for record in table:
                try:
                    raw_date = getattr(record, col['data'].lower(), None)
                    record_date = _safe_date(raw_date)

                    if record_date is None:
                        continue

                    if anno is not None and record_date.year != anno:
                        continue

                    importo = _safe_float(getattr(record, col['importo'].lower(), 0))

                    # Solo uscite (importi negativi)
                    if importo >= 0:
                        continue

                    tipo_op = _safe_int(getattr(record, col['tipo_operazione'].lower(), 0))

                    # Escludi movimenti interni cassa-banca
                    if tipo_op in PRIMANOTA_MOVIMENTI_INTERNI:
                        continue

                    records.append({
                        'data': record_date,
                        'importo': abs(importo),
                        'descrizione': clean_dbf_value(getattr(record, col['descrizione'].lower(), '')),
                        'tipo_operazione': tipo_op,
                        'tipo_chi': _safe_int(getattr(record, col['tipo_chi'].lower(), 0)),
                        'conto': clean_dbf_value(getattr(record, col['conto'].lower(), '')),
                    })
                except Exception:
                    continue
    except Exception as e:
        logger.error(f"Errore lettura PRIMANO.DBF: {e}")

    df = pd.DataFrame(records)
    if not df.empty:
        df['data'] = pd.to_datetime(df['data'])
        df['anno'] = df['data'].dt.year
        df['mese'] = df['data'].dt.month

    logger.info(f"get_df_primanota: {len(df)} movimenti caricati" + (f" (anno={anno})" if anno else ""))
    return df
