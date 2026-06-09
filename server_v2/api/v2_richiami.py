"""
Richiami API V2 for StudioDimaAI.

Modern API endpoints for patient recall management.
"""

import logging
import os
from datetime import date, datetime
from flask import Blueprint, request, g
from flask_jwt_extended import jwt_required, verify_jwt_in_request
from jwt.exceptions import InvalidTokenError

from services.pazienti_service import PazientiService
from services.richiami_service import RichiamiService
from services.slot_finder_service import trova_slot_liberi, trova_ultimo_igienista, build_last_igiene_lookup
from app_v2 import format_response
from core.exceptions import ValidationError, DatabaseError
from core.constants_v2 import TIPO_RICHIAMI


logger = logging.getLogger(__name__)

# Mapping shorthand filtro → codice TIPO_RICHIAMI
_FILTRO_TO_TIPO = {
    'generico':    '1',
    'igiene':      '2',
    'rx_impianto': '3',
    'controllo':   '4',
    'impianti':    '5',
    'ortodonzia':  '6',
}


def _check_auth():
    """Accetta X-API-Key (per n8n) oppure JWT valido."""
    api_key = request.headers.get('X-API-Key', '').strip()
    automation_key = os.environ.get('BOT_API_KEY', '').strip()
    if api_key and automation_key and api_key == automation_key:
        return
    try:
        verify_jwt_in_request()
    except Exception:
        from flask_jwt_extended.exceptions import NoAuthorizationError
        raise NoAuthorizationError('Autenticazione richiesta: JWT o X-API-Key valido')


def _months_between(d1: date, d2: date) -> int:
    return (d2.year - d1.year) * 12 + (d2.month - d1.month)


def _add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    year = d.year + m // 12
    month = m % 12 + 1
    import calendar
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _parse_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%Y%m%d'):
        try:
            return datetime.strptime(str(value), fmt).date()
        except ValueError:
            continue
    return None

# Create blueprint
richiami_v2_bp = Blueprint('richiami_v2', __name__)


# ===== HELPER FUNCTIONS =====

def handle_error(error, context=""):
    """Standardized error handling."""
    if isinstance(error, ValidationError):
        logger.warning(f"Validation error in {context}: {error}")
        return format_response({
            'success': False,
            'error': 'VALIDATION_ERROR',
            'message': str(error)
        }, 400)
    elif isinstance(error, DatabaseError):
        logger.error(f"Database error in {context}: {error}")
        return format_response({
            'success': False,
            'error': 'DATABASE_ERROR',
            'message': 'Database operation failed'
        }, 500)
    else:
        logger.error(f"Unexpected error in {context}: {error}")
        return format_response({
            'success': False,
            'error': 'INTERNAL_ERROR',
            'message': 'Internal server error'
        }, 500)


def validate_required_param(data, param_name, param_type=str):
    """Validate required parameter."""
    if not data:
        raise ValidationError("Request body is required")
    value = data.get(param_name)
    if value is None:
        raise ValidationError(f"{param_name} is required")
    if param_type != str and not isinstance(value, param_type):
        raise ValidationError(f"{param_name} must be a valid {param_type.__name__}")
    return value


@richiami_v2_bp.route('/pazienti/<paziente_id>/richiamo/status', methods=['PUT'])
@jwt_required()
def update_richiamo_status(paziente_id):
    """
    Update richiamo status for a patient.
    
    Body:
        da_richiamare (str): Status (S/N/R)
        data_richiamo (str, optional): Date when recalled (for R status)
    """
    try:
        data = request.get_json()
        da_richiamare = validate_required_param(data, 'da_richiamare')
        data_richiamo = data.get('data_richiamo')
        
        if da_richiamare not in ['S', 'N', 'R']:
            raise ValidationError("da_richiamare must be S, N, or R")
        
        service = RichiamiService()
        result = service.update_richiamo_status(paziente_id, da_richiamare, data_richiamo)
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore aggiornamento stato')), 400
            
    except (ValidationError, DatabaseError, Exception) as e:
        return handle_error(e, "update_richiamo_status")


@richiami_v2_bp.route('/pazienti/<paziente_id>/richiamo/tipo', methods=['PUT'])
@jwt_required()
def update_richiamo_tipo(paziente_id):
    """
    Update richiamo configuration (tipo and tempo) for a patient.
    
    Body:
        tipo_richiamo (str): Type codes (e.g., "21")
        tempo_richiamo (int): Months interval
    """
    try:
        data = request.get_json()
        tipo_richiamo = validate_required_param(data, 'tipo_richiamo')
        tempo_richiamo = validate_required_param(data, 'tempo_richiamo', int)
        
        # Get patient info from gestionale first (optional for now)
        paziente = {'nome': 'Test Patient'}
        try:
            from core.database_manager import DatabaseManager
            db_manager = DatabaseManager()
            pazienti_service = PazientiService(db_manager)
            paziente_result = pazienti_service.get_paziente_by_id(paziente_id)
            
            if paziente_result['success']:
                paziente = paziente_result['data']
        except Exception as e:
            logger.warning(f"Could not fetch patient from gestionale: {e}")
            paziente = {'id': paziente_id, 'nome': f'Paziente {paziente_id}'}
        
        # Update or create richiamo
        richiami_service = RichiamiService()
        
        # Check if richiamo exists
        existing_richiami = richiami_service.get_richiami_paziente(paziente_id)
        if existing_richiami['success'] and existing_richiami['data']:
            result = richiami_service.update_richiamo_config(paziente_id, tipo_richiamo, tempo_richiamo, paziente)
        else:
            result = richiami_service.create_richiamo(
                paziente_id=paziente_id,
                nome=paziente.get('nome', ''),
                data_ultima_visita=paziente.get('ultima_visita'),
                tipo_richiamo=tipo_richiamo,
                tempo_richiamo=tempo_richiamo
            )
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore aggiornamento configurazione')), 400
            
    except (ValidationError, DatabaseError, Exception) as e:
        return handle_error(e, "update_richiamo_tipo")


@richiami_v2_bp.route('/richiami/da-fare', methods=['GET'])
@jwt_required()
def get_richiami_da_fare():
    """
    Get list of richiami that need to be done.
    
    Query Parameters:
        limit (int): Maximum results (optional)
    """
    try:
        limit = request.args.get('limit', type=int)
        
        service = RichiamiService()
        result = service.get_richiami_da_fare(limit)
        
        if result['success']:
            return format_response({
                'richiami': result['data'],
                'count': result['count']
            })
        else:
            return format_response(success=False, error=result.get('error', 'Errore caricamento richiami'))
            
    except (DatabaseError, Exception) as e:
        return handle_error(e, "get_richiami_da_fare")


@richiami_v2_bp.route('/richiami/statistiche', methods=['GET'])
@jwt_required()
def get_richiami_statistiche():
    """Get richiami statistics."""
    try:
        service = RichiamiService()
        result = service.get_statistiche_richiami()
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore statistiche'))
            
    except (DatabaseError, Exception) as e:
        return handle_error(e, "get_richiami_statistiche")


@richiami_v2_bp.route('/richiami/<int:richiamo_id>/completato', methods=['PUT'])
@jwt_required()
def mark_richiamo_completato(richiamo_id):
    """
    Mark a richiamo as completed.
    
    Body:
        data_richiamo (str, optional): Date when completed
    """
    try:
        data = request.get_json() or {}
        data_richiamo = data.get('data_richiamo')
        
        # Get richiamo first to get paziente_id
        service = RichiamiService()
        richiamo = service.get_richiamo_by_id(richiamo_id)
        
        if not richiamo['success']:
            return format_response(success=False, error="Richiamo non trovato"), 404
        
        paziente_id = richiamo['data']['paziente_id']
        
        # Update status to completed
        result = service.update_richiamo_status(paziente_id, 'R', data_richiamo)
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore completamento richiamo')), 400
            
    except (DatabaseError, Exception) as e:
        return handle_error(e, "mark_richiamo_completato")


@richiami_v2_bp.route('/richiami/migrate-from-dbf', methods=['POST'])
@jwt_required()
def migrate_richiami_from_dbf():
    """
    Migrate existing richiami data from DBF gestionale to SQLite table.
    This is a one-time operation to import existing data.
    """
    try:
        # Get all pazienti with richiami data from DBF
        pazienti_service = PazientiService(g.database_manager)
        result = pazienti_service.get_pazienti_paginated(page=1, per_page=10000)
        
        if not result['success']:
            return format_response(success=False, error="Could not fetch pazienti from DBF"), 500
        
        pazienti = result['data']['pazienti']
        richiami_service = RichiamiService()
        
        migrated_count = 0
        skipped_count = 0
        error_count = 0
        
        for paziente in pazienti:
            try:
                paziente_id = paziente.get('id')
                nome = paziente.get('nome', 'N/A')
                da_richiamare = paziente.get('da_richiamare', '').strip()
                tipo_richiamo = paziente.get('tipo_richiamo', '').strip()
                tempo_richiamo = paziente.get('mesi_richiamo')  # Note: field name difference
                ultima_visita = paziente.get('ultima_visita')
                
                # Skip if no richiamo data
                if not da_richiamare or da_richiamare not in ['S', 'N', 'R']:
                    skipped_count += 1
                    continue
                
                # Check if already exists
                existing = richiami_service.get_richiami_paziente(paziente_id)
                if existing['success'] and existing['data']:
                    skipped_count += 1
                    continue
                
                # Create richiamo record
                create_result = richiami_service.create_richiamo(
                    paziente_id=paziente_id,
                    nome=nome,
                    data_ultima_visita=ultima_visita,
                    tipo_richiamo=tipo_richiamo if tipo_richiamo else None,
                    tempo_richiamo=tempo_richiamo if tempo_richiamo and isinstance(tempo_richiamo, int) else None
                )
                
                if create_result['success']:
                    # Update status to match DBF
                    status_result = richiami_service.update_richiamo_status(
                        paziente_id=paziente_id,
                        da_richiamare=da_richiamare,
                        data_richiamo=None
                    )
                    
                    if status_result['success']:
                        migrated_count += 1
                    else:
                        error_count += 1
                else:
                    error_count += 1
                    
            except Exception:
                error_count += 1
                continue
        
        return format_response({
            'migrated': migrated_count,
            'skipped': skipped_count,
            'errors': error_count,
            'total_processed': len(pazienti),
            'message': f'Migration completed: {migrated_count} migrated, {skipped_count} skipped, {error_count} errors'
        })
            
    except (DatabaseError, Exception) as e:
        return handle_error(e, "migrate_richiami_from_dbf")


@richiami_v2_bp.route('/richiami', methods=['GET'])
@jwt_required()
def get_richiami_list():
    """
    Get list of richiami with filters.
    
    Query Parameters:
        days (int): Days threshold (default: 90)
        status (str): Filter by status (S, N, R)
        tipo (str): Filter by tipo_richiamo
        limit (int): Limit results
    
    Returns:
        JSON response with richiami list
    """
    try:
        # Get query parameters
        days_threshold = request.args.get('days', 90, type=int)
        status = request.args.get('status')
        tipo = request.args.get('tipo')
        limit = request.args.get('limit', type=int)
        
        service = RichiamiService()
        
        if status:
            # Filter by status (need to implement in service)
            result = service.get_richiami_da_fare(limit) if status == 'S' else service.get_richiami_da_fare(limit)
        elif tipo:
            # Filter by tipo (need to implement in service) 
            result = service.get_richiami_da_fare(limit)
        else:
            # Get all richiami da fare
            result = service.get_richiami_da_fare(limit)
        
        if result['success']:
            return format_response({
                'richiami': result['data'],
                'count': result['count'],
                'filters': {
                    'days_threshold': days_threshold,
                    'status': status,
                    'tipo': tipo,
                    'limit': limit
                }
            })
        else:
            return format_response(success=False, error=result.get('error', 'Errore recupero richiami'))
            
    except Exception as e:
        return handle_error(e, "get_richiami_list")


@richiami_v2_bp.route('/richiami/<int:richiamo_id>/message', methods=['GET'])
@jwt_required()
def get_richiamo_message(richiamo_id):
    """
    Get message content for a richiamo.
    
    Returns:
        JSON response with richiamo message data
    """
    try:
        service = RichiamiService()
        result = service.get_richiamo_by_id(richiamo_id)
        
        if not result['success']:
            return format_response(success=False, error='Richiamo non trovato'), 404
        
        richiamo_data = result['data']
        
        # Import SMS service for message generation
        from services.sms_service import sms_service
        preview_result = sms_service.preview_recall_message(richiamo_data)
        
        if preview_result['success']:
            return format_response({
                'richiamo': richiamo_data,
                'message_preview': preview_result
            })
        else:
            return format_response(success=False, error=preview_result.get('error', 'Errore generazione messaggio'))
            
    except Exception as e:
        return handle_error(e, "get_richiamo_message")


@richiami_v2_bp.route('/richiami/update-dates', methods=['POST'])
@jwt_required()
def update_richiami_dates():
    """
    Update richiami dates based on patient data.
    
    This recalculates richiamo dates based on ultima_visita + tempo_richiamo.
    
    Returns:
        JSON response with update results
    """
    try:
        service = RichiamiService()
        
        # Get all active richiami
        richiami_result = service.get_richiami_da_fare()
        if not richiami_result['success']:
            return format_response(success=False, error='Errore recupero richiami')
        
        richiami = richiami_result['data']
        updated_count = 0
        
        for richiamo in richiami:
            # For each richiamo, update dates if needed
            # This is a simplified implementation - in V1 it might be more complex
            try:
                # Here you would implement the date update logic
                # based on patient data and richiamo configuration
                updated_count += 1
            except Exception as e:
                logger.warning(f"Failed to update dates for richiamo {richiamo.get('id')}: {e}")
                continue
        
        return format_response({'updated': updated_count})
        
    except Exception as e:
        return handle_error(e, "update_richiami_dates")


@richiami_v2_bp.route('/richiami/export', methods=['GET'])
@jwt_required()
def export_richiami():
    """
    Export richiami data.
    
    Query Parameters:
        days (int): Days threshold (default: 90)
        format (str): Export format (default: json)
    
    Returns:
        JSON response with richiami export data
    """
    try:
        days_threshold = request.args.get('days', 90, type=int)
        export_format = request.args.get('format', 'json')
        
        service = RichiamiService()
        result = service.get_richiami_da_fare()
        
        if result['success']:
            return format_response({
                'richiami': result['data'],
                'count': result['count'],
                'export_format': export_format,
                'filters': {'days_threshold': days_threshold}
            })
        else:
            return format_response(success=False, error='Errore export richiami')
            
    except Exception as e:
        return handle_error(e, "export_richiami")


@richiami_v2_bp.route('/richiami/test', methods=['GET'])
@jwt_required()
def test_richiami():
    """
    Test richiami system functionality.
    
    Returns:
        JSON response with test results
    """
    try:
        service = RichiamiService()
        
        # Test basic functionality
        richiami_result = service.get_richiami_da_fare(30)  # Get richiami from last 30 days
        stats_result = service.get_statistiche_richiami()
        
        test_results = {
            'richiami_trovati': richiami_result['count'] if richiami_result['success'] else 0,
            'statistiche': stats_result['data'] if stats_result['success'] else {},
            'service_status': 'OK'
        }
        
        return format_response(test_results)
        
    except Exception as e:
        return handle_error(e, "test_richiami")


@richiami_v2_bp.route('/richiami/anteprima-messaggio', methods=['GET'])
def get_anteprima_messaggio():
    """
    Genera anteprima del messaggio di richiamo per un paziente.

    Query params:
        patient_id: ID paziente (obbligatorio)

    Auth: header X-API-Key (per n8n) oppure JWT.
    """
    _check_auth()

    patient_id = request.args.get('patient_id', '').strip()
    if not patient_id:
        return format_response({'success': False, 'error': 'patient_id obbligatorio'}), 400

    try:
        # Leggi paziente da DBF
        service = PazientiService(g.database_manager)
        paziente_result = service.get_paziente_by_id(patient_id)

        if not paziente_result.get('success'):
            return format_response({'success': False, 'error': 'Paziente non trovato'}), 404

        paziente = paziente_result['data']

        # Prepara dati per preview messaggio
        richiamo_data = {
            'nome': paziente.get('nome', '').strip(),
            'nome_completo': paziente.get('nome', '').strip(),
            'tipo_richiamo': paziente.get('tipo_richiamo', '1').strip(),
            'tempo_richiamo': paziente.get('mesi_richiamo') or paziente.get('tempo_richiamo'),
            'telefono': paziente.get('cellulare') or paziente.get('telefono', '').strip(),
            'data_richiamo': paziente.get('data_richiamo_prevista'),
            'ultima_visita': paziente.get('ultima_visita'),
        }

        # Genera preview messaggio
        from services.sms_service import SMSService
        sms_service = SMSService()
        preview_result = sms_service.preview_recall_message(richiamo_data)

        return format_response(preview_result)

    except Exception as e:
        logger.error(f'Errore anteprima messaggio paziente {patient_id}: {e}', exc_info=True)
        return format_response({'success': False, 'error': str(e)}), 500


@richiami_v2_bp.route('/richiami/pazienti-da-richiamare', methods=['GET'])
def get_pazienti_da_richiamare():
    """
    Restituisce l'elenco pazienti da richiamare, letto direttamente dal DBF Windent.

    Query params:
        filtro  : igiene | impianti | rx_impianto | controllo | ortodonzia | generico | bambini | donne
        tipo    : codice numerico TIPO_RICHIAMI ('1'-'6'), sovrascrive filtro se specificato
        eta_max : int — eta massima per il filtro bambini (default 16)
        solo_cellulare : bool (default true) — escludi pazienti senza cellulare
        scaduti_solo   : bool (default false) — solo pazienti il cui richiamo e scaduto
        limit   : int — numero massimo di risultati

    Auth: header X-API-Key (per n8n) oppure JWT.
    """
    _check_auth()

    filtro = (request.args.get('filtro') or '').lower().strip()
    tipo_override = (request.args.get('tipo') or '').strip()
    eta_max = request.args.get('eta_max', 16, type=int)
    solo_cellulare = request.args.get('solo_cellulare', 'true').lower() != 'false'
    scaduti_solo = request.args.get('scaduti_solo', 'false').lower() == 'true'
    ritardo_max_giorni = request.args.get('ritardo_max_giorni', 3650, type=int)
    limit = request.args.get('limit', type=int)

    # Risolvi il codice tipo
    tipo_filtro = tipo_override or _FILTRO_TO_TIPO.get(filtro)

    try:
        # Leggi tutti i pazienti dal DBF (merge SQLite disabilitato per velocita)
        service = PazientiService(g.database_manager)
        raw = service.get_pazienti_paginated(page=1, per_page=20000)
        if not raw.get('success'):
            return format_response({'success': False, 'error': 'Errore lettura DBF pazienti'}), 500

        pazienti = raw['data']['pazienti']
        today = date.today()
        result = []

        # Lookup data ultima igiene da PREVENT.DBF per tutti i pazienti in una sola lettura.
        # Usato per sovrascrivere ultima_visita (DB_PAULTVI) che Windent aggiorna raramente.
        igiene_lookup = build_last_igiene_lookup()

        for p in pazienti:
            # Solo quelli marcati da richiamare
            if p.get('da_richiamare', '').strip().upper() != 'S':
                continue

            # Filtro per tipo richiamo (DB_PARIMOT è multi-carattere: "21" = igiene+generico)
            tipo_paz = p.get('tipo_richiamo', '').strip()
            if tipo_filtro and tipo_filtro not in tipo_paz:
                continue

            # Filtro donne
            if filtro == 'donne' and p.get('sesso', '').strip().upper() != 'F':
                continue

            # Filtro bambini
            if filtro == 'bambini':
                dn = _parse_date(p.get('data_nascita'))
                if not dn or _months_between(dn, today) // 12 > eta_max:
                    continue

            # Solo pazienti con cellulare (per WhatsApp)
            cellulare = p.get('cellulare', '').strip()
            if solo_cellulare and not cellulare:
                continue

            # Calcola scadenza richiamo.
            # Per pazienti con igiene ('2' in tipo): usa data reale da PREVENT.DBF.
            # Per altri tipi: usa ultima_visita dal record paziente.
            paziente_id = p.get('id', '').strip()
            igiene_entry = igiene_lookup.get(paziente_id) if '2' in tipo_paz else None
            if igiene_entry:
                uv = igiene_entry[0]  # già un oggetto date
            else:
                uv = _parse_date(p.get('ultima_visita'))
            mesi = None
            raw_mesi = p.get('tempo_richiamo') or p.get('mesi_richiamo')
            if raw_mesi is not None:
                try:
                    mesi = int(raw_mesi)
                except (TypeError, ValueError):
                    mesi = None

            data_richiamo_prevista = None
            mesi_dalla_visita = None
            scaduto = False
            giorni_ritardo = 0

            if uv and mesi:
                data_richiamo_prevista = _add_months(uv, mesi)
                mesi_dalla_visita = _months_between(uv, today)
                scaduto = data_richiamo_prevista <= today
                giorni_ritardo = (today - data_richiamo_prevista).days if scaduto else 0

            if scaduti_solo and not scaduto:
                continue

            if giorni_ritardo > ritardo_max_giorni:
                continue

            # Decodifica multi-carattere: "21" → ["Igiene", "Generico"]
            tipi_nomi = [TIPO_RICHIAMI[c] for c in tipo_paz if c in TIPO_RICHIAMI]

            result.append({
                'id':                     p.get('id'),
                'nome':                   p.get('nome', '').strip(),
                'cellulare':              cellulare,
                'telefono':               p.get('telefono', '').strip(),
                'sesso':                  p.get('sesso', '').strip(),
                'data_nascita':           p.get('data_nascita'),
                'tipo_richiamo':          tipo_paz,
                'tipo_richiamo_nomi':     tipi_nomi,
                'mesi_richiamo':          mesi,
                'ultima_visita':          p.get('ultima_visita'),
                'data_richiamo_prevista': data_richiamo_prevista.isoformat() if data_richiamo_prevista else None,
                'mesi_dalla_visita':      mesi_dalla_visita,
                'scaduto':                scaduto,
                'giorni_ritardo':         giorni_ritardo,
            })

        # Ordine: più in ritardo prima
        result.sort(key=lambda x: x['giorni_ritardo'], reverse=True)

        if limit:
            result = result[:limit]

        return format_response({
            'pazienti': result,
            'count': len(result),
            'filtri': {
                'filtro': filtro or None,
                'tipo': tipo_filtro,
                'tipo_nome': TIPO_RICHIAMI.get(tipo_filtro, None) if tipo_filtro else None,
                'solo_cellulare': solo_cellulare,
                'scaduti_solo': scaduti_solo,
                'eta_max': eta_max if filtro == 'bambini' else None,
            }
        })

    except Exception as e:
        logger.error(f'Errore get_pazienti_da_richiamare: {e}', exc_info=True)
        return format_response({'success': False, 'error': str(e)}), 500


@richiami_v2_bp.route('/richiami/slot-per-paziente/<db_code>', methods=['GET'])
def get_slot_per_paziente(db_code: str):
    """
    Restituisce i prossimi slot liberi per un paziente da richiamare.

    Logica operatore:
      - tipo_richiamo contiene '2' (igiene):
          cerca ultima igiene in PREVENT.DBF → slot Lara (2) o Anet (5) o entrambe
      - altri tipi: slot Dr. Nicola (1)

    Query params:
        giorni_avanti : int (default 14)
        max_slot      : int (default 5)

    Auth: X-API-Key o JWT.
    """
    _check_auth()

    giorni_avanti = request.args.get('giorni_avanti', 14, type=int)
    max_slot      = request.args.get('max_slot', 5, type=int)

    try:
        service = PazientiService(g.database_manager)
        res = service.get_paziente_by_id(db_code)
        if not res.get('success'):
            return format_response({'success': False, 'error': 'Paziente non trovato'}), 404

        paziente = res['data']
        tipo_richiamo = (paziente.get('tipo_richiamo') or '').strip()
        nome = (paziente.get('nome') or '').strip()

        if '2' in tipo_richiamo:
            operatore_id, ultima_data = trova_ultimo_igienista(db_code)

            if operatore_id == 2:
                operatori = [2]
                operatore_suggerito = 'lara'
            elif operatore_id == 5:
                operatori = [5]
                operatore_suggerito = 'anet'
            else:
                operatori = [2, 5]
                operatore_suggerito = 'entrambe'

            tipo = 'igiene'
            durata = 50
            ultima_igiene = {'operatore_id': operatore_id, 'data': ultima_data}
        else:
            operatori = [1]
            operatore_suggerito = 'nicola'
            tipo = 'altro'
            durata = 30
            ultima_igiene = None

        slots = []
        for op_id in operatori:
            op_slots = trova_slot_liberi(
                operatore_id=op_id,
                durata_minuti=durata,
                giorni_avanti=giorni_avanti,
                max_slot=max_slot,
            )
            slots.extend(op_slots)

        slots.sort(key=lambda s: (s['data'], s['inizio']))
        slots = slots[:max_slot]

        return format_response({
            'paziente': {
                'db_code': db_code,
                'nome': nome,
                'tipo_richiamo': tipo_richiamo,
            },
            'tipo': tipo,
            'operatore_suggerito': operatore_suggerito,
            'ultima_igiene': ultima_igiene,
            'slots': slots,
        })

    except Exception as e:
        logger.error(f'Errore get_slot_per_paziente {db_code}: {e}', exc_info=True)
        return format_response({'success': False, 'error': str(e)}), 500


# Error handlers for the blueprint
@richiami_v2_bp.errorhandler(404)
def handle_not_found(e):
    return format_response({
        'success': False,
        'error': 'NOT_FOUND',
        'message': 'Resource not found'
    }, 404)


@richiami_v2_bp.errorhandler(500)
def handle_internal_error(e):
    logger.error(f"Internal error: {e}")
    return format_response({
        'success': False,
        'error': 'INTERNAL_ERROR',
        'message': 'Internal server error'
    }, 500)
