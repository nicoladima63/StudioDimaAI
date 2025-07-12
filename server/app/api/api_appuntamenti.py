from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from server.app.services.calendar_service import CalendarService
from datetime import date

appuntamenti_bp = Blueprint('appuntamenti', __name__, url_prefix='/api/appuntamenti')

@appuntamenti_bp.route('/statistiche', methods=['GET'])
@jwt_required()
def get_appuntamenti_stats():
    try:
        oggi = date.today()
        mese_corrente = oggi.month
        anno_corrente = oggi.year

        # Mese precedente
        if mese_corrente == 1:
            mese_precedente = 12
            anno_precedente = anno_corrente - 1
        else:
            mese_precedente = mese_corrente - 1
            anno_precedente = anno_corrente

        # Mese prossimo
        if mese_corrente == 12:
            mese_prossimo = 1
            anno_prossimo = anno_corrente + 1
        else:
            mese_prossimo = mese_corrente + 1
            anno_prossimo = anno_corrente

        # Recupera dati
        app_mese_precedente = CalendarService.get_db_appointments_for_month(mese_precedente, anno_precedente)
        app_mese_corrente = CalendarService.get_db_appointments_for_month(mese_corrente, anno_corrente)
        app_mese_prossimo = CalendarService.get_db_appointments_for_month(mese_prossimo, anno_prossimo)

        return jsonify({'success': True, 'data': {
            'mese_precedente': len(app_mese_precedente),
            'mese_corrente': len(app_mese_corrente),
            'mese_prossimo': len(app_mese_prossimo),
        }})
    except Exception as e:
        import traceback
        print(f"ERRORE IN get_appuntamenti_stats: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@appuntamenti_bp.route('/prime-visite', methods=['GET'])
@jwt_required()
def get_prime_visite_stats():
    try:
        oggi = date.today()
        # TODO: Implementare una logica specifica per le "prime visite"
        appuntamenti_mese_corrente = CalendarService.get_db_appointments_for_month(oggi.month, oggi.year)
        
        # Placeholder: per ora conta tutte le visite del mese
        count_nuove_visite = len(appuntamenti_mese_corrente)

        return jsonify({'success': True, 'data': {'nuove_visite': count_nuove_visite}}), 200
    except Exception as e:
        import traceback
        print(f"ERRORE IN get_prime_visite_stats: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500