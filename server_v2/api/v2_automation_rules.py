"""
🔧 API Automazione - Gestione Azioni e Regole di Automazione
==============================================================

API per la gestione dell'engine di automazione, incluse azioni e regole.

Author: Gemini Code Architect
Version: 2.0.2
"""

from flask import Blueprint, request, jsonify
from services.automation_service import get_automation_service
import logging

logger = logging.getLogger(__name__)

# Blueprint senza url_prefix, il prefisso verrà aggiunto direttamente nelle route
automation_bp = Blueprint('automation', __name__)

@automation_bp.route('/automations/actions', methods=['GET'])
def get_actions():
    """Elenco delle azioni disponibili."""
    try:
        automation_service = get_automation_service()
        data = automation_service.list_actions()
        return jsonify({'success': True, 'data': data, 'total': len(data)})
    except Exception as e:
        logger.error(f"Errore API get_actions: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@automation_bp.route('/automations/rules', methods=['GET'])
def get_rules():
    """Recupera tutte le regole di automazione con filtri opzionali."""
    try:
        automation_service = get_automation_service()
        filters = {}
        if request.args.get('attiva') is not None:
            filters['attiva'] = request.args.get('attiva').lower() == 'true'
        if request.args.get('trigger_id'):
            filters['trigger_id'] = request.args.get('trigger_id')
        if request.args.get('monitor_id'):
            filters['monitor_id'] = request.args.get('monitor_id')
    
        rules = automation_service.get_all_rules(filters if filters else None)        
        return jsonify({
            'success': True,
            'data': rules,
            'total': len(rules)
        })
        
    except Exception as e:
        logger.error(f"Errore API get_rules: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@automation_bp.route('/automations/rules/<int:rule_id>', methods=['GET'])
def get_rule(rule_id: int):
    """Recupera una singola regola di automazione."""
    try:
        automation_service = get_automation_service()
        rule = automation_service.get_rule_by_id(rule_id)
        if not rule:
            return jsonify({'success': False, 'error': 'Regola non trovata'}), 404
        return jsonify({'success': True, 'data': rule})
    except Exception as e:
        logger.error(f"Errore API get_rule: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@automation_bp.route('/automations/rules', methods=['POST'])
def create_rule():
    """Crea una nuova regola di automazione."""
    try:
        automation_service = get_automation_service()
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Dati JSON richiesti'}), 400
        
        new_rule = automation_service.create_rule(data)
        
        return jsonify({
            'success': True,
            'data': new_rule,
            'message': 'Regola creata con successo'
        }), 201
        
    except Exception as e:
        logger.error(f"Errore API create_rule: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@automation_bp.route('/automations/rules/<int:rule_id>', methods=['PUT'])
def update_rule(rule_id: int):
    """Aggiorna una regola di automazione esistente."""
    try:
        automation_service = get_automation_service()
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Dati JSON richiesti'}), 400
        
        updated_rule = automation_service.update_rule(rule_id, data)
        
        return jsonify({
            'success': True,
            'data': updated_rule,
            'message': 'Regola aggiornata con successo'
        })
        
    except Exception as e:
        logger.error(f"Errore API update_rule: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@automation_bp.route('/automations/rules/<int:rule_id>', methods=['DELETE'])
def delete_rule(rule_id: int):
    """Elimina una regola di automazione."""
    try:
        automation_service = get_automation_service()
        success = automation_service.delete_rule(rule_id)
        if success:
            return jsonify({'success': True, 'message': 'Regola eliminata con successo'})
        else:
            return jsonify({'success': False, 'error': 'Errore durante l\'eliminazione'}), 500
        
    except Exception as e:
        logger.error(f"Errore API delete_rule: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@automation_bp.route('/automations/rules/<int:rule_id>/toggle', methods=['POST'])
def toggle_rule(rule_id: int):
    """Attiva/disattiva una regola di automazione."""
    try:
        automation_service = get_automation_service()
        rule = automation_service.get_rule_by_id(rule_id)
        if not rule:
            return jsonify({'success': False, 'error': 'Regola non trovata'}), 404
        
        new_status = not bool(rule['attiva'])
        automation_service.update_rule(rule_id, {'attiva': new_status})
        
        return jsonify({
            'success': True,
            'data': {'id': rule_id, 'attiva': new_status},
            'message': f'Regola {"attivata" if new_status else "disattivata"} con successo'
        })
        
    except Exception as e:
        logger.error(f"Errore API toggle_rule: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500