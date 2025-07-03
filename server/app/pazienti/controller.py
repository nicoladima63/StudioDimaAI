from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from ..pazienti.service import PazientiService

pazienti_bp = Blueprint('pazienti', __name__, url_prefix='/api/pazienti')
service = PazientiService()

@pazienti_bp.route('/', methods=['GET'])
@jwt_required()
def get_pazienti():
    pazienti = service.get_all_pazienti()
    return jsonify({'success': True, 'data': pazienti, 'count': len(pazienti)})

@pazienti_bp.route('/statistiche', methods=['GET'])
@jwt_required()
def get_stats():
    try:
        stats = service.get_stats()
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500 


# Endpoint di test senza autenticazione per verificare se il problema è JWT
@pazienti_bp.route('/test', methods=['GET'])
def test_endpoint():
    try:
        logger.info("Test endpoint chiamato")
        return jsonify({'success': True, 'message': 'Endpoint funzionante'})
    except Exception as e:
        logger.error(f"Errore in test_endpoint: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500