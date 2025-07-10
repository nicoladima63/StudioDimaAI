import pandas as pd
import logging
from datetime import date, timedelta
from server.app.config.constants import COLONNE

logger = logging.getLogger(__name__)

def get_appuntamenti_domani(df_appuntamenti, data_test: date = None):
    col_data = COLONNE['appuntamenti']['data']
    if df_appuntamenti.empty or col_data not in df_appuntamenti.columns:
        logger.warning("DBF appuntamenti vuoto o colonna data mancante.")
        return pd.DataFrame()
    df_appuntamenti[col_data] = pd.to_datetime(df_appuntamenti[col_data], errors='coerce').dt.date
    target_date = data_test or (date.today() + timedelta(days=1))
    filtrati = df_appuntamenti[(df_appuntamenti[col_data] == target_date) & df_appuntamenti[col_data].notna()]
    logger.info(f"Trovati {len(filtrati)} appuntamenti per {target_date}")
    return filtrati

def get_appuntamenti_mese(df_appuntamenti, month: int, year: int):
    col_data = COLONNE['appuntamenti']['data']
    if df_appuntamenti.empty or col_data not in df_appuntamenti.columns:
        logger.warning("DBF appuntamenti vuoto o colonna data mancante.")
        return pd.DataFrame()
    df_appuntamenti[col_data] = pd.to_datetime(df_appuntamenti[col_data], errors='coerce')
    filtered = df_appuntamenti[(df_appuntamenti[col_data].dt.month == month) & (df_appuntamenti[col_data].dt.year == year)].copy()
    logger.info(f"Trovati {len(filtered)} appuntamenti per {month}/{year}")
    return filtered 