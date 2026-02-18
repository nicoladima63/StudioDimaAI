"""
Push Notifications API endpoints.
Handles subscription management for browser push notifications.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging

logger = logging.getLogger(__name__)

push_bp = Blueprint('push_v2', __name__)


@push_bp.route('/push/subscribe', methods=['POST'])
@jwt_required()
def subscribe():
    """Subscribe user to push notifications."""
    try:
        from app_v2 import push_service

        if not push_service:
            return jsonify({
                'success': False,
                'error': 'Push notifications not configured'
            }), 503

        data = request.json or {}
        subscription_info = data.get('subscription')

        if not subscription_info:
            return jsonify({
                'success': False,
                'error': 'subscription is required'
            }), 400

        # Validate subscription format
        if 'endpoint' not in subscription_info or 'keys' not in subscription_info:
            return jsonify({
                'success': False,
                'error': 'Invalid subscription format'
            }), 400

        user = get_jwt_identity()
        user_id = user['id'] if isinstance(user, dict) else user
        success = push_service.subscribe_user(user_id, subscription_info)

        if success:
            return jsonify({
                'success': True,
                'message': 'Successfully subscribed to push notifications'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to subscribe'
            }), 500

    except Exception as e:
        logger.error(f"Error in push subscribe: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@push_bp.route('/push/unsubscribe', methods=['POST'])
@jwt_required()
def unsubscribe():
    """Unsubscribe user from push notifications."""
    try:
        from app_v2 import push_service

        if not push_service:
            return jsonify({
                'success': False,
                'error': 'Push notifications not configured'
            }), 503

        data = request.json or {}
        endpoint = data.get('endpoint')

        if not endpoint:
            return jsonify({
                'success': False,
                'error': 'endpoint is required'
            }), 400

        user = get_jwt_identity()
        user_id = user['id'] if isinstance(user, dict) else user
        success = push_service.unsubscribe_user(user_id, endpoint)

        if success:
            return jsonify({
                'success': True,
                'message': 'Successfully unsubscribed from push notifications'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to unsubscribe'
            }), 500

    except Exception as e:
        logger.error(f"Error in push unsubscribe: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@push_bp.route('/push/public-key', methods=['GET'])
def get_public_key():
    """Get VAPID public key for frontend subscription."""
    try:
        from app_v2 import vapid_public_key

        if not vapid_public_key:
            return jsonify({
                'success': False,
                'error': 'VAPID public key not configured'
            }), 503

        return jsonify({
            'success': True,
            'publicKey': vapid_public_key
        })

    except Exception as e:
        logger.error(f"Error getting public key: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@push_bp.route('/push/test', methods=['POST'])
@jwt_required()
def send_test_notification():
    """Send a test push notification (for debugging)."""
    try:
        from app_v2 import push_service

        if not push_service:
            return jsonify({
                'success': False,
                'error': 'Push notifications not configured'
            }), 503

        user = get_jwt_identity()
        user_id = user['id'] if isinstance(user, dict) else user

        result = push_service.send_notification(
            user_id=user_id,
            title="Test Notification",
            body="This is a test push notification from Studio Dima AI!",
            icon="/logo192.png",
            url="/",
            urgency='normal'
        )

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error sending test notification: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@push_bp.route('/push/test-simple', methods=['POST', 'GET'])
def send_test_notification_simple():
    """
    Test endpoint senza JWT per debug.
    Accetta user_id, title, body come parametri query o JSON.
    """
    try:
        from app_v2 import push_service

        if not push_service:
            return jsonify({
                'success': False,
                'error': 'Push notifications not configured'
            }), 503

        # Parametri da query string o JSON body
        if request.method == 'POST' and request.is_json:
            data = request.json
        else:
            data = request.args

        user_id = int(data.get('user_id', 1))
        title = data.get('title', 'Test Push Notification')
        body = data.get('body', 'Questa e una notifica di test da Studio Dima AI!')

        result = push_service.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            icon='/vite.svg',
            url='/',
            urgency='normal'
        )

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error in test-simple endpoint: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
