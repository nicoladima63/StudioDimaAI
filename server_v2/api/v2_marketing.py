"""
Marketing API: CRUD template WhatsApp e broadcast verso segmenti pazienti.
Ogni messaggio inviato viene tracciato in patient_communications.
"""
import logging
import os
import requests
from datetime import datetime

from flask import Blueprint, request, g
from flask_jwt_extended import jwt_required

from app_v2 import format_response

logger = logging.getLogger(__name__)

marketing_bp = Blueprint('marketing', __name__)

EVOLUTION_BASE_URL = os.getenv('EVOLUTION_BASE_URL', 'http://127.0.0.1:8080')
EVOLUTION_INSTANCE = os.getenv('EVOLUTION_INSTANCE', 'studio-instance')

_TABLES_READY = False


def _evo_headers() -> dict:
    return {'apikey': os.getenv('EVOLUTION_API_KEY', ''), 'Content-Type': 'application/json'}


def _normalize_phone(phone: str) -> str:
    p = ''.join(c for c in (phone or '') if c.isdigit())
    if p.startswith('0039'):
        p = p[4:]
    elif p.startswith('39') and len(p) > 10:
        p = p[2:]
    if not p.startswith('39'):
        p = '39' + p
    return p


def _ensure_tables():
    global _TABLES_READY
    if _TABLES_READY:
        return
    g.database_manager.execute_query("""
        CREATE TABLE IF NOT EXISTS marketing_templates (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            nome       TEXT NOT NULL,
            testo      TEXT NOT NULL,
            note       TEXT DEFAULT '',
            canale     TEXT DEFAULT 'whatsapp',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    _TABLES_READY = True


# ── Templates CRUD ────────────────────────────────────────────────────────

@marketing_bp.route('/marketing/templates', methods=['GET'])
@jwt_required()
def get_templates():
    _ensure_tables()
    rows = g.database_manager.execute_query(
        'SELECT * FROM marketing_templates ORDER BY nome',
        fetch_all=True
    )
    return format_response({'templates': rows or [], 'count': len(rows or [])})


@marketing_bp.route('/marketing/templates', methods=['POST'])
@jwt_required()
def create_template():
    _ensure_tables()
    data = request.get_json() or {}
    nome  = (data.get('nome') or '').strip()
    testo = (data.get('testo') or '').strip()
    if not nome or not testo:
        return format_response(success=False, error='nome e testo obbligatori'), 400
    g.database_manager.execute_query(
        'INSERT INTO marketing_templates (nome, testo, note, canale) VALUES (?, ?, ?, ?)',
        (nome, testo, data.get('note', ''), data.get('canale', 'whatsapp'))
    )
    return format_response(message='Template creato'), 201


@marketing_bp.route('/marketing/templates/<int:tid>', methods=['PUT'])
@jwt_required()
def update_template(tid):
    _ensure_tables()
    data = request.get_json() or {}
    nome  = (data.get('nome') or '').strip()
    testo = (data.get('testo') or '').strip()
    if not nome or not testo:
        return format_response(success=False, error='nome e testo obbligatori'), 400
    g.database_manager.execute_query(
        """UPDATE marketing_templates
           SET nome=?, testo=?, note=?, canale=?, updated_at=?
           WHERE id=?""",
        (nome, testo, data.get('note', ''), data.get('canale', 'whatsapp'),
         datetime.now().isoformat(), tid)
    )
    return format_response(message='Template aggiornato')


@marketing_bp.route('/marketing/templates/<int:tid>', methods=['DELETE'])
@jwt_required()
def delete_template(tid):
    _ensure_tables()
    g.database_manager.execute_query(
        'DELETE FROM marketing_templates WHERE id=?', (tid,)
    )
    return format_response(message='Template eliminato')


# ── Broadcast ─────────────────────────────────────────────────────────────

@marketing_bp.route('/marketing/broadcast', methods=['POST'])
@jwt_required()
def broadcast():
    """
    Invia un messaggio WhatsApp a una lista di pazienti e traccia ogni invio.

    Body JSON:
        pazienti : [{id, nome, cellulare}, ...]
        testo    : testo del messaggio (variabile supportata: {nome})
    """
    _ensure_tables()
    data            = request.get_json() or {}
    pazienti        = data.get('pazienti', [])
    testo_template  = (data.get('testo') or '').strip()

    if not pazienti:
        return format_response(success=False, error='Nessun paziente selezionato'), 400
    if not testo_template:
        return format_response(success=False, error='Testo messaggio obbligatorio'), 400

    sent, failed, errors = 0, 0, []
    now = datetime.now().isoformat()

    for paz in pazienti:
        phone = (paz.get('cellulare') or '').strip()
        nome  = (paz.get('nome') or '').strip()
        pid   = (paz.get('id') or '').strip()

        if not phone:
            failed += 1
            continue

        first_name = nome.split()[0] if nome else 'paziente'
        text       = testo_template.replace('{nome}', first_name)
        phone_norm = _normalize_phone(phone)
        stato      = 'failed'
        msg_id     = ''

        try:
            r = requests.post(
                f'{EVOLUTION_BASE_URL}/message/sendText/{EVOLUTION_INSTANCE}',
                headers=_evo_headers(),
                json={'number': phone_norm, 'text': text},
                timeout=10,
            )
            if r.status_code in (200, 201):
                stato  = 'sent'
                msg_id = r.json().get('key', {}).get('id', '')
                sent  += 1
            else:
                failed += 1
                errors.append(f'{nome}: HTTP {r.status_code}')
        except Exception as e:
            failed += 1
            errors.append(f'{nome}: {e}')

        try:
            g.database_manager.execute_query(
                """INSERT INTO patient_communications
                   (patient_id, patient_name, phone, channel, type, stato, message_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (pid, nome, phone, 'whatsapp', 'marketing', stato, msg_id, now)
            )
        except Exception as log_err:
            logger.error(f'Log comunicazione {pid}: {log_err}')

    return format_response({
        'sent':   sent,
        'failed': failed,
        'total':  len(pazienti),
        'errors': errors[:10],
    })
