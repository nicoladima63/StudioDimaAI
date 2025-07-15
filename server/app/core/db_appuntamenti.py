import pandas as pd
import logging
from datetime import date, timedelta, datetime
from server.app.config.constants import COLONNE, DBF_TABLES
from server.app.core.mode_manager import get_mode
from server.app.core.sync_utils import map_appointment
import os
import dbf

logger = logging.getLogger(__name__)

def _get_dbf_path(table_name: str):
    """
    Costruisce il percorso per un file DBF usando:
    - PATH specifico (es. PATH_APPUNTAMENTI_DBF) se disponibile
    - oppure struttura base_path/categoria/nomefile
    """
    mode = get_mode('database')
    table_info = DBF_TABLES.get(table_name)
    if not table_info:
        raise ValueError(f"Tabella '{table_name}' non definita in DBF_TABLES.")

    # 1. Prova a cercare una variabile specifica per la tabella
    env_var = f"PATH_{table_name.upper()}_DBF"
    direct_path = os.getenv(env_var)
    if direct_path:
        return direct_path

    # 2. Se non c'è, costruisci il path classico
    base_path_env = "PROD_DB_BASE_PATH" if mode == 'prod' else "DEV_DB_BASE_PATH"
    base_path = os.getenv(base_path_env)

    if not base_path:
        if mode == 'dev':
            fallback_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'windent'))
            logger.warning(f"Variabile d'ambiente '{base_path_env}' non impostata. Uso fallback: {fallback_path}")
            base_path = fallback_path
        else:
            raise ValueError(f"Variabile d'ambiente '{base_path_env}' non impostata. Obbligatoria in modalità produzione.")

    category_path = table_info['categoria']
    file_name = table_info['file']
    
    return os.path.join(base_path, category_path, file_name)

def _leggi_tabella_dbf(percorso_file: str) -> pd.DataFrame:
    try:
        with dbf.Table(percorso_file, codepage='cp1252') as table:
            records = []
            for record in table:
                try:
                    records.append({field: record[field] for field in table.field_names})
                except Exception as e:
                    logger.warning(f"Errore nel record: {e}")
            logger.info(f"Letti {len(records)} record da {percorso_file}")
            return pd.DataFrame(records)
    except Exception as e:
        logger.error(f"Errore lettura tabella DBF '{percorso_file}': {e}")
        return pd.DataFrame()

def get_appointments_for_month(month: int, year: int):
    """
    Legge il DBF degli appuntamenti record per record e restituisce quelli del mese/anno specificato.
    Questo approccio è ottimizzato per file di grandi dimensioni.
    """
    try:
        path_appuntamenti = _get_dbf_path('agenda')
        path_pazienti = _get_dbf_path('pazienti')
    except (ValueError, FileNotFoundError) as e:
        logger.error(f"Errore nel recuperare il percorso del DBF: {e}")
        raise e

    # 1. Carica i pazienti in un dizionario per un accesso rapido
    patients_dict = {}
    col_paz = COLONNE['pazienti']
    try:
        with dbf.Table(path_pazienti, codepage='cp1252') as pazienti_table:
            for record in pazienti_table:
                pid = str(record[col_paz['id']]).strip()
                name = str(record[col_paz['nome']]).strip()
                if pid:
                    patients_dict[pid] = name
    except Exception as e:
        logger.error(f"Errore durante la lettura del DBF pazienti {path_pazienti}: {e}")
        raise IOError(f"Impossibile leggere il file dei pazienti.")

    # 2. Legge gli appuntamenti record per record e filtra
    appointments = []
    col_app = COLONNE['appuntamenti']
    try:
        with dbf.Table(path_appuntamenti, codepage='cp1252') as apps_table:
            for r in apps_table:
                app_date = r[col_app['data']]
                if not app_date or app_date.month != month or app_date.year != year:
                    continue

                idpaz = str(r[col_app['id_paziente']]).strip()
                
                # Crea il record grezzo
                raw_appointment = {
                    'DATA': app_date,
                    'ORA_INIZIO': float(r[col_app['ora_inizio']] or 0),
                    'ORA_FINE': float(r[col_app['ora_fine']] or 0),
                    'TIPO': r[col_app['tipo']].strip() if r[col_app['tipo']] else '',
                    'STUDIO': r[col_app['studio']] or 1,
                    'NOTE': r[col_app['note']].strip() if r[col_app['note']] else '',
                    'DESCRIZIONE': r[col_app['descrizione']].strip() if r[col_app['descrizione']] else '',
                    'PAZIENTE': patients_dict.get(idpaz, '')
                }
                
                # Mappa e formatta il record
                mapped_app = map_appointment(raw_appointment)
                
                # Converte le date per la serializzazione JSON
                if isinstance(mapped_app.get('DATA'), datetime):
                    mapped_app['DATA'] = mapped_app['DATA'].isoformat()
                if hasattr(mapped_app.get('ORA_INIZIO'), 'isoformat'):
                    mapped_app['ORA_INIZIO'] = mapped_app['ORA_INIZIO'].isoformat()
                if hasattr(mapped_app.get('ORA_FINE'), 'isoformat'):
                    mapped_app['ORA_FINE'] = mapped_app['ORA_FINE'].isoformat()

                appointments.append(mapped_app)

    except Exception as e:
        logger.error(f"Errore durante la lettura del DBF appuntamenti {path_appuntamenti}: {e}")
        raise IOError(f"Impossibile leggere il file degli appuntamenti.")
        
    logger.info(f"Trovati e processati {len(appointments)} appuntamenti per {month}/{year}")
    return appointments

def get_appointments_stats_for_year():
    """
    Calcola le statistiche mensili degli appuntamenti per gli ultimi 3 anni.
    """
    try:
        path_appuntamenti = _get_dbf_path('agenda')
    except (ValueError, FileNotFoundError) as e:
        logger.error(f"Errore nel recuperare il percorso del DBF appuntamenti: {e}")
        anno_corrente = datetime.now().year
        anni = [anno_corrente - i for i in range(2, -1, -1)]
        return {str(anno): [{'month': m, 'count': 0} for m in range(1, 13)] for anno in anni}

    df = _leggi_tabella_dbf(path_appuntamenti)
    col_data = COLONNE['appuntamenti']['data']

    anno_corrente = datetime.now().year
    anni = [anno_corrente - i for i in range(2, -1, -1)]

    if df.empty or col_data not in df.columns:
        logger.warning("DataFrame appuntamenti vuoto o colonna data mancante. Ritorno statistiche vuote.")
        return {str(anno): [{'month': m, 'count': 0} for m in range(1, 13)] for anno in anni}

    df[col_data] = pd.to_datetime(df[col_data], errors='coerce')
    
    result = {}
    for anno in anni:
        df_anno = df[df[col_data].dt.year == anno]
        result[str(anno)] = []
        for month in range(1, 13):
            count = df_anno[df_anno[col_data].dt.month == month].shape[0]
            result[str(anno)].append({'month': month, 'count': int(count)})
    
    return result

def get_appointments_count_by_range(start_date: str, end_date: str):
    """
    Conta gli appuntamenti in un intervallo di date specificato (formato 'DD/MM/YYYY').
    """
    start = datetime.strptime(start_date, '%d/%m/%Y')
    end = datetime.strptime(end_date, '%d/%m/%Y')

    try:
        path_appuntamenti = _get_dbf_path('agenda')
    except (ValueError, FileNotFoundError) as e:
        logger.error(f"Errore nel recuperare il percorso del DBF appuntamenti: {e}")
        return 0

    df = _leggi_tabella_dbf(path_appuntamenti)
    col_data = COLONNE['appuntamenti']['data']

    if df.empty or col_data not in df.columns:
        logger.warning("DataFrame appuntamenti vuoto o colonna data mancante. Ritorno 0.")
        return 0

    df[col_data] = pd.to_datetime(df[col_data], errors='coerce')
    mask = (df[col_data] >= start) & (df[col_data] <= end)
    count = df[mask].shape[0]
    
    return int(count)