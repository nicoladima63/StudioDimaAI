import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from core.database_manager import get_database_manager
from repositories.prestazione_work_mapping_repository import PrestazioneWorkMappingRepository
from app_v2 import format_response

logger = logging.getLogger(__name__)

prestazione_mapping_bp = Blueprint('prestazione_mapping_v2', __name__)

@prestazione_mapping_bp.route('/prestazione-work-mapping', methods=['GET'])
@jwt_required()
def get_all_mappings():
    """Ottiene tutti i mapping prestazione → work."""
    try:
        repo = PrestazioneWorkMappingRepository(get_database_manager())
        mappings = repo.list().data
        return format_response(success=True, data=mappings, state='success')
    except Exception as e:
        logger.error(f"Error getting mappings: {e}", exc_info=True)
        return format_response(success=False, error=str(e), state='error'), 500

@prestazione_mapping_bp.route('/prestazione-work-mapping/<codice>', methods=['GET'])
@jwt_required()
def get_mapping(codice: str):
    """Ottiene il work_id per una prestazione."""
    try:
        repo = PrestazioneWorkMappingRepository(get_database_manager())
        work_id = repo.get_work_id_by_prestazione(codice)
        if work_id is None:
            return format_response(success=False, error='Mapping non trovato', state='warning'), 404
        return format_response(success=True, data={'codice_prestazione': codice, 'work_id': work_id}, state='success')
    except Exception as e:
        logger.error(f"Error getting mapping for {codice}: {e}", exc_info=True)
        return format_response(success=False, error=str(e), state='error'), 500

@prestazione_mapping_bp.route('/prestazione-work-mapping', methods=['POST'])
@jwt_required()
def create_or_update_mapping():
    """Crea o aggiorna un mapping."""
    try:
        data = request.get_json()
        if not data or 'codice_prestazione' not in data or 'work_id' not in data:
            return format_response(success=False, error='codice_prestazione e work_id sono richiesti', state='error'), 400

        repo = PrestazioneWorkMappingRepository(get_database_manager())
        mapping = repo.upsert_mapping(data['codice_prestazione'], int(data['work_id']))
        return format_response(success=True, data=mapping, state='success', message='Mapping salvato con successo')
    except Exception as e:
        logger.error(f"Error upserting mapping: {e}", exc_info=True)
        return format_response(success=False, error=str(e), state='error'), 500

@prestazione_mapping_bp.route('/prestazione-work-mapping/<codice>', methods=['DELETE'])
@jwt_required()
def delete_mapping(codice: str):
    """Elimina un mapping."""
    try:
        repo = PrestazioneWorkMappingRepository(get_database_manager())
        success = repo.delete_mapping(codice)
        if not success:
            return format_response(success=False, error='Mapping non trovato', state='warning'), 404
        return format_response(success=True, message='Mapping eliminato con successo', state='success')
    except Exception as e:
        logger.error(f"Error deleting mapping: {e}", exc_info=True)
        return format_response(success=False, error=str(e), state='error'), 500
