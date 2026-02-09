"""
Social Media Management API V2 for StudioDimaAI.
Endpoints per gestione account social, posts, categorie - MVP Phase 1.
"""

from flask import Blueprint, request, jsonify, g, redirect
from flask_jwt_extended import jwt_required
from services.social_media_service import SocialMediaService
from services.social_publishing_service import SocialPublishingService
from utils.oauth_manager import OAuthManager, OAuthProvider
from app_v2 import require_auth, format_response
from core.exceptions import ValidationError, DatabaseError
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

social_media_v2_bp = Blueprint('social_media_v2', __name__)


# =============================================================================
# SOCIAL ACCOUNTS ENDPOINTS (MVP: Mock data)
# =============================================================================

@social_media_v2_bp.route('/social-media/accounts', methods=['GET'])
@jwt_required()
def get_social_accounts():
    """
    Lista tutti gli account social configurati.
    MVP: Ritorna account mock statici.
    """
    try:
        user_id = require_auth()
        service = SocialMediaService(g.database_manager)
        accounts = service.get_all_accounts()

        return format_response(
            data={'accounts': accounts},
            message=f"Retrieved {len(accounts)} social accounts",
            state='success'
        )
    except Exception as e:
        logger.error(f"Error getting social accounts: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/accounts/<int:account_id>', methods=['PUT'])
@jwt_required()
def update_social_account(account_id):
    """
    Aggiorna configurazione di un account social.
    Body: account_name, account_username, access_token, refresh_token, token_expires_at, is_connected
    """
    try:
        user_id = require_auth()
        data = request.get_json()

        if not data:
            return format_response(
                success=False,
                error="JSON body required",
                state='error'
            ), 400

        service = SocialMediaService(g.database_manager)
        updated_account = service.update_account(account_id, data)

        if not updated_account:
            return format_response(
                success=False,
                error=f"Account {account_id} not found",
                state='error'
            ), 404

        return format_response(
            data=updated_account,
            message="Account updated successfully",
            state='success'
        )
    except ValidationError as e:
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 400
    except Exception as e:
        logger.error(f"Error updating account {account_id}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


# =============================================================================
# CATEGORIES ENDPOINTS
# =============================================================================

@social_media_v2_bp.route('/social-media/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Lista tutte le categorie contenuti."""
    try:
        user_id = require_auth()
        service = SocialMediaService(g.database_manager)
        categories = service.get_all_categories()

        return format_response(
            data={'categories': categories},
            message=f"Retrieved {len(categories)} categories",
            state='success'
        )
    except Exception as e:
        logger.error(f"Error getting categories: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/categories', methods=['POST'])
@jwt_required()
def create_category():
    """Crea nuova categoria."""
    try:
        user_id = require_auth()
        data = request.get_json()

        if not data:
            return format_response(
                success=False,
                error="JSON body required",
                state='error'
            ), 400

        service = SocialMediaService(g.database_manager)
        category = service.create_category(data)

        return format_response(
            data=category,
            message="Category created successfully",
            state='success'
        ), 201
    except ValidationError as e:
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 400
    except Exception as e:
        logger.error(f"Error creating category: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


# =============================================================================
# POSTS CRUD ENDPOINTS
# =============================================================================

@social_media_v2_bp.route('/social-media/posts', methods=['GET'])
@jwt_required()
def get_posts():
    """
    Lista posts con paginazione e filtri.
    Query params: page, per_page, status, category_id, content_type, search
    """
    try:
        user_id = require_auth()

        # Parse query params
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)  # Max 100
        status = request.args.get('status')
        category_id = request.args.get('category_id', type=int)
        content_type = request.args.get('content_type')
        search = request.args.get('search', '').strip()

        service = SocialMediaService(g.database_manager)
        result = service.get_posts_paginated(
            page=page,
            per_page=per_page,
            status=status,
            category_id=category_id,
            content_type=content_type,
            search=search if search else None
        )

        return format_response(
            data={
                'posts': result['posts'],
                'pagination': {
                    'page': result['current_page'],
                    'per_page': result['per_page'],
                    'total': result['total'],
                    'pages': result['pages'],
                    'has_next': result['has_next'],
                    'has_prev': result['has_prev']
                }
            },
            message=f"Retrieved {len(result['posts'])} posts",
            state='success'
        )
    except Exception as e:
        logger.error(f"Error getting posts: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/posts', methods=['POST'])
@jwt_required()
def create_post():
    """Crea nuovo post."""
    try:
        user_id = require_auth()
        data = request.get_json()

        if not data:
            return format_response(
                success=False,
                error="JSON body required",
                state='error'
            ), 400

        # Validazione campi obbligatori
        if not data.get('title') or not data.get('content'):
            return format_response(
                success=False,
                error="Fields 'title' and 'content' are required",
                state='error'
            ), 400

        service = SocialMediaService(g.database_manager)
        post = service.create_post(
            title=data['title'],
            content=data['content'],
            category_id=data.get('category_id'),
            content_type=data.get('content_type', 'post'),
            platforms=data.get('platforms', []),
            media_urls=data.get('media_urls', []),
            hashtags=data.get('hashtags', []),
            scheduled_at=data.get('scheduled_at'),
            created_by=user_id
        )

        return format_response(
            data=post,
            message="Post created successfully",
            state='success'
        ), 201
    except ValidationError as e:
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 400
    except Exception as e:
        logger.error(f"Error creating post: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/posts/<int:post_id>', methods=['GET'])
@jwt_required()
def get_post(post_id):
    """Dettaglio singolo post."""
    try:
        user_id = require_auth()
        service = SocialMediaService(g.database_manager)
        post = service.get_post_by_id(post_id)

        if not post:
            return format_response(
                success=False,
                error=f"Post {post_id} not found",
                state='error'
            ), 404

        return format_response(
            data=post,
            state='success'
        )
    except Exception as e:
        logger.error(f"Error getting post {post_id}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/posts/<int:post_id>', methods=['PUT'])
@jwt_required()
def update_post(post_id):
    """Aggiorna post esistente."""
    try:
        user_id = require_auth()
        data = request.get_json()

        if not data:
            return format_response(
                success=False,
                error="JSON body required",
                state='error'
            ), 400

        service = SocialMediaService(g.database_manager)
        post = service.update_post(post_id, data)

        return format_response(
            data=post,
            message="Post updated successfully",
            state='success'
        )
    except ValidationError as e:
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 400
    except Exception as e:
        logger.error(f"Error updating post {post_id}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/posts/<int:post_id>', methods=['DELETE'])
@jwt_required()
def delete_post(post_id):
    """Soft delete di un post."""
    try:
        user_id = require_auth()
        service = SocialMediaService(g.database_manager)
        service.delete_post(post_id)

        return format_response(
            message="Post deleted successfully",
            state='success'
        )
    except Exception as e:
        logger.error(f"Error deleting post {post_id}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


# =============================================================================
# STATS ENDPOINT (per Dashboard)
# =============================================================================

@social_media_v2_bp.route('/social-media/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """Ottieni statistiche posts per dashboard."""
    try:
        user_id = require_auth()
        service = SocialMediaService(g.database_manager)
        stats = service.get_posts_stats()

        return format_response(
            data=stats,
            state='success'
        )
    except Exception as e:
        logger.error(f"Error getting stats: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


# =============================================================================
# CALENDAR ENDPOINT (Phase 2)
# =============================================================================

@social_media_v2_bp.route('/social-media/calendar', methods=['GET'])
@jwt_required()
def get_calendar_events():
    """
    Ottieni eventi calendario per posts schedulati.

    Query params:
        start_date: Data inizio range (ISO format)
        end_date: Data fine range (ISO format)

    Returns:
        events: Lista eventi formattati per react-big-calendar
    """
    try:
        user_id = require_auth()

        # Parse query params
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        # Get calendar events from service
        service = SocialMediaService(g.database_manager)
        events = service.get_calendar_events(start_date, end_date)

        return format_response(
            data={'events': events},
            message=f"Retrieved {len(events)} calendar events",
            state='success'
        )

    except Exception as e:
        logger.error(f"Error getting calendar events: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


# =============================================================================
# OAUTH & PUBLISHING ENDPOINTS (Phase 2)
# =============================================================================

# In-memory storage for OAuth states (in production, use Redis or DB)
_oauth_states = {}

@social_media_v2_bp.route('/social-media/accounts/<int:account_id>/connect', methods=['POST'])
@jwt_required()
def initiate_oauth_connection(account_id):
    """
    Inizia OAuth flow per connettere account social.

    Returns:
        authorization_url: URL per autorizzazione OAuth
        state: State token per CSRF protection
    """
    try:
        user = require_auth()
        user_id = user['id']  # Extract only the ID, not the full user dict

        # Get account and determine platform
        service = SocialMediaService(g.database_manager)
        account = service.get_account_by_id(account_id)

        if not account:
            return format_response(
                success=False,
                error=f"Account {account_id} not found",
                state='error'
            ), 404

        # Generate OAuth URL
        oauth_manager = OAuthManager()
        platform = account['platform']
        provider = oauth_manager.get_provider_from_platform(platform)

        auth_url, state = oauth_manager.generate_authorization_url(provider, user_id, account_id)

        # Store state temporarily for validation in callback
        _oauth_states[state] = {
            'user_id': user_id,
            'account_id': account_id,
            'platform': platform,
            'timestamp': datetime.utcnow().isoformat()
        }

        logger.info(f"OAuth flow initiated for account {account_id} (platform: {platform})")

        return format_response(
            data={
                'authorization_url': auth_url,
                'state': state
            },
            message='OAuth flow initiated',
            state='success'
        )

    except Exception as e:
        logger.error(f"Error initiating OAuth for account {account_id}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/callback/<platform>', methods=['GET'])
def oauth_callback(platform):
    """
    OAuth callback endpoint per tutte le piattaforme.

    Query params:
        code: Authorization code
        state: State token for CSRF protection
    """
    code = request.args.get('code')
    state = request.args.get('state')

    if not code or not state:
        logger.error("Missing code or state in OAuth callback")
        return redirect(f'/oauth-result?success=false&error=missing_params')

    try:
        # Validate state
        oauth_manager = OAuthManager()
        user_id, account_id, provider = oauth_manager.validate_state(state)

        # Verify state exists in our storage
        if state not in _oauth_states:
            logger.error("State not found in storage")
            return redirect(f'/oauth-result?success=false&error=invalid_state')

        # Remove used state
        del _oauth_states[state]

        # Exchange code for token
        logger.info(f"Exchanging code for token (account: {account_id})")
        token_data = oauth_manager.exchange_code_for_token(provider, code)

        # Calculate token expiration
        expires_in = token_data.get('expires_in', 3600)
        token_expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()

        # Update account with tokens
        service = SocialMediaService(g.database_manager)
        service.update_account(account_id, {
            'access_token': token_data['access_token'],
            'refresh_token': token_data.get('refresh_token'),
            'token_expires_at': token_expires_at,
            'is_connected': 1,
            'last_synced_at': datetime.utcnow().isoformat()
        })

        logger.info(f"Account {account_id} connected successfully")

        return redirect(f'/oauth-result?success=true&platform={platform}')

    except Exception as e:
        logger.error(f"OAuth callback error: {e}", exc_info=True)
        return redirect(f'/oauth-result?success=false&error={str(e)}')


@social_media_v2_bp.route('/social-media/accounts/<int:account_id>/disconnect', methods=['POST'])
@jwt_required()
def disconnect_account(account_id):
    """Disconnetti account social"""
    try:
        user_id = require_auth()

        service = SocialMediaService(g.database_manager)
        service.update_account(account_id, {
            'is_connected': 0,
            'access_token': None,
            'refresh_token': None,
            'token_expires_at': None
        })

        logger.info(f"Account {account_id} disconnected")

        return format_response(
            message='Account disconnected successfully',
            state='success'
        )

    except Exception as e:
        logger.error(f"Error disconnecting account {account_id}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/accounts/<int:account_id>/pages', methods=['GET'])
@jwt_required()
def get_facebook_pages(account_id):
    """
    Recupera le Facebook Pages gestite dall'account connesso.
    Usato per selezionare quale Page usare per pubblicare.
    """
    try:
        user_id = require_auth()

        service = SocialMediaService(g.database_manager)
        account = service.get_account_by_id(account_id)

        if not account:
            return format_response(
                success=False,
                error=f"Account {account_id} not found",
                state='error'
            ), 404

        if not account['is_connected']:
            return format_response(
                success=False,
                error="Account not connected",
                state='error'
            ), 400

        # Call Facebook Graph API to get Pages
        import requests
        access_token = account['access_token']

        response = requests.get(
            'https://graph.facebook.com/v18.0/me/accounts',
            params={'access_token': access_token},
            timeout=10
        )
        response.raise_for_status()

        pages_data = response.json()
        pages = pages_data.get('data', [])

        logger.info(f"Retrieved {len(pages)} Facebook Pages for account {account_id}")

        return format_response(
            data={'pages': pages},
            message=f"Retrieved {len(pages)} Facebook Pages",
            state='success'
        )

    except Exception as e:
        logger.error(f"Error getting Facebook Pages for account {account_id}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/accounts/<int:account_id>/select-page', methods=['POST'])
@jwt_required()
def select_facebook_page(account_id):
    """
    Seleziona quale Facebook Page usare per pubblicare.

    Body:
        page_id: ID della Page Facebook
        page_access_token: Access token specifico per la Page (opzionale)
    """
    try:
        user_id = require_auth()
        data = request.get_json(silent=True, force=True) or {}

        page_id = data.get('page_id')
        if not page_id:
            return format_response(
                success=False,
                error="page_id is required",
                state='error'
            ), 400

        service = SocialMediaService(g.database_manager)

        # Update account with Page ID
        update_data = {
            'account_id': page_id
        }

        # If page-specific access token provided, use it
        if data.get('page_access_token'):
            update_data['access_token'] = data['page_access_token']

        updated_account = service.update_account(account_id, update_data)

        logger.info(f"Facebook Page {page_id} selected for account {account_id}")

        return format_response(
            data=updated_account,
            message="Facebook Page selected successfully",
            state='success'
        )

    except Exception as e:
        logger.error(f"Error selecting Facebook Page for account {account_id}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@social_media_v2_bp.route('/social-media/posts/<int:post_id>/publish', methods=['POST'])
@jwt_required()
def publish_post_now(post_id):
    """
    Pubblica post immediatamente su tutte le piattaforme selezionate.

    Body (optional):
        account_ids: [1, 2, 3] - Specific accounts, default: all connected for selected platforms
    """
    try:
        user_id = require_auth()
        # Get JSON body if present, silent=True to handle missing Content-Type
        data = request.get_json(silent=True, force=True) or {}

        service = SocialPublishingService(g.database_manager)
        post = service.repository.get_post_by_id(post_id)

        if not post:
            return format_response(
                success=False,
                error=f"Post {post_id} not found",
                state='error'
            ), 404

        # Deserialize platforms
        if isinstance(post.get('platforms'), str):
            import json
            post['platforms'] = json.loads(post['platforms']) if post['platforms'] else []

        # Determine accounts to publish to
        account_ids = data.get('account_ids')
        if not account_ids:
            # Get all connected accounts for selected platforms
            accounts = service.repository.get_connected_accounts_for_platforms(post['platforms'])
            account_ids = [acc['id'] for acc in accounts]

        if not account_ids:
            return format_response(
                success=False,
                error='No connected accounts found for selected platforms',
                state='error'
            ), 400

        # Publish to each account
        results = []
        for account_id in account_ids:
            try:
                result = service.publish_post(post_id, account_id)
                results.append({
                    'account_id': account_id,
                    'success': result['success'],
                    'platform_post_id': result.get('platform_post_id'),
                    'error': result.get('error_message')
                })

                # Save publication record
                service.repository.create_publication_record({
                    'post_id': post_id,
                    'social_account_id': account_id,
                    'platform_post_id': result.get('platform_post_id'),
                    'status': 'published' if result['success'] else 'failed',
                    'published_at': datetime.utcnow().isoformat() if result['success'] else None,
                    'error_message': result.get('error_message')
                })

            except Exception as e:
                logger.error(f"Error publishing to account {account_id}: {e}")
                results.append({
                    'account_id': account_id,
                    'success': False,
                    'error': str(e)
                })

        # Update post status
        all_success = all(r['success'] for r in results)
        any_success = any(r['success'] for r in results)

        service.repository.update_post(post_id, {
            'status': 'published' if all_success else ('failed' if not any_success else 'published'),
            'published_at': datetime.utcnow().isoformat() if any_success else None
        })

        success_count = len([r for r in results if r['success']])

        return format_response(
            data={'publications': results},
            message=f'Published to {success_count}/{len(results)} accounts',
            state='success' if all_success else ('warning' if any_success else 'error')
        )

    except Exception as e:
        logger.error(f"Error publishing post {post_id}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


# =============================================================================
# HEALTH CHECK
# =============================================================================

@social_media_v2_bp.route('/social-media/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'service': 'social_media',
        'version': 'phase2',
        'message': 'Social Media Manager API is running'
    }), 200


# TEMPORARY ENDPOINT FOR TESTING (REMOVE IN PRODUCTION)
@social_media_v2_bp.route('/social-media/test/set-page-id', methods=['POST'])
def test_set_page_id():
    """
    TEMPORARY: Set Facebook Page ID without authentication.
    Body: {"account_id": 2, "page_id": "372172199587722"}
    """
    try:
        data = request.get_json(silent=True, force=True) or {}
        account_id = data.get('account_id', 2)
        page_id = data.get('page_id')

        if not page_id:
            return jsonify({'error': 'page_id required'}), 400

        service = SocialMediaService(g.database_manager)
        updated = service.update_account(account_id, {'account_id': page_id})

        return jsonify({
            'success': True,
            'message': f'Page ID {page_id} set for account {account_id}',
            'account': updated
        })

    except Exception as e:
        logger.error(f"Error setting page ID: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
