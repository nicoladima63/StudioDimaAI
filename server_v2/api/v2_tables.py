"""
📋 API per la gestione delle Tabelle Configurabili
================================================

Endpoint per esporre le configurazioni delle tabelle definite centralmente.

Author: Gemini Code Assistant
Version: 1.0.0
"""

import logging
from flask import Blueprint, jsonify
from core.constants_v2 import DBF_TABLES

logger = logging.getLogger(__name__)

# Blueprint per le API delle tabelle
tables_bp = Blueprint('tables', __name__)

@tables_bp.route('/monitorable-tables', methods=['GET'])
def get_monitorable_tables():
    """
    Restituisce la lista delle tabelle DBF che possono essere monitorate.
    I dati sono presi direttamente da `core.constants_v2.DBF_TABLES`.
    """
    try:
        # Trasforma il dizionario in una lista di oggetti
        formatted_tables = [
            {
                "name": table_name,
                "description": table_info.get("descrizione", f"Tabella {table_name}")
            }
            for table_name, table_info in DBF_TABLES.items()
        ]
        
        return jsonify({
            'success': True,
            'data': formatted_tables
        })
        
    except Exception as e:
        logger.error(f"Errore nel recupero delle tabelle monitorabili: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore interno del server: {str(e)}'
        }), 500
