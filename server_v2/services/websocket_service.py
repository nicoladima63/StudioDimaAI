"""
WebSocket Service for real-time notifications.
Manages WebSocket connections and broadcasts events to connected clients.
"""

import logging
from typing import Dict, Any, Optional
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import request

logger = logging.getLogger(__name__)


class WebSocketService:
    """
    Service for managing WebSocket connections and broadcasting events.
    Each user joins a room based on their user_id for targeted notifications.
    """
    
    def __init__(self, socketio: SocketIO):
        self.socketio = socketio
        self.connected_clients: Dict[str, list] = {}  # user_id -> [session_ids]
        
        # Register event handlers
        self._register_handlers()
        
    def _register_handlers(self):
        """Register WebSocket event handlers."""
        
        @self.socketio.on('connect')
        def handle_connect():
            """Handle client connection."""
            session_id = request.sid
            logger.info(f"Client connected: {session_id}")
            emit('connected', {'status': 'ok', 'session_id': session_id})
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            """Handle client disconnection."""
            session_id = request.sid
            logger.info(f"Client disconnected: {session_id}")
            
            # Remove from connected clients
            for user_id, sessions in list(self.connected_clients.items()):
                if session_id in sessions:
                    sessions.remove(session_id)
                    if not sessions:
                        del self.connected_clients[user_id]
                    break
                    
        @self.socketio.on('join')
        def handle_join(data: Dict[str, Any]):
            """
            Handle user joining their personal room.
            Expected data: {'user_id': int}
            """
            try:
                user_id = str(data.get('user_id'))
                session_id = request.sid
                
                if not user_id:
                    emit('error', {'message': 'user_id is required'})
                    return
                    
                # Join room
                room = f"user_{user_id}"
                join_room(room)
                
                # Track connection
                if user_id not in self.connected_clients:
                    self.connected_clients[user_id] = []
                if session_id not in self.connected_clients[user_id]:
                    self.connected_clients[user_id].append(session_id)
                
                logger.info(f"User {user_id} (session {session_id}) joined room {room}")
                emit('joined', {'room': room, 'user_id': user_id})
                
            except Exception as e:
                logger.error(f"Error in join handler: {e}")
                emit('error', {'message': str(e)})
                
        @self.socketio.on('leave')
        def handle_leave(data: Dict[str, Any]):
            """
            Handle user leaving their personal room.
            Expected data: {'user_id': int}
            """
            try:
                user_id = str(data.get('user_id'))
                session_id = request.sid
                
                if not user_id:
                    return
                    
                # Leave room
                room = f"user_{user_id}"
                leave_room(room)
                
                # Remove from tracking
                if user_id in self.connected_clients:
                    if session_id in self.connected_clients[user_id]:
                        self.connected_clients[user_id].remove(session_id)
                    if not self.connected_clients[user_id]:
                        del self.connected_clients[user_id]
                
                logger.info(f"User {user_id} (session {session_id}) left room {room}")
                emit('left', {'room': room})
                
            except Exception as e:
                logger.error(f"Error in leave handler: {e}")
    
    def broadcast_notification(self, user_id: int, notification_data: Dict[str, Any]):
        """
        Broadcast a notification to a specific user.
        Sends to all connected sessions of that user.
        
        Args:
            user_id: Target user ID
            notification_data: Notification payload
        """
        try:
            room = f"user_{user_id}"
            self.socketio.emit(
                'new_notification',
                notification_data,
                room=room
            )
            logger.info(f"Broadcasted notification to user {user_id} in room {room}")
            
        except Exception as e:
            logger.error(f"Error broadcasting notification to user {user_id}: {e}")
            
    def broadcast_to_all(self, event: str, data: Dict[str, Any]):
        """
        Broadcast an event to all connected clients.
        
        Args:
            event: Event name
            data: Event payload
        """
        try:
            self.socketio.emit(event, data, broadcast=True)
            logger.info(f"Broadcasted event '{event}' to all clients")
            
        except Exception as e:
            logger.error(f"Error broadcasting event '{event}': {e}")
            
    def is_user_connected(self, user_id: int) -> bool:
        """
        Check if a user has any active connections.
        
        Args:
            user_id: User ID to check
            
        Returns:
            True if user has at least one active connection
        """
        return str(user_id) in self.connected_clients
        
    def get_connected_users_count(self) -> int:
        """Get the number of unique users currently connected."""
        return len(self.connected_clients)
