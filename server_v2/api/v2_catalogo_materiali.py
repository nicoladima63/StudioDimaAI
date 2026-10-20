"""Catalogo materiali (prodotti, offerte dei fornitori, voci del gestionale)."""
import logging

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app_v2 import format_response, require_auth
from services.catalogo_materiali_migration import ensure_tables
from services.catalogo_materiali_service import CatalogoMaterialiService

logger = logging.getLogger(__name__)

catalogo_materiali_bp = Blueprint('catalogo_materiali', __name__)

_TABLES_READY = False


def _ensure_tables():
    global _TABLES_READY
    if _TABLES_READY:
        return
    with g.database_manager.transaction() as conn:
        ensure_tables(conn)
    _TABLES_READY = True


def _operation(action, not_found='Elemento non trovato'):
    require_auth()
    try:
        _ensure_tables()
        result = action(CatalogoMaterialiService(g.database_manager))
        if result is None:
            return format_response(success=False, error=not_found, state='error'), 404
        return format_response(data=result, state='success')
    except ValueError as exc:
        return format_response(success=False, error=str(exc), state='error'), 400
    except Exception:
        logger.exception('Errore catalogo materiali')
        return format_response(success=False, error='Operazione sul catalogo materiali non riuscita', state='error'), 500


def _body():
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else {}


@catalogo_materiali_bp.route('/materiali/catalogo/prodotti', methods=['GET'])
@jwt_required()
def list_prodotti():
    args = request.args
    return _operation(lambda s: s.search(
        q=args.get('q', ''), fornitore_id=args.get('fornitore_id'), contoid=args.get('contoid', type=int),
        brancaid=args.get('brancaid', type=int), sottocontoid=args.get('sottocontoid', type=int),
        stato=args.get('stato'), archiviati=args.get('archiviati') in ('1', 'true'),
        page=args.get('page', 1, type=int), per_page=args.get('per_page', 20, type=int),
        sort=args.get('sort', 'nome'), direction=args.get('dir', 'asc')))


@catalogo_materiali_bp.route('/materiali/catalogo/prodotti/<int:prodotto_id>', methods=['GET'])
@jwt_required()
def get_prodotto(prodotto_id):
    return _operation(lambda s: s.get(prodotto_id), 'Prodotto non trovato')


@catalogo_materiali_bp.route('/materiali/catalogo/prodotti/<int:prodotto_id>', methods=['PUT'])
@jwt_required()
def update_prodotto(prodotto_id):
    return _operation(lambda s: s.update_prodotto(prodotto_id, _body()), 'Prodotto non trovato')


@catalogo_materiali_bp.route('/materiali/catalogo/prodotti/classifica', methods=['POST'])
@jwt_required()
def classifica_prodotti():
    body = _body()
    return _operation(lambda s: s.classifica(body.get('ids'), body.get('classificazione')))


@catalogo_materiali_bp.route('/materiali/catalogo/prodotti/unisci', methods=['POST'])
@jwt_required()
def unisci_prodotti():
    body = _body()
    return _operation(lambda s: s.unisci(body.get('target_id'), body.get('source_ids')))


@catalogo_materiali_bp.route('/materiali/catalogo/prodotti/<int:prodotto_id>/archivia', methods=['POST'])
@jwt_required()
def archivia_prodotto(prodotto_id):
    archiviato = _body().get('archiviato', True) is not False
    return _operation(lambda s: {'archiviato': archiviato} if s.archivia(prodotto_id, archiviato) else None, 'Prodotto non trovato')


@catalogo_materiali_bp.route('/materiali/catalogo/offerte/<int:offerta_id>', methods=['PUT'])
@jwt_required()
def update_offerta(offerta_id):
    return _operation(lambda s: s.update_offerta(offerta_id, _body()), 'Offerta non trovata')


@catalogo_materiali_bp.route('/materiali/catalogo/offerte/<int:offerta_id>/separa', methods=['POST'])
@jwt_required()
def separa_offerta(offerta_id):
    return _operation(lambda s: s.separa_offerta(offerta_id), 'Offerta non trovata')


@catalogo_materiali_bp.route('/materiali/catalogo/fornitori', methods=['GET'])
@jwt_required()
def list_fornitori_catalogo():
    origine = 'gestionale' if request.args.get('origine') == 'gestionale' else 'catalogo'
    return _operation(lambda s: s.fornitori(origine))


@catalogo_materiali_bp.route('/materiali/catalogo/voci-gestionale', methods=['GET'])
@jwt_required()
def list_voci_gestionale():
    args = request.args
    require_auth()
    try:
        _ensure_tables()
        data = CatalogoMaterialiService(g.database_manager).voci_gestionale(
            q=args.get('q', ''), fornitore_id=args.get('fornitore_id'), solo_nuove=args.get('tutte') not in ('1', 'true'),
            page=args.get('page', 1, type=int), per_page=args.get('per_page', 20, type=int),
            refresh=args.get('refresh') in ('1', 'true'))
        return format_response(data=data, state='success')
    except OSError:
        logger.exception('Gestionale non raggiungibile')
        empty = {'voci': [], 'pagination': {'page': 1, 'per_page': 20, 'total': 0, 'pages': 1}}
        return format_response(data=empty, state='warning', message='Gestionale non raggiungibile: impossibile leggere le fatture')
    except ValueError as exc:
        return format_response(success=False, error=str(exc), state='error'), 400
    except Exception:
        logger.exception('Errore lettura voci gestionale')
        return format_response(success=False, error='Lettura delle voci del gestionale non riuscita', state='error'), 500


@catalogo_materiali_bp.route('/materiali/catalogo/voci-gestionale/aggiungi', methods=['POST'])
@jwt_required()
def aggiungi_voci_gestionale():
    return _operation(lambda s: s.aggiungi_voci(_body().get('voci')))
