from flask import Blueprint, request, jsonify
import logging
from typing import Dict

from server.app.services.sms_service import sms_service

logger = logging.getLogger(__name__)

sms_bp = Blueprint('sms', __name__)

@sms_bp.route('/api/sms/send', methods=['POST'])
def send_sms():
    """
    Endpoint per inviare un SMS generico
    
    Body JSON:
    {
        "to_number": "+393331234567",
        "message": "Testo del messaggio",
        "sender": "StudioDima" (opzionale)
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dati richiesti'}), 400
        
        to_number = data.get('to_number')
        message = data.get('message')
        sender = data.get('sender')
        
        if not to_number or not message:
            return jsonify({'error': 'Numero telefono e messaggio richiesti'}), 400
        
        result = sms_service.send_sms(to_number, message, sender)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Errore endpoint send_sms: {e}")
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500

@sms_bp.route('/api/sms/send-recall', methods=['POST'])
def send_recall_sms():
    """
    Endpoint per inviare SMS di richiamo
    
    Body JSON:
    {
        "richiamo_id": "12345" (opzionale, se non fornito usa richiamo_data)
        "richiamo_data": {
            "telefono": "+393331234567",
            "nome_completo": "Mario Rossi",
            "tipo": "1",
            "data1": "2025-07-20",
            ...
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dati richiesti'}), 400
        
        richiamo_data = data.get('richiamo_data')
        richiamo_id = data.get('richiamo_id')
        
        # Se è fornito l'ID, recupera i dati del richiamo dal database
        if richiamo_id and not richiamo_data:
            try:
                from server.app.services.recalls_service import RecallService
                recall_service = RecallService()
                richiamo_data = recall_service.get_recall_by_id(richiamo_id)
                
                if not richiamo_data:
                    return jsonify({'error': 'Richiamo non trovato'}), 404
                    
            except Exception as e:
                logger.error(f"Errore recupero richiamo {richiamo_id}: {e}")
                return jsonify({'error': 'Errore recupero dati richiamo'}), 500
        
        if not richiamo_data:
            return jsonify({'error': 'Dati richiamo richiesti'}), 400
        
        result = sms_service.send_recall_sms(richiamo_data)
        
        if result['success']:
            # Log dell'invio per audit
            logger.info(f"SMS richiamo inviato: {richiamo_data.get('nome_completo', 'N/A')} -> {richiamo_data.get('telefono', 'N/A')}")
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Errore endpoint send_recall_sms: {e}")
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500

@sms_bp.route('/api/sms/send-bulk', methods=['POST'])
def send_bulk_sms():
    """
    Endpoint per inviare SMS in blocco
    
    Body JSON:
    {
        "richiami": [
            {"telefono": "+393331234567", "messaggio": "Testo 1"},
            {"telefono": "+393337654321", "messaggio": "Testo 2"}
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'richiami' not in data:
            return jsonify({'error': 'Lista richiami richiesta'}), 400
        
        richiami = data['richiami']
        
        if not isinstance(richiami, list) or len(richiami) == 0:
            return jsonify({'error': 'Lista richiami deve essere un array non vuoto'}), 400
        
        results = []
        success_count = 0
        error_count = 0
        
        for i, richiamo in enumerate(richiami):
            try:
                if 'messaggio' in richiamo:
                    # SMS generico
                    result = sms_service.send_sms(
                        richiamo.get('telefono'),
                        richiamo.get('messaggio')
                    )
                else:
                    # SMS di richiamo
                    result = sms_service.send_recall_sms(richiamo)
                
                results.append({
                    'index': i,
                    'telefono': richiamo.get('telefono'),
                    'result': result
                })
                
                if result['success']:
                    success_count += 1
                else:
                    error_count += 1
                    
            except Exception as e:
                error_result = {
                    'index': i,
                    'telefono': richiamo.get('telefono'),
                    'result': {
                        'success': False,
                        'error': f'Errore elaborazione: {str(e)}'
                    }
                }
                results.append(error_result)
                error_count += 1
        
        return jsonify({
            'success': True,
            'summary': {
                'total': len(richiami),
                'success': success_count,
                'errors': error_count
            },
            'results': results
        }), 200
        
    except Exception as e:
        logger.error(f"Errore endpoint send_bulk_sms: {e}")
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500

@sms_bp.route('/api/sms/status', methods=['GET'])
def get_sms_service_status():
    """Ottiene lo stato del servizio SMS"""
    try:
        return jsonify({
            'mode': sms_service.get_current_mode(),
            'enabled': sms_service.is_enabled(),
            'sender': sms_service.params.get('SENDER', 'N/A'),
            'api_configured': sms_service.params.get('API_KEY') is not None
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Errore recupero stato: {str(e)}'
        }), 500