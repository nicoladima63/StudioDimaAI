import dbf
import os
import pandas as pd
import logging
from datetime import datetime, timedelta, date
from typing import List, Dict, Any
from dbfread import DBF
from server.app.config.constants import COLONNE, DBF_TABLES
from server.app.core.mode_manager import get_mode
from server.app.services.sms_service import sms_service
import json
from server.app.core.automation_config import get_automation_settings

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
        # Prima legge i flag deleted direttamente dal file binario
        deleted_records = set()
        try:
            import struct
            with open(percorso_file, 'rb') as f:
                # Leggi header DBF
                f.seek(8)  # Va a header length
                header_len = struct.unpack('<H', f.read(2))[0]
                record_len = struct.unpack('<H', f.read(2))[0]
                
                # Leggi ogni record per controllare il flag deleted
                record_index = 0
                f.seek(header_len)
                while True:
                    current_pos = header_len + (record_index * record_len)
                    f.seek(current_pos)
                    delete_flag = f.read(1)
                    if not delete_flag:
                        break
                    if delete_flag == b'*':
                        deleted_records.add(record_index)
                    record_index += 1
        except Exception as e:
            logger.warning(f"Errore lettura flag deleted per {percorso_file}: {e}")

        # Poi legge i record escludendo quelli cancellati
        with dbf.Table(percorso_file, codepage='cp1252') as table:
            records = []
            record_index = 0
            for record in table:
                try:
                    # Salta i record cancellati
                    if record_index in deleted_records:
                        record_index += 1
                        continue
                    records.append({field: record[field] for field in table.field_names})
                    record_index += 1
                except Exception as e:
                    logger.warning(f"Errore nel record: {e}")
                    record_index += 1
            # logger.info(f"Letti {len(records)} record da {percorso_file}, {len(deleted_records)} cancellati esclusi")
            return pd.DataFrame(records)
    except Exception as e:
        logger.error(f"Errore lettura tabella DBF '{percorso_file}': {e}")
        return pd.DataFrame()

def _get_appointments_for_month(month: int, year: int):
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

    # 2. Prima legge i flag deleted direttamente dal file binario
    deleted_records = set()
    try:
        import struct
        with open(path_appuntamenti, 'rb') as f:
            # Leggi header DBF
            f.seek(8)  # Va a header length
            header_len = struct.unpack('<H', f.read(2))[0]
            record_len = struct.unpack('<H', f.read(2))[0]
            
            # Leggi ogni record per controllare il flag deleted
            record_index = 0
            f.seek(header_len)  # Va all'inizio dei dati
            while True:
                current_pos = header_len + (record_index * record_len)
                f.seek(current_pos)
                delete_flag = f.read(1)
                if not delete_flag:  # Fine file
                    break
                if delete_flag == b'*':  # Record cancellato
                    deleted_records.add(record_index)
                record_index += 1
    except Exception as e:
        logger.warning(f"Errore lettura flag deleted: {e}, procedo senza filtro")

    # 3. Legge gli appuntamenti record per record e filtra
    appointments = []
    col_app = COLONNE['appuntamenti']
    try:
        with dbf.Table(path_appuntamenti, codepage='cp1252') as apps_table:
            record_index = 0
            for r in apps_table:
                # Salta i record cancellati usando l'indice
                if record_index in deleted_records:
                    record_index += 1
                    continue
                    
                app_date = r[col_app['data']]
                if not app_date or app_date.month != month or app_date.year != year:
                    record_index += 1
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
                
                appointments.append(raw_appointment)
                record_index += 1

    except Exception as e:
        logger.error(f"Errore durante la lettura del DBF appuntamenti {path_appuntamenti}: {e}")
        raise IOError(f"Impossibile leggere il file degli appuntamenti.")
        
    logger.info(f"Trovati e processati {len(appointments)} appuntamenti per {month}/{year}, {len(deleted_records)} record cancellati esclusi")
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

def estrai_dati(dbf_path: str, tabella: str) -> List[Dict[str, Any]]:
    """Estrae dati da un file .DBF secondo la mappatura di COLONNE[tabella]."""
    colonne_tabella = COLONNE.get(tabella)
    if not colonne_tabella:
        raise ValueError(f"Tabella '{tabella}' non trovata in COLONNE")
    return [
        {
            nome_logico: record.get(nome_dbf, '')
            for nome_logico, nome_dbf in colonne_tabella.items()
        }
        for record in DBF(dbf_path, encoding='latin-1')
    ] 

def get_tomorrow_appointments_for_reminder():
    """
    Estrae gli appuntamenti di domani e invia (o simula) i promemoria SMS.
    Non invia nulla se domani è sabato o domenica.
    Restituisce un log riassuntivo.
    """
    log = []
    today = date.today()
    tomorrow = today + timedelta(days=1)
    weekday = tomorrow.weekday()  # 0=lun, 5=sab, 6=dom

    if weekday == 5:
        log.append("Domani è sabato: nessun promemoria inviato.")
        return log
    if weekday == 6:
        log.append("Domani è domenica: nessun promemoria inviato.")
        return log

    # Estrai appuntamenti di domani
    try:
        path_appuntamenti = _get_dbf_path('agenda')
        path_pazienti = _get_dbf_path('pazienti')
    except Exception as e:
        log.append(f"Errore nel recuperare i percorsi DBF: {e}")
        return log

    # Carica appuntamenti
    df_apps = _leggi_tabella_dbf(path_appuntamenti)
    col_data = COLONNE['appuntamenti']['data']
    col_id_paziente = COLONNE['appuntamenti']['id_paziente']
    
    if df_apps.empty or col_data not in df_apps.columns:
        log.append("Nessun appuntamento trovato per domani.")
        return log

    # Filtra appuntamenti di domani
    df_apps[col_data] = pd.to_datetime(df_apps[col_data], errors='coerce')
    mask = (df_apps[col_data].dt.date == tomorrow)
    df_apps_tomorrow = df_apps[mask]

    if df_apps_tomorrow.empty:
        log.append("Nessun appuntamento trovato per domani.")
        return log

    # Carica anagrafica pazienti
    df_pazienti = _leggi_tabella_dbf(path_pazienti)
    col_paz_id = COLONNE['pazienti']['id']
    col_telefono = COLONNE['pazienti']['telefono']
    col_cellulare = COLONNE['pazienti']['cellulare']
    col_nome = COLONNE['pazienti']['nome']
    
    if df_pazienti.empty:
        log.append("Anagrafica pazienti non disponibile.")
        return log

    # JOIN tra appuntamenti e pazienti
    df_merged = df_apps_tomorrow.merge(
        df_pazienti, 
        left_on=col_id_paziente, 
        right_on=col_paz_id, 
        how='left'
    )
    
    apps = df_merged.to_dict(orient='records')

    settings = get_automation_settings()
    mode = settings.get('sms_promemoria_mode', 'prod')
    count = 0
    success = 0
    errors = []
    skipped_appointments = []  # Appuntamenti saltati (note giornaliere, ecc.)
    
    for app in apps:
        # Recupera telefono: prima cellulare, poi fisso
        telefono_raw = app.get(col_cellulare) or app.get(col_telefono)
        nome_raw = app.get(col_nome, 'Gentile paziente')
        if nome_raw and str(nome_raw).lower() != 'nan':
            nome_completo = str(nome_raw).strip()
        else:
            nome_completo = 'Gentile paziente'
        
        # Applica la stessa logica del calendar sync per escludere appuntamenti di sistema
        descrizione = app.get(COLONNE['appuntamenti']['descrizione'], '').strip()
        note = app.get(COLONNE['appuntamenti']['note'], '').strip()
        ora_inizio = app.get(COLONNE['appuntamenti']['ora_inizio'], '')
        
        # Escludi "Note giornaliere" (8:00 senza paziente, descrizione o note)
        is_nota_giornaliera = (
            str(ora_inizio).startswith('8:00') and 
            not nome_completo.strip() and 
            not descrizione and 
            not note
        )
        
        # Escludi appuntamenti senza paziente vero (solo note/descrizioni di sistema)
        is_system_appointment = (
            not nome_completo or 
            nome_completo in ['Gentile paziente', 'nan'] or
            (nome_raw and str(nome_raw).lower() == 'nan')
        )
        
        if is_nota_giornaliera or is_system_appointment:
            skipped_appointments.append({
                'ora': ora_inizio,
                'descrizione': descrizione or note or 'Appuntamento di sistema',
                'motivo': 'Nota giornaliera' if is_nota_giornaliera else 'Appuntamento senza paziente'
            })
            continue
        
        # Converti telefono in stringa e pulisci
        if telefono_raw and str(telefono_raw).lower() != 'nan':
            telefono = str(telefono_raw).strip()
            # Rimuovi .0 se è un float convertito
            if telefono.endswith('.0'):
                telefono = telefono[:-2]
            # Aggiungi prefisso +39 se manca
            if telefono and not telefono.startswith('+'):
                if telefono.startswith('39'):
                    telefono = '+' + telefono
                elif telefono.startswith('3'):
                    telefono = '+39' + telefono
                else:
                    telefono = '+39' + telefono
        else:
            telefono = ''
        
        # Prepara i dati per l'SMS
        sms_data = {
            'nome_completo': nome_completo,
            'telefono': telefono,
            'data_appuntamento': tomorrow.strftime('%d/%m/%Y'),
            'ora_appuntamento': str(app.get(COLONNE['appuntamenti']['ora_inizio'], '')),
            'tipo_appuntamento': app.get(COLONNE['appuntamenti']['tipo'], ''),
            'medico': app.get(COLONNE['appuntamenti']['medico'], '')
        }
        if not sms_data['telefono']:
            log.append(f"Appuntamento per {sms_data['nome_completo']} senza telefono: nessun SMS.")
            errors.append({
                'paziente': sms_data['nome_completo'],
                'numero': '',
                'errore': 'Telefono mancante'
            })
            continue
        if mode == 'test':
            msg = sms_service.generate_appointment_reminder_message(sms_data)
            log.append(f"[TEST] {sms_data['nome_completo']} ({sms_data['telefono']}): {msg}")
            success += 1
        else:
            result = sms_service.send_appointment_reminder_sms(sms_data)
            if result.get('success'):
                log.append(f"[INVIO] SMS inviato a {sms_data['nome_completo']} ({sms_data['telefono']})")
                success += 1
            else:
                log.append(f"[ERRORE] {sms_data['nome_completo']} ({sms_data['telefono']}): {result.get('error')}")
                errors.append({
                    'paziente': sms_data['nome_completo'],
                    'numero': sms_data['telefono'],
                    'errore': result.get('error')
                })
        count += 1
    
    # Resoconto finale
    log.append(f"Totale appuntamenti processati: {count}")
    if skipped_appointments:
        log.append(f"Appuntamenti saltati (sistema/note): {len(skipped_appointments)}")
        for skip in skipped_appointments:
            log.append(f"  - {skip['ora']}: {skip['descrizione']} ({skip['motivo']})")
    
    # TODO: Inviare resoconto al frontend quando sarà implementato
    # summary_for_frontend = {
    #     'date': tomorrow.strftime('%Y-%m-%d'),
    #     'processed': count,
    #     'success': success,
    #     'errors': len(errors),
    #     'skipped': len(skipped_appointments),
    #     'skipped_details': skipped_appointments
    # }

    # Scrivi log dettagliato su file
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'sent': count,
        'success': success,
        'errors': errors
    }
    try:
        with open('automation_reminder.log', 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
    except Exception as e:
        logger.error(f"Errore scrittura log automazione: {e}")

    return log 

