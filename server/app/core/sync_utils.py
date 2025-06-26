
import hashlib
import json
from datetime import datetime, date, time
import logging

logger = logging.getLogger(__name__)

SYNC_MAP_FILE = 'synced_events.json'

# Chiavi logiche usate internamente (coerenti con DataFrame trasformato)
COL_DATA = 'DATA'
COL_ORA_INIZIO = 'ORA_INIZIO'
COL_ORA_FINE = 'ORA_FINE'
COL_STUDIO = 'STUDIO'
COL_PAZIENTE = 'PAZIENTE'
COL_DESCRIZIONE = 'DESCRIZIONE'
COL_NOTE = 'NOTE'


def _float_to_time(val):
    """Converte un float tipo 8.4 in time(8,40) (minuti in base 10)."""
    try:
        h = int(val)
        m = int(round((val - h) * 100))
        if m >= 60:
            m = 59  # fallback di sicurezza
        return datetime.min.time().replace(hour=h, minute=m)
    except Exception:
        logger.warning(f"Valore non convertibile in time: {val}, ritorno 08:00")
        return datetime.min.time().replace(hour=8, minute=0)


def _normalize_for_hash(app):
    """Restituisce una copia normalizzata dell'appuntamento per hash/idempotenza."""
    norm = dict(app)
    if isinstance(norm.get(COL_DATA), datetime):
        norm[COL_DATA] = norm[COL_DATA].isoformat()
    if isinstance(norm.get(COL_ORA_INIZIO), time):
        norm[COL_ORA_INIZIO] = norm[COL_ORA_INIZIO].strftime('%H:%M')
    if isinstance(norm.get(COL_ORA_FINE), time):
        norm[COL_ORA_FINE] = norm[COL_ORA_FINE].strftime('%H:%M')
    return norm


def compute_appointment_hash(app):
    norm = _normalize_for_hash(app)
    relevant = f"{norm[COL_DATA]}_{norm[COL_ORA_INIZIO]}_{norm[COL_ORA_FINE]}_{norm[COL_STUDIO]}_{norm.get(COL_PAZIENTE,'')}_{norm.get(COL_DESCRIZIONE,'')}_{norm.get(COL_NOTE,'')}"
    return hashlib.md5(relevant.encode('utf-8')).hexdigest()


def load_sync_map(sync_map_file=SYNC_MAP_FILE):
    try:
        with open(sync_map_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Impossibile caricare mappa sincronizzazione: {e}")
        return {}


def save_sync_map(sync_map, sync_map_file=SYNC_MAP_FILE):
    try:
        with open(sync_map_file, 'w', encoding='utf-8') as f:
            json.dump(sync_map, f, ensure_ascii=False, indent=2)
        logger.info(f"Mappa sincronizzazione salvata su {sync_map_file}")
    except Exception as e:
        logger.error(f"Errore nel salvataggio della mappa sincronizzazione: {e}")


def map_appointment(app):
    paziente = app.get(COL_PAZIENTE, '').strip()
    data = app.get(COL_DATA)
    tipo = app.get('TIPO', '').strip() or app.get('DB_APPACOD', '').strip()
    note = app.get(COL_NOTE, '').strip()
    dottore = app.get('DOTTORE', '').strip() or app.get('DB_DOTT', '').strip() or app.get('MEDICO', '').strip() or str(app.get('DB_APMEDIC', '')).strip()
    studio = app.get(COL_STUDIO)
    descrizione = app.get(COL_DESCRIZIONE, '').strip()
    ora_inizio = app.get(COL_ORA_INIZIO)
    ora_fine = app.get(COL_ORA_FINE)

    try:
        dottore_int = int(dottore) if dottore not in (None, '', 'None') else 0
    except Exception:
        dottore_int = 0
        logger.warning(f"Impossibile convertire 'dottore' in int: {dottore}")

    try:
        studio_int = int(studio) if studio not in (None, '', 'None') else 0
    except Exception:
        studio_int = 0
        logger.warning(f"Impossibile convertire 'studio' in int: {studio}")

    t_inizio = _float_to_time(ora_inizio) if ora_inizio is not None else datetime.min.time().replace(hour=8)
    t_fine = _float_to_time(ora_fine) if ora_fine is not None else None

    if t_fine is None or t_fine == t_inizio:
        from datetime import timedelta
        dt_inizio = datetime.combine(date(2000,1,1), t_inizio)
        dt_fine = dt_inizio + timedelta(minutes=10)
        t_fine = dt_fine.time()

    if not isinstance(data, datetime):
        if isinstance(data, date):
            data = datetime.combine(data, t_inizio)
        else:
            try:
                data = datetime.strptime(str(data), '%Y-%m-%d %H:%M:%S')
            except Exception as e:
                logger.error(f"DATA non valida: {data} - {e}")
                raise ValueError(f"DATA non è un datetime valido: {data} (tipo: {type(data)})")

    if dottore_int == 0 and studio_int == 0 and not paziente:
        summary = "NOTA GIORNALIERA"
        description = note or descrizione or "Nota giornaliera gestionale"
        return {
            COL_PAZIENTE: '',
            COL_DATA: data,
            COL_ORA_INIZIO: t_inizio,
            COL_ORA_FINE: t_fine,
            COL_STUDIO: studio_int,
            COL_DESCRIZIONE: summary,
            COL_NOTE: description,
            'TIPO': tipo,
            'DOTTORE': dottore_int,
            'SPECIAL': 'NOTA_GIORNALIERA',
        }

    if dottore_int > 0 and studio_int > 0 and not paziente:
        summary = f"SERVIZIO (Dott. {dottore_int}, Studio {studio_int})"
        description = note or descrizione or f"Servizio interno gestionale (Dottore {dottore_int}, Studio {studio_int})"
        return {
            COL_PAZIENTE: '',
            COL_DATA: data,
            COL_ORA_INIZIO: t_inizio,
            COL_ORA_FINE: t_fine,
            COL_STUDIO: studio_int,
            COL_DESCRIZIONE: summary,
            COL_NOTE: description,
            'TIPO': tipo,
            'DOTTORE': dottore_int,
            'SPECIAL': 'APP_SERVIZIO',
        }

    summary =
