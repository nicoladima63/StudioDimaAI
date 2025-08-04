from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from datetime import datetime
from server.app.services.incassi_service import IncassiService
from dbfread import DBF
from server.app.core.db_utils import get_dbf_path
from server.app.config.constants import COLONNE
import logging

logger = logging.getLogger(__name__)

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
        logger.error(f"Errore nel recuperare gli anni delle fatture: {e}", exc_info=True)
        return jsonify({"errore": "Impossibile recuperare gli anni"}), 500

@fatture_bp.route('/raw', methods=['GET'])
@jwt_required()
def get_fatture_raw():
    """
    Endpoint per dati raw delle fatture filtrati per anni.
    Query params:
    - anni: lista anni separati da virgola (es: 2022,2023,2024)
    """
    try:
        # Parse anni parameter
        anni_param = request.args.get('anni', '')
        if not anni_param:
            return jsonify({
                'success': False,
                'error': 'Parametro anni richiesto (es: 2022,2023,2024)'
            }), 400
        
        try:
            anni = [int(anno.strip()) for anno in anni_param.split(',')]
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Formato anni non valido. Usare: 2022,2023,2024'
            }), 400
        
        # Helper functions
        def safe_float(val, default=0.0):
            if val is None:
                return default
            try:
                return float(val)
            except (ValueError, TypeError):
                return default
        
        def safe_str(val, default=''):
            if val is None:
                return default
            return str(val).strip()
        
        def parse_date(date_str):
            if not date_str:
                return None
            try:
                return datetime.strptime(str(date_str)[:10], '%Y-%m-%d').date()
            except:
                return None
        
        # Read DBF
        path_fatture = get_dbf_path('fatture')
        col_map = COLONNE['fatture']
        
        fatture_data = []
        for record in DBF(path_fatture, encoding='latin-1'):
            data_fattura = parse_date(record.get(col_map['fatturadata']))
            if not data_fattura or data_fattura.year not in anni:
                continue
                
            importo = safe_float(record.get(col_map['fatturaimporto']))
            
            fatture_data.append({
                'paziente_id': safe_str(record.get(col_map['fatturapazienteid'])),
                'data': data_fattura.isoformat(),
                'importo': importo,
                'anno': data_fattura.year,
                'mese': data_fattura.month
            })
        
        return jsonify({
            'success': True,
            'data': fatture_data,
            'metadata': {
                'count': len(fatture_data),
                'anni_richiesti': anni,
                'anni_trovati': list(set(f['anno'] for f in fatture_data))
            }
        })
        
    except Exception as e:
        logger.error(f"Errore endpoint fatture raw: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500