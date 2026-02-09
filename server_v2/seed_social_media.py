"""
Script per popolare il database con categorie di test
Social Media Manager - MVP Phase 1
"""

import sys
import logging
from pathlib import Path

# Add server_v2 to path
sys.path.insert(0, str(Path(__file__).parent))

from core.database_manager import get_database_manager
from repositories.social_media_repository import SocialMediaRepository

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_categories():
    """Popola il database con categorie di test."""
    try:
        db_manager = get_database_manager()
        repo = SocialMediaRepository(db_manager)

        # Categorie di test per studio odontoiatrico
        categories = [
            {
                'name': 'Promozione Servizi',
                'description': 'Post per promuovere i servizi dello studio',
                'color': '#3498db',
                'icon': 'cilMegaphone',
                'sort_order': 1
            },
            {
                'name': 'Educazione Pazienti',
                'description': 'Contenuti educativi per i pazienti',
                'color': '#2ecc71',
                'icon': 'cilBook',
                'sort_order': 2
            },
            {
                'name': 'Team Interno',
                'description': 'Comunicazioni per il team dello studio',
                'color': '#9b59b6',
                'icon': 'cilPeople',
                'sort_order': 3
            },
            {
                'name': 'Eventi e News',
                'description': 'Annunci di eventi e novità',
                'color': '#f39c12',
                'icon': 'cilCalendar',
                'sort_order': 4
            },
            {
                'name': 'Testimonianze',
                'description': 'Recensioni e testimonianze dei pazienti',
                'color': '#e74c3c',
                'icon': 'cilStar',
                'sort_order': 5
            }
        ]

        created_count = 0
        for cat_data in categories:
            try:
                # Controlla se esiste già
                existing = repo.execute_custom_query(
                    "SELECT id FROM content_categories WHERE name = ? AND deleted_at IS NULL",
                    (cat_data['name'],),
                    fetch_one=True
                )

                if existing:
                    logger.info(f"Categoria '{cat_data['name']}' già esistente, skip")
                    continue

                # Crea categoria
                category = repo.create_category(cat_data)
                logger.info(f"✓ Creata categoria: {category['name']} (ID: {category['id']})")
                created_count += 1
            except Exception as e:
                logger.error(f"Errore creando categoria '{cat_data['name']}': {e}")
                continue

        logger.info(f"\n🎉 Seed completato! Categorie create: {created_count}/{len(categories)}")
        logger.info("\nOra puoi testare il Social Media Manager all'URL:")
        logger.info("http://localhost:3000/social-media")

    except Exception as e:
        logger.error(f"Errore generale: {e}")
        raise


if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("Social Media Manager - Seed Categorie di Test")
    logger.info("=" * 60)
    seed_categories()
