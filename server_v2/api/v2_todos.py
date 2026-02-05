
from flask import Blueprint, request, jsonify
from core.database_manager import get_database_manager
from services.todo_service import TodoService
import logging

logger = logging.getLogger(__name__)

todos_bp = Blueprint('todos_v2', __name__)

def get_todo_service():
    db_manager = get_database_manager()
    return TodoService(db_manager)

@todos_bp.route('/todos', methods=['GET'])
def get_todos():
    """Get todos with optional filters."""
    try:
        user_id = request.args.get('user_id')
        status = request.args.get('status')
        priority = request.args.get('priority')
        type_filter = request.args.get('type')
        
        service = get_todo_service()
        
        # For now, return inbox if user_id provided, else error
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id is required'}), 400
        
        # Get inbox and filter if needed
        todos = service.get_inbox(user_id)
        
        # Apply filters
        if status:
            todos = [t for t in todos if t.get('status') == status]
        if priority:
            todos = [t for t in todos if t.get('priority') == priority]
        if type_filter:
            todos = [t for t in todos if t.get('type') == type_filter]
        
        return jsonify({'success': True, 'data': todos})
    except Exception as e:
        logger.error(f"Error getting todos: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos/<int:todo_id>', methods=['GET'])
def get_todo(todo_id):
    """Get a single todo by ID."""
    try:
        service = get_todo_service()
        todo = service.get_by_id(todo_id)
        
        if not todo:
            return jsonify({'success': False, 'error': 'Todo not found'}), 404
        
        return jsonify({'success': True, 'data': todo})
    except Exception as e:
        logger.error(f"Error getting todo {todo_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos/inbox', methods=['GET'])
def get_inbox():
    """Get inbox for a user."""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
             return jsonify({'success': False, 'error': 'user_id is required'}), 400
             
        service = get_todo_service()
        todos = service.get_inbox(int(user_id))
        
        return jsonify({'success': True, 'data': todos})
    except Exception as e:
        logger.error(f"Error getting inbox: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos/sent', methods=['GET'])
def get_sent():
    """Get sent todos for a user."""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
             return jsonify({'success': False, 'error': 'user_id is required'}), 400
             
        service = get_todo_service()
        todos = service.get_sent(int(user_id))
        
        return jsonify({'success': True, 'data': todos})
    except Exception as e:
        logger.error(f"Error getting sent todos: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos/pending', methods=['GET'])
def get_pending():
    """Get pending todos for a user (shortcut)."""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
             return jsonify({'success': False, 'error': 'user_id is required'}), 400
             
        service = get_todo_service()
        todos = service.get_pending_for_user(int(user_id))
        
        return jsonify({'success': True, 'data': todos})
    except Exception as e:
        logger.error(f"Error getting pending todos: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos', methods=['POST'])
def create_todo():
    """Create a new todo/message."""
    try:
        data = request.json or {}
        service = get_todo_service()
        
        # Validation
        if not data.get('sender_id') or not data.get('recipient_id'):
             return jsonify({'success': False, 'error': 'sender_id and recipient_id are required'}), 400
        
        if not data.get('subject'):
             return jsonify({'success': False, 'error': 'subject is required'}), 400
             
        new_todo = service.create_todo(
            sender_id=data.get('sender_id'),
            recipient_id=data.get('recipient_id'),
            subject=data.get('subject'),
            message=data.get('message'),
            priority=data.get('priority', 'medium'),
            due_date=data.get('due_date'),
            type=data.get('type', 'general'),
            related_task_id=data.get('related_task_id'),
            related_step_id=data.get('related_step_id')
        )
        
        return jsonify({'success': True, 'data': new_todo}), 201
    except Exception as e:
        logger.error(f"Error creating todo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos/<int:todo_id>', methods=['PATCH'])
def update_todo(todo_id):
    """Update a todo."""
    try:
        data = request.json or {}
        service = get_todo_service()
        
        # Allow updating specific fields
        allowed_fields = ['status', 'priority', 'due_date', 'message', 'subject']
        updates = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not updates:
            return jsonify({'success': False, 'error': 'No valid fields to update'}), 400
        
        updated_todo = service.update_todo(todo_id, updates)
        
        if not updated_todo:
            return jsonify({'success': False, 'error': 'Todo not found'}), 404
        
        return jsonify({'success': True, 'data': updated_todo})
    except Exception as e:
        logger.error(f"Error updating todo {todo_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    """Soft delete (archive) a todo."""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id is required'}), 400
        
        service = get_todo_service()
        success = service.archive_message(todo_id, int(user_id))
        
        if not success:
            return jsonify({'success': False, 'error': 'Todo not found or unauthorized'}), 404
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error deleting todo {todo_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos/<int:todo_id>/complete', methods=['POST'])
def complete_todo(todo_id):
    """Mark a todo as completed."""
    try:
        user_id = request.json.get('user_id') if request.json else request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id is required'}), 400
        
        service = get_todo_service()
        success = service.mark_as_completed(todo_id, int(user_id))
        
        if not success:
            return jsonify({'success': False, 'error': 'Todo not found or unauthorized'}), 404
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error completing todo {todo_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos/<int:todo_id>/read', methods=['POST'])
def mark_todo_read(todo_id):
    """Mark a todo as read."""
    try:
        user_id = request.json.get('user_id') if request.json else request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id is required'}), 400
        
        service = get_todo_service()
        success = service.mark_as_read(todo_id, int(user_id))
        
        if not success:
            return jsonify({'success': False, 'error': 'Todo not found or unauthorized'}), 404
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error marking todo {todo_id} as read: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos/<int:todo_id>/snooze', methods=['POST'])
def snooze_todo(todo_id):
    """Snooze/postpone a todo by X days."""
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        days = data.get('days', 1)  # Default 1 day
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id is required'}), 400
        
        if not isinstance(days, int) or days < 1:
            return jsonify({'success': False, 'error': 'days must be a positive integer'}), 400
        
        service = get_todo_service()
        success = service.snooze_todo(todo_id, days, int(user_id))
        
        if not success:
            return jsonify({'success': False, 'error': 'Todo not found or unauthorized'}), 404
        
        return jsonify({'success': True, 'days': days})
    except Exception as e:
        logger.error(f"Error snoozing todo {todo_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/tasks/<int:task_id>/todos/postpone', methods=['POST'])
def postpone_task_todos(task_id):
    """Postpone all todos of a task by X days (e.g., when patient reschedules)."""
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        days = data.get('days', 7)  # Default 7 days
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id is required'}), 400
        
        if not isinstance(days, int) or days < 1:
            return jsonify({'success': False, 'error': 'days must be a positive integer'}), 400
        
        service = get_todo_service()
        result = service.postpone_task_todos(task_id, days, int(user_id))
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error postponing task {task_id} todos: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

