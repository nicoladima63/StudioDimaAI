
from flask import Blueprint, request, jsonify
from core.database_manager import get_database_manager
from services.work_service import WorkService
import logging

logger = logging.getLogger(__name__)

tasks_bp = Blueprint('tasks_v2', __name__)

def get_work_service():
    db_manager = get_database_manager()
    return WorkService(db_manager)

@tasks_bp.route('/tasks', methods=['GET'])
def get_tasks():
    """Get tasks, optionally filtered by patient_id."""
    try:
        patient_id = request.args.get('patient_id')
        service = get_work_service()
        
        if patient_id:
            tasks = service.get_tasks_for_patient(patient_id)
        else:
            tasks = service.get_all_tasks()
            
        return jsonify({'success': True, 'data': tasks})
    except Exception as e:
        logger.error(f"Error getting tasks: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tasks_bp.route('/tasks/<int:task_id>', methods=['GET'])
def get_task_details(task_id):
    """Get task details with steps."""
    try:
        service = get_work_service()
        task = service.get_task_details(task_id)
        if not task:
            return jsonify({'success': False, 'error': 'Task not found'}), 404
        return jsonify({'success': True, 'data': task})
    except Exception as e:
        logger.error(f"Error getting task {task_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tasks_bp.route('/tasks', methods=['POST'])
def create_task():
    """Create a new task from a work template."""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
            
        patient_id = data.get('patient_id')
        work_id = data.get('work_id')
        description = data.get('description')
        prestazione_id = data.get('prestazione_id')
        external_ref_id = data.get('external_ref_id')
        start_date = data.get('start_date')
        due_date = data.get('due_date')
        
        if not patient_id or not work_id:
            return jsonify({'success': False, 'error': 'patient_id and work_id are required'}), 400
            
        service = get_work_service()
        new_task = service.create_task_from_work(
            patient_id=patient_id,
            work_id=work_id,
            description=description,
            prestazione_id=prestazione_id,
            external_ref_id=external_ref_id,
            start_date=start_date,
            due_date=due_date
        )
        
        return jsonify({'success': True, 'data': new_task}), 201
        
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tasks_bp.route('/tasks/<int:task_id>/steps/<int:step_id>/complete', methods=['POST'])
def complete_step(task_id, step_id):
    """Mark a step as completed."""
    try:
        service = get_work_service()
        task = service.complete_step(task_id, step_id)
        if not task:
            return jsonify({'success': False, 'error': 'Step or Task not found or failed to complete'}), 404
        return jsonify({'success': True, 'data': task})
    except Exception as e:
        logger.error(f"Error completing step {step_id} for task {task_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tasks_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task."""
    try:
        service = get_work_service()
        success = service.delete_task(task_id)
        if not success:
            return jsonify({'success': False, 'error': 'Task not found or failed to delete'}), 404
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error deleting task {task_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tasks_bp.route('/tasks/<int:task_id>/status', methods=['PATCH'])
def update_task_status(task_id):
    """Update task status (e.g. cancel)."""
    try:
        data = request.json
        status = data.get('status')
        if not status:
            return jsonify({'success': False, 'error': 'Status is required'}), 400
            
        service = get_work_service()
        task = service.update_task_status(task_id, status)
        if not task:
            return jsonify({'success': False, 'error': 'Task not found'}), 404
        return jsonify({'success': True, 'data': task})
    except Exception as e:
        logger.error(f"Error updating task status {task_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
