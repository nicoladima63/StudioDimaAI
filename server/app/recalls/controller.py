import logging
from flask import Blueprint, request, jsonify
from datetime import datetime
from typing import Dict, Any
import sys
import os
from flask_jwt_extended import jwt_required

# Aggiungi il path per gli import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.recalls.service import RecallService
except ImportError:
    # Fallback per esecuzione diretta
    from recalls.service import RecallService


# Crea il blueprint per i richiami
recalls_bp = Blueprint('recalls', __name__, url_prefix='/api/recalls')
recall_service = RecallService()


@recalls_bp.route('/', methods=['GET'])
@jwt_required()
def get_recalls():
    """
    GET /api/recalls/
    Ottiene tutti i richiami con filtri opzionali
    """
    try:
        # Parametri di query
        days_threshold = request.args.get('days', 90, type=int)
        status = request.args.get('status')  # scaduto, in_scadenza, futuro
        tipo = request.args.get('tipo')  # codice tipo richiamo
        
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
    """
    GET /api/recalls/statistics
    Ottiene statistiche sui richiami
    """
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
    """
    GET /api/recalls/<richiamo_id>/message
    Ottiene il messaggio preparato per un richiamo specifico
    """
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
    """
    POST /api/recalls/update-dates
    Aggiorna le date dei richiami basandosi sull'ultima visita
    """
    try:
        result = recall_service.update_recall_dates()
        
        return jsonify({
            'success': True,
            'data': result,
            'message': f"Aggiornati {result['aggiornati']} richiami su {result['totale_processati']} processati"
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
    """
    GET /api/recalls/export
    Esporta i richiami in formato CSV (per implementazione futura)
    """
    try:
        days_threshold = request.args.get('days', 90, type=int)
        richiami = recall_service.get_all_recalls(days_threshold)
        
        # Per ora restituisce solo i dati, in futuro si può implementare l'export CSV
        return jsonify({
            'success': True,
            'data': richiami,
            'count': len(richiami),
            'export_format': 'json',  # In futuro: 'csv'
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
    """
    GET /api/recalls/test
    Endpoint di test per verificare il funzionamento del servizio
    """
    try:
        # Test base del servizio
        richiami = recall_service.get_all_recalls(30)  # Solo 30 giorni per test
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
        logging.error(f"Errore nel test richiami: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Errore nel test del servizio',
            'message': str(e)
        }), 500 