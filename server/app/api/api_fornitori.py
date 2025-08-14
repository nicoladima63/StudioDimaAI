from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from server.app.core.db_calendar import _get_dbf_path, _leggi_tabella_dbf
from server.app.config.constants import COLONNE, DBF_TABLES
import pandas as pd
import sqlite3
import os
import logging
from server.app.config.config import Config

logger = logging.getLogger(__name__)

api_fornitori = Blueprint('api_fornitori', __name__, url_prefix='/api')

@api_fornitori.route('/fornitori/<fornitore_id>/classificazione', methods=['GET'])
@jwt_required()
def get_classificazione_fornitore(fornitore_id):
    """Recupera la classificazione di un fornitore dalla tabella classificazioni_costi"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT contoid, brancaid, sottocontoid 
            FROM classificazioni_costi 
            WHERE tipo_entita = 'fornitore' AND codice_riferimento = ?
            ORDER BY data_modifica DESC
            LIMIT 1
        ''', (fornitore_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return jsonify({
                'success': True,
                'data': {
                    'contoid': row[0],
                    'brancaid': row[1] if row[1] != 0 else None,
                    'sottocontoid': row[2] if row[2] != 0 else None
                }
            })
        else:
            return jsonify({
                'success': True,
                'data': {
                    'contoid': None,
                    'brancaid': None,
                    'sottocontoid': None
                }
            })
            
    except Exception as e:
        logger.error(f"Errore nel recupero classificazione fornitore {fornitore_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

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


@api_fornitori.route('/fornitori/by-classificazione', methods=['GET'])
@jwt_required()
def get_fornitori_by_classificazione():
    """
    Ottieni fornitori filtrati per classificazione (conto, branca, sottoconto)
    Query params: contoid (required), brancaid (optional), sottocontoid (optional)
    """
    try:
        # Parametri query
        contoid = request.args.get('contoid', type=int)
        brancaid = request.args.get('brancaid', type=int)
        sottocontoid = request.args.get('sottocontoid', type=int)
        
        if not contoid:
            return jsonify({
                "success": False,
                "error": "Parametro 'contoid' obbligatorio"
            }), 400
        
        # Costruisci query dinamica
        db_path = os.path.join(Config.INSTANCE_FOLDER, 'studio_dima.db')
        fornitori_classificati = []
        
        where_conditions = ["contoid = ?", "tipo_entita = 'fornitore'"]
        params = [contoid]
        
        if brancaid:
            where_conditions.append("brancaid = ?")
            params.append(brancaid)
        
        if sottocontoid:
            where_conditions.append("sottocontoid = ?")
            params.append(sottocontoid)
        
        where_clause = " AND ".join(where_conditions)
        
        with sqlite3.connect(db_path) as conn:
            query = f"""
                SELECT DISTINCT 
                    codice_riferimento, 
                    fornitore_nome
                FROM classificazioni_costi 
                WHERE {where_clause}
                ORDER BY fornitore_nome
            """
            
            cursor = conn.execute(query, params)
            for row in cursor.fetchall():
                fornitori_classificati.append({
                    'codice_riferimento': row[0],
                    'fornitore_nome': row[1] or f'Fornitore {row[0]}'
                })
        
        return jsonify({
            "success": True,
            "data": fornitori_classificati,
            "count": len(fornitori_classificati),
            "filters": {
                "contoid": contoid,
                "brancaid": brancaid,
                "sottocontoid": sottocontoid
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500