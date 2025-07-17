# server/app/api/api_templates.py

from flask import Blueprint, request, jsonify
import logging
from typing import Dict

from server.app.core.template_manager import template_manager

logger = logging.getLogger(__name__)

templates_bp = Blueprint('templates', __name__)

@templates_bp.route('/api/sms/templates', methods=['GET'])
def get_all_templates():
    """
    Ottiene tutti i template SMS
    
    Returns:
        JSON con tutti i template disponibili
    """
    try:
        templates = template_manager.get_all_templates()
        
        return jsonify({
            'success': True,
            'templates': templates
        })
        
    except Exception as e:
        logger.error(f"Errore recupero template: {e}")
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500

@templates_bp.route('/api/sms/templates/<tipo>', methods=['GET'])
def get_template(tipo: str):
    """
    Ottiene un template specifico
    
    Args:
        tipo: 'richiamo' o 'promemoria'
        
    Returns:
        JSON con il template richiesto
    """
    try:
        if tipo not in ['richiamo', 'promemoria']:
            return jsonify({
                'success': False,
                'error': 'Tipo template non valido. Usa: richiamo, promemoria'
            }), 400
        
        template = template_manager.get_template(tipo)
        
        if not template:
            return jsonify({
                'success': False,
                'error': f'Template {tipo} non trovato'
            }), 404
        
        return jsonify({
            'success': True,
            'template': template
        })
        
    except Exception as e:
        logger.error(f"Errore recupero template {tipo}: {e}")
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500

@templates_bp.route('/api/sms/templates/<tipo>', methods=['PUT'])
def update_template(tipo: str):
    """
    Aggiorna un template
    
    Args:
        tipo: Tipo di template da aggiornare
        
    Body JSON:
    {
        "content": "Nuovo contenuto del template",
        "description": "Nuova descrizione (opzionale)"
    }
    """
    try:
        if tipo not in ['richiamo', 'promemoria']:
            return jsonify({
                'success': False,
                'error': 'Tipo template non valido. Usa: richiamo, promemoria'
            }), 400
        
        data = request.get_json()
        
        if not data or 'content' not in data:
            return jsonify({
                'success': False,
                'error': 'Campo "content" richiesto'
            }), 400
        
        content = data['content']
        description = data.get('description')
        
        # Valida il template
        validation = template_manager.validate_template(content)
        
        if not validation['valid']:
            return jsonify({
                'success': False,
                'error': 'Template non valido',
                'validation_errors': validation['errors']
            }), 400
        
        # Aggiorna il template
        success = template_manager.update_template(tipo, content, description)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'Errore aggiornamento template'
            }), 500
        
        # Ritorna il template aggiornato
        updated_template = template_manager.get_template(tipo)
        
        return jsonify({
            'success': True,
            'message': f'Template {tipo} aggiornato con successo',
            'template': updated_template,
            'validation': validation
        })
        
    except Exception as e:
        logger.error(f"Errore aggiornamento template {tipo}: {e}")
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500

@templates_bp.route('/api/sms/templates/<tipo>/reset', methods=['POST'])
def reset_template(tipo: str):
    """
    Resetta un template ai valori di default
    
    Args:
        tipo: Tipo di template da resettare
    """
    try:
        if tipo not in ['richiamo', 'promemoria']:
            return jsonify({
                'success': False,
                'error': 'Tipo template non valido. Usa: richiamo, promemoria'
            }), 400
        
        success = template_manager.reset_template(tipo)
        
        if not success:
            return jsonify({
                'success': False,
                'error': f'Errore reset template {tipo}'
            }), 500
        
        # Ritorna il template resettato
        reset_template = template_manager.get_template(tipo)
        
        return jsonify({
            'success': True,
            'message': f'Template {tipo} resettato ai valori di default',
            'template': reset_template
        })
        
    except Exception as e:
        logger.error(f"Errore reset template {tipo}: {e}")
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500

@templates_bp.route('/api/sms/templates/<tipo>/preview', methods=['POST'])
def preview_template(tipo: str):
    """
    Anteprima di un template con dati di esempio
    
    Args:
        tipo: Tipo di template
        
    Body JSON:
    {
        "content": "Template da renderizzare (opzionale, usa quello salvato se non fornito)",
        "data": {
            "nome_completo": "Mario Rossi",
            "data_richiamo": "15/08/2025",
            ...
        }
    }
    """
    try:
        if tipo not in ['richiamo', 'promemoria']:
            return jsonify({
                'success': False,
                'error': 'Tipo template non valido. Usa: richiamo, promemoria'
            }), 400
        
        request_data = request.get_json()
        
        # Usa il template fornito o quello salvato
        if request_data and 'content' in request_data:
            content = request_data['content']
            # Crea un template temporaneo per il rendering
            temp_template = {
                'content': content,
                'variables': template_manager._extract_variables(content)
            }
        else:
            temp_template = template_manager.get_template(tipo)
            if not temp_template:
                return jsonify({
                    'success': False,
                    'error': f'Template {tipo} non trovato'
                }), 404
            content = temp_template['content']
        
        # Dati di esempio per il preview
        sample_data = {
            'richiamo': {
                'nome_completo': 'Mario Rossi',
                'tipo_richiamo': 'Controllo periodico',
                'data_richiamo': '15/08/2025'
            },
            'promemoria': {
                'nome_completo': 'Lucia Bianchi',
                'data_appuntamento': '20/07/2025',
                'ora_appuntamento': '10:30',
                'tipo_appuntamento': 'Visita di controllo',
                'medico': 'Dr. Rossi'
            }
        }
        
        # Usa i dati forniti o quelli di esempio
        preview_data = request_data.get('data', {}) if request_data else {}
        final_data = {**sample_data.get(tipo, {}), **preview_data}
        
        # Renderizza il template
        rendered = template_manager.render_template(tipo, final_data) if request_data and 'content' not in request_data else content
        
        # Se abbiamo un content custom, fai il rendering manuale
        if request_data and 'content' in request_data:
            for var, value in final_data.items():
                placeholder = f"{{{var}}}"
                rendered = rendered.replace(placeholder, str(value))
        
        # Valida il template
        validation = template_manager.validate_template(content)
        
        return jsonify({
            'success': True,
            'preview': rendered,
            'sample_data': final_data,
            'validation': validation,
            'stats': {
                'length': len(rendered),
                'estimated_sms_parts': (len(rendered) // 160) + 1
            }
        })
        
    except Exception as e:
        logger.error(f"Errore preview template {tipo}: {e}")
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500

@templates_bp.route('/api/sms/templates/validate', methods=['POST'])
def validate_template():
    """
    Valida un template senza salvarlo
    
    Body JSON:
    {
        "content": "Template da validare"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'content' not in data:
            return jsonify({
                'success': False,
                'error': 'Campo "content" richiesto'
            }), 400
        
        content = data['content']
        validation = template_manager.validate_template(content)
        
        return jsonify({
            'success': True,
            'validation': validation
        })
        
    except Exception as e:
        logger.error(f"Errore validazione template: {e}")
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500