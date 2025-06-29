import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..recalls import recall_db_service
from ..brevo.sms_service import send_sms_brevo
from datetime import datetime

recall_db_bp = Blueprint('recall_db', __name__, url_prefix='/api/recall-messages')

# --- CRUD messaggi ---
@recall_db_bp.route('/', methods=['GET'])
@jwt_required()
def get_messages():
    tipo = request.args.get('tipo')
    messages = recall_db_service.get_all_messages(tipo)
    return jsonify({'success': True, 'data': messages})

@recall_db_bp.route('/<int:msg_id>', methods=['GET'])
@jwt_required()
def get_message(msg_id):
    msg = recall_db_service.get_message_by_id(msg_id)
    if msg:
        return jsonify({'success': True, 'data': msg})
    else:
        return jsonify({'success': False, 'error': 'Messaggio non trovato'}), 404

@recall_db_bp.route('/', methods=['POST'])
@jwt_required()
def create_message():
    data = request.get_json()
    tipo = data.get('tipo')
    testo = data.get('testo')
    titolo = data.get('titolo')
    attivo = data.get('attivo', 1)
    if not tipo or not testo:
        return jsonify({'success': False, 'error': 'Tipo e testo sono obbligatori'}), 400
    msg_id = recall_db_service.create_message(tipo, testo, titolo, attivo)
    return jsonify({'success': True, 'id': msg_id})

@recall_db_bp.route('/<int:msg_id>', methods=['PUT'])
@jwt_required()
def update_message(msg_id):
    data = request.get_json()
    testo = data.get('testo')
    titolo = data.get('titolo')
    attivo = data.get('attivo')
    recall_db_service.update_message(msg_id, testo, titolo, attivo)
    return jsonify({'success': True})

@recall_db_bp.route('/<int:msg_id>', methods=['DELETE'])
@jwt_required()
def delete_message(msg_id):
    recall_db_service.delete_message(msg_id)
    return jsonify({'success': True})

# --- Lettura storico invii ---
@recall_db_bp.route('/invio', methods=['GET'])
@jwt_required()
def get_invio():
    tipo = request.args.get('tipo')
    id_paziente = request.args.get('id_paziente')
    invii = recall_db_service.get_all_invio(tipo, id_paziente)
    return jsonify({'success': True, 'data': invii})

@recall_db_bp.route('/invio/<int:invio_id>', methods=['GET'])
@jwt_required()
def get_invio_by_id(invio_id):
    invio = recall_db_service.get_invio_by_id(invio_id)
    if invio:
        return jsonify({'success': True, 'data': invio})
    else:
        return jsonify({'success': False, 'error': 'Invio non trovato'}), 404

@recall_db_bp.route('/send-reminder', methods=['POST'])
@jwt_required()
def send_reminder():
    """
    Invia un SMS di promemoria e salva lo storico invio.
    Body JSON: { "id_paziente": ..., "telefono": ..., "testo": ..., "tipo": "promemoria" }
    """
    data = request.get_json()
    id_paziente = data.get('id_paziente')
    telefono = data.get('telefono')
    testo = data.get('testo')
    tipo = data.get('tipo', 'promemoria')
    if not telefono or not testo:
        return jsonify({'success': False, 'error': 'Telefono e testo sono obbligatori'}), 400
    sms_result = send_sms_brevo(telefono, testo)
    stato = 'inviato' if sms_result else 'errore'
    # Salva storico
    recall_db_service.save_invio(tipo, id_paziente, telefono, testo, stato, str(sms_result))
    return jsonify({'success': stato == 'inviato', 'result': str(sms_result)})

@recall_db_bp.route('/test-sms', methods=['POST'])
@jwt_required()
def test_sms():
    """
    Invia un SMS di test a un numero specificato, senza salvare storico.
    Body JSON: { "telefono": ..., "testo": ... }
    """
    data = request.get_json()
    telefono = data.get('telefono')
    testo = data.get('testo', 'Test SMS StudioDimaAI')
    if not telefono:
        return jsonify({'success': False, 'error': 'Telefono obbligatorio'}), 400
    sms_result = send_sms_brevo(telefono, testo)
    return jsonify({'success': bool(sms_result), 'result': str(sms_result)})

def render_message_template(template, richiamo):
    """
    Sostituisce i segnaposto nel template con i dati reali del richiamo.
    """
    mapping = {
        'nomepaziente': richiamo.get('nome_completo', ''),
        'tiporichiamo': richiamo.get('tipo_descrizione', ''),
        'dataappuntamento': richiamo.get('data_richiamo', ''),
    }
    # Sostituzione sicura anche se mancano dati
    for key, value in mapping.items():
        template = template.replace(f'{{{key}}}', str(value))
    return template 