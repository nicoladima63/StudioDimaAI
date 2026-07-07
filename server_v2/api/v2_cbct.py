"""
API endpoints per il download automatico delle TAC/CBCT dal portale Alliance Medical.
"""

import logging

from flask import Blueprint, request, g
from flask_jwt_extended import jwt_required

from services.cbct_service import CbctService
from app_v2 import format_response
from core.exceptions import ValidationError, CbctError

logger = logging.getLogger(__name__)

cbct_v2_bp = Blueprint('cbct_v2', __name__)


@cbct_v2_bp.route('/cbct/esami', methods=['GET'])
@jwt_required()
def get_lista_esami():
    try:
        service = CbctService(g.database_manager)
        esami = service.get_lista_esami()
        return format_response(data=esami, state='success')
    except CbctError as e:
        logger.error(f"Errore CBCT nel recupero della lista esami: {e}")
        return format_response(success=False, error=str(e), state='error'), 502
    except Exception as e:
        logger.error(f"Errore imprevisto nella lista esami CBCT: {e}", exc_info=True)
        return format_response(
            success=False, error="Errore imprevisto nel recupero della lista esami", state='error'
        ), 500


@cbct_v2_bp.route('/cbct/esami/<portal_exam_id>/scarica', methods=['POST'])
@jwt_required()
def scarica_esame(portal_exam_id):
    try:
        payload = request.get_json(force=True) or {}
        paziente_raw = payload.get('paziente_raw')
        data_esame = payload.get('data_esame')
        if not paziente_raw or not data_esame:
            raise ValidationError("paziente_raw e data_esame sono obbligatori")

        service = CbctService(g.database_manager)
        risultato = service.scarica_ed_estrai(portal_exam_id, paziente_raw, data_esame)
        return format_response(
            data=risultato,
            message=f"Esame scaricato in {risultato['cartella_nas']}",
            state='success',
        )
    except ValidationError as e:
        return format_response(success=False, error=str(e), state='error'), 400
    except CbctError as e:
        logger.error(f"Errore CBCT nel download esame {portal_exam_id}: {e}")
        return format_response(success=False, error=str(e), state='error'), 502
    except Exception as e:
        logger.error(f"Errore imprevisto nel download esame CBCT {portal_exam_id}: {e}", exc_info=True)
        return format_response(
            success=False, error="Errore imprevisto nel download dell'esame", state='error'
        ), 500
