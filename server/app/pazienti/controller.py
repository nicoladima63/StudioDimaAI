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
    stats = service.get_stats()
    return jsonify({'success': True, 'data': stats}) 