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

@fatture_bp.route('/anni', methods=['GET'])
def get_anni_fatture():
    db = DBHandler()
    fatture = db.leggi_fatture()
    anni = set()
    for f in fatture:
        data = f.get('data_incasso')
        if data:
            try:
                # Gestione formato stringa 'gg/mm/aaaa'
                if isinstance(data, str) and '/' in data:
                    anno = int(data.split('/')[-1])
                elif hasattr(data, 'year'):
                    anno = data.year
                else:
                    continue
                anni.add(anno)
            except Exception as e:
                print("Errore parsing anno:", e)
                continue
    anni_ordinati = sorted(list(anni))
    return jsonify(anni_ordinati) 