"""
Bot WhatsApp management API Blueprint.

Provides endpoints to check bot services status and manage studiobot_studio_info
directly from StudioDimaAI without going through n8n UI.
"""

import os
import logging
import requests
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta, timezone, time as dtime
from flask import Blueprint, request, g
from flask_jwt_extended import jwt_required
from functools import wraps

from app_v2 import format_response

logger = logging.getLogger(__name__)

bot_v2_bp = Blueprint('bot_v2', __name__)

BOT_API_KEY = os.getenv('BOT_API_KEY', '')


def _require_bot_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get('X-Bot-Api-Key', '')
        if not BOT_API_KEY or key != BOT_API_KEY:
            return format_response(success=False, error='Unauthorized'), 401
        return f(*args, **kwargs)
    return decorated

EVOLUTION_BASE_URL = os.getenv('EVOLUTION_BASE_URL', 'http://127.0.0.1:8080')
EVOLUTION_INSTANCE = os.getenv('EVOLUTION_INSTANCE', 'studio-instance')


def _evo_headers():
    return {'apikey': os.getenv('EVOLUTION_API_KEY', ''), 'Content-Type': 'application/json'}

BOT_SERVICES = [
    {'id': 'whatsapp', 'name': 'WhatsApp Bot', 'url': 'https://wa.valorian.it'},
    {'id': 'n8n',      'name': 'n8n Workflows', 'url': 'https://n8n.valorian.it'},
    {'id': 'chat',     'name': 'Chat LLM',      'url': 'https://chat.valorian.it'},
    {'id': 'ntfy',     'name': 'Notifiche',      'url': 'https://ntfy.valorian.it'},
    {'id': 'status',   'name': 'Status',         'url': 'https://status.valorian.it'},
]


def _get_bot_db_conn():
    return psycopg2.connect(
        host=os.getenv('BOT_DB_HOST', '127.0.0.1'),
        port=int(os.getenv('BOT_DB_PORT', '5432')),
        database=os.getenv('BOT_DB_NAME', 'studiobot'),
        user=os.getenv('BOT_DB_USER', 'studiobot'),
        password=os.getenv('BOT_DB_PASSWORD', ''),
        connect_timeout=5,
    )


@bot_v2_bp.route('/bot/status', methods=['GET'])
@jwt_required()
def get_bot_status():
    """Check reachability of all bot services."""
    results = []
    for svc in BOT_SERVICES:
        online = False
        try:
            r = requests.head(svc['url'], timeout=5, allow_redirects=True)
            online = r.status_code < 500
        except Exception:
            online = False
        results.append({**svc, 'online': online})
    return format_response({'services': results})


@bot_v2_bp.route('/bot/studio-info', methods=['GET'])
@jwt_required()
def get_studio_info():
    """Get all key/value pairs from studiobot_studio_info."""
    try:
        conn = _get_bot_db_conn()
        with conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute('SELECT chiave, valore FROM studiobot_studio_info')
                rows = cur.fetchall()
        conn.close()
        return format_response({'items': [dict(r) for r in rows]})
    except Exception as e:
        logger.error(f'Error fetching studio_info: {e}')
        return format_response(success=False, error='Impossibile connettersi al database del bot'), 500


@bot_v2_bp.route('/bot/studio-info', methods=['POST'])
@jwt_required()
def create_studio_info():
    """Create a new key in studiobot_studio_info."""
    data = request.get_json() or {}
    chiave = (data.get('chiave') or '').strip()
    valore = (data.get('valore') or '').strip()
    if not chiave:
        return format_response(success=False, error='chiave obbligatoria'), 400
    try:
        conn = _get_bot_db_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    'INSERT INTO studiobot_studio_info (chiave, valore) VALUES (%s, %s)',
                    (chiave, valore)
                )
        conn.close()
        return format_response({'chiave': chiave, 'valore': valore})
    except psycopg2.errors.UniqueViolation:
        return format_response(success=False, error='Chiave gia esistente'), 409
    except Exception as e:
        logger.error(f'Error creating studio_info: {e}')
        return format_response(success=False, error='Errore salvataggio'), 500


@bot_v2_bp.route('/bot/studio-info/<chiave>', methods=['PUT'])
@jwt_required()
def update_studio_info(chiave: str):
    """Update value for a key in studiobot_studio_info."""
    data = request.get_json() or {}
    valore = data.get('valore', '')
    try:
        conn = _get_bot_db_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE studiobot_studio_info SET valore = %s WHERE chiave = %s',
                    (valore, chiave)
                )
                if cur.rowcount == 0:
                    return format_response(success=False, error='Chiave non trovata'), 404
        conn.close()
        return format_response({'chiave': chiave, 'valore': valore})
    except Exception as e:
        logger.error(f'Error updating studio_info {chiave}: {e}')
        return format_response(success=False, error='Errore aggiornamento'), 500


@bot_v2_bp.route('/bot/studio-info/<chiave>', methods=['DELETE'])
@jwt_required()
def delete_studio_info(chiave: str):
    """Delete a key from studiobot_studio_info."""
    try:
        conn = _get_bot_db_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM studiobot_studio_info WHERE chiave = %s', (chiave,))
                if cur.rowcount == 0:
                    return format_response(success=False, error='Chiave non trovata'), 404
        conn.close()
        return format_response({'deleted': chiave})
    except Exception as e:
        logger.error(f'Error deleting studio_info {chiave}: {e}')
        return format_response(success=False, error='Errore eliminazione'), 500


@bot_v2_bp.route('/bot/whatsapp/status', methods=['GET'])
@jwt_required()
def get_whatsapp_status():
    """Get WhatsApp connection state from Evolution API."""
    try:
        r = requests.get(
            f'{EVOLUTION_BASE_URL}/instance/connectionState/{EVOLUTION_INSTANCE}',
            headers=_evo_headers(), timeout=5
        )
        data = r.json()
        state = data.get('instance', {}).get('state', 'unknown')
        return format_response({'state': state})
    except Exception as e:
        logger.error(f'Error fetching WA status: {e}')
        return format_response(success=False, error='Evolution API non raggiungibile'), 500


@bot_v2_bp.route('/bot/whatsapp/qr', methods=['GET'])
@jwt_required()
def get_whatsapp_qr():
    """Get QR code for WhatsApp reconnection."""
    try:
        r = requests.get(
            f'{EVOLUTION_BASE_URL}/instance/connect/{EVOLUTION_INSTANCE}',
            headers=_evo_headers(), timeout=10
        )
        data = r.json()
        logger.info(f'Evolution /connect response: {data}')
        qr = (data.get('base64')
              or data.get('qrcode', {}).get('base64')
              or data.get('code')
              or data.get('qr'))
        if not qr:
            return format_response(success=False, error=f'QR non disponibile: {data}'), 400
        return format_response({'qr': qr})
    except Exception as e:
        logger.error(f'Error fetching WA QR: {e}')
        return format_response(success=False, error='Errore recupero QR'), 500


@bot_v2_bp.route('/bot/whatsapp/logout', methods=['POST'])
@jwt_required()
def logout_whatsapp():
    """Logout WhatsApp instance (forces QR re-scan)."""
    try:
        r = requests.delete(
            f'{EVOLUTION_BASE_URL}/instance/logout/{EVOLUTION_INSTANCE}',
            headers=_evo_headers(), timeout=5
        )
        return format_response({'result': r.json()})
    except Exception as e:
        logger.error(f'Error WA logout: {e}')
        return format_response(success=False, error='Errore logout'), 500


@bot_v2_bp.route('/bot/conversazioni/<int:conv_id>', methods=['DELETE'])
@jwt_required()
def delete_conversazione(conv_id: int):
    """Delete a conversation and all its messages."""
    try:
        conn = _get_bot_db_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM studiobot_escalazioni WHERE conversazione_id = %s', (conv_id,))
                cur.execute('DELETE FROM studiobot_messaggi WHERE conversazione_id = %s', (conv_id,))
                cur.execute('DELETE FROM studiobot_conversazioni WHERE id = %s', (conv_id,))
                if cur.rowcount == 0:
                    return format_response(success=False, error='Conversazione non trovata'), 404
        conn.close()
        return format_response({'deleted': conv_id})
    except Exception as e:
        logger.error(f'Error deleting conversazione {conv_id}: {e}')
        return format_response(success=False, error='Errore eliminazione'), 500


@bot_v2_bp.route('/bot/paziente-by-phone', methods=['GET'])
@_require_bot_key
def get_paziente_by_phone():
    """Lookup a patient by phone number (for bot use, protected by X-Bot-Api-Key)."""
    telefono = request.args.get('telefono', '').strip()
    if not telefono:
        return format_response(success=False, error='telefono obbligatorio'), 400
    try:
        from services.pazienti_service import PazientiService
        svc = PazientiService(g.database_manager)
        result = svc.search_pazienti('', limit=1, telefono=telefono)
        pazienti = result.get('pazienti', [])
        if pazienti:
            return format_response({'found': True, 'paziente': pazienti[0]})
        return format_response({'found': False, 'paziente': None})
    except Exception as e:
        logger.error(f'Error lookup paziente by phone {telefono}: {e}')
        return format_response(success=False, error='Errore ricerca paziente'), 500


@bot_v2_bp.route('/bot/conversazioni', methods=['GET'])
@jwt_required()
def get_conversazioni():
    """List conversations with patient info, paginated."""
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    offset = (page - 1) * per_page
    try:
        conn = _get_bot_db_conn()
        with conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute('SELECT COUNT(*) FROM studiobot_conversazioni')
                total = cur.fetchone()['count']
                cur.execute('''
                    SELECT c.id, c.iniziata_at, c.ultima_attivita, c.aperta,
                           c.escalata_at, c.motivo_escalation,
                           p.wa_nome, p.wa_jid, p.db_panome
                    FROM studiobot_conversazioni c
                    JOIN studiobot_pazienti p ON p.id = c.paziente_id
                    ORDER BY c.ultima_attivita DESC
                    LIMIT %s OFFSET %s
                ''', (per_page, offset))
                rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return format_response({'conversazioni': rows, 'total': total, 'page': page, 'per_page': per_page})
    except Exception as e:
        logger.error(f'Error fetching conversazioni: {e}')
        return format_response(success=False, error='Errore recupero conversazioni'), 500


@bot_v2_bp.route('/bot/conversazioni/<int:conv_id>/messaggi', methods=['GET'])
@jwt_required()
def get_messaggi(conv_id: int):
    """Get all messages for a conversation."""
    try:
        conn = _get_bot_db_conn()
        with conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute('''
                    SELECT id, ruolo, contenuto, classificazione, created_at
                    FROM studiobot_messaggi
                    WHERE conversazione_id = %s
                    ORDER BY created_at ASC
                ''', (conv_id,))
                rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return format_response({'messaggi': rows})
    except Exception as e:
        logger.error(f'Error fetching messaggi for conv {conv_id}: {e}')
        return format_response(success=False, error='Errore recupero messaggi'), 500


# ---------------------------------------------------------------------------
# Igienista schedule constraints
# ---------------------------------------------------------------------------
IGIENISTA_CAL_ID = os.getenv('CALENDAR_ID_STUDIO_2', '')
SLOT_DURATION = timedelta(minutes=50)
ROME = timezone(timedelta(hours=2))  # CEST; adjust to +1 in winter if needed

# Weekday -> list of (start_hour, start_min, end_hour, end_min)
IGIENISTA_WINDOWS = {
    0: [(14, 0, 19, 0)],                 # Lunedi (Anet)
    2: [(9, 0, 13, 0), (14, 0, 19, 0)], # Mercoledi (Lara)
    3: [(15, 0, 19, 0)],                 # Giovedi (Lara)
}
ANET_DAYS = {0}
LARA_DAYS = {2, 3}


def _fetch_calendar_events(service, cal_id: str, time_min: datetime, time_max: datetime) -> list:
    result = service.events().list(
        calendarId=cal_id,
        timeMin=time_min.isoformat(),
        timeMax=time_max.isoformat(),
        singleEvents=True,
        orderBy='startTime',
    ).execute()
    return result.get('items', [])


def _is_lara_no_day(events: list, day: datetime.date) -> bool:
    """Return True if there is a LARA NO event starting at 08:xx on that day."""
    for ev in events:
        start = ev.get('start', {})
        dt_str = start.get('dateTime')
        if not dt_str:
            continue
        try:
            dt = datetime.fromisoformat(dt_str)
        except ValueError:
            continue
        title = (ev.get('summary') or '').upper().strip()
        if dt.date() == day and dt.hour == 8 and 'LARA NO' in title:
            return True
    return False


def _busy_intervals(events: list, day: datetime.date) -> list:
    """Return list of (start, end) datetime for events on that day (excluding LARA NO)."""
    intervals = []
    for ev in events:
        start_raw = ev.get('start', {}).get('dateTime')
        end_raw = ev.get('end', {}).get('dateTime')
        if not start_raw or not end_raw:
            continue
        try:
            s = datetime.fromisoformat(start_raw)
            e = datetime.fromisoformat(end_raw)
        except ValueError:
            continue
        title = (ev.get('summary') or '').upper().strip()
        if s.date() == day and 'LARA NO' not in title:
            intervals.append((s, e))
    return intervals


def _free_slots(day: datetime.date, windows: list, busy: list, slot_dur: timedelta, max_slots: int = 3) -> list:
    slots = []
    for wh, wm, eh, em in windows:
        cursor = datetime(day.year, day.month, day.day, wh, wm, tzinfo=ROME)
        window_end = datetime(day.year, day.month, day.day, eh, em, tzinfo=ROME)
        while cursor + slot_dur <= window_end and len(slots) < max_slots:
            slot_end = cursor + slot_dur
            overlap = any(
                s < slot_end and e > cursor
                for s, e in busy
            )
            if not overlap:
                giorni_ita = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
                label = f"{giorni_ita[cursor.weekday()]} {cursor.strftime('%d/%m alle %H:%M')}"
                slots.append(label)
            cursor += slot_dur
    return slots


@bot_v2_bp.route('/bot/available-slots', methods=['GET'])
@_require_bot_key
def get_available_slots():
    """Return next available hygiene slots from Google Calendar 2."""
    days_ahead = int(request.args.get('giorni', 14))
    max_results = int(request.args.get('max', 5))
    igienista = request.args.get('igienista', 'any').lower().strip()  # anet | lara | any

    if igienista == 'anet':
        allowed_days = ANET_DAYS
    elif igienista == 'lara':
        allowed_days = LARA_DAYS
    else:
        allowed_days = ANET_DAYS | LARA_DAYS

    try:
        from core.google_calendar_client import GoogleCalendarClient
        from core.paths import GOOGLE_CREDENTIALS_PATH, GOOGLE_TOKEN_PATH
        client = GoogleCalendarClient(credentials_path=GOOGLE_CREDENTIALS_PATH, token_path=GOOGLE_TOKEN_PATH)
        service = client.get_service()

        now = datetime.now(tz=ROME)
        time_max = now + timedelta(days=days_ahead)
        events = _fetch_calendar_events(service, IGIENISTA_CAL_ID, now, time_max)

        slots = []
        current = now.date()
        for i in range(days_ahead):
            day = current + timedelta(days=i)
            weekday = day.weekday()
            if weekday not in IGIENISTA_WINDOWS or weekday not in allowed_days:
                continue
            if weekday in LARA_DAYS and _is_lara_no_day(events, day):
                continue
            busy = _busy_intervals(events, day)
            windows = IGIENISTA_WINDOWS[weekday]
            day_slots = _free_slots(day, windows, busy, SLOT_DURATION, max_slots=3)
            slots.extend(day_slots)
            if len(slots) >= max_results:
                break

        return format_response({'slots': slots[:max_results], 'igienista': igienista})
    except Exception as e:
        logger.error(f'Error fetching available slots: {e}')
        return format_response(success=False, error='Errore recupero slot disponibili'), 500


# MEDICI da constants_v2: 5=Anet, 2=Lara
_MEDICO_TO_IGIENISTA = {5: 'anet', 2: 'lara'}
_IGIENISTI_IDS = set(_MEDICO_TO_IGIENISTA.keys())


@bot_v2_bp.route('/bot/last-igienista/<db_code>', methods=['GET'])
@_require_bot_key
def get_last_igienista(db_code: str):
    """Return the hygienist (anet/lara/any) from the patient's last executed treatment in PREVENT.DBF."""
    try:
        import dbf as dbflib
        from utils.dbf_utils import get_optimized_reader, clean_dbf_value
        from core.constants_v2 import COLONNE

        reader = get_optimized_reader()
        db_code_stripped = db_code.strip()

        # Step 1: collect piano IDs belonging to this patient (ELENCO.DBF)
        elenco_path = reader._get_dbf_path('ELENCO.DBF')
        col_el = COLONNE['elenco']
        f_el_id  = col_el['id'].lower()           # db_code
        f_el_paz = col_el['id_paziente'].lower()  # db_elpacod

        piano_ids = set()
        with dbflib.Table(elenco_path, codepage='cp1252') as table:
            for record in table:
                try:
                    paz = clean_dbf_value(getattr(record, f_el_paz, ''))
                    if paz == db_code_stripped:
                        pid = clean_dbf_value(getattr(record, f_el_id, ''))
                        if pid:
                            piano_ids.add(pid)
                except Exception:
                    continue

        if not piano_ids:
            return format_response({'igienista': 'any', 'last_date': None})

        # Step 2: scan PREVENT.DBF for executed igienista treatments
        prevent_path = reader._get_dbf_path('PREVENT.DBF')
        col_pr = COLONNE['preventivi']
        f_pr_piano  = col_pr['id_piano'].lower()           # db_prelcod
        f_pr_medico = col_pr['medico'].lower()             # db_prmedic
        f_pr_data   = col_pr['data_prestazione'].lower()   # db_prdata
        f_pr_stato  = col_pr['stato_prestazione'].lower()  # db_guardia (3=eseguito)

        best_date = None
        best_medico_id = None

        with dbflib.Table(prevent_path, codepage='cp1252') as table:
            for record in table:
                try:
                    stato = clean_dbf_value(getattr(record, f_pr_stato, None))
                    if stato != 3:
                        continue
                    piano = clean_dbf_value(getattr(record, f_pr_piano, ''))
                    if piano not in piano_ids:
                        continue
                    try:
                        medico_id = int(clean_dbf_value(getattr(record, f_pr_medico, None)))
                    except (TypeError, ValueError):
                        continue
                    if medico_id not in _IGIENISTI_IDS:
                        continue
                    pdata = getattr(record, f_pr_data, None)
                    if not pdata:
                        continue
                    if best_date is None or pdata > best_date:
                        best_date = pdata
                        best_medico_id = medico_id
                except Exception:
                    continue

        if best_medico_id is None:
            return format_response({'igienista': 'any', 'last_date': None})

        igienista = _MEDICO_TO_IGIENISTA.get(best_medico_id, 'any')
        last_date_str = best_date.strftime('%Y-%m-%d') if best_date else None
        return format_response({'igienista': igienista, 'last_date': last_date_str, 'medico_id': best_medico_id})

    except Exception as e:
        logger.error(f'Error fetching last igienista for {db_code}: {e}')
        return format_response(success=False, error='Errore recupero igienista'), 500
