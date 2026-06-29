"""
Servizio reminder appuntamenti multi-canale.

Flusso per ogni appuntamento:
1. Legge APPUNTA.DBF + PAZIENTI.DBF dal server
2. Se cellulare disponibile: check WhatsApp (cache → PostgreSQL bot → Evolution API)
3. Se WA: manda via Evolution API
4. Se no WA o solo fisso: SMS via Brevo
5. Solo fisso: alert push alla segreteria, nessun automatismo
6. Log in patient_communications (SQLite)
"""

import os
import logging
import sqlite3
import requests
import dbf
import pytz
from datetime import datetime, date, timedelta
from typing import Optional

from core.config_manager import get_config
from core.paths import STUDIO_DIMA_DB_PATH
from core.constants_v2 import TIPI_APPUNTAMENTO
from core.reminder_db import ensure_reminder_tables, is_appointment_confirmed

ROME_TZ = pytz.timezone('Europe/Rome')

logger = logging.getLogger(__name__)

EVOLUTION_BASE_URL = os.getenv('EVOLUTION_BASE_URL', 'http://127.0.0.1:8080')
EVOLUTION_INSTANCE = os.getenv('EVOLUTION_INSTANCE', 'studio-instance')

REMINDER_MESSAGES = {
    '24h': {
        'wa': (
            "Ciao {nome}! Domani {data} alle {ora} hai un appuntamento dal dentista "
            "(Studio Dr. Di Martino).\nRispondi SI per confermare o NO per cancellare. Grazie!"
        ),
        'sms': "Studio Dr.Di Martino: appuntamento domani {data} ore {ora}. Info: 0574712060",
    },
    '2h': {
        'wa': (
            "Promemoria: tra 2 ore ({ora}) hai il tuo appuntamento dal dentista "
            "(Studio Dr. Di Martino). A presto!"
        ),
        'sms': "Studio Dr.Di Martino: promemoria visita oggi ore {ora}. Info: 0574712060",
    },
    'followup': {
        'wa': (
            "Promemoria: il suo appuntamento e oggi alle {ora} (Studio Dr. Di Martino). "
            "Rispondi SI per confermare o NO per cancellare."
        ),
        'sms': "Studio Dr.Di Martino: promemoria visita OGGI ore {ora}. Info: 0574712060",
    },
}


_sent_this_session: set[str] = set()  # chiave: "patient_id|ap_date|ap_time|type"


def _session_key(patient_id: str, ap_date: str, ap_time: str, reminder_type: str) -> str:
    return f"{patient_id}|{ap_date}|{ap_time}|{reminder_type}"


# ---------------------------------------------------------------------------
# DBF helpers
# ---------------------------------------------------------------------------

def _dbf_path(table_name: str) -> str:
    config = get_config()
    return config.get_dbf_path(table_name)


def _ora_fmt(ora_raw: str) -> str:
    """Converte '9.4' → '09:40', '14.3' → '14:30'."""
    ora_raw = str(ora_raw).strip()
    if '.' in ora_raw:
        h, m = ora_raw.split('.', 1)
        return f"{int(h):02d}:{int(m)*10:02d}"
    return f"{int(float(ora_raw)):02d}:00"


def _is_mobile(phone: str) -> bool:
    """Verifica che il numero sia un cellulare italiano (inizia con 3)."""
    clean = phone.strip().replace(' ', '').replace('-', '')
    if clean.startswith('+39'):
        clean = clean[3:]
    elif len(clean) == 12 and clean.startswith('39'):
        clean = clean[2:]
    return clean.startswith('3') and len(clean) >= 9


def _normalize_phone(phone: str) -> str:
    """Normalizza a formato internazionale 39xxxxxxxxxx."""
    phone = phone.strip().replace(' ', '').replace('-', '')
    if phone.startswith('+39'):
        return phone[1:]
    if phone.startswith('39') and len(phone) == 12:
        return phone
    if phone.startswith('3') and len(phone) == 10:
        return '39' + phone
    return phone


# ---------------------------------------------------------------------------
# Lettura appuntamenti e pazienti
# ---------------------------------------------------------------------------

def get_upcoming_appointments(reminder_type: str, slot: str = 'all') -> list[dict]:
    """
    Legge APPUNTA.DBF e restituisce gli appuntamenti da notificare.

    reminder_type '24h': appuntamenti di DOMANI (data == domani)
      slot='morning'   -> ore < 13:00
      slot='afternoon' -> ore >= 13:00
      slot='all'       -> tutti (fallback)
    reminder_type '2h':  appuntamenti tra 90 e 150 minuti da adesso
    """
    now = datetime.now(ROME_TZ).replace(tzinfo=None)  # ora legale corretta per Roma
    tomorrow = (now + timedelta(days=1)).date()

    ap_path = _dbf_path('APPUNTA')
    paz_path = _dbf_path('pazienti')

    # --- Appuntamenti ---
    rows = []
    try:
        table = dbf.Table(ap_path, codepage='cp1252')
        table.open(dbf.READ_ONLY)
        for record in table:
            if dbf.is_deleted(record):
                continue
            try:
                ap_date = record['DB_APDATA']
                if hasattr(ap_date, 'date'):
                    ap_date = ap_date.date()
                paz_id = str(record['DB_APPACOD']).strip()
                if not paz_id:
                    continue
                ora_raw = str(record['DB_APOREIN']).strip()
                ora_fmt = _ora_fmt(ora_raw)
                ap_dt = datetime.combine(ap_date, datetime.strptime(ora_fmt, '%H:%M').time())

                if reminder_type == '24h':
                    if ap_date != tomorrow:
                        continue
                    if slot == 'morning':
                        match = (ap_dt.hour < 13)
                    elif slot == 'afternoon':
                        match = (ap_dt.hour >= 13)
                    else:
                        match = True
                else:
                    # Appuntamenti tra 90 e 150 minuti da adesso
                    delta = (ap_dt - now).total_seconds() / 60
                    match = (90 <= delta <= 150)

                if match:
                    rows.append({
                        'patient_id': paz_id,
                        'appointment_date': str(ap_date),
                        'appointment_time': ora_fmt,
                        'tipo': str(record['DB_GUARDIA']).strip(),
                        'studio': str(record['DB_APSTUDI']).strip(),
                        'nome_dbf': str(record['DB_APDESCR']).strip(),
                    })
            except Exception:
                continue
        table.close()
    except Exception as e:
        logger.error(f"Errore lettura APPUNTA.DBF: {e}")
        return []

    if not rows:
        return []

    # --- Pazienti ---
    paz_ids = {r['patient_id'] for r in rows}
    pazienti: dict[str, dict] = {}
    try:
        table = dbf.Table(paz_path, codepage='cp1252')
        table.open(dbf.READ_ONLY)
        for record in table:
            if dbf.is_deleted(record):
                continue
            try:
                pid = str(record['DB_CODE']).strip()
                if pid not in paz_ids:
                    continue
                pazienti[pid] = {
                    'nome': str(record['DB_PANOME']).strip(),
                    'cell': str(record['DB_PACELLU']).strip(),
                    'tel': str(record['DB_PATELEF']).strip(),
                    'email': str(record['DB_PAEMAIL']).strip(),
                }
            except Exception:
                continue
        table.close()
    except Exception as e:
        logger.error(f"Errore lettura PAZIENTI.DBF: {e}")

    # --- Merge ---
    for row in rows:
        paz = pazienti.get(row['patient_id'], {})
        row['patient_name'] = paz.get('nome') or row['nome_dbf']
        row['cell'] = paz.get('cell', '')
        row['tel'] = paz.get('tel', '')
    return rows


# ---------------------------------------------------------------------------
# Check WhatsApp
# ---------------------------------------------------------------------------

def _evo_headers() -> dict:
    return {'apikey': os.getenv('EVOLUTION_API_KEY', ''), 'Content-Type': 'application/json'}


def check_whatsapp(patient_id: str, phone: str) -> tuple[bool, Optional[str]]:
    """
    Controlla se il numero ha WhatsApp.
    Ordine: cache SQLite → studiobot_pazienti PostgreSQL → Evolution API.
    Ritorna (has_whatsapp, wa_jid).
    """
    phone_norm = _normalize_phone(phone)

    # 1. Cache SQLite
    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        cur = conn.cursor()
        cur.execute(
            "SELECT has_whatsapp, wa_jid, checked_at FROM pazienti_wa_cache WHERE patient_id = ?",
            (patient_id,)
        )
        row = cur.fetchone()
        conn.close()
        if row and row[0] is not None:
            checked_at = datetime.fromisoformat(row[2]) if row[2] else None
            if checked_at and (datetime.now() - checked_at).days < 30:
                return bool(row[0]), row[1]
    except Exception as e:
        logger.warning(f"Errore lettura wa_cache: {e}")

    # 2. Evolution API
    try:
        r = requests.post(
            f"{EVOLUTION_BASE_URL}/chat/whatsappNumbers/{EVOLUTION_INSTANCE}",
            headers=_evo_headers(),
            json={'numbers': [phone_norm]},
            timeout=5,
        )
        if r.status_code == 200:
            try:
                data = r.json() if r.text.strip() else {}
            except ValueError:
                logger.warning(f"Evolution API risposta non JSON: {r.text[:200]}")
                return False, None
            results = data if isinstance(data, list) else data.get('data', [])
            for item in results:
                if item.get('exists'):
                    jid = item.get('jid', phone_norm + '@s.whatsapp.net')
                    _save_wa_cache(patient_id, phone, True, jid)
                    return True, jid
            _save_wa_cache(patient_id, phone, False, None)
            return False, None
    except Exception as e:
        logger.warning(f"Errore Evolution API check WA: {e}")

    # Fallback: non riusciamo a verificare, trattiamo come SMS
    return False, None


def _save_wa_cache(patient_id: str, phone: str, has_wa: bool, jid: Optional[str]):
    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        conn.execute("""
            INSERT INTO pazienti_wa_cache (patient_id, phone, has_whatsapp, wa_jid, checked_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(patient_id) DO UPDATE SET
                phone=excluded.phone, has_whatsapp=excluded.has_whatsapp,
                wa_jid=excluded.wa_jid, checked_at=excluded.checked_at
        """, (patient_id, phone, 1 if has_wa else 0, jid, datetime.now().isoformat()))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Errore salvataggio wa_cache: {e}")


# ---------------------------------------------------------------------------
# Invio messaggi
# ---------------------------------------------------------------------------

def send_whatsapp_reminder(phone: str, patient_name: str, ap_date: str, ap_time: str, reminder_type: str) -> dict:
    """Invia reminder via Evolution API WhatsApp."""
    phone_norm = _normalize_phone(phone)
    parts = patient_name.split() if patient_name else []
    nome = parts[-1] if len(parts) > 1 else (parts[0] if parts else 'paziente')
    data_fmt = datetime.strptime(ap_date, '%Y-%m-%d').strftime('%d/%m')
    tpl = REMINDER_MESSAGES[reminder_type]['wa']
    text = tpl.format(nome=nome, data=data_fmt, ora=ap_time)

    from core.automation_config import get_automation_settings
    settings = get_automation_settings()
    if settings.get('theoretical_mode_enabled'):
        logger.info(f"[THEORETICAL WA] To: {phone_norm}, Message: {text[:50]}...")
        return {'success': True, 'message_id': 'SIMULATED', 'channel': 'whatsapp', 'theoretical': True}

    try:
        r = requests.post(
            f"{EVOLUTION_BASE_URL}/message/sendText/{EVOLUTION_INSTANCE}",
            headers=_evo_headers(),
            json={'number': phone_norm, 'text': text},
            timeout=10,
        )
        try:
            data = r.json() if r.text.strip() else {}
        except ValueError:
            snippet = (r.text or '')[:200]
            logger.warning(f"Evolution sendText non JSON ({r.status_code}): {snippet}")
            return {'success': False, 'error': f'HTTP {r.status_code}: risposta non JSON'}
        if r.status_code in (200, 201):
            msg_id = ''
            if isinstance(data, dict):
                key = data.get('key') or {}
                msg_id = key.get('id', '') if isinstance(key, dict) else str(key or '')
            return {'success': True, 'message_id': msg_id, 'channel': 'whatsapp'}
        logger.warning(f"Evolution API error {r.status_code}: {data}")
        return {'success': False, 'error': str(data)}
    except Exception as e:
        logger.error(f"Errore invio WA reminder: {e}")
        return {'success': False, 'error': str(e)}


def send_sms_reminder(phone: str, patient_name: str, ap_date: str, ap_time: str, reminder_type: str) -> dict:
    """Invia reminder via Brevo SMS (sempre in prod)."""
    from services.sms_service import SMSService
    from core.environment_manager import environment_manager, ServiceType, Environment
    data_fmt = datetime.strptime(ap_date, '%Y-%m-%d').strftime('%d/%m')
    tpl = REMINDER_MESSAGES[reminder_type]['sms']
    text = tpl.format(data=data_fmt, ora=ap_time)

    environment_manager.set_environment(ServiceType.SMS, Environment('prod'))
    svc = SMSService()
    result = svc.send_sms(phone, text, tag='reminder')
    return {
        'success': result.get('success', False),
        'message_id': result.get('message_id', ''),
        'channel': 'sms',
        'error': result.get('message') if not result.get('success') else None,
    }


# ---------------------------------------------------------------------------
# Log comunicazioni
# ---------------------------------------------------------------------------

def _already_sent(patient_id: str, ap_date: str, ap_time: str, reminder_type: str) -> bool:
    """Verifica che non sia già stato inviato un reminder per questo appuntamento."""
    key = _session_key(patient_id, ap_date, ap_time, reminder_type)
    if key in _sent_this_session:
        return True
    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        cur = conn.cursor()
        cur.execute("""
            SELECT id FROM patient_communications
            WHERE patient_id = ? AND appointment_date = ? AND appointment_time = ? AND type = ?
            AND stato != 'failed'
        """, (patient_id, ap_date, ap_time, reminder_type))
        exists = cur.fetchone() is not None
        conn.close()
        if exists:
            _sent_this_session.add(key)
        return exists
    except Exception as e:
        logger.warning(f"Errore check duplicati: {e}")
        return False


def _log_communication(patient_id: str, patient_name: str, phone: str,
                        channel: str, reminder_type: str, ap_date: str, ap_time: str,
                        stato: str, message_id: str = '') -> int:
    if stato == 'sent':
        _sent_this_session.add(_session_key(patient_id, ap_date, ap_time, reminder_type))
    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO patient_communications
                (patient_id, patient_name, phone, channel, type, appointment_date, appointment_time, stato, message_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (patient_id, patient_name, phone, channel, reminder_type, ap_date, ap_time, stato, message_id))
        comm_id = cur.lastrowid
        conn.commit()
        conn.close()
        return comm_id
    except Exception as e:
        logger.error(f"Errore log comunicazione: {e}")
        return 0


# ---------------------------------------------------------------------------
# Follow-up: appuntamenti di oggi senza risposta
# ---------------------------------------------------------------------------

def get_appointments_pending_followup(hours_before: int = 3) -> list[dict]:
    """
    Legge patient_communications per trovare appuntamenti di oggi con reminder
    inviato ma senza risposta, che sono a `hours_before` ore di distanza.
    Non tocca i DBF — i dati sono già nel log.
    """
    now = datetime.now(ROME_TZ).replace(tzinfo=None)
    today = now.strftime('%Y-%m-%d')
    current_time = now.strftime('%H:%M')
    cutoff_time = (now + timedelta(hours=hours_before)).strftime('%H:%M')

    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT patient_id, patient_name, phone, appointment_date, appointment_time, channel
            FROM patient_communications
            WHERE appointment_date = ?
              AND stato = 'sent'
              AND type != 'followup'
              AND appointment_time > ?
              AND appointment_time <= ?
              AND NOT EXISTS (
                SELECT 1 FROM patient_communications f
                WHERE f.patient_id = patient_communications.patient_id
                  AND f.appointment_date = patient_communications.appointment_date
                  AND f.appointment_time = patient_communications.appointment_time
                  AND f.type = 'followup'
              )
              AND NOT EXISTS (
                SELECT 1 FROM appointment_confirmations ac
                WHERE ac.patient_id = patient_communications.patient_id
                  AND ac.appointment_date = patient_communications.appointment_date
                  AND ac.response_type = 'confirmed'
              )
        """, (today, current_time, cutoff_time))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"Errore lettura pending followup: {e}")
        return []


def run_followup_reminders(hours_before: int = 3, dry_run: bool = False) -> dict:
    """
    Invia follow-up reminder per appuntamenti di oggi senza risposta.
    Riusa il canale originale (WA o SMS) già registrato in patient_communications.
    """
    ensure_reminder_tables()
    appointments = get_appointments_pending_followup(hours_before)
    stats = {'sent_wa': 0, 'sent_sms': 0, 'errors': [], 'dry_run': dry_run, 'hours_before': hours_before, 'simulated_actions': []}

    for ap in appointments:
        pid = ap['patient_id']
        name = ap['patient_name']
        phone = ap['phone']
        ap_date = ap['appointment_date']
        ap_time = ap['appointment_time']
        channel = ap['channel']

        if dry_run:
            if channel == 'whatsapp':
                stats['sent_wa'] += 1
            else:
                stats['sent_sms'] += 1
            
            # Record simulated action
            stats['simulated_actions'].append({
                'patient_id': pid,
                'patient_name': name,
                'phone': phone,
                'channel': channel,
                'type': 'followup',
                'appointment_date': ap_date,
                'appointment_time': ap_time,
                'message': REMINDER_MESSAGES['followup'][channel == 'whatsapp' and 'wa' or 'sms'].format(
                    data=datetime.strptime(ap_date, '%Y-%m-%d').strftime('%d/%m'), 
                    ora=ap_time
                )
            })
            continue

        if channel == 'whatsapp':
            result = send_whatsapp_reminder(phone, name, ap_date, ap_time, 'followup')
        else:
            result = send_sms_reminder(phone, name, ap_date, ap_time, 'followup')

        stato = 'sent' if result['success'] else 'failed'
        _log_communication(pid, name, phone, channel, 'followup', ap_date, ap_time,
                           stato, result.get('message_id', ''))
        if result['success']:
            if channel == 'whatsapp':
                stats['sent_wa'] += 1
            else:
                stats['sent_sms'] += 1
        else:
            stats['errors'].append({'patient': name, 'error': result.get('error', '')})

    _write_log('followup', stats)
    return stats


# ---------------------------------------------------------------------------
# Job principale
# ---------------------------------------------------------------------------

def run_reminders(reminder_type: str, dry_run: bool = False, patient_filter: str = None, slot: str = 'all') -> dict:
    """
    Funzione chiamata dallo scheduler.

    reminder_type:   '24h' o '2h'
    slot:            'morning' | 'afternoon' | 'all' (usato solo per 24h)
    dry_run:         se True, simula senza inviare nulla
    patient_filter:  se valorizzato, processa solo il paziente con questo patient_id
    Ritorna statistiche: {sent_wa, sent_sms, skipped_fisso, errors, no_phone}
    """
    ensure_reminder_tables()
    appointments = get_upcoming_appointments(reminder_type, slot=slot)
    if patient_filter:
        appointments = [a for a in appointments if a['patient_id'] == patient_filter]

    stats = {'sent_wa': 0, 'sent_sms': 0, 'skipped_fisso': [], 'errors': [], 'no_phone': [],
             'dry_run': dry_run, 'simulated_actions': []}

    for ap in appointments:
        pid = ap['patient_id']
        name = ap['patient_name']
        ap_date = ap['appointment_date']
        ap_time = ap['appointment_time']
        cell = ap.get('cell', '').strip()
        tel = ap.get('tel', '').strip()

        # Anti-duplicati
        if _already_sent(pid, ap_date, ap_time, reminder_type):
            continue

        # Se ha già confermato (SI alla 24h), non disturbare con il 2h
        if reminder_type == '2h' and is_appointment_confirmed(pid, ap_date, ap_time):
            continue

        # Classifica contatto
        if cell and _is_mobile(cell):
            phone = cell
            has_wa, _ = check_whatsapp(pid, phone)
            if dry_run:
                channel = 'whatsapp' if has_wa else 'sms'
                logger.info(f"[DRY RUN] {name} -> {channel} ({phone})")
                if has_wa:
                    stats['sent_wa'] += 1
                else:
                    stats['sent_sms'] += 1
                
                # Record simulated action
                tpl = REMINDER_MESSAGES[reminder_type][channel == 'whatsapp' and 'wa' or 'sms']
                data_fmt = datetime.strptime(ap_date, '%Y-%m-%d').strftime('%d/%m')
                if channel == 'whatsapp':
                    parts = name.split() if name else []
                    nome = parts[-1] if len(parts) > 1 else (parts[0] if parts else 'paziente')
                    text = tpl.format(nome=nome, data=data_fmt, ora=ap_time)
                else:
                    text = tpl.format(data=data_fmt, ora=ap_time)
                
                stats['simulated_actions'].append({
                    'patient_id': pid,
                    'patient_name': name,
                    'phone': phone,
                    'channel': channel,
                    'type': reminder_type,
                    'appointment_date': ap_date,
                    'appointment_time': ap_time,
                    'message': text
                })
            else:
                if has_wa:
                    result = send_whatsapp_reminder(phone, name, ap_date, ap_time, reminder_type)
                else:
                    result = send_sms_reminder(phone, name, ap_date, ap_time, reminder_type)

                channel = result.get('channel', 'sms')
                stato = 'sent' if result['success'] else 'failed'
                _log_communication(pid, name, phone, channel, reminder_type, ap_date, ap_time,
                                   stato, result.get('message_id', ''))
                if result['success']:
                    if channel == 'whatsapp':
                        stats['sent_wa'] += 1
                    else:
                        stats['sent_sms'] += 1
                else:
                    stats['errors'].append({'patient': name, 'error': result.get('error', '')})

        elif tel:
            # Solo fisso: nessun automatismo, verrà notificata la segreteria dopo
            stats['skipped_fisso'].append({'patient_id': pid, 'name': name,
                                           'tel': tel, 'ap_date': ap_date, 'ap_time': ap_time})
        else:
            stats['no_phone'].append({'patient_id': pid, 'name': name,
                                      'ap_date': ap_date, 'ap_time': ap_time})

    # Notifica segreteria per pazienti con solo fisso
    if stats['skipped_fisso']:
        _notify_staff_fisso(stats['skipped_fisso'], reminder_type)

    # Log su file (stesso pattern scheduler esistente)
    _write_log(reminder_type, stats)

    return stats


def _notify_staff_fisso(pazienti_fisso: list, reminder_type: str):
    """Invia push notification alla segreteria per pazienti senza cellulare."""
    try:
        from app_v2 import push_service
        if not push_service:
            return
        nomi = ', '.join(p['name'] for p in pazienti_fisso)
        message = (
            f"Reminder {reminder_type}: {len(pazienti_fisso)} pazient"
            f"{'e' if len(pazienti_fisso)==1 else 'i'} senza cellulare — contattare manualmente: {nomi}"
        )
        push_service.send_notification_to_all(
            title="Reminder: contattare manualmente",
            body=message,
            data={'type': 'reminder_manual', 'pazienti': pazienti_fisso}
        )
    except Exception as e:
        logger.warning(f"Errore notifica segreteria fisso: {e}")


def _write_log(reminder_type: str, stats: dict):
    import json, time
    entry = {
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'type': reminder_type,
        'sent_wa': stats['sent_wa'],
        'sent_sms': stats['sent_sms'],
        'skipped_fisso': len(stats.get('skipped_fisso', [])),
        'no_phone': len(stats.get('no_phone', [])),
        'errors': stats['errors'],
    }
    try:
        log_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'automation_reminders.log')
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    except Exception as e:
        logger.error(f"Errore scrittura log reminder: {e}")
