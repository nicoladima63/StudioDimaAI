from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from server.app.services.calendar_service import CalendarService
from datetime import date, datetime
import logging

logger = logging.getLogger(__name__)

kpi_bp = Blueprint('kpi', __name__, url_prefix='/api/kpi')

@kpi_bp.route('/statistiche', methods=['GET'])
@jwt_required()
def get_stats():
    try:
        oggi = date.today()
        mese_corrente = oggi.month
        anno_corrente = oggi.year
        # Calcola mese e anno precedente
        if mese_corrente == 1:
            mese_precedente = 12
            anno_precedente = anno_corrente - 1
        else:
            mese_precedente = mese_corrente - 1
            anno_precedente = anno_corrente
        # Calcola mese e anno prossimo
        if mese_corrente == 12:
            mese_prossimo = 1
            anno_prossimo = anno_corrente + 1
        else:
            mese_prossimo = mese_corrente + 1
            anno_prossimo = anno_corrente
        # Qui dovresti recuperare gli appuntamenti tramite una funzione centralizzata (es. da db_utils)
        # e passarli a CalendarService se serve.
        # Per ora lasciamo la struttura come placeholder.
        return jsonify({'success': True, 'data': {
            'mese_precedente': 0,
            'mese_corrente': 0,
            'mese_prossimo': 0,
            'percentuale_corrente': 0,
            'percentuale_prossimo': 0
        }})
    except Exception as e:
        logger.error("Errore in get_stats", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@kpi_bp.route('/prime-visite', methods=['GET'])
@jwt_required()
def get_prime_visite():
    return jsonify({'success': True, 'data': {'nuove_visite': 0}}), 200

@kpi_bp.route('/totale-fino-a', methods=['GET'])
@jwt_required()
def totale_fino_a():
    anno = int(request.args.get('anno'))
    giorno_str = request.args.get('giorno')
    giorno = datetime.strptime(giorno_str, '%Y-%m-%d').date()
    # Qui va la logica aggiornata per il conteggio appuntamenti, usando funzioni centralizzate
    return jsonify({'success': True, 'data': {'anno': anno, 'fino_a': giorno_str, 'totale': 0}}) 