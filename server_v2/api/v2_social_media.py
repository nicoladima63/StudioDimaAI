"""
Social Media Management API V2 for StudioDimaAI.
Endpoints per gestione account social, posts, categorie - MVP Phase 1.
"""

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required
from services.social_media_service import SocialMediaService
from app_v2 import require_auth, format_response
from core.exceptions import ValidationError, DatabaseError
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
# HEALTH CHECK
# =============================================================================

@social_media_v2_bp.route('/social-media/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'service': 'social_media',
        'version': 'mvp',
        'message': 'Social Media Manager API is running'
    }), 200
