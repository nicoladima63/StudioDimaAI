
from flask import Blueprint, request, jsonify
from core.database_manager import get_database_manager
from services.work_service import WorkService
import logging

logger = logging.getLogger(__name__)

steps_bp = Blueprint('steps_v2', __name__)

def get_work_service():
    db_manager = get_database_manager()
    return WorkService(db_manager)

@steps_bp.route('/steps/<int:step_id>/complete', methods=['POST'])
def complete_step(step_id):
    """
    Mark a step as completed and activate the next one.
    Expected JSON: { "task_id": 123, "user_id": "optional_user" }
    """
    try:
        data = request.json or {}
        task_id = data.get('task_id')
        user_id = data.get('user_id')
        
        if not task_id:
            return jsonify({'success': False, 'error': 'task_id is required'}), 400
            
        service = get_work_service()
        updated_task = service.complete_step(task_id, step_id, user_id)
        
        return jsonify({'success': True, 'data': updated_task})
        
    except Exception as e:
        logger.error(f"Error completing step {step_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
