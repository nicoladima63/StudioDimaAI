from flask import Blueprint, jsonify, request
from datetime import datetime
from server.app.services.incassi_service import IncassiService

fatture_bp = Blueprint('fatture', __name__, url_prefix='/api/fatture')
service = IncassiService()

@fatture_bp.route('/all', methods=['GET'])
def get_all_fatture():
    fatture = service.get_all_incassi()
    last_update = datetime.now().isoformat(timespec='seconds')
    return jsonify({
        'fatture': fatture,
        'last_update': last_update
    })

@fatture_bp.route('/anni', methods=['GET'])
def get_anni_fatture():
    fatture = service.get_all_incassi()
    anni = set()
    for f in fatture:
        data = f.get('data')
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