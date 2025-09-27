"""
🔧 API Callback Preparate - Gestione delle configurazioni di callback
====================================================================

API per creare, leggere e cancellare le callback preparate.

Author: Gemini Code Assist
Version: 1.0.0
"""

from flask import Blueprint, request, jsonify
from services.callback_service import callback_preparate_service
import logging

logger = logging.getLogger(__name__)

# Blueprint per le API delle callback preparate
callbacks_bp = Blueprint('callbacks', __name__)

@callbacks_bp.route('/', methods=['GET'])
def get_all_callbacks():
    """Recupera tutte le callback preparate."""
    try:
        data = callback_preparate_service.get_all()
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Errore API get_all_callbacks: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@callbacks_bp.route('/', methods=['POST'])
def create_callback():
    """Crea una nuova callback preparata."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Dati JSON richiesti'}), 400
        
        new_callback = callback_preparate_service.create(data)
        return jsonify({'success': True, 'data': new_callback}), 201
    except Exception as e:
        logger.error(f"Errore API create_callback: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@callbacks_bp.route('/<int:callback_id>', methods=['DELETE'])
def delete_callback(callback_id: int):
    """Elimina una callback preparata."""
    try:
        success = callback_preparate_service.delete(callback_id)
        if success:
            return jsonify({'success': True, 'message': 'Callback eliminata con successo'})
        else:
            # Questo caso non dovrebbe verificarsi se il servizio lancia eccezioni
            return jsonify({'success': False, 'error': 'Errore durante l\'eliminazione'}), 500
    except Exception as e:
        logger.error(f"Errore API delete_callback: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500