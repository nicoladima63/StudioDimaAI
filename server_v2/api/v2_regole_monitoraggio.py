"""
🔧 API Regole Monitoraggio - Gestione regole di monitoraggio prestazioni
======================================================================

API per gestire le regole di monitoraggio che accoppiano tipi di prestazione
con callback functions per il sistema di monitoraggio.

Author: Claude Code Studio Architect
Version: 1.0.0
"""

from flask import Blueprint, request, jsonify
from services.regole_monitoraggio_service import regole_monitoraggio_service
from core.constants_v2 import CATEGORIE_PRESTAZIONI
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Blueprint per le API regole monitoraggio
regole_monitoraggio_bp = Blueprint('regole_monitoraggio', __name__)

# Le funzioni di validazione sono ora nel servizio

@regole_monitoraggio_bp.route('/callbacks', methods=['GET'])
def get_callbacks():
    """Elenco delle callback disponibili."""
    try:
        data = regole_monitoraggio_service.list_callbacks()
        return jsonify({'success': True, 'data': data, 'total': len(data)})
    except Exception as e:
        logger.error(f"Errore API get_callbacks: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@regole_monitoraggio_bp.route('/regole', methods=['GET'])
def get_regole():
    """Recupera tutte le regole di monitoraggio con filtri opzionali."""
    try:
        # Parametri di filtro
        filters = {}
        if request.args.get('categoria'):
            filters['categoria'] = int(request.args.get('categoria'))
        if request.args.get('attiva') is not None:
            filters['attiva'] = request.args.get('attiva').lower() == 'true'
        if request.args.get('callback_function'):
            filters['callback_function'] = request.args.get('callback_function')
        if request.args.get('tipo_prestazione'):
            filters['tipo_prestazione'] = request.args.get('tipo_prestazione')
        
        # Usa il servizio per recuperare le regole
        regole = regole_monitoraggio_service.get_all_regole(filters if filters else None)
        
        return jsonify({
            'success': True,
            'data': regole,
            'categorie': CATEGORIE_PRESTAZIONI,
            'total': len(regole)
        })
        
    except Exception as e:
        logger.error(f"Errore API get_regole: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@regole_monitoraggio_bp.route('/regole/<int:regola_id>', methods=['GET'])
def get_regola(regola_id: int):
    """Recupera una singola regola di monitoraggio."""
    try:
        regole = regole_monitoraggio_service.get_all_regole()
        regola = next((r for r in regole if r['id'] == regola_id), None)
        
        if not regola:
            return jsonify({
                'success': False,
                'error': 'Regola non trovata'
            }), 404
        
        return jsonify({
            'success': True,
            'data': regola
        })
        
    except Exception as e:
        logger.error(f"Errore API get_regola: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@regole_monitoraggio_bp.route('/regole', methods=['POST'])
def create_regola():
    """Crea una nuova regola di monitoraggio."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Dati JSON richiesti'
            }), 400
        
        # Usa il servizio per creare la regola
        new_regola = regole_monitoraggio_service.create_regola(data)
        
        return jsonify({
            'success': True,
            'data': new_regola,
            'message': 'Regola creata con successo'
        }), 201
        
    except Exception as e:
        logger.error(f"Errore API create_regola: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@regole_monitoraggio_bp.route('/regole/<int:regola_id>', methods=['PUT'])
def update_regola(regola_id: int):
    """Aggiorna una regola di monitoraggio esistente."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Dati JSON richiesti'
            }), 400
        
        # Usa il servizio per aggiornare la regola
        updated_regola = regole_monitoraggio_service.update_regola(regola_id, data)
        
        return jsonify({
            'success': True,
            'data': updated_regola,
            'message': 'Regola aggiornata con successo'
        })
        
    except Exception as e:
        logger.error(f"Errore API update_regola: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@regole_monitoraggio_bp.route('/regole/<int:regola_id>', methods=['DELETE'])
def delete_regola(regola_id: int):
    """Elimina una regola di monitoraggio."""
    try:
        # Usa il servizio per eliminare la regola
        success = regole_monitoraggio_service.delete_regola(regola_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Regola eliminata con successo'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Errore durante l\'eliminazione'
            }), 500
        
    except Exception as e:
        logger.error(f"Errore API delete_regola: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@regole_monitoraggio_bp.route('/regole/<int:regola_id>/toggle', methods=['POST'])
def toggle_regola(regola_id: int):
    """Attiva/disattiva una regola di monitoraggio."""
    try:
        # Recupera regola corrente
        regole = regole_monitoraggio_service.get_all_regole()
        regola = next((r for r in regole if r['id'] == regola_id), None)
        
        if not regola:
            return jsonify({
                'success': False,
                'error': 'Regola non trovata'
            }), 404
        
        new_status = not bool(regola['attiva'])
        
        # Aggiorna stato usando il servizio
        updated_regola = regole_monitoraggio_service.update_regola(regola_id, {'attiva': new_status})
        
        return jsonify({
            'success': True,
            'data': {
                'id': regola_id,
                'attiva': new_status
            },
            'message': f'Regola {"attivata" if new_status else "disattivata"} con successo'
        })
        
    except Exception as e:
        logger.error(f"Errore API toggle_regola: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@regole_monitoraggio_bp.route('/regole/stats', methods=['GET'])
def get_regole_stats():
    """Recupera statistiche sulle regole di monitoraggio."""
    try:
        # Usa il servizio per recuperare le statistiche
        stats = regole_monitoraggio_service.get_statistiche()
        
        return jsonify({
            'success': True,
            'data': stats
        })
        
    except Exception as e:
        logger.error(f"Errore API get_regole_stats: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@regole_monitoraggio_bp.route('/regole/<int:regola_id>/execute', methods=['POST'])
def execute_regola(regola_id: int):
    """Esegue una regola di monitoraggio."""
    try:
        data = request.get_json() or {}
        
        # Usa il servizio per eseguire la regola
        result = regole_monitoraggio_service.execute_regola(regola_id, data)
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Errore API execute_regola: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@regole_monitoraggio_bp.route('/regole/execute-prestazione', methods=['POST'])
def execute_regole_prestazione():
    """Esegue tutte le regole per un tipo di prestazione."""
    try:
        data = request.get_json()
        
        if not data or not data.get('tipo_prestazione_id'):
            return jsonify({
                'success': False,
                'error': 'tipo_prestazione_id richiesto'
            }), 400
        
        # Usa il servizio per eseguire le regole
        results = regole_monitoraggio_service.execute_regole_per_prestazione(
            data['tipo_prestazione_id'], 
            data.get('context_data', {})
        )
        
        return jsonify({
            'success': True,
            'data': {
                'tipo_prestazione_id': data['tipo_prestazione_id'],
                'results': results,
                'total_executed': len(results)
            }
        })
        
    except Exception as e:
        logger.error(f"Errore API execute_regole_prestazione: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
