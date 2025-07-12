from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from datetime import datetime
from server.app.services.incassi_service import IncassiService

fatture_bp = Blueprint('fatture', __name__, url_prefix='/api/fatture')
service = IncassiService()

@fatture_bp.route('/all', methods=['GET'])
@jwt_required()
def get_all_fatture():
    anno = request.args.get('anno', type=int)
    mese = request.args.get('mese', type=int)
    
    fatture = service.get_all_incassi(anno=anno, mese=mese)
    last_update = datetime.now().isoformat(timespec='seconds')
    
    return jsonify({
        'fatture': fatture,
        'last_update': last_update
    })

@fatture_bp.route('/anni', methods=['GET'])
@jwt_required()
def get_anni_fatture():
    """Endpoint ottimizzato per restituire solo gli anni disponibili."""
    try:
        anni = service.get_anni_disponibili()
        return jsonify(anni)
    except Exception as e:
        # Considera un logging più robusto in produzione
        print(f"Errore nel recuperare gli anni delle fatture: {e}")
        return jsonify({"errore": "Impossibile recuperare gli anni"}), 500