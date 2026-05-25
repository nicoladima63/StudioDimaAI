"""
Reminder appuntamenti API - endpoints per trigger manuale, status e log.
"""

import json
import logging
import os
import sqlite3
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app_v2 import format_response
from core.paths import STUDIO_DIMA_DB_PATH
from core.reminder_db import ensure_reminder_tables

logger = logging.getLogger(__name__)

reminders_v2_bp = Blueprint('reminders_v2', __name__)

@reminders_v2_bp.route('/reminders/settings', methods=['GET'])
@jwt_required()
def get_reminder_settings():
    """Legge le impostazioni correnti dei reminder appuntamenti."""
    from core.automation_config import get_automation_settings
    s = get_automation_settings()
    return format_response({
        'appointment_reminder_24h_enabled': s.get('appointment_reminder_24h_enabled', True),
        'appointment_reminder_2h_enabled': s.get('appointment_reminder_2h_enabled', True),
        'appointment_followup_enabled': s.get('appointment_followup_enabled', True),
        'appointment_followup_hours_before': s.get('appointment_followup_hours_before', 3),
    })


@reminders_v2_bp.route('/reminders/settings', methods=['PUT'])
@jwt_required()
def update_reminder_settings():
    """Aggiorna le impostazioni dei reminder appuntamenti e riprogramma i job."""
    from core.automation_config import get_automation_settings, save_automation_settings
    body = request.get_json() or {}
    try:
        s = get_automation_settings()
        fields = [
            'appointment_reminder_24h_enabled',
            'appointment_reminder_2h_enabled',
            'appointment_followup_enabled',
            'appointment_followup_hours_before',
        ]
        for f in fields:
            if f in body:
                s[f] = body[f]
        save_automation_settings(s)
        # Riprogramma i job con le nuove impostazioni
        from app_v2 import scheduler_service as svc
        if svc:
            svc.schedule_appointment_reminders()
        return format_response({k: s[k] for k in fields if k in s})
    except Exception as e:
        logger.error(f"Errore update reminder settings: {e}")
        return format_response(success=False, error=str(e)), 500


@reminders_v2_bp.route('/reminders/status', methods=['GET'])
@jwt_required()
def get_reminders_status():
    """Stato scheduler reminders + ultime righe di log."""
    log_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), 'automation_reminders.log'
    )
    last_entries = []
    if os.path.exists(log_path):
        try:
            with open(log_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            last_entries = [json.loads(l) for l in lines[-20:] if l.strip()]
        except Exception as e:
            logger.warning(f"Errore lettura log reminder: {e}")

    return format_response({
        'log_entries': list(reversed(last_entries)),
        'log_path': log_path,
    })


@reminders_v2_bp.route('/reminders/trigger-24h', methods=['POST'])
@jwt_required()
def trigger_24h():
    """Trigger manuale reminder 24h. Parametri opzionali: dry_run, patient_id."""
    from services.appointment_reminder_service import run_reminders
    body = request.get_json() or {}
    dry_run = body.get('dry_run', False)
    patient_filter = body.get('patient_id')
    try:
        stats = run_reminders('24h', dry_run=dry_run, patient_filter=patient_filter)
        return format_response(stats)
    except Exception as e:
        logger.error(f"Errore trigger 24h: {e}")
        return format_response(success=False, error=str(e)), 500


@reminders_v2_bp.route('/reminders/trigger-2h', methods=['POST'])
@jwt_required()
def trigger_2h():
    """Trigger manuale reminder 2h. Parametri opzionali: dry_run, patient_id."""
    from services.appointment_reminder_service import run_reminders
    body = request.get_json() or {}
    dry_run = body.get('dry_run', False)
    patient_filter = body.get('patient_id')
    try:
        stats = run_reminders('2h', dry_run=dry_run, patient_filter=patient_filter)
        return format_response(stats)
    except Exception as e:
        logger.error(f"Errore trigger 2h: {e}")
        return format_response(success=False, error=str(e)), 500


@reminders_v2_bp.route('/reminders/communications', methods=['GET'])
@jwt_required()
def get_communications():
    """Lista patient_communications con paginazione."""
    ensure_reminder_tables()
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 20)), 100)
    offset = (page - 1) * per_page

    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM patient_communications")
        total = cur.fetchone()[0]
        cur.execute("""
            SELECT * FROM patient_communications
            ORDER BY created_at DESC LIMIT ? OFFSET ?
        """, (per_page, offset))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return format_response({
            'items': rows,
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page,
        })
    except Exception as e:
        logger.error(f"Errore lettura communications: {e}")
        return format_response(success=False, error=str(e)), 500


@reminders_v2_bp.route('/reminders/trigger-followup', methods=['POST'])
@jwt_required()
def trigger_followup():
    """Trigger manuale follow-up reminder. Parametri opzionali: dry_run, hours_before."""
    from services.appointment_reminder_service import run_followup_reminders
    body = request.get_json() or {}
    dry_run = body.get('dry_run', False)
    hours_before = int(body.get('hours_before', 3))
    try:
        stats = run_followup_reminders(hours_before=hours_before, dry_run=dry_run)
        return format_response(stats)
    except Exception as e:
        logger.error(f"Errore trigger followup: {e}")
        return format_response(success=False, error=str(e)), 500


@reminders_v2_bp.route('/reminders/replies', methods=['GET'])
@jwt_required()
def get_reminder_replies():
    """
    Lista reminder inviati con stato risposta (confermato/cancellato/nessuna risposta).
    Parametri: days (default 7), date (YYYY-MM-DD specifico)
    """
    ensure_reminder_tables()
    days = int(request.args.get('days', 7))
    date_filter = request.args.get('date')

    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        if date_filter:
            where = "WHERE pc.appointment_date = ?"
            params = [date_filter, 100]
        else:
            where = "WHERE pc.created_at >= datetime('now', ? || ' days')"
            params = [f'-{days}', 100]

        cur.execute(f"""
            SELECT
                pc.id,
                pc.patient_name,
                pc.phone,
                pc.channel,
                pc.type AS reminder_type,
                pc.appointment_date,
                pc.appointment_time,
                pc.stato,
                pc.created_at,
                ac.response,
                ac.received_at AS response_at
            FROM patient_communications pc
            LEFT JOIN appointment_confirmations ac ON ac.communication_id = pc.id
            {where}
            ORDER BY pc.appointment_date DESC, pc.appointment_time ASC, pc.created_at DESC
            LIMIT ?
        """, params)

        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return format_response({'items': rows, 'total': len(rows)})
    except Exception as e:
        logger.error(f"Errore lettura reminder replies: {e}")
        return format_response(success=False, error=str(e)), 500


@reminders_v2_bp.route('/reminders/wa-cache', methods=['GET'])
@jwt_required()
def get_wa_cache():
    """Stato cache WhatsApp pazienti."""
    ensure_reminder_tables()
    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT patient_id, phone, has_whatsapp, wa_jid, checked_at
            FROM pazienti_wa_cache ORDER BY checked_at DESC
        """)
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        wa = sum(1 for r in rows if r['has_whatsapp'] == 1)
        no_wa = sum(1 for r in rows if r['has_whatsapp'] == 0)
        return format_response({'items': rows, 'total': len(rows), 'wa': wa, 'no_wa': no_wa})
    except Exception as e:
        logger.error(f"Errore lettura wa_cache: {e}")
        return format_response(success=False, error=str(e)), 500
