
from flask import Blueprint, request, jsonify
from core.database_manager import get_database_manager
from repositories.todo_repository import TodoRepository
import logging

logger = logging.getLogger(__name__)

todos_bp = Blueprint('todos_v2', __name__)

def get_todo_repo():
    db_manager = get_database_manager()
    return TodoRepository(db_manager)

@todos_bp.route('/todos/inbox', methods=['GET'])
def get_inbox():
    """Get inbox for a user."""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
             return jsonify({'success': False, 'error': 'user_id is required'}), 400
             
        repo = get_todo_repo()
        # TODO: Add pagination options
        result = repo.get_inbox(user_id)
        
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logger.error(f"Error getting inbox: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@todos_bp.route('/todos', methods=['POST'])
def create_todo():
    """Create a new todo/message."""
    try:
        data = request.json or {}
        repo = get_todo_repo()
        
        # Basic validation handled by repo/schema, but ensuring sender/recipient here
        if not data.get('sender_id') or not data.get('recipient_id'):
             return jsonify({'success': False, 'error': 'sender_id and recipient_id are required'}), 400
             
        new_todo = repo.create(data)
        return jsonify({'success': True, 'data': new_todo}), 201
    except Exception as e:
        logger.error(f"Error creating todo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
