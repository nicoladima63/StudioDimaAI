import logging
from flask import Blueprint, request, jsonify
from datetime import datetime
from flask_jwt_extended import jwt_required
from server.app.services.recalls_service import RecallService
from server.app.brevo.sms_service import send_sms_brevo

recalls_bp = Blueprint('recalls', __name__, url_prefix='/api/recalls')
recall_service = RecallService()

@recalls_bp.route('/', methods=['GET'])
@jwt_required()
def get_recalls():
    try:
        days_threshold = request.args.get('days', 90, type=int)
        status = request.args.get('status')
        tipo = request.args.get('tipo')
        if status:
            richiami = recall_service.get_recalls_by_status(status, days_threshold)
        elif tipo:
            richiami = recall_service.get_recalls_by_type(tipo, days_threshold)
        else:
            richiami = recall_service.get_all_recalls(days_threshold)
        return jsonify({
            'success': True,
            'data': richiami,
            'count': len(richiami),
            'filters': {
                'days_threshold': days_threshold,
                'status': status,
                'tipo': tipo
            }
        }), 200
    except Exception as e:
        logging.error(f"Errore nel recupero richiami: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nel recupero dei richiami',
            'message': str(e)
        }), 500

@recalls_bp.route('/statistics', methods=['GET'])
@jwt_required()
def get_recall_statistics():
    try:
        days_threshold = request.args.get('days', 90, type=int)
        stats = recall_service.get_recall_statistics(days_threshold)
        return jsonify({
            'success': True,
            'data': stats,
            'filters': {
                'days_threshold': days_threshold
            }
        }), 200
    except Exception as e:
        logging.error(f"Errore nel recupero statistiche: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nel recupero delle statistiche',
            'message': str(e)
        }), 500

@recalls_bp.route('/<richiamo_id>/message', methods=['GET'])
@jwt_required()
def get_recall_message(richiamo_id: str):
    try:
        message_data = recall_service.prepare_recall_message(richiamo_id)
        if not message_data:
            return jsonify({
                'success': False,
                'error': 'Richiamo non trovato'
            }), 404
        return jsonify({
            'success': True,
            'data': message_data
        }), 200
    except Exception as e:
        logging.error(f"Errore nel recupero messaggio richiamo: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nel recupero del messaggio',
            'message': str(e)
        }), 500

@recalls_bp.route('/update-dates', methods=['POST'])
@jwt_required()
def update_recall_dates():
    try:
        result = recall_service.update_recall_dates()
        return jsonify({
            'success': True,
            'data': result,
            'message': f"Aggiornati {result.get('aggiornati', 0)} richiami"
        }), 200
    except Exception as e:
        logging.error(f"Errore nell'aggiornamento date richiami: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nell\'aggiornamento delle date',
            'message': str(e)
        }), 500

@recalls_bp.route('/export', methods=['GET'])
@jwt_required()
def export_recalls():
    try:
        days_threshold = request.args.get('days', 90, type=int)
        richiami = recall_service.get_all_recalls(days_threshold)
        return jsonify({
            'success': True,
            'data': richiami,
            'count': len(richiami),
            'export_format': 'json',
            'filters': {
                'days_threshold': days_threshold
            }
        }), 200
    except Exception as e:
        logging.error(f"Errore nell'export richiami: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nell\'export dei richiami',
            'message': str(e)
        }), 500

@recalls_bp.route('/test', methods=['GET'])
@jwt_required()
def test_recalls():
    try:
        richiami = recall_service.get_all_recalls(30)
        stats = recall_service.get_recall_statistics(30)
        return jsonify({
            'success': True,
            'test_results': {
                'richiami_trovati': len(richiami),
                'statistiche': stats,
                'service_status': 'OK'
            },
            'message': 'Test completato con successo'
        }), 200
    except Exception as e:
        logging.error(f"Errore in test_recalls: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500 