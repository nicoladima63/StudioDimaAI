"""
Social Publishing Service for StudioDimaAI.
Service per pubblicazione posts su piattaforme social (Instagram, Facebook, LinkedIn, TikTok).
"""

import logging
import requests
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from repositories.social_media_repository import SocialMediaRepository
from utils.oauth_manager import OAuthManager, OAuthProvider
from core.database_manager import DatabaseManager

logger = logging.getLogger(__name__)


class SocialPublishingService:
    """
    Service per pubblicazione su piattaforme social.

    Gestisce:
    - Pubblicazione posts su Instagram, Facebook, LinkedIn, TikTok
    - Upload media
    - Gestione rate limits
    - Retry logic
    - Salvataggio engagement metrics
    """

    def __init__(self, database_manager: DatabaseManager):
        """Initialize publishing service"""
        self.db_manager = database_manager
        self.repository = SocialMediaRepository(database_manager)
        self.oauth_manager = OAuthManager()

    def publish_post(
        self,
        post_id: int,
        account_id: int
    ) -> Dict[str, Any]:
        """
        Pubblica post su account social specifico.

        Args:
            post_id: ID del post da pubblicare
            account_id: ID dell'account social target

        Returns:
            Dictionary con risultato pubblicazione: {
                'success': bool,
                'platform_post_id': str,
                'error_message': str
            }
        """
        try:
            # Get post and account
            post = self.repository.get_post_by_id(post_id)
            if not post:
                raise ValueError(f"Post {post_id} not found")

            account = self.repository.get_account_by_id(account_id)
            if not account:
                raise ValueError(f"Account {account_id} not found")

            if not account['is_connected']:
                raise ValueError(f"Account {account_id} is not connected")

            # Check token expiration and refresh if needed
            if self.oauth_manager.is_token_expired(account.get('token_expires_at')):
                logger.info(f"Token expired for account {account_id}, refreshing...")
                account = self._refresh_account_token(account)

            # Deserialize JSON fields
            post = self._deserialize_post_fields(post)

            # Route to platform-specific publisher
            platform = account['platform']

            if platform == 'instagram':
                return self._publish_to_instagram(post, account)
            elif platform == 'facebook':
                return self._publish_to_facebook(post, account)
            elif platform == 'linkedin':
                return self._publish_to_linkedin(post, account)
            elif platform == 'tiktok':
                return self._publish_to_tiktok(post, account)
            else:
                raise ValueError(f"Unsupported platform: {platform}")

        except Exception as e:
            logger.error(f"Error publishing post {post_id} to account {account_id}: {e}", exc_info=True)
            return {
                'success': False,
                'platform_post_id': None,
                'error_message': str(e)
            }

    def _deserialize_post_fields(self, post: Dict[str, Any]) -> Dict[str, Any]:
        """Deserialize JSON fields in post"""
        for field in ['platforms', 'media_urls', 'hashtags', 'metadata']:
            if field in post and isinstance(post[field], str):
                try:
                    post[field] = json.loads(post[field]) if post[field] else []
                except json.JSONDecodeError:
                    post[field] = []
        return post

    def _publish_to_instagram(
        self,
        post: Dict,
        account: Dict
    ) -> Dict[str, Any]:
        """
        Pubblica su Instagram usando Graph API.

        Instagram publishing flow:
        1. Create media container (POST /me/media)
        2. Publish container (POST /me/media_publish)

        Args:
            post: Post data
            account: Account data

        Returns:
            Publication result
        """
        try:
            access_token = account['access_token']
            instagram_account_id = account.get('account_id')

            if not instagram_account_id:
                raise ValueError("Instagram account ID not configured")

            # Step 1: Create media container
            container_url = f'https://graph.facebook.com/v18.0/{instagram_account_id}/media'

            caption = self._format_caption_instagram(post)
            container_data = {
                'caption': caption,
                'access_token': access_token
            }

            # Add media if available
            if post.get('media_urls') and len(post['media_urls']) > 0:
                container_data['image_url'] = post['media_urls'][0]

            logger.info(f"Creating Instagram media container for post {post['id']}")

            response = requests.post(container_url, data=container_data, timeout=30)
            response.raise_for_status()
            container_id = response.json()['id']

            logger.info(f"Media container created: {container_id}")

            # Step 2: Publish container
            publish_url = f'https://graph.facebook.com/v18.0/{instagram_account_id}/media_publish'
            publish_data = {
                'creation_id': container_id,
                'access_token': access_token
            }

            response = requests.post(publish_url, data=publish_data, timeout=30)
            response.raise_for_status()

            platform_post_id = response.json()['id']

            logger.info(f"Instagram post published successfully: {platform_post_id}")

            return {
                'success': True,
                'platform_post_id': platform_post_id,
                'error_message': None
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"Instagram API error: {e}")
            error_msg = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('error', {}).get('message', str(e))
                except:
                    pass

            return {
                'success': False,
                'platform_post_id': None,
                'error_message': f"Instagram API error: {error_msg}"
            }

    def _publish_to_facebook(
        self,
        post: Dict,
        account: Dict
    ) -> Dict[str, Any]:
        """
        Pubblica su Facebook Page.

        Endpoints:
        - POST /{page_id}/photos (for photo posts)
        - POST /{page_id}/feed (for text posts)

        Args:
            post: Post data
            account: Account data

        Returns:
            Publication result
        """
        try:
            access_token = account['access_token']
            page_id = account.get('account_id')

            if not page_id:
                raise ValueError("Facebook Page ID not configured")

            # Determine endpoint based on media
            if post.get('media_urls') and len(post['media_urls']) > 0:
                # Photo post
                url = f'https://graph.facebook.com/v18.0/{page_id}/photos'
                data = {
                    'url': post['media_urls'][0],
                    'caption': self._format_caption_facebook(post),
                    'access_token': access_token
                }
            else:
                # Text post
                url = f'https://graph.facebook.com/v18.0/{page_id}/feed'
                data = {
                    'message': self._format_message_facebook(post),
                    'access_token': access_token
                }

            logger.info(f"Publishing to Facebook page {page_id}")

            response = requests.post(url, data=data, timeout=30)
            response.raise_for_status()

            platform_post_id = response.json()['id']

            logger.info(f"Facebook post published successfully: {platform_post_id}")

            return {
                'success': True,
                'platform_post_id': platform_post_id,
                'error_message': None
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"Facebook API error: {e}")
            error_msg = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('error', {}).get('message', str(e))
                except:
                    pass

            return {
                'success': False,
                'platform_post_id': None,
                'error_message': f"Facebook API error: {error_msg}"
            }

    def _publish_to_linkedin(
        self,
        post: Dict,
        account: Dict
    ) -> Dict[str, Any]:
        """
        Pubblica su LinkedIn.

        Endpoint: POST /v2/ugcPosts

        Args:
            post: Post data
            account: Account data

        Returns:
            Publication result
        """
        try:
            access_token = account['access_token']
            person_urn = account.get('account_id')

            if not person_urn:
                raise ValueError("LinkedIn Person URN not configured")

            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }

            # Determine media category
            media_category = 'NONE'
            if post.get('media_urls') and len(post['media_urls']) > 0:
                media_category = 'IMAGE'

            payload = {
                'author': person_urn,
                'lifecycleState': 'PUBLISHED',
                'specificContent': {
                    'com.linkedin.ugc.ShareContent': {
                        'shareCommentary': {
                            'text': self._format_text_linkedin(post)
                        },
                        'shareMediaCategory': media_category
                    }
                },
                'visibility': {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
                }
            }

            logger.info(f"Publishing to LinkedIn (author: {person_urn})")

            response = requests.post(
                'https://api.linkedin.com/v2/ugcPosts',
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()

            # LinkedIn returns post ID in X-RestLi-Id header
            platform_post_id = response.headers.get('X-RestLi-Id', response.json().get('id', 'unknown'))

            logger.info(f"LinkedIn post published successfully: {platform_post_id}")

            return {
                'success': True,
                'platform_post_id': platform_post_id,
                'error_message': None
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"LinkedIn API error: {e}")
            error_msg = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('message', str(e))
                except:
                    pass

            return {
                'success': False,
                'platform_post_id': None,
                'error_message': f"LinkedIn API error: {error_msg}"
            }

    def _publish_to_tiktok(
        self,
        post: Dict,
        account: Dict
    ) -> Dict[str, Any]:
        """
        Pubblica su TikTok.

        Note: TikTok posting requires video upload flow which is more complex.
        This is a placeholder for future implementation.

        Args:
            post: Post data
            account: Account data

        Returns:
            Publication result
        """
        logger.warning("TikTok publishing not yet implemented")
        return {
            'success': False,
            'platform_post_id': None,
            'error_message': "TikTok publishing not yet implemented"
        }

    def _format_caption_instagram(self, post: Dict) -> str:
        """
        Format caption for Instagram (max 2200 chars).

        Args:
            post: Post data

        Returns:
            Formatted caption
        """
        caption = post['content']

        # Add hashtags
        if post.get('hashtags') and len(post['hashtags']) > 0:
            hashtags = ' '.join(f"#{tag.strip('#')}" for tag in post['hashtags'])
            caption = f"{caption}\n\n{hashtags}"

        # Instagram max caption length is 2200 characters
        return caption[:2200]

    def _format_caption_facebook(self, post: Dict) -> str:
        """Format caption for Facebook photo posts"""
        caption = post['content']

        if post.get('hashtags') and len(post['hashtags']) > 0:
            hashtags = ' '.join(f"#{tag.strip('#')}" for tag in post['hashtags'])
            caption = f"{caption}\n\n{hashtags}"

        return caption[:63206]  # Facebook max length

    def _format_message_facebook(self, post: Dict) -> str:
        """Format message for Facebook text posts"""
        message = post['content']

        if post.get('hashtags') and len(post['hashtags']) > 0:
            hashtags = ' '.join(f"#{tag.strip('#')}" for tag in post['hashtags'])
            message = f"{message}\n\n{hashtags}"

        return message[:63206]  # Facebook max length

    def _format_text_linkedin(self, post: Dict) -> str:
        """Format text for LinkedIn posts (max 3000 chars)"""
        text = post['content']

        if post.get('hashtags') and len(post['hashtags']) > 0:
            hashtags = ' '.join(f"#{tag.strip('#')}" for tag in post['hashtags'])
            text = f"{text}\n\n{hashtags}"

        return text[:3000]

    def _refresh_account_token(self, account: Dict) -> Dict:
        """
        Refresh expired access token.

        Args:
            account: Account data with expired token

        Returns:
            Updated account data with new token
        """
        try:
            platform = account['platform']
            refresh_token = account.get('refresh_token')

            if not refresh_token:
                raise ValueError(f"No refresh token available for account {account['id']}")

            provider = self.oauth_manager.get_provider_from_platform(platform)

            new_token_data = self.oauth_manager.refresh_access_token(provider, refresh_token)

            # Calculate new expiration time
            expires_in = new_token_data.get('expires_in', 3600)
            token_expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()

            # Update account in DB
            update_data = {
                'access_token': new_token_data['access_token'],
                'token_expires_at': token_expires_at
            }

            # Update refresh token if new one provided
            if 'refresh_token' in new_token_data:
                update_data['refresh_token'] = new_token_data['refresh_token']

            self.repository.update_account(account['id'], update_data)

            logger.info(f"Token refreshed for account {account['id']}")

            # Return updated account
            return self.repository.get_account_by_id(account['id'])

        except Exception as e:
            logger.error(f"Failed to refresh token for account {account['id']}: {e}")
            raise Exception(f"Token refresh failed: {str(e)}")
