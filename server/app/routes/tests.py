# analytics/app/routes/tests.py

from flask import Blueprint, jsonify, request
from flask_cors import cross_origin  # <-- aggiungi questa
from ..auth.utils import token_required

tests_bp = Blueprint("tests", __name__)

@tests_bp.route('/ping', methods=['GET', 'OPTIONS'])
@cross_origin(origin='http://localhost:5173') 
def ping():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True}), 200
    return jsonify({'message': 'pong'})
