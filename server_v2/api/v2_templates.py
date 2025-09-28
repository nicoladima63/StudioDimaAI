"""
📋 API per la gestione dei Template SMS
=======================================

Endpoint per esporre i template SMS gestiti dal TemplateManager.

Author: Gemini Code Assistant
Version: 1.0.0
"""

import logging
from flask import Blueprint, jsonify
from core.template_manager import template_manager

logger = logging.getLogger(__name__)

# Blueprint per le API dei template
templates_v2_bp = Blueprint('templates_v2', __name__, url_prefix='/api/v2')

@templates_v2_bp.route('/sms-templates', methods=['GET'])
def get_sms_templates():
    """
    Restituisce la lista dei template SMS disponibili.
    """
    try:
        all_templates = template_manager.get_all_templates()
        
        # Formatta i dati per essere usati facilmente in una select del frontend
        formatted_list = [
            {
                "key": key,
                "description": template.get("description", key) # Usa la chiave se manca la descrizione
            }
            for key, template in all_templates.items()
        ]
        
        return jsonify({
            'success': True,
            'data': formatted_list
        })
        
    except Exception as e:
        logger.error(f"Errore nel recupero dei template SMS: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'Errore interno del server: {str(e)}'
        }), 500
