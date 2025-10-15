"""
🎯 API per il Tracciamento dei Click SMS
==================================

Questo blueprint gestisce l'endpoint pubblico per il redirect dei link tracciati.

Author: Gemini Code Architect
Version: 1.0.0
"""

import logging
from flask import Blueprint, redirect, request, abort

from services.link_tracker_service import link_tracker_service

logger = logging.getLogger(__name__)
tracker_bp = Blueprint('tracker_bp', __name__)

@tracker_bp.route('/track/<string:tracking_id>', methods=['GET'])
def track_click(tracking_id: str):
    """
    Endpoint pubblico chiamato quando un utente clicca su un link tracciato.
    Registra il click e reindirizza all'URL originale.
    """
    ip_address = request.remote_addr
    user_agent = request.headers.get('User-Agent')

    logger.info(f"Click ricevuto per tracking_id: {tracking_id} da IP: {ip_address}")

    original_url = link_tracker_service.get_original_url_and_log_click(
        tracking_id=tracking_id, ip_address=ip_address, user_agent=user_agent
    )

    if original_url:
        return redirect(original_url, code=302)
    else:
        logger.warning(f"Tentativo di accesso a un tracking_id non valido: {tracking_id}")
        return abort(404, description="Link non trovato o scaduto.")