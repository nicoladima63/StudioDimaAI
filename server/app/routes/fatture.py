from flask import Blueprint, jsonify
from datetime import datetime
from server.app.core.db_handler import DBHandler

fatture_bp = Blueprint('fatture', __name__)

@fatture_bp.route('/all', methods=['GET'])
def get_all_fatture():
    db = DBHandler()
    fatture = db.leggi_fatture()
    last_update = datetime.now().isoformat(timespec='seconds')
    return jsonify({
        'fatture': fatture,
        'last_update': last_update
    }) 