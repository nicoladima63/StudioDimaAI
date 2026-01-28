
from flask import Blueprint, request, jsonify
from core.database_manager import get_database_manager
from services.work_service import WorkService
import logging

logger = logging.getLogger(__name__)

works_bp = Blueprint('works_v2', __name__)

def get_work_service():
    db_manager = get_database_manager()
    return WorkService(db_manager)

@works_bp.route('/works', methods=['GET'])
def get_works():
    """Get all work templates."""
    try:
        service = get_work_service()
        works = service.get_all_works()
        return jsonify({'success': True, 'data': works})
    except Exception as e:
        logger.error(f"Error getting works: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@works_bp.route('/works/<int:work_id>', methods=['GET'])
def get_work_details(work_id):
    """Get work details with steps."""
    try:
        service = get_work_service()
        work = service.get_work_details(work_id)
        if not work:
            return jsonify({'success': False, 'error': 'Work not found'}), 404
        return jsonify({'success': True, 'data': work})
    except Exception as e:
        logger.error(f"Error getting work {work_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@works_bp.route('/works', methods=['POST'])
def create_work():
    """Create a new work template."""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
            
        work_data = data.get('work')
        steps_data = data.get('steps')
        
        if not work_data:
             return jsonify({'success': False, 'error': 'Work data is required'}), 400
             
        service = get_work_service()
        new_work = service.create_work_template(work_data, steps_data)
        
        return jsonify({'success': True, 'data': new_work}), 201
        
    except Exception as e:
        logger.error(f"Error creating work: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
