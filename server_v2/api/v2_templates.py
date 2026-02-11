from flask import Blueprint, jsonify, request
from core.template_manager import get_template_manager
from core.exceptions import DatabaseError, ValidationError
import logging

logger = logging.getLogger(__name__)
templates_v2_bp = Blueprint('templates_v2', __name__)

@templates_v2_bp.route('/sms-templates', methods=['GET'])
def get_sms_templates():
    """
    Restituisce tutti i template SMS disponibili.

    Query Params:
        type (optional): Filtra per tipo (promemoria, richiami, social, newsletter, email_team)
        category_id (optional): Filtra per categoria (restituisce template della categoria + generici)

    Example:
        GET /sms-templates?type=social&category_id=3
    """
    try:
        template_manager = get_template_manager()
        template_type = request.args.get('type')  # Filtro opzionale per type
        category_id = request.args.get('category_id', type=int)  # Filtro opzionale per category_id
        templates = template_manager.get_all_templates(template_type=template_type, category_id=category_id)
        return jsonify({'success': True, 'data': templates})
    except Exception as e:
        logger.error(f"Errore API get_sms_templates: {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500

@templates_v2_bp.route('/sms-templates', methods=['POST'])
def create_sms_template():
    """
    Crea un nuovo template SMS.

    Body:
        name: Nome univoco del template (required)
        content: Contenuto con placeholders (required)
        description: Descrizione opzionale
        type: Tipo template (promemoria, richiami, social, newsletter, email_team) - default: 'promemoria'
        category_id: ID categoria associata (opzionale, NULL = template generico)
    """
    data = request.get_json()
    if not data or 'name' not in data or 'content' not in data:
        return jsonify({'success': False, 'message': "Dati 'name' e 'content' richiesti."}), 400

    try:
        template_manager = get_template_manager()
        new_template = template_manager.create_template(
            name=data['name'],
            content=data['content'],
            description=data.get('description'),
            template_type=data.get('type', 'promemoria'),  # Default: 'promemoria'
            category_id=data.get('category_id')  # Opzionale
        )
        return jsonify({'success': True, 'data': new_template}), 201
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 409 # Conflict
    except Exception as e:
        logger.error(f"Errore API create_sms_template: {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500

@templates_v2_bp.route('/sms-templates/<template_name>', methods=['PUT'])
def update_sms_template(template_name):
    """
    Aggiorna un template SMS esistente.

    Body:
        content: Nuovo contenuto (required)
        description: Nuova descrizione (optional)
        type: Nuovo tipo (optional)
        category_id: Nuovo category_id (optional, can be null to remove category)
    """
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'success': False, 'message': "Dato 'content' richiesto."}), 400

    try:
        template_manager = get_template_manager()
        # Se category_id è presente nel body (anche se null), aggiornalo
        update_category = 'category_id' in data
        updated_template = template_manager.update_template(
            name=template_name,
            new_content=data['content'],
            new_description=data.get('description'),
            new_type=data.get('type'),  # Optional: aggiorna type se fornito
            new_category_id=data.get('category_id'),
            update_category=update_category
        )
        return jsonify({'success': True, 'data': updated_template})
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 404 # Not Found
    except Exception as e:
        logger.error(f"Errore API update_sms_template: {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500

@templates_v2_bp.route('/sms-templates/<template_name>', methods=['DELETE'])
def delete_sms_template(template_name):
    """Elimina un template SMS."""
    try:
        template_manager = get_template_manager()
        template_manager.delete_template(template_name)
        return jsonify({'success': True, 'message': f"Template '{template_name}' eliminato con successo."})
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 404 # Not Found or in use
    except Exception as e:
        logger.error(f"Errore API delete_sms_template: {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500

@templates_v2_bp.route('/sms-templates/preview', methods=['POST'])
def preview_sms_template():
    """Genera un'anteprima di un template SMS."""
    data = request.get_json()
    template_name = data.get('name')
    template_id = data.get('id')
    template_content = data.get('custom_content') # Contenuto custom per preview (CORREZIONE)
    preview_data = data.get('preview_data', {}) # Dati per il rendering

    if not (template_name or template_id or template_content):
        return jsonify({'success': False, 'message': "Richiesto 'name', 'id' o 'content' per l'anteprima."}), 400

    try:
        template_manager = get_template_manager()
        if template_content: # Preview di contenuto custom
            result = template_manager.preview_template(name=None, custom_content=template_content, data=preview_data)
        elif template_id:
            result = template_manager.preview_template(id=template_id, data=preview_data)
        else: # template_name
            result = template_manager.preview_template(name=template_name, data=preview_data)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Errore API preview_sms_template: {e}", exc_info=True)
        return jsonify({'success': False, 'message': str(e)}), 500