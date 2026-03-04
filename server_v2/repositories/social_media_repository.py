"""
Social Media Repository for StudioDimaAI Server V2.
Data access layer per social media management system.
"""

import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from core.base_repository import BaseRepository
from core.database_manager import DatabaseManager
from core.exceptions import RepositoryError, ValidationError

logger = logging.getLogger(__name__)


class SocialMediaRepository(BaseRepository):
    """Repository per social media data (posts, accounts, categories)."""

    @property
    def table_name(self) -> str:
        return 'posts'

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_tables_exist()

    def _ensure_tables_exist(self) -> None:
        """Crea tutte le tabelle del social media manager se non esistono."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()

                # Tabella: social_accounts
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS social_accounts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        platform TEXT NOT NULL,
                        account_name TEXT NOT NULL,
                        account_username TEXT,
                        account_id TEXT UNIQUE,
                        access_token TEXT,
                        refresh_token TEXT,
                        token_expires_at TIMESTAMP,
                        is_connected INTEGER DEFAULT 0,
                        last_synced_at TIMESTAMP,
                        metadata TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL
                    )
                ''')

                # Indici per social_accounts
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_social_accounts_connected ON social_accounts(is_connected)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_social_accounts_deleted ON social_accounts(deleted_at)')

                # Tabella: content_categories
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS content_categories (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL UNIQUE,
                        description TEXT,
                        color TEXT,
                        icon TEXT,
                        sort_order INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL
                    )
                ''')

                # Indici per content_categories
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_content_categories_name ON content_categories(name)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_content_categories_deleted ON content_categories(deleted_at)')

                # Tabella: posts
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS posts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category_id INTEGER,
                        title TEXT NOT NULL,
                        content TEXT NOT NULL,
                        content_type TEXT DEFAULT 'post',
                        platforms TEXT,
                        media_urls TEXT,
                        hashtags TEXT,
                        status TEXT DEFAULT 'draft',
                        scheduled_at TIMESTAMP,
                        published_at TIMESTAMP,
                        created_by INTEGER,
                        metadata TEXT,
                        template_id INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL,
                        FOREIGN KEY (category_id) REFERENCES content_categories(id)
                    )
                ''')

                # Indici per posts
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(content_type)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_posts_deleted ON posts(deleted_at)')

                # Migrazione: aggiungi campi AI se non esistono
                for col_name, col_type in [('ai_generated', 'INTEGER DEFAULT 0'), ('content_pillar', 'TEXT')]:
                    try:
                        cursor.execute(f"ALTER TABLE posts ADD COLUMN {col_name} {col_type}")
                    except Exception:
                        pass

                # Tabella: post_publications
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS post_publications (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        post_id INTEGER NOT NULL,
                        social_account_id INTEGER NOT NULL,
                        platform_post_id TEXT,
                        status TEXT DEFAULT 'pending',
                        published_at TIMESTAMP,
                        error_message TEXT,
                        engagement_metrics TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL,
                        FOREIGN KEY (post_id) REFERENCES posts(id),
                        FOREIGN KEY (social_account_id) REFERENCES social_accounts(id)
                    )
                ''')

                # Indici per post_publications
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_post_publications_post ON post_publications(post_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_post_publications_account ON post_publications(social_account_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_post_publications_status ON post_publications(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_post_publications_deleted ON post_publications(deleted_at)')

                # Tabella: content_templates
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS content_templates (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        description TEXT,
                        category_id INTEGER,
                        template_type TEXT NOT NULL,
                        subject TEXT,
                        body TEXT NOT NULL,
                        variables TEXT,
                        is_active INTEGER DEFAULT 1,
                        created_by INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL,
                        FOREIGN KEY (category_id) REFERENCES content_categories(id)
                    )
                ''')

                # Indici per content_templates
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(template_type)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_content_templates_category ON content_templates(category_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_content_templates_deleted ON content_templates(deleted_at)')

                # Tabella: ai_generation_history
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS ai_generation_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        prompt TEXT NOT NULL,
                        generated_content TEXT NOT NULL,
                        content_type TEXT,
                        ai_model TEXT,
                        tokens_used INTEGER,
                        generation_time_ms INTEGER,
                        user_id INTEGER,
                        was_accepted INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                # Indici per ai_generation_history
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_ai_history_user ON ai_generation_history(user_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_ai_history_type ON ai_generation_history(content_type)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_ai_history_created ON ai_generation_history(created_at)')

                cursor.close()

            logger.info("Social media tables created/verified successfully")
        except Exception as e:
            logger.error(f"Failed to create social media tables: {e}")
            raise RepositoryError(f"Failed to create tables: {str(e)}", cause=e)

    # ==========================================================================
    # SOCIAL ACCOUNTS METHODS
    # ==========================================================================

    def get_all_accounts(self) -> List[Dict[str, Any]]:
        """Ottieni tutti gli account social non eliminati."""
        try:
            query = """
                SELECT * FROM social_accounts
                WHERE deleted_at IS NULL
                ORDER BY platform, account_name
            """
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(r) for r in results] if results else []
        except Exception as e:
            logger.error(f"Error getting social accounts: {e}")
            raise RepositoryError(f"Failed to get social accounts: {str(e)}", cause=e)

    def get_account_by_id(self, account_id: int) -> Optional[Dict[str, Any]]:
        """Ottieni account social per ID."""
        try:
            result = self.execute_custom_query(
                "SELECT * FROM social_accounts WHERE id = ? AND deleted_at IS NULL",
                (account_id,),
                fetch_one=True
            )
            return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error getting account {account_id}: {e}")
            raise RepositoryError(f"Failed to get account: {str(e)}", cause=e)

    def update_account(self, account_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Aggiorna account social."""
        try:
            data['updated_at'] = datetime.utcnow().isoformat()

            # Build UPDATE query manually since we're updating a different table than self.table_name
            set_clauses = [f"{field} = ?" for field in data.keys()]
            values = list(data.values())
            values.append(account_id)

            query = f"""
                UPDATE social_accounts
                SET {', '.join(set_clauses)}
                WHERE id = ?
            """

            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(query, tuple(values))
                rows_affected = cursor.rowcount
                cursor.close()

                if rows_affected == 0:
                    raise RepositoryError(f"Account {account_id} not found or not updated")

            logger.info(f"Updated social account {account_id}")
            return self.get_account_by_id(account_id)

        except Exception as e:
            logger.error(f"Error updating account {account_id}: {e}")
            raise RepositoryError(f"Failed to update account: {str(e)}", cause=e)

    # ==========================================================================
    # CATEGORIES METHODS
    # ==========================================================================

    def get_all_categories(self) -> List[Dict[str, Any]]:
        """Ottieni tutte le categorie contenuti non eliminate."""
        try:
            query = """
                SELECT * FROM content_categories
                WHERE deleted_at IS NULL
                ORDER BY sort_order, name
            """
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(r) for r in results] if results else []
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            raise RepositoryError(f"Failed to get categories: {str(e)}", cause=e)

    def create_category(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Crea nuova categoria."""
        try:
            # Validazione nome required
            if not data.get('name'):
                raise ValidationError("Category name is required")

            insert_sql = '''
                INSERT INTO content_categories (name, description, color, icon, sort_order)
                VALUES (?, ?, ?, ?, ?)
            '''

            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(insert_sql, (
                    data['name'],
                    data.get('description'),
                    data.get('color'),
                    data.get('icon'),
                    data.get('sort_order', 0)
                ))
                category_id = cursor.lastrowid
                cursor.close()

            # Ritorna la categoria creata
            result = self.execute_custom_query(
                "SELECT * FROM content_categories WHERE id = ?",
                (category_id,),
                fetch_one=True
            )
            return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error creating category: {e}")
            raise RepositoryError(f"Failed to create category: {str(e)}", cause=e)

    def update_category(self, category_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Aggiorna categoria esistente."""
        try:
            # Verifica esistenza
            existing = self.execute_custom_query(
                "SELECT * FROM content_categories WHERE id = ? AND deleted_at IS NULL",
                (category_id,),
                fetch_one=True
            )
            if not existing:
                return None

            # Prepara update
            update_fields = []
            params = []

            if 'name' in data:
                update_fields.append('name = ?')
                params.append(data['name'])
            if 'description' in data:
                update_fields.append('description = ?')
                params.append(data['description'])
            if 'color' in data:
                update_fields.append('color = ?')
                params.append(data['color'])
            if 'icon' in data:
                update_fields.append('icon = ?')
                params.append(data['icon'])
            if 'sort_order' in data:
                update_fields.append('sort_order = ?')
                params.append(data['sort_order'])

            if not update_fields:
                return dict(existing)

            update_fields.append('updated_at = CURRENT_TIMESTAMP')
            params.append(category_id)

            update_sql = f'''
                UPDATE content_categories
                SET {', '.join(update_fields)}
                WHERE id = ? AND deleted_at IS NULL
            '''

            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(update_sql, params)
                cursor.close()

            # Ritorna categoria aggiornata
            result = self.execute_custom_query(
                "SELECT * FROM content_categories WHERE id = ?",
                (category_id,),
                fetch_one=True
            )
            return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error updating category {category_id}: {e}")
            raise RepositoryError(f"Failed to update category: {str(e)}", cause=e)

    def delete_category(self, category_id: int) -> bool:
        """Soft delete di una categoria."""
        try:
            # Verifica esistenza
            existing = self.execute_custom_query(
                "SELECT * FROM content_categories WHERE id = ? AND deleted_at IS NULL",
                (category_id,),
                fetch_one=True
            )
            if not existing:
                return False

            # Soft delete
            delete_sql = '''
                UPDATE content_categories
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = ? AND deleted_at IS NULL
            '''

            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(delete_sql, (category_id,))
                cursor.close()

            return True
        except Exception as e:
            logger.error(f"Error deleting category {category_id}: {e}")
            raise RepositoryError(f"Failed to delete category: {str(e)}", cause=e)

    # ==========================================================================
    # POSTS METHODS (CRUD)
    # ==========================================================================

    def get_posts_paginated(
        self,
        page: int = 1,
        per_page: int = 20,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Ottieni posts paginati con filtri opzionali."""
        try:
            offset = (page - 1) * per_page

            # Base query
            query = "SELECT * FROM posts WHERE deleted_at IS NULL"
            count_query = "SELECT COUNT(*) as cnt FROM posts WHERE deleted_at IS NULL"
            params = []

            # Applica filtri
            if filters:
                if filters.get('status'):
                    query += " AND status = ?"
                    count_query += " AND status = ?"
                    params.append(filters['status'])

                if filters.get('category_id'):
                    query += " AND category_id = ?"
                    count_query += " AND category_id = ?"
                    params.append(filters['category_id'])

                if filters.get('content_type'):
                    query += " AND content_type = ?"
                    count_query += " AND content_type = ?"
                    params.append(filters['content_type'])

                if filters.get('search'):
                    query += " AND (title LIKE ? OR content LIKE ?)"
                    count_query += " AND (title LIKE ? OR content LIKE ?)"
                    search_term = f"%{filters['search']}%"
                    params.extend([search_term, search_term])

            # Ordinamento e paginazione
            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([per_page, offset])

            # Esegui query
            posts = self.execute_custom_query(query, tuple(params), fetch_all=True)
            posts_list = [dict(p) for p in posts] if posts else []

            # Count totale
            total_result = self.execute_custom_query(
                count_query,
                tuple(params[:-2]) if filters else (),  # Escludi LIMIT e OFFSET
                fetch_one=True
            )
            total = total_result['cnt'] if total_result else 0

            return {
                'posts': posts_list,
                'total': total,
                'pages': (total + per_page - 1) // per_page,
                'current_page': page,
                'per_page': per_page,
                'has_next': offset + per_page < total,
                'has_prev': page > 1
            }
        except Exception as e:
            logger.error(f"Error getting paginated posts: {e}")
            raise RepositoryError(f"Failed to get posts: {str(e)}", cause=e)

    def create_post(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Crea nuovo post."""
        try:
            # Validazione campi required
            if not data.get('title') or not data.get('content'):
                raise ValidationError("Title and content are required")

            # Ensure JSON fields are strings (not dicts/lists)
            platforms = data.get('platforms', '[]')
            if isinstance(platforms, (list, dict)):
                platforms = json.dumps(platforms)

            media_urls = data.get('media_urls', '[]')
            if isinstance(media_urls, (list, dict)):
                media_urls = json.dumps(media_urls)

            hashtags = data.get('hashtags', '[]')
            if isinstance(hashtags, (list, dict)):
                hashtags = json.dumps(hashtags)

            metadata = data.get('metadata', '{}')
            if isinstance(metadata, dict):
                metadata = json.dumps(metadata)

            insert_sql = '''
                INSERT INTO posts (
                    category_id, title, content, content_type,
                    platforms, media_urls, hashtags, status,
                    scheduled_at, created_by, metadata,
                    ai_generated, content_pillar
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            '''

            # Handle created_by (ensure it's not a dict)
            created_by = data.get('created_by')
            if isinstance(created_by, dict):
                # If it's a dict, try to extract 'id' or 'user_id'
                created_by = created_by.get('id') or created_by.get('user_id')
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(insert_sql, (
                    data.get('category_id'),
                    data['title'],
                    data['content'],
                    data.get('content_type', 'post'),
                    platforms,
                    media_urls,
                    hashtags,
                    data.get('status', 'draft'),
                    data.get('scheduled_at'),
                    created_by,
                    metadata,
                    1 if data.get('ai_generated') else 0,
                    data.get('content_pillar')
                ))
                post_id = cursor.lastrowid
                cursor.close()

            return self.get_post_by_id(post_id)
        except Exception as e:
            logger.error(f"Error creating post: {e}")
            raise RepositoryError(f"Failed to create post: {str(e)}", cause=e)

    def get_post_by_id(self, post_id: int) -> Optional[Dict[str, Any]]:
        """Ottieni post per ID."""
        try:
            result = self.execute_custom_query(
                "SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL",
                (post_id,),
                fetch_one=True
            )
            return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error getting post {post_id}: {e}")
            raise RepositoryError(f"Failed to get post: {str(e)}", cause=e)

    def update_post(self, post_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Aggiorna post esistente."""
        try:
            # Ensure JSON fields are strings (not dicts/lists)
            if 'platforms' in data:
                if isinstance(data['platforms'], (list, dict)):
                    data['platforms'] = json.dumps(data['platforms'])

            if 'media_urls' in data:
                if isinstance(data['media_urls'], (list, dict)):
                    data['media_urls'] = json.dumps(data['media_urls'])

            if 'hashtags' in data:
                if isinstance(data['hashtags'], (list, dict)):
                    data['hashtags'] = json.dumps(data['hashtags'])

            if 'metadata' in data:
                if isinstance(data['metadata'], dict):
                    data['metadata'] = json.dumps(data['metadata'])

            # Prepara campi update
            update_fields = []
            params = []

            allowed_fields = [
                'category_id', 'title', 'content', 'content_type',
                'platforms', 'media_urls', 'hashtags', 'status',
                'scheduled_at', 'published_at', 'metadata',
                'ai_generated', 'content_pillar'
            ]

            for field in allowed_fields:
                if field in data:
                    update_fields.append(f"{field} = ?")
                    params.append(data[field])

            if not update_fields:
                raise ValidationError("No fields to update")

            # Aggiungi updated_at
            update_fields.append("updated_at = ?")
            params.append(datetime.utcnow().isoformat())

            # Aggiungi post_id per WHERE
            params.append(post_id)

            update_sql = f'''
                UPDATE posts
                SET {', '.join(update_fields)}
                WHERE id = ? AND deleted_at IS NULL
            '''

            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(update_sql, tuple(params))
                cursor.close()

            return self.get_post_by_id(post_id)
        except Exception as e:
            logger.error(f"Error updating post {post_id}: {e}")
            raise RepositoryError(f"Failed to update post: {str(e)}", cause=e)

    def delete_post(self, post_id: int) -> None:
        """Soft delete di un post."""
        try:
            self.soft_delete(post_id)
            logger.info(f"Post {post_id} soft deleted")
        except Exception as e:
            logger.error(f"Error deleting post {post_id}: {e}")
            raise RepositoryError(f"Failed to delete post: {str(e)}", cause=e)

    # ==========================================================================
    # CUSTOM QUERIES
    # ==========================================================================

    def get_scheduled_posts(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Ottieni posts schedulati per range di date."""
        try:
            query = """
                SELECT * FROM posts
                WHERE status = 'scheduled'
                  AND deleted_at IS NULL
            """
            params = []

            if start_date:
                query += " AND scheduled_at >= ?"
                params.append(start_date)
            if end_date:
                query += " AND scheduled_at <= ?"
                params.append(end_date)

            query += " ORDER BY scheduled_at ASC"

            results = self.execute_custom_query(query, tuple(params), fetch_all=True)
            return [dict(r) for r in results] if results else []
        except Exception as e:
            logger.error(f"Error getting scheduled posts: {e}")
            raise RepositoryError(f"Failed to get scheduled posts: {str(e)}", cause=e)

    def get_posts_by_status(self, status: str) -> List[Dict[str, Any]]:
        """Ottieni posts per status."""
        try:
            query = """
                SELECT * FROM posts
                WHERE status = ? AND deleted_at IS NULL
                ORDER BY created_at DESC
            """
            results = self.execute_custom_query(query, (status,), fetch_all=True)
            return [dict(r) for r in results] if results else []
        except Exception as e:
            logger.error(f"Error getting posts by status {status}: {e}")
            raise RepositoryError(f"Failed to get posts by status: {str(e)}", cause=e)

    def get_connected_accounts_for_platforms(
        self,
        platforms: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Ottieni tutti gli account connessi per le piattaforme specificate.

        Args:
            platforms: Lista di platform names (es. ['instagram', 'facebook'])

        Returns:
            Lista di account connessi
        """
        if not platforms:
            return []

        try:
            placeholders = ','.join('?' * len(platforms))
            query = f"""
                SELECT * FROM social_accounts
                WHERE platform IN ({placeholders})
                AND is_connected = 1
                AND deleted_at IS NULL
            """
            results = self.execute_custom_query(query, tuple(platforms), fetch_all=True)
            return [dict(r) for r in results] if results else []
        except Exception as e:
            logger.error(f"Error getting connected accounts for platforms {platforms}: {e}")
            raise RepositoryError(f"Failed to get connected accounts: {str(e)}", cause=e)

    def create_publication_record(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Crea record di pubblicazione in post_publications table.

        Args:
            data: Dati pubblicazione

        Returns:
            Record creato con ID
        """
        try:
            insert_sql = """
                INSERT INTO post_publications (
                    post_id, social_account_id, platform_post_id,
                    status, published_at, error_message
                ) VALUES (?, ?, ?, ?, ?, ?)
            """

            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(insert_sql, (
                    data['post_id'],
                    data['social_account_id'],
                    data.get('platform_post_id'),
                    data.get('status', 'pending'),
                    data.get('published_at'),
                    data.get('error_message')
                ))
                record_id = cursor.lastrowid
                cursor.close()

            logger.info(f"Created publication record: {record_id}")
            return {'id': record_id, **data}

        except Exception as e:
            logger.error(f"Error creating publication record: {e}")
            raise RepositoryError(f"Failed to create publication record: {str(e)}", cause=e)
