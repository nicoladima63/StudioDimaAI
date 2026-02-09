"""
Social Media Service for StudioDimaAI Server V2.
Business logic per gestione social media posts e accounts.
"""

import logging
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from services.base_service import BaseService
from repositories.social_media_repository import SocialMediaRepository
from core.exceptions import ValidationError, DatabaseError

logger = logging.getLogger(__name__)


class SocialMediaService(BaseService):
    """Service per Social Media Management - MVP Phase 1."""

    def __init__(self, database_manager):
        super().__init__(database_manager)
        self.repository = SocialMediaRepository(database_manager)

    # ==========================================================================
    # SOCIAL ACCOUNTS METHODS (Stub per MVP)
    # ==========================================================================

    def get_all_accounts(self) -> List[Dict[str, Any]]:
        """
        Ottieni tutti gli account social.
        MVP: Ritorna account mock statici.
        """
        try:
            # Per MVP: ritorna account mock
            # In Phase 2 questi saranno letti dal DB
            mock_accounts = [
                {
                    'id': 1,
                    'platform': 'instagram',
                    'account_name': 'Studio Dima',
                    'account_username': '@studiodima',
                    'is_connected': 0,
                    'connection_status': 'disconnected',
                    'last_synced_at': None,
                    'metadata': json.dumps({'followers': 0})
                },
                {
                    'id': 2,
                    'platform': 'facebook',
                    'account_name': 'Studio Dima Odontoiatrico',
                    'account_username': 'StudioDima',
                    'is_connected': 0,
                    'connection_status': 'disconnected',
                    'last_synced_at': None,
                    'metadata': json.dumps({'followers': 0})
                },
                {
                    'id': 3,
                    'platform': 'linkedin',
                    'account_name': 'Studio Dima',
                    'account_username': 'studio-dima',
                    'is_connected': 0,
                    'connection_status': 'disconnected',
                    'last_synced_at': None,
                    'metadata': json.dumps({'followers': 0})
                },
                {
                    'id': 4,
                    'platform': 'tiktok',
                    'account_name': 'Studio Dima',
                    'account_username': '@studiodima',
                    'is_connected': 0,
                    'connection_status': 'disconnected',
                    'last_synced_at': None,
                    'metadata': json.dumps({'followers': 0})
                }
            ]

            return mock_accounts
        except Exception as e:
            logger.error(f"Error getting accounts: {e}")
            raise DatabaseError(f"Failed to get accounts: {str(e)}")

    def update_account(self, account_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Aggiorna configurazione account social.
        Salva nel DB i dati di connessione.
        """
        try:
            # Validazione base
            if 'account_name' in data and not data['account_name'].strip():
                raise ValidationError("Account name cannot be empty")

            # Aggiorna nel DB
            updated_account = self.repository.update_account(account_id, data)

            if not updated_account:
                return None

            # Parse JSON fields if present
            if updated_account.get('metadata'):
                try:
                    updated_account['metadata'] = json.loads(updated_account['metadata'])
                except:
                    updated_account['metadata'] = {}

            return updated_account
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error updating account {account_id}: {e}")
            raise DatabaseError(f"Failed to update account: {str(e)}")

    # ==========================================================================
    # CATEGORIES METHODS
    # ==========================================================================

    def get_all_categories(self) -> List[Dict[str, Any]]:
        """Ottieni tutte le categorie contenuti."""
        try:
            categories = self.repository.get_all_categories()
            return categories
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            raise DatabaseError(f"Failed to get categories: {str(e)}")

    def create_category(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Crea nuova categoria."""
        try:
            # Validazione
            if not data.get('name'):
                raise ValidationError("Category name is required")

            category = self.repository.create_category(data)
            return category
        except Exception as e:
            logger.error(f"Error creating category: {e}")
            raise

    # ==========================================================================
    # POSTS CRUD METHODS
    # ==========================================================================

    def get_posts_paginated(
        self,
        page: int = 1,
        per_page: int = 20,
        status: Optional[str] = None,
        category_id: Optional[int] = None,
        content_type: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """Ottieni posts paginati con filtri."""
        try:
            # Prepara filtri
            filters = {}
            if status:
                filters['status'] = status
            if category_id:
                filters['category_id'] = category_id
            if content_type:
                filters['content_type'] = content_type
            if search:
                filters['search'] = search

            # Ottieni da repository
            result = self.repository.get_posts_paginated(
                page=page,
                per_page=per_page,
                filters=filters
            )

            # Parse JSON fields per ogni post
            for post in result['posts']:
                post['platforms'] = json.loads(post.get('platforms') or '[]')
                post['media_urls'] = json.loads(post.get('media_urls') or '[]')
                post['hashtags'] = json.loads(post.get('hashtags') or '[]')
                post['metadata'] = json.loads(post.get('metadata') or '{}')

            return result
        except Exception as e:
            logger.error(f"Error getting posts: {e}")
            raise DatabaseError(f"Failed to get posts: {str(e)}")

    def create_post(
        self,
        title: str,
        content: str,
        category_id: Optional[int],
        content_type: str,
        platforms: List[str],
        media_urls: List[str],
        hashtags: List[str],
        scheduled_at: Optional[str],
        created_by: int
    ) -> Dict[str, Any]:
        """Crea nuovo post."""
        try:
            # Validazione
            if not title or not content:
                raise ValidationError("Title and content are required")

            # Determina status
            status = 'scheduled' if scheduled_at else 'draft'

            # Debug: log input types
            logger.debug(f"create_post inputs - platforms type: {type(platforms)}, value: {platforms}")
            logger.debug(f"create_post inputs - media_urls type: {type(media_urls)}, value: {media_urls}")
            logger.debug(f"create_post inputs - hashtags type: {type(hashtags)}, value: {hashtags}")
            logger.debug(f"create_post inputs - created_by type: {type(created_by)}, value: {created_by}")

            # Prepara dati con JSON serialization
            post_data = {
                'title': title,
                'content': content,
                'category_id': category_id,
                'content_type': content_type,
                'platforms': json.dumps(platforms) if platforms is not None else '[]',
                'media_urls': json.dumps(media_urls) if media_urls is not None else '[]',
                'hashtags': json.dumps(hashtags) if hashtags is not None else '[]',
                'status': status,
                'scheduled_at': scheduled_at,
                'created_by': created_by,
                'metadata': json.dumps({
                    'created_via': 'social_media_manager'
                })
            }

            logger.debug(f"post_data prepared: {post_data}")

            # Crea post
            post = self.repository.create_post(post_data)

            # Parse JSON fields per risposta
            post['platforms'] = json.loads(post.get('platforms') or '[]')
            post['media_urls'] = json.loads(post.get('media_urls') or '[]')
            post['hashtags'] = json.loads(post.get('hashtags') or '[]')
            post['metadata'] = json.loads(post.get('metadata') or '{}')

            logger.info(f"Post created successfully: {post['id']}")
            return post
        except Exception as e:
            logger.error(f"Error creating post: {e}")
            raise

    def get_post_by_id(self, post_id: int) -> Optional[Dict[str, Any]]:
        """Ottieni dettaglio post."""
        try:
            post = self.repository.get_post_by_id(post_id)
            if not post:
                return None

            # Parse JSON fields
            post['platforms'] = json.loads(post.get('platforms') or '[]')
            post['media_urls'] = json.loads(post.get('media_urls') or '[]')
            post['hashtags'] = json.loads(post.get('hashtags') or '[]')
            post['metadata'] = json.loads(post.get('metadata') or '{}')

            return post
        except Exception as e:
            logger.error(f"Error getting post {post_id}: {e}")
            raise DatabaseError(f"Failed to get post: {str(e)}")

    def update_post(self, post_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Aggiorna post esistente."""
        try:
            # Serializza JSON fields se presenti
            update_data = data.copy()

            if 'platforms' in update_data and isinstance(update_data['platforms'], list):
                update_data['platforms'] = json.dumps(update_data['platforms'])

            if 'media_urls' in update_data and isinstance(update_data['media_urls'], list):
                update_data['media_urls'] = json.dumps(update_data['media_urls'])

            if 'hashtags' in update_data and isinstance(update_data['hashtags'], list):
                update_data['hashtags'] = json.dumps(update_data['hashtags'])

            if 'metadata' in update_data and isinstance(update_data['metadata'], dict):
                update_data['metadata'] = json.dumps(update_data['metadata'])

            # Aggiorna tramite repository
            post = self.repository.update_post(post_id, update_data)

            # Parse JSON fields per risposta
            post['platforms'] = json.loads(post.get('platforms') or '[]')
            post['media_urls'] = json.loads(post.get('media_urls') or '[]')
            post['hashtags'] = json.loads(post.get('hashtags') or '[]')
            post['metadata'] = json.loads(post.get('metadata') or '{}')

            logger.info(f"Post updated successfully: {post_id}")
            return post
        except Exception as e:
            logger.error(f"Error updating post {post_id}: {e}")
            raise

    def delete_post(self, post_id: int) -> None:
        """Soft delete post."""
        try:
            self.repository.delete_post(post_id)
            logger.info(f"Post deleted successfully: {post_id}")
        except Exception as e:
            logger.error(f"Error deleting post {post_id}: {e}")
            raise DatabaseError(f"Failed to delete post: {str(e)}")

    # ==========================================================================
    # UTILITY METHODS
    # ==========================================================================

    def get_posts_stats(self) -> Dict[str, Any]:
        """Ottieni statistiche posts per dashboard."""
        try:
            # Draft posts
            draft_posts = self.repository.get_posts_by_status('draft')

            # Scheduled posts
            scheduled_posts = self.repository.get_posts_by_status('scheduled')

            # Published posts
            published_posts = self.repository.get_posts_by_status('published')

            return {
                'total': len(draft_posts) + len(scheduled_posts) + len(published_posts),
                'draft': len(draft_posts),
                'scheduled': len(scheduled_posts),
                'published': len(published_posts)
            }
        except Exception as e:
            logger.error(f"Error getting posts stats: {e}")
            return {
                'total': 0,
                'draft': 0,
                'scheduled': 0,
                'published': 0
            }
