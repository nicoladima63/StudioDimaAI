from flask import Blueprint, jsonify, request
from datetime import datetime
from flask_jwt_extended import jwt_required
from server.app.services.incassi_service import IncassiService

incassi_bp = Blueprint('incassi', __name__, url_prefix='/api/incassi')
service = IncassiService()

@incassi_bp.route('/get', methods=['GET'])
@jwt_required()
def get_incassi():
    incassi = service.get_all_incassi()
    return jsonify({'success': True, 'data': incassi, 'count': len(incassi)})

@incassi_bp.route('/all', methods=['GET'])
@jwt_required()
def get_all_incassi():
    incassi = service.get_all_incassi()
    last_update = datetime.now().isoformat(timespec='seconds')
    return jsonify({
        'incassi': incassi,
        'last_update': last_update
    })

@incassi_bp.route('/trend', methods=['GET'])
@jwt_required()
def get_trend():
    try:
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        data = service.get_incassi_trend(date_from, date_to)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@incassi_bp.route('/by_date', methods=['GET'])
@jwt_required()
def get_incassi_by_date():
    try:
        anno = request.args.get('anno')
        mese = request.args.get('mese')
        if anno is None:
            return jsonify({'success': False, 'error': 'Missing year parameter'}), 400
        data = service.get_incassi_by_date(anno, mese)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@incassi_bp.route('/by_periodo', methods=['GET'])
@jwt_required()
def get_incassi_by_periodo():
    try:
        anno = request.args.get('anno')
        tipo = request.args.get('tipo')
        numero = request.args.get('numero')
        if not (anno and tipo and numero):
            return jsonify({'success': False, 'error': 'Missing parameters'}), 400
        data = service.get_incassi_by_periodo(anno, tipo, numero)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500 