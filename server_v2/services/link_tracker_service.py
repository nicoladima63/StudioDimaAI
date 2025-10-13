"""
🔗 Link Tracker Service
======================

Questo servizio gestisce la creazione e il tracciamento dei click sui link.

Author: Gemini Code Architect
Version: 1.0.0
"""

import logging
import uuid
from typing import Dict, Any, Optional

from flask import current_app

from core.database_manager import get_database_manager
from core.exceptions import DatabaseError

logger = logging.getLogger(__name__)

class LinkTrackerService:
    """
    Servizio per la gestione dei link tracciati.
    """
    def __init__(self):
        self.db_manager = get_database_manager()
        logger.info("LinkTrackerService inizializzato.")

    def create_tracked_link(self, original_url: str, context_data: Optional[Dict[str, Any]] = None) -> str:
        """
        Crea un nuovo link tracciato, lo salva nel DB e restituisce l'URL completo.

        Args:
            original_url: L'URL di destinazione originale.
            context_data: Dati contestuali opzionali da salvare (es. id paziente, id trigger).

        Returns:
            L'URL tracciato completo che punta al nostro server.
        """
        tracking_id = str(uuid.uuid4())[:8]  # ID corto e univoco
        context_json = str(context_data) if context_data else None

        query = "INSERT INTO tracked_links (id, original_url, context_data) VALUES (?, ?, ?)"
        try:
            self.db_manager.execute_query(query, (tracking_id, original_url, context_json))
            logger.info(f"Creato link tracciato '{tracking_id}' per URL: {original_url}")
        except Exception as e:
            logger.error(f"Errore DB durante la creazione del link tracciato: {e}", exc_info=True)
            raise DatabaseError("Impossibile creare il link tracciato nel database.")

        base_url = current_app.config.get("SERVER_BASE_URL", "http://localhost:5000")
        api_prefix = current_app.config.get("API_PREFIX", "/api/v2")
        return f"{base_url}{api_prefix}/track/{tracking_id}"

    def get_original_url_and_log_click(self, tracking_id: str, ip_address: str, user_agent: str) -> Optional[str]:
        """
        Registra un click nel DB e restituisce l'URL originale per il redirect.

        Args:
            tracking_id: L'ID del link tracciato.
            ip_address: L'indirizzo IP del client.
            user_agent: Lo user agent del client.

        Returns:
            L'URL originale se il link è valido, altrimenti None.
        """
        click_query = "INSERT INTO tracked_clicks (link_id, ip_address, user_agent) VALUES (?, ?, ?)"
        link_query = "SELECT original_url FROM tracked_links WHERE id = ?"

        with self.db_manager.transaction() as conn:
            conn.execute(click_query, (tracking_id, ip_address, user_agent))
            result = conn.execute(link_query, (tracking_id,)).fetchone()
        
        return result['original_url'] if result else None

# Istanza singleton del servizio
link_tracker_service = LinkTrackerService()