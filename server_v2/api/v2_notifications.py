"""
Notifications API V2 for StudioDimaAI.

API endpoints for user notification management.
"""

import logging
from flask import Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity

from core.database_manager import get_database_manager
from services.notification_service import NotificationService
from app_v2 import format_response

logger = logging.getLogger(__name__)

notifications_bp = Blueprint('notifications_v2', __name__)


def get_notification_service():
    """Helper to instantiate NotificationService."""
    db_manager = get_database_manager()
    return NotificationService(db_manager)


@notifications_bp.route('/notifications/unread', methods=['GET'])
@jwt_required()
def get_unread_notifications():
    """
    Get unread notifications for the current user.

    Returns:
        JSON with unread notifications list
    """
    try:
        user_identity = get_jwt_identity()
        service = get_notification_service()

        # Extract user_id from identity dict
        if isinstance(user_identity, dict):
            user_id = user_identity.get('id')
        else:
            user_id = user_identity

        # Convert to int
        try:
            user_id_int = int(user_id)
        except (ValueError, TypeError):
            return format_response(
                success=False,
                error='Invalid user ID format',
                state='error'
            ), 400

        notifications = service.get_unread_notifications(user_id_int)

        return format_response(
            success=True,
            data={
                'notifications': notifications,
                'count': len(notifications)
            },
            state='success'
        ), 200

    except Exception as e:
        logger.error(f"Error getting unread notifications: {e}")
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@notifications_bp.route('/notifications/<int:notification_id>/read', methods=['POST'])
@jwt_required()
def mark_notification_read(notification_id):
    """
    Mark a notification as read.

    Args:
        notification_id: The notification ID to mark

    Returns:
        JSON with success status
    """
    try:
        service = get_notification_service()

        success = service.mark_read(notification_id)

        if success:
            return format_response(
                success=True,
                data={'message': 'Notification marked as read'},
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error='Notification not found',
                state='warning'
            ), 404

    except Exception as e:
        logger.error(f"Error marking notification {notification_id} as read: {e}")
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@notifications_bp.route('/notifications/mark-all-read', methods=['POST'])
@jwt_required()
def mark_all_read():
    """
    Mark all notifications as read for current user.

    Returns:
        JSON with success status and count of marked notifications
    """
    try:
        user_identity = get_jwt_identity()
        service = get_notification_service()

        # Extract user_id from identity dict
        if isinstance(user_identity, dict):
            user_id = user_identity.get('id')
        else:
            user_id = user_identity

        # Convert to int
        try:
            user_id_int = int(user_id)
        except (ValueError, TypeError):
            return format_response(
                success=False,
                error='Invalid user ID format',
                state='error'
            ), 400

        # Get all unread notifications
        unread = service.get_unread_notifications(user_id_int)

        # Mark each as read
        count = 0
        for notification in unread:
            if service.mark_read(notification['id']):
                count += 1

        return format_response(
            success=True,
            data={
                'message': f'{count} notifications marked as read',
                'count': count
            },
            state='success'
        ), 200

    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500
