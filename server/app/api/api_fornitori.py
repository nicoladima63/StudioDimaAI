from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from server.app.core.db_calendar import _get_dbf_path, _leggi_tabella_dbf
from server.app.config.constants import COLONNE, DBF_TABLES
import pandas as pd

api_fornitori = Blueprint('api_fornitori', __name__, url_prefix='/api')

@api_fornitori.route('/fornitori', methods=['GET'])
@jwt_required()
def get_fornitori():
    try:
        file_path = _get_dbf_path('fornitori')
        df_raw = _leggi_tabella_dbf(file_path)
        
        
        fornitori = []
        for _, record in df_raw.iterrows():
            fornitore_clean = {}
            for key_logico, key_dbf in COLONNE['fornitori'].items():
                value = record.get(key_dbf, '')
                if isinstance(value, bytes):
                    value = value.decode('latin-1', errors='ignore').strip()
                elif isinstance(value, str):
                    value = value.strip()
                elif pd.isna(value) or str(value) == 'nan':
                    value = None  # Converti NaN in None (null in JSON)
                fornitore_clean[key_logico] = value
            
            fornitori.append(fornitore_clean)
        
        return jsonify({
            "success": True,
            "data": fornitori,
            "count": len(fornitori)
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_fornitori.route('/fornitori/<fornitore_id>', methods=['GET'])
@jwt_required()
def get_fornitore_by_id(fornitore_id):
    try:
        file_path = _get_dbf_path('fornitori')
        df_raw = _leggi_tabella_dbf(file_path)
        
        fornitore_trovato = None
        for _, record in df_raw.iterrows():
            db_code = record.get('DB_CODE', '')
            if isinstance(db_code, bytes):
                db_code = db_code.decode('latin-1', errors='ignore').strip()
            elif isinstance(db_code, str):
                db_code = db_code.strip()
            
            if str(db_code) == str(fornitore_id):
                fornitore_clean = {}
                for key_logico, key_dbf in COLONNE['fornitori'].items():
                    value = record.get(key_dbf, '')
                    if isinstance(value, bytes):
                        value = value.decode('latin-1', errors='ignore').strip()
                    elif isinstance(value, str):
                        value = value.strip()
                    elif pd.isna(value) or str(value) == 'nan':
                        value = None
                    fornitore_clean[key_logico] = value
                
                fornitore_trovato = fornitore_clean
                break
        
        if fornitore_trovato:
            return jsonify({
                "success": True,
                "data": fornitore_trovato
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": f"Fornitore con ID {fornitore_id} non trovato"
            }), 404
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500