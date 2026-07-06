"""
Bot WhatsApp management API Blueprint.

Provides endpoints to check bot services status and manage studiobot_studio_info
directly from StudioDimaAI without going through n8n UI.
"""

import os
import logging
import sqlite3
import subprocess
import requests
from datetime import datetime, timedelta, timezone, time as dtime
from flask import Blueprint, request, g
from flask_jwt_extended import jwt_required
from functools import wraps

from app_v2 import format_response
from core.paths import STUDIO_DIMA_DB_PATH
from core.reminder_db import ensure_reminder_tables

_BOT_DB_UNAVAILABLE = 'Bot database non disponibile (dentalai non attivo)'

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
]


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
    return format_response(success=False, error=_BOT_DB_UNAVAILABLE, state='warning'), 503


@bot_v2_bp.route('/bot/studio-info', methods=['POST'])
@jwt_required()
def create_studio_info():
    return format_response(success=False, error=_BOT_DB_UNAVAILABLE, state='warning'), 503


@bot_v2_bp.route('/bot/studio-info/<chiave>', methods=['PUT'])
@jwt_required()
def update_studio_info(chiave: str):
    return format_response(success=False, error=_BOT_DB_UNAVAILABLE, state='warning'), 503


@bot_v2_bp.route('/bot/studio-info/<chiave>', methods=['DELETE'])
@jwt_required()
def delete_studio_info(chiave: str):
    return format_response(success=False, error=_BOT_DB_UNAVAILABLE, state='warning'), 503


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


def _extract_qr_from_body(data: dict) -> str | None:
    """Estrae il base64 QR da una risposta Evolution in qualsiasi formato noto."""
    if not isinstance(data, dict):
        return None
    return (data.get('base64')
            or (data.get('qrcode') or {}).get('base64')
            or data.get('code')
            or data.get('qr')
            or None)


def _fetch_qr() -> str | None:
    """
    Recupera il QR WhatsApp da Evolution tramite /instance/connect/{instance}.
    Restituisce il base64 del QR se disponibile, None se non ancora pronto.
    """
    headers = _evo_headers()
    try:
        r = requests.get(f'{EVOLUTION_BASE_URL}/instance/connect/{EVOLUTION_INSTANCE}',
                         headers=headers, timeout=10)
        logger.info(f'Evolution connect/{EVOLUTION_INSTANCE}: status={r.status_code} body={r.text[:400]}')
        if r.status_code == 200:
            qr = _extract_qr_from_body(r.json())
            if qr:
                return qr
        else:
            logger.warning(f'Evolution connect/{EVOLUTION_INSTANCE} returned {r.status_code}: {r.text[:200]}')
    except Exception as e:
        logger.warning(f'Evolution connect error: {e}')
    return None


@bot_v2_bp.route('/bot/whatsapp/qr', methods=['GET'])
@jwt_required()
def get_whatsapp_qr():
    """Genera il QR WhatsApp. Ritorna not_ready=True se Evolution non è ancora pronto."""
    try:
        qr = _fetch_qr()
        if not qr:
            return format_response({'qr': None, 'not_ready': True}), 202
        return format_response({'qr': qr, 'not_ready': False})
    except Exception as e:
        logger.error(f'Error fetching WA QR: {e}')
        return format_response(success=False, error=str(e)), 500


@bot_v2_bp.route('/bot/whatsapp/logout', methods=['POST'])
@jwt_required()
def logout_whatsapp():
    """Logout WhatsApp (disconnette il telefono, istanza resta)."""
    try:
        r = requests.delete(
            f'{EVOLUTION_BASE_URL}/instance/logout/{EVOLUTION_INSTANCE}',
            headers=_evo_headers(), timeout=5
        )
        return format_response({'result': r.json()})
    except Exception as e:
        logger.error(f'Error WA logout: {e}')
        return format_response(success=False, error='Errore logout'), 500


@bot_v2_bp.route('/bot/whatsapp/instance', methods=['DELETE'])
@jwt_required()
def delete_whatsapp_instance():
    """Elimina l'istanza WhatsApp da Evolution (richiede ricreazione)."""
    try:
        r = requests.delete(
            f'{EVOLUTION_BASE_URL}/instance/delete/{EVOLUTION_INSTANCE}',
            headers=_evo_headers(), timeout=10
        )
        if r.status_code in (200, 204):
            return format_response({'deleted': True})
        return format_response(success=False, error=f'Evolution {r.status_code}: {r.text[:200]}'), 400
    except Exception as e:
        logger.error(f'Error deleting WA instance: {e}')
        return format_response(success=False, error=str(e)), 500


@bot_v2_bp.route('/bot/conversazioni/<int:conv_id>', methods=['DELETE'])
@jwt_required()
def delete_conversazione(conv_id: int):
    return format_response(success=False, error=_BOT_DB_UNAVAILABLE, state='warning'), 503


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
    return format_response(success=False, error=_BOT_DB_UNAVAILABLE, state='warning'), 503


@bot_v2_bp.route('/bot/conversazioni/<int:conv_id>/messaggi', methods=['GET'])
@jwt_required()
def get_messaggi(conv_id: int):
    return format_response(success=False, error=_BOT_DB_UNAVAILABLE, state='warning'), 503


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


def _free_slots(day: datetime.date, windows: list, busy: list, slot_dur: timedelta, max_slots: int = 3, min_start: datetime = None) -> list:
    slots = []
    for wh, wm, eh, em in windows:
        cursor = datetime(day.year, day.month, day.day, wh, wm, tzinfo=ROME)
        window_end = datetime(day.year, day.month, day.day, eh, em, tzinfo=ROME)
        while cursor + slot_dur <= window_end and len(slots) < max_slots:
            if min_start and cursor < min_start:
                cursor += slot_dur
                continue
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
        min_start = now + timedelta(minutes=30)
        for i in range(days_ahead):
            day = current + timedelta(days=i)
            weekday = day.weekday()
            if weekday not in IGIENISTA_WINDOWS or weekday not in allowed_days:
                continue
            if weekday in LARA_DAYS and _is_lara_no_day(events, day):
                continue
            busy = _busy_intervals(events, day)
            windows = IGIENISTA_WINDOWS[weekday]
            day_slots = _free_slots(day, windows, busy, SLOT_DURATION, max_slots=3, min_start=min_start)
            slots.extend(day_slots)
            if len(slots) >= max_results:
                break

        return format_response({'slots': slots[:max_results], 'igienista': igienista})
    except Exception as e:
        logger.error(f'Error fetching available slots: {e}')
        return format_response(success=False, error='Errore recupero slot disponibili'), 500


# ---------------------------------------------------------------------------
# Doctor (studio 1) schedule constraints
# ---------------------------------------------------------------------------
DOTTORE_CAL_ID = os.getenv('CALENDAR_ID_STUDIO_1', '')
DOTTORE_SLOT_DURATION = timedelta(minutes=30)

DOTTORE_WINDOWS = {
    0: [(9, 0, 13, 0), (15, 0, 19, 0)],  # Lunedi
    1: [(9, 0, 16, 0)],                    # Martedi
    2: [(9, 0, 13, 0), (15, 0, 19, 0)],  # Mercoledi
    3: [(9, 0, 13, 0), (15, 0, 19, 0)],  # Giovedi
    4: [(9, 0, 16, 0)],                    # Venerdi
}


@bot_v2_bp.route('/bot/available-slots-visita', methods=['GET'])
@_require_bot_key
def get_available_slots_visita():
    """Return next available doctor appointment slots from Google Calendar 1."""
    days_ahead = int(request.args.get('giorni', 14))
    max_results = int(request.args.get('max', 5))

    try:
        from core.google_calendar_client import GoogleCalendarClient
        from core.paths import GOOGLE_CREDENTIALS_PATH, GOOGLE_TOKEN_PATH
        client = GoogleCalendarClient(credentials_path=GOOGLE_CREDENTIALS_PATH, token_path=GOOGLE_TOKEN_PATH)
        service = client.get_service()

        now = datetime.now(tz=ROME)
        time_max = now + timedelta(days=days_ahead)
        events = _fetch_calendar_events(service, DOTTORE_CAL_ID, now, time_max)

        slots = []
        current = now.date()
        min_start = now + timedelta(minutes=30)
        for i in range(days_ahead):
            day = current + timedelta(days=i)
            weekday = day.weekday()
            if weekday not in DOTTORE_WINDOWS:
                continue
            busy = _busy_intervals(events, day)
            windows = DOTTORE_WINDOWS[weekday]
            day_slots = _free_slots(day, windows, busy, DOTTORE_SLOT_DURATION, max_slots=3, min_start=min_start)
            slots.extend(day_slots)
            if len(slots) >= max_results:
                break

        return format_response({'slots': slots[:max_results]})
    except Exception as e:
        logger.error(f'Error fetching visita slots: {e}')
        return format_response(success=False, error='Errore recupero slot visite'), 500


@bot_v2_bp.route('/bot/triage-config', methods=['GET'])
@_require_bot_key
def get_triage_config():
    return format_response(success=False, error=_BOT_DB_UNAVAILABLE, state='warning'), 503


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


def _do_confirmation(phone: str, response_val: str, appointment_date: str = '') -> dict:
    """Logica condivisa tra /bot/appointment-confirmation e /bot/whatsapp-webhook."""
    phone_suffix = phone[-9:]
    conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if appointment_date:
        cur.execute("""
            SELECT id, patient_id, patient_name, appointment_date, appointment_time
            FROM patient_communications
            WHERE phone LIKE ? AND appointment_date = ? AND stato NOT IN ('confirmed', 'cancelled')
            ORDER BY created_at DESC LIMIT 1
        """, ('%' + phone_suffix, appointment_date))
    else:
        cur.execute("""
            SELECT id, patient_id, patient_name, appointment_date, appointment_time
            FROM patient_communications
            WHERE phone LIKE ? AND stato NOT IN ('confirmed', 'cancelled')
            ORDER BY created_at DESC LIMIT 1
        """, ('%' + phone_suffix,))

    comm = cur.fetchone()
    comm_id = None
    patient_id = None
    patient_name = 'Paziente'
    ap_date = appointment_date
    ap_time = ''

    if comm:
        comm_id = comm['id']
        patient_id = comm['patient_id']
        patient_name = comm['patient_name'] or 'Paziente'
        ap_date = comm['appointment_date']
        ap_time = comm['appointment_time']
        cur.execute(
            "UPDATE patient_communications SET stato = ? WHERE id = ?",
            (response_val, comm_id)
        )

    cur.execute("""
        INSERT INTO appointment_confirmations
            (patient_id, phone, appointment_date, appointment_time, response, communication_id)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (patient_id, phone, ap_date, ap_time, response_val, comm_id))

    conn.commit()
    conn.close()

    if response_val == 'cancelled':
        try:
            from app_v2 import push_service
            if push_service:
                slot_url = f"/richiami/slot-liberi?data={ap_date}&ora={ap_time}"
                push_service.send_notification(
                    user_id=3,  # CristinaB
                    title="Appuntamento cancellato",
                    body=f"{patient_name} ha cancellato: {ap_date} ore {ap_time}. Clicca per trovare un sostituto.",
                    url=slot_url,
                    urgency='high',
                )
        except Exception as e:
            logger.warning(f"Errore notifica cancellazione: {e}")

    return {
        'response': response_val,
        'patient_name': patient_name,
        'appointment_date': ap_date,
        'appointment_time': ap_time,
        'communication_id': comm_id,
    }


@bot_v2_bp.route('/bot/appointment-confirmation', methods=['POST'])
@_require_bot_key
def receive_appointment_confirmation():
    """
    Riceve conferma/cancellazione appuntamento da n8n (risposta SI/NO del paziente su WA).

    Body: {
        "phone": "393xxxxxxxxx",
        "response": "confirmed" | "cancelled",
        "appointment_date": "YYYY-MM-DD"  (opzionale)
    }
    """
    ensure_reminder_tables()
    data = request.get_json() or {}
    phone = data.get('phone', '').strip()
    response_val = data.get('response', '').strip().lower()
    appointment_date = data.get('appointment_date', '')

    if not phone or response_val not in ('confirmed', 'cancelled'):
        return format_response(success=False, error='phone e response (confirmed|cancelled) richiesti'), 400

    try:
        result = _do_confirmation(phone, response_val, appointment_date)
        return format_response(result)
    except Exception as e:
        logger.error(f"Errore appointment-confirmation: {e}")
        return format_response(success=False, error=str(e)), 500


# ---------------------------------------------------------------------------
# Testi positivi/negativi riconosciuti nel webhook Evolution
# ---------------------------------------------------------------------------
_EVO_POSITIVE = {'SI', 'SÌ', 'SÍ', 'YES', 'OK', 'CONFERMO', 'CONFERMATO', '1'}
_EVO_NEGATIVE = {'NO', 'CANCELLO', 'ANNULLO', 'ANNULLA', 'DISDICO', 'DISDETTA', 'CANCELLA', '0'}


@bot_v2_bp.route('/bot/whatsapp-webhook', methods=['POST'])
def evolution_webhook():
    """
    Riceve eventi da Evolution API (diretto, senza n8n).
    Accessibile solo da host.docker.internal — nessun JWT richiesto.
    Gestisce messages.upsert per SI/NO dei pazienti sui reminder.
    """
    payload = request.get_json(silent=True) or {}
    event = payload.get('event', '')

    if event != 'messages.upsert':
        return format_response({'ignored': True})

    data = payload.get('data', {})
    key = data.get('key', {})

    if key.get('fromMe'):
        return format_response({'ignored': True})

    remote_jid = key.get('remoteJid', '')
    if '@g.us' in remote_jid:
        return format_response({'ignored': True})

    phone = remote_jid.split('@')[0]

    message = data.get('message', {})
    text = (
        message.get('conversation')
        or (message.get('extendedTextMessage') or {}).get('text')
        or ''
    ).strip().upper()

    if not text:
        return format_response({'ignored': True})

    if text in _EVO_POSITIVE:
        response_val = 'confirmed'
    elif text in _EVO_NEGATIVE:
        response_val = 'cancelled'
    else:
        return format_response({'ignored': True, 'reason': 'not a reminder response'})

    ensure_reminder_tables()
    try:
        result = _do_confirmation(phone, response_val)
        if result.get('communication_id'):
            logger.info(f"WA conferma da {phone}: {response_val} per appuntamento {result.get('appointment_date')}")
        else:
            logger.debug(f"WA messaggio da {phone} ({response_val}): nessun reminder in attesa")
        return format_response(result)
    except Exception as e:
        logger.error(f"Errore Evolution webhook: {e}")
        return format_response(success=False, error=str(e)), 500


@bot_v2_bp.route('/bot/pending-reminder', methods=['GET'])
@_require_bot_key
def get_pending_reminder():
    """
    Controlla se esiste un reminder in attesa per un numero di telefono.
    Usato da n8n per decidere se smistare il messaggio al Reminder Handler.

    Query: ?phone=393xxxxxxxxx
    Risposta: {has_pending: bool, communication_id, appointment_date, appointment_time, patient_name}
    """
    ensure_reminder_tables()
    phone = request.args.get('phone', '').strip()
    if not phone:
        return format_response(success=False, error='phone richiesto'), 400

    phone_suffix = phone[-9:]
    now = datetime.now()
    today = now.strftime('%Y-%m-%d')
    current_time = now.strftime('%H:%M')

    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT id, patient_id, patient_name, appointment_date, appointment_time
            FROM patient_communications
            WHERE phone LIKE ?
              AND stato NOT IN ('confirmed', 'cancelled', 'failed')
              AND (
                  appointment_date > ?
                  OR (appointment_date = ? AND appointment_time > ?)
              )
            ORDER BY appointment_date ASC, created_at DESC
            LIMIT 1
        """, ('%' + phone_suffix, today, today, current_time))
        row = cur.fetchone()
        conn.close()

        if row:
            return format_response({
                'has_pending': True,
                'communication_id': row['id'],
                'patient_id': row['patient_id'],
                'patient_name': row['patient_name'],
                'appointment_date': row['appointment_date'],
                'appointment_time': row['appointment_time'],
            })
        else:
            return format_response({'has_pending': False})

    except Exception as e:
        logger.error(f"Errore pending-reminder: {e}")
        return format_response(success=False, error=str(e)), 500


# ---------------------------------------------------------------------------
# Evolution dashboard status
# ---------------------------------------------------------------------------

@bot_v2_bp.route('/bot/evolution/status', methods=['GET'])
@jwt_required()
def get_evolution_dashboard_status():
    """
    Stato aggregato del sistema reminder: Docker, Evolution API, WhatsApp, Scheduler.
    Usato dalla pagina EvolutionSettings nel frontend.
    """
    ensure_reminder_tables()
    status: dict = {
        'docker_daemon_running': False,   # Docker Desktop aperto e daemon attivo
        'docker_running': False,          # container studiodima-evolution in esecuzione
        'evolution_reachable': False,
        'wa_state': 'unknown',
        'instance_exists': False,
        'webhook_url': os.getenv('EVOLUTION_WEBHOOK_URL', ''),
        'webhook_configured': bool(os.getenv('EVOLUTION_WEBHOOK_URL', '')),
        'reminder_24h_enabled': False,
        'reminder_2h_enabled': False,
        'followup_enabled': False,
        'recent_communications': [],
    }

    # 1a. Verifica daemon Docker (docker ps ritorna 0 solo se il daemon risponde)
    try:
        daemon_probe = subprocess.run(
            'docker ps -q', shell=True, capture_output=True, timeout=5
        )
        status['docker_daemon_running'] = daemon_probe.returncode == 0
    except Exception:
        pass

    # 1b. Verifica container solo se il daemon risponde
    if status['docker_daemon_running']:
        try:
            result = subprocess.run(
                'docker ps --filter name=studiodima-evolution --filter status=running -q',
                shell=True, capture_output=True, text=True, timeout=5
            )
            status['docker_running'] = bool(result.stdout.strip())
        except Exception:
            pass

    # 2. Evolution API raggiungibile (fetchInstances serve solo per questo)
    try:
        r = requests.get(
            f'{EVOLUTION_BASE_URL}/instance/fetchInstances',
            headers=_evo_headers(), timeout=5
        )
        status['evolution_reachable'] = r.status_code < 500
    except Exception:
        pass

    # 3. Istanza presente + stato WhatsApp via connectionState
    # Restituisce 200+state se esiste, 404 se non esiste — più affidabile di parsare fetchInstances
    if status['evolution_reachable']:
        try:
            r = requests.get(
                f'{EVOLUTION_BASE_URL}/instance/connectionState/{EVOLUTION_INSTANCE}',
                headers=_evo_headers(), timeout=5
            )
            if r.status_code == 200:
                status['instance_exists'] = True
                status['wa_state'] = r.json().get('instance', {}).get('state', 'unknown')
            # 404 = istanza non esiste, instance_exists rimane False
        except Exception:
            pass

    # 4. Impostazioni scheduler
    try:
        from core.automation_config import get_automation_settings
        s = get_automation_settings()
        status['reminder_24h_enabled'] = bool(s.get('appointment_reminder_24h_enabled', False))
        status['reminder_2h_enabled'] = bool(s.get('appointment_reminder_2h_enabled', True))
        status['followup_enabled'] = bool(s.get('appointment_followup_enabled', False))
    except Exception:
        pass

    # 5. Ultime comunicazioni
    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT id, patient_name, phone, channel, type, stato,
                   appointment_date, appointment_time, created_at
            FROM patient_communications
            ORDER BY created_at DESC LIMIT 50
        """)
        status['recent_communications'] = [dict(r) for r in cur.fetchall()]
        conn.close()
    except Exception:
        pass

    return format_response(status)


def _normalize_phone_to_jid(phone: str) -> str:
    """Normalizza un numero italiano al JID WhatsApp (39xxxxxxxxxx@s.whatsapp.net)."""
    phone = phone.strip().replace(' ', '').replace('-', '')
    if phone.startswith('+39'):
        phone = phone[1:]
    elif phone.startswith('3') and len(phone) == 10:
        phone = '39' + phone
    return f'{phone}@s.whatsapp.net'


def _extract_evo_text(message: dict) -> str:
    """Estrae il testo da un oggetto message di Evolution/Baileys, qualunque sia il tipo."""
    if not isinstance(message, dict):
        return '[messaggio non supportato]'
    return (
        message.get('conversation')
        or (message.get('extendedTextMessage') or {}).get('text')
        or (message.get('imageMessage') or {}).get('caption')
        or (message.get('videoMessage') or {}).get('caption')
        or '[messaggio non supportato]'
    )


def _parse_evo_messages(raw) -> list:
    """
    Normalizza la risposta di Evolution POST /chat/findMessages/{instance} in una lista
    ordinata cronologicamente di {id, fromMe, text, timestamp}.
    La forma della risposta varia tra versioni Evolution: puo' essere un array diretto
    oppure annidata sotto messages.records.
    """
    if isinstance(raw, dict):
        records = raw.get('messages', {}).get('records') if isinstance(raw.get('messages'), dict) else raw.get('records')
        records = records if isinstance(records, list) else []
    elif isinstance(raw, list):
        records = raw
    else:
        records = []

    parsed = []
    for r in records:
        if not isinstance(r, dict):
            continue
        key = r.get('key', {})
        parsed.append({
            'id': key.get('id', ''),
            'fromMe': bool(key.get('fromMe')),
            'text': _extract_evo_text(r.get('message', {})),
            'timestamp': r.get('messageTimestamp', 0),
        })
    parsed.sort(key=lambda m: m['timestamp'])
    return parsed


@bot_v2_bp.route('/bot/evolution/conversation', methods=['GET'])
@jwt_required()
def get_evolution_conversation():
    """Recupera la cronologia messaggi WhatsApp live da Evolution per un numero di telefono."""
    phone = request.args.get('phone', '').strip()
    if not phone:
        return format_response(success=False, error='phone richiesto'), 400

    jid = _normalize_phone_to_jid(phone)
    try:
        r = requests.post(
            f'{EVOLUTION_BASE_URL}/chat/findMessages/{EVOLUTION_INSTANCE}',
            headers=_evo_headers(),
            json={'where': {'key': {'remoteJid': jid}}, 'limit': 50},
            timeout=10,
        )
        if r.status_code != 200:
            return format_response(success=False, error=f'Evolution API {r.status_code}', state='warning')
        messages = _parse_evo_messages(r.json())
        return format_response({'messages': messages, 'jid': jid})
    except Exception as e:
        logger.warning(f'Errore recupero conversazione Evolution ({jid}): {e}')
        return format_response(success=False, error='Evolution non raggiungibile', state='warning')


def _compose_dir() -> 'Path | None':
    """Ritorna la directory del docker-compose.yml o None se non trovato."""
    from pathlib import Path
    p = Path(__file__).parent.parent.parent / 'docker-compose.yml'
    return p.parent if p.exists() else None


def _run_docker(cmd: str, timeout: int = 60) -> tuple[bool, str]:
    """Esegue un comando docker via shell e ritorna (ok, output)."""
    cwd = _compose_dir()
    if cwd is None:
        return False, 'docker-compose.yml non trovato nella root del progetto'
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True,
            timeout=timeout, cwd=str(cwd)
        )
        output = (result.stdout or result.stderr or '').strip()
        return result.returncode == 0, output
    except subprocess.TimeoutExpired:
        return False, f'Timeout ({timeout}s): operazione non completata'
    except Exception as e:
        return False, str(e)


_DOCKER_DESKTOP_PATHS = [
    r'C:\Program Files\Docker\Docker\Docker Desktop.exe',
    os.path.expandvars(r'%LOCALAPPDATA%\Programs\Docker\Docker\Docker Desktop.exe'),
    os.path.expandvars(r'%PROGRAMFILES%\Docker\Docker\Docker Desktop.exe'),
]


@bot_v2_bp.route('/bot/evolution/start-docker-desktop', methods=['POST'])
@jwt_required()
def start_docker_desktop():
    """Lancia Docker Desktop.exe (non bloccante). L'utente deve attendere ~30s poi ricaricare."""
    from pathlib import Path as _Path
    for path in _DOCKER_DESKTOP_PATHS:
        if _Path(path).exists():
            try:
                subprocess.Popen([path])
                return format_response({'launched': True, 'path': path})
            except Exception as e:
                return format_response(success=False, error=f'Impossibile avviare Docker Desktop: {e}'), 500
    return format_response(success=False, error='Docker Desktop non trovato nei percorsi standard'), 404


@bot_v2_bp.route('/bot/evolution/start', methods=['POST'])
@jwt_required()
def start_evolution():
    """Avvia il container Evolution via docker compose up -d."""
    ok, output = _run_docker('docker compose up -d', timeout=120)
    if ok:
        return format_response({'started': True, 'output': output})
    logger.error(f'Evolution start fallito: {output}')
    return format_response(success=False, error=output), 500


@bot_v2_bp.route('/bot/evolution/stop', methods=['POST'])
@jwt_required()
def stop_evolution():
    """Ferma il container Evolution via docker compose stop."""
    ok, output = _run_docker('docker compose stop evolution', timeout=30)
    if ok:
        return format_response({'stopped': True, 'output': output})
    logger.error(f'Evolution stop fallito: {output}')
    return format_response(success=False, error=output), 500


@bot_v2_bp.route('/bot/evolution/create-instance', methods=['POST'])
@jwt_required()
def create_evolution_instance():
    """Crea l'istanza WhatsApp su Evolution API (da chiamare una volta sola)."""
    try:
        r = requests.post(
            f'{EVOLUTION_BASE_URL}/instance/create',
            headers=_evo_headers(),
            json={
                'instanceName': EVOLUTION_INSTANCE,
                'integration': 'WHATSAPP-BAILEYS',
                'qrcode': True,
            },
            timeout=10
        )
        if r.status_code in (200, 201):
            body = r.json() if r.text else {}
            # Evolution restituisce il QR direttamente nella risposta di creazione quando qrcode: True
            qr_section = body.get('qrcode') or {}
            qr_data = (qr_section.get('base64')
                       or body.get('base64')
                       or qr_section.get('code')
                       or body.get('code')
                       or None)
            logger.debug(f'create-instance response keys: {list(body.keys())} qr_found={bool(qr_data)}')
            return format_response({
                'created': True,
                'already_exists': False,
                'instance': EVOLUTION_INSTANCE,
                'qr': qr_data,
            })
        if r.status_code == 403:
            body = r.json()
            msgs = body.get('response', {}).get('message', [])
            if any('already in use' in m for m in msgs):
                return format_response({'created': False, 'already_exists': True, 'instance': EVOLUTION_INSTANCE})
        return format_response(success=False, error=f'Evolution API {r.status_code}: {r.text[:200]}'), 400
    except Exception as e:
        logger.error(f'Errore creazione istanza Evolution: {e}')
        return format_response(success=False, error=str(e)), 500
