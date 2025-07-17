from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import logging
from server.app.services.pazienti_service import PazientiService

logger = logging.getLogger(__name__)
pazienti_bp = Blueprint('pazienti', __name__, url_prefix='/api/pazienti')
service = PazientiService()

@pazienti_bp.route('/', methods=['GET'])
@jwt_required()
def get_pazienti():
    """
    Endpoint principale per pazienti
    Query params:
    - view: 'all' (default), 'recalls', 'cities'
    - priority: 'high', 'medium', 'low' (solo per view=recalls)
    - status: 'scaduto', 'in_scadenza', 'futuro' (solo per view=recalls)
    """
    try:
        view = request.args.get('view', 'all')
        priority = request.args.get('priority')
        status = request.args.get('status')
        
        if view == 'recalls':
            data = service.get_recalls_data(priority=priority, status=status)
            message = f"Richiami"
            if priority:
                message += f" priorità {priority}"
            if status:
                message += f" stato {status}"
        elif view == 'cities':
            data = service.get_cities_data()
            message = "Dati per città"
        else:
            data = service.get_pazienti_all()
            message = "Tutti i pazienti"
        
        return jsonify({
            'success': True,
            'data': data,
            'count': len(data),
            'view': view,
            'filters': {
                'priority': priority,
                'status': status
            },
            'message': message
        }), 200
        
    except Exception as e:
        logger.error(f"Errore in get_pazienti: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nel recupero dei pazienti',
            'message': str(e)
        }), 500

@pazienti_bp.route('/statistics', methods=['GET'])
@jwt_required()
def get_statistics():
    """Endpoint per statistiche complete"""
    try:
        stats = service.get_pazienti_statistics()
        return jsonify({
            'success': True,
            'data': stats,
            'message': 'Statistiche calcolate con successo'
        }), 200
        
    except Exception as e:
        logger.error(f"Errore in get_statistics: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nel calcolo delle statistiche',
            'message': str(e)
        }), 500

@pazienti_bp.route('/recalls', methods=['GET'])
@jwt_required()
def get_recalls():
    """
    Endpoint dedicato ai richiami
    Query params:
    - priority: 'high', 'medium', 'low'
    - status: 'scaduto', 'in_scadenza', 'futuro'
    """
    try:
        priority = request.args.get('priority')
        status = request.args.get('status')
        recalls = service.get_recalls_data(priority=priority, status=status)
        
        message = "Richiami"
        if priority:
            message += f" priorità {priority}"
        if status:
            message += f" stato {status}"
        
        return jsonify({
            'success': True,
            'data': recalls,
            'count': len(recalls),
            'filters': {
                'priority': priority,
                'status': status
            },
            'message': message
        }), 200
        
    except Exception as e:
        logger.error(f"Errore in get_recalls: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nel recupero dei richiami',
            'message': str(e)
        }), 500

@pazienti_bp.route('/cities', methods=['GET'])
@jwt_required()
def get_cities():
    """Endpoint per dati geografici"""
    try:
        cities = service.get_cities_data()
        
        return jsonify({
            'success': True,
            'data': cities,
            'count': len(cities),
            'message': 'Dati città recuperati con successo'
        }), 200
        
    except Exception as e:
        logger.error(f"Errore in get_cities: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nel recupero dati città',
            'message': str(e)
        }), 500

@pazienti_bp.route('/recalls/<paziente_id>/message', methods=['GET'])
@jwt_required()
def get_recall_message(paziente_id: str):
    """Genera messaggio per richiamo specifico"""
    try:
        message_data = service.prepare_recall_message(paziente_id)
        if not message_data:
            return jsonify({
                'success': False,
                'error': 'Paziente non trovato o non necessita richiamo'
            }), 404
            
        return jsonify({
            'success': True,
            'data': message_data,
            'message': 'Messaggio richiamo generato'
        }), 200
        
    except Exception as e:
        logger.error(f"Errore in get_recall_message: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nella generazione del messaggio',
            'message': str(e)
        }), 500

@pazienti_bp.route('/export', methods=['GET'])
@jwt_required()
def export_pazienti():
    """
    Endpoint per export
    Query params:
    - view: 'all', 'recalls', 'cities'
    - priority: 'high', 'medium', 'low' (solo per view=recalls)
    - status: 'scaduto', 'in_scadenza', 'futuro' (solo per view=recalls)
    - format: 'json' (default)
    """
    try:
        view = request.args.get('view', 'all')
        priority = request.args.get('priority')
        status = request.args.get('status')
        format_type = request.args.get('format', 'json')
        
        if view == 'recalls':
            data = service.get_recalls_data(priority=priority, status=status)
        elif view == 'cities':
            data = service.get_cities_data()
        else:
            data = service.get_pazienti_all()
        
        return jsonify({
            'success': True,
            'data': data,
            'count': len(data),
            'export_format': format_type,
            'view': view,
            'filters': {
                'priority': priority,
                'status': status
            },
            'exported_at': service.get_pazienti_statistics()['aggiornato_il']
        }), 200
        
    except Exception as e:
        logger.error(f"Errore in export_pazienti: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nell\'export',
            'message': str(e)
        }), 500

@pazienti_bp.route('/test', methods=['GET'])
def test_endpoint():
    """Endpoint di test senza autenticazione"""
    try:
        # Test rapido conteggio
        pazienti = service.get_pazienti_all()
        stats = service.get_pazienti_statistics()
        
        return jsonify({
            'success': True,
            'data': {
                'pazienti_count': len(pazienti),
                'richiami_count': stats['richiami']['totale_da_richiamare'],
                'service_status': 'OK'
            },
            'message': 'Test endpoint funzionante'
        }), 200
        
    except Exception as e:
        logger.error(f"Errore in test_endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nel test',
            'message': str(e)
        }), 500

# Endpoint legacy per backward compatibility
@pazienti_bp.route('/legacy/list', methods=['GET'])
@jwt_required()
def get_pazienti_legacy():
    """Endpoint legacy - get_all_pazienti"""
    try:
        data = service.get_all_pazienti()
        return jsonify({
            'success': True,
            'data': data,
            'count': len(data)
        }), 200
    except Exception as e:
        logger.error(f"Errore in get_pazienti_legacy: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@pazienti_bp.route('/legacy/stats', methods=['GET'])
@jwt_required()
def get_stats_legacy():
    """Endpoint legacy - get_stats"""
    try:
        stats = service.get_stats()
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        logger.error(f"Errore in get_stats_legacy: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500