"""
Admin API - build info e riavvio server.
"""

import json
import logging
import os
import threading
import time
from pathlib import Path
from flask import Blueprint
from flask_jwt_extended import jwt_required

from app_v2 import format_response

logger = logging.getLogger(__name__)

admin_v2_bp = Blueprint('admin_v2', __name__)

_BUILD_INFO_PATH = Path(__file__).parent.parent / 'build_info.json'


def _read_build_info() -> dict:
    try:
        with open(_BUILD_INFO_PATH, 'r', encoding='utf-8') as f:
            info = json.load(f)
    except Exception:
        info = {
            'version': '2.0.0',
            'build': 0,
            'built_at': 'unknown',
            'git_hash': 'unknown',
        }
    # ENVIRONMENT env var e' la fonte di verita' per l'ambiente corrente
    info['env'] = os.getenv('ENVIRONMENT', 'development')
    return info


@admin_v2_bp.route('/build-info', methods=['GET'])
def get_build_info():
    """Restituisce info build corrente. Endpoint pubblico (no JWT)."""
    info = _read_build_info()
    return format_response(info)


@admin_v2_bp.route('/admin/restart', methods=['POST'])
@jwt_required()
def restart_server():
    """
    Riavvia il server con exit code 75.
    Il wrapper start_server_v2.bat rileva il codice e rilancia il processo.
    """
    logger.warning("Riavvio server richiesto via API")

    def _delayed_exit():
        time.sleep(2)
        os._exit(75)

    threading.Thread(target=_delayed_exit, daemon=True).start()
    return format_response({'message': 'Riavvio in corso...', 'countdown_seconds': 2})
