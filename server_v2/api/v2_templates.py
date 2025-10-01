import logging
from flask import Blueprint, request, jsonify
from typing import Dict, Any

from core.exceptions import ValidationError
from core.template_manager import get_template_manager

logger = logging.getLogger(__name__)

# Blueprint per le API di gestione template (nome originale v2_templates_bp)
templates_v2_bp = Blueprint('templates_v2', __name__) # Usa il nome originale del blueprint

@templates_v2_bp.route('/templates/sms', methods=['GET'])
def get_all_sms_templates():
    """Recupera tutti i template SMS."""
    try:
        manager = get_template_manager()
        templates = manager.get_all_templates()
        return jsonify({'success': True, 'data': templates})
    except Exception as e:
        logger.error(f"Errore nel recupero di tutti i template SMS: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Errore nel recupero dei template: {str(e)}'}), 500

@templates_v2_bp.route('/templates/sms/<string:name>', methods=['GET'])
def get_sms_template(name: str):
    """Recupera un template SMS specifico per nome."""
    try:
        manager = get_template_manager()
        template = manager.get_template_by_name(name)
        if not template:
            return jsonify({'success': False, 'message': f'Template SMS \'{name}\' non trovato'}), 404
        return jsonify({'success': True, 'data': template})
    except Exception as e:
        logger.error(f"Errore nel recupero del template SMS \'{name}\' : {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Errore nel recupero del template: {str(e)}'}), 500

@templates_v2_bp.route('/templates/sms', methods=['POST'])
def create_sms_template():
    """Crea un nuovo template SMS."""
    try:
        data = request.get_json()
        name = data.get('name')
        content = data.get('content')
        description = data.get('description')

        if not name or not content:
            raise ValidationError('Campi \'name\' e \'content\' sono obbligatori.')

        manager = get_template_manager()
        template = manager.create_template(name, content, description)
        return jsonify({'success': True, 'data': template, 'message': 'Template SMS creato con successo'}), 201
    except ValidationError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except ValueError as e: # Cattura l\'errore se il template esiste già
        return jsonify({'success': False, 'message': str(e)}), 409 # Conflict
    except Exception as e:
        logger.error(f"Errore nella creazione del template SMS: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Errore nella creazione del template: {str(e)}'}), 500

@templates_v2_bp.route('/templates/sms/<string:name>', methods=['PUT'])
def update_sms_template(name: str):
    """Aggiorna un template SMS esistente."""
    try:
        data = request.get_json()
        new_content = data.get('content')
        new_description = data.get('description')

        if not new_content:
            raise ValidationError('Il campo \'content\' è obbligatorio per l\'aggiornamento.')

        manager = get_template_manager()
        template = manager.update_template(name, new_content, new_description)
        return jsonify({'success': True, 'data': template, 'message': 'Template SMS aggiornato con successo'})
    except ValidationError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except ValueError as e: # Cattura l\'errore se il template non esiste
        return jsonify({'success': False, 'message': str(e)}), 404 # Not Found
    except Exception as e:
        logger.error(f"Errore nell\'aggiornamento del template SMS \'{name}\' : {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Errore nell\'aggiornamento del template: {str(e)}'}), 500

@templates_v2_bp.route('/templates/sms/<string:name>', methods=['DELETE'])
def delete_sms_template(name: str):
    """Elimina un template SMS."""
    try:
        manager = get_template_manager()
        manager.delete_template(name)
        return jsonify({'success': True, 'message': f'Template SMS \'{name}\' eliminato con successo'})
    except ValueError as e: # Cattura l\'errore se il template non esiste o è in uso
        return jsonify({'success': False, 'message': str(e)}), 400 # Bad Request (for 'in use') or 404 (not found) 
    except Exception as e:
        logger.error(f"Errore nell\'eliminazione del template SMS \'{name}\' : {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Errore nell\'eliminazione del template: {str(e)}'}), 500

@templates_v2_bp.route('/templates/sms/preview', methods=['POST'])
def preview_sms_template():
    """Genera un'anteprima di un template SMS."""
    try:
        data = request.get_json()
        template_name = data.get('name')
        custom_content = data.get('custom_content')
        preview_data = data.get('preview_data', {})

        if not template_name and not custom_content:
            raise ValidationError('È richiesto il nome del template o il contenuto personalizzato per l\'anteprima.')

        manager = get_template_manager()
        result = manager.preview_template(template_name, preview_data, custom_content)
        
        if result['success']:
            return jsonify({'success': True, 'data': result})
        else:
            return jsonify({'success': False, 'message': result['message']}), 400

    except ValidationError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        logger.error(f"Errore durante la generazione dell'anteprima del template: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Errore interno del server: {str(e)}'}), 500