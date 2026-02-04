"""
Calendar API V2 - Simplified version based on V1 logic

Migrated from V1 maintaining exact functionality with V2 architecture patterns.
Follows V1 working endpoints exactly but with V2 response format and conventions.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import date, datetime
import logging
import uuid
import threading
import os
from typing import Dict, Any, List, Optional
from pathlib import Path
from core.google_calendar_client import GoogleCalendarClient
from utils.dbf_utils import get_optimized_reader # New import

import services.calendar_service as calendar_service_module

# Determine base path for Google Calendar credentials
# Go up from api/ to server_v2/
_BASE_DIR = Path(__file__).parent.parent  # api/ -> server_v2/
_CREDENTIALS_PATH = _BASE_DIR / "instance" / "credentials.json"
_TOKEN_PATH = _BASE_DIR / "tokens" / "google_calendar.json"
from core.exceptions import (
    GoogleCredentialsNotFoundError,
    CalendarSyncError,
    GoogleQuotaError
)
from app_v2 import format_response

logger = logging.getLogger(__name__)

calendar_v2_bp = Blueprint('calendar_v2', __name__)

# Job tracking per operazioni asincrone (come V1)
sync_jobs: Dict[str, Dict[str, Any]] = {}
clear_jobs: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# SECTION 1: STATISTICHE E ANALYTICS (from V1)
# =============================================================================

# Endpoints migrated to SECTION 3.1: STATISTICS (Optimized)
# See below for implementation.


# =============================================================================
# SECTION 2: GOOGLE CALENDAR INTEGRATION (from V1)
# =============================================================================

@calendar_v2_bp.route('/list', methods=['GET'])
@jwt_required()
def list_calendars():
    """List Google calendars. V1 logic with V2 error handling."""
    from flask_jwt_extended import get_jwt_identity
    
    try:
        # Verify JWT is working
        current_user = get_jwt_identity()
        logger.info(f"list_calendars called by user: {current_user} - attempting to retrieve calendars")
        
        calendars = calendar_service_module.list_google_calendars()
        
        logger.info(f"Successfully retrieved {len(calendars)} calendars")
        return format_response(
            success=True,
            data={'calendars': calendars},
            message='Calendars retrieved successfully',
            state='success'
        ), 200
        
    except GoogleCredentialsNotFoundError as e:
        logger.warning(f"Google credentials not found in list_calendars: {e}")
        return format_response(
            success=False,
            error='GOOGLE_AUTH_REQUIRED',
            message='Google Calendar authentication required. Use the /api/v2/calendar/reauth-url endpoint to get a new authentication URL.',
            data={
                'action_required': 're-authenticate',
                'auth_type': 'google_calendar',
                'reauth_endpoint': '/api/v2/calendar/reauth-url'
            },
            state='error'
        ), 200  # Changed to 200 to avoid confusion with JWT 401
        
    except Exception as e:
        logger.error(f"Error in list_calendars: {e}", exc_info=True)
        return format_response(
            success=False,
            error='CALENDAR_LIST_ERROR',
            message=f'Error retrieving calendars: {str(e)}',
            state='error'
        ), 500


@calendar_v2_bp.route('/sync', methods=['POST'])
@jwt_required()
def sync_calendar():
    """Sync appointments to Google Calendar. Uses new functional service."""
    try:
        data = request.get_json()
        # calendar_id is now less relevant for sync_calendar_from_records as it's configured in calendar_service.py itself
        month = data.get("month")
        year = data.get("year")
        studio_id = data.get("studio_id") # Will be used for filtering
        end_month = data.get("end_month")
        end_year = data.get("end_year")
        
        if not (month and year and studio_id): # calendar_id is not directly used by sync_calendar_from_records
            return format_response(
                success=False,
                error='MISSING_PARAMETERS',
                message='month, year and studio_id are required',
                state='error'
            ), 400
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job tracking
        sync_jobs[job_id] = {
            "status": "in_progress",
            "progress": 0,
            "synced": 0,
            "total": 0,
            "message": "Starting synchronization...",
            "error": None,
            "cancelled": False
        }
        
        def sync_job():
            try:
                # Instantiate DBF reader
                dbf_reader = get_optimized_reader()

                all_appointments_raw = []
                # Determine date range and read appointments
                if end_month and end_year:
                    current_month, current_year = month, year
                    while (current_year < end_year) or (current_year == end_year and current_month <= end_month):
                        month_appointments = dbf_reader.get_appointments_optimized(current_month, current_year)
                        all_appointments_raw.extend(month_appointments)
                        
                        current_month += 1
                        if current_month > 12:
                            current_month = 1
                            current_year += 1
                else:
                    all_appointments_raw = dbf_reader.get_appointments_optimized(month, year)
                
                # Filter by studio (keeping this logic here)
                filtered_appointments_for_sync = [
                    app for app in all_appointments_raw 
                    if int(app.get('STUDIO', 0)) == int(studio_id)
                ]
                
                # Progress callback (simplified, as sync_calendar_from_records doesn't expose granular progress)
                def update_sync_progress(synced, total, message=""):
                    if sync_jobs[job_id]["cancelled"]:
                        raise Exception("Sincronizzazione interrotta dall'utente")
                    
                    # Usa 'processed' invece di 'synced' per coerenza
                    sync_jobs[job_id].update({
                        "progress": int(100 * synced / max(1, total)) if total > 0 else 0,
                        "processed": synced,  # <-- CHIAVE STANDARD
                        "total": total,
                        "message": message
                    })

                # Call the new functional service
                # The calendar_id from the request is configured in calendar_service.py itself (CALENDAR_ID_STUDIO_X)
                # and doesn't need to be passed to sync_calendar_from_records.
                # Pass the callback to the service
                sync_result = calendar_service_module.sync_calendar_from_records(
                    filtered_appointments_for_sync,
                    on_progress=lambda synced, total: update_sync_progress(synced, total, f"Sincronizzati {synced}/{total} eventi...")
                )
                
                # Update final status
                sync_jobs[job_id]["status"] = "completed"
                sync_jobs[job_id]["message"] = "Synchronization completed."
                sync_jobs[job_id]["processed"] = sync_result['sync'].get('inserted', 0) + sync_result['sync'].get('updated', 0)
                sync_jobs[job_id]["total"] = len(filtered_appointments_for_sync) # Total processed appointments
                sync_jobs[job_id]["progress"] = 100
            
            except GoogleQuotaError as e:
                logger.error(f"Google Quota Error stopped the sync job: {e}")
                sync_jobs[job_id]["status"] = "error"
                sync_jobs[job_id]["error"] = "Google API quota exceeded. Please try again later."
                sync_jobs[job_id]["message"] = "Errore: Quota API di Google superata."
            except Exception as e:
                if "cancelled by user" in str(e):
                    sync_jobs[job_id]["status"] = "cancelled"
                    sync_jobs[job_id]["message"] = "Synchronization cancelled by user"
                else:
                    logger.error(f"Synchronization error: {e}", exc_info=True)
                    sync_jobs[job_id]["status"] = "error"
                    sync_jobs[job_id]["error"] = str(e)
                    sync_jobs[job_id]["message"] = f"Error: {str(e)}"
        
        # Start async thread
        thread = threading.Thread(target=sync_job)
        thread.start()
        
        return jsonify({"job_id": job_id}), 202
        
    except Exception as e:
        logger.error(f"Error starting sync: {e}", exc_info=True)
        return format_response(
            success=False,
            error='SYNC_START_ERROR',
            message=f'Error starting sync: {str(e)}',
            state='error'
        ), 500


@calendar_v2_bp.route('/sync-status', methods=['GET'])
@jwt_required()
def sync_status():
    """Check sync job status. V1 logic."""
    job_id = request.args.get("jobId")
    #logger.info(f"Status request for job: {job_id}")
    
    if not job_id:
        return format_response(
            success=False,
            error='JOB_ID_REQUIRED',
            message='jobId parameter is required',
            state='error'
        ), 400
    
    if job_id not in sync_jobs:
        logger.warning(f"Job {job_id} not found. Available jobs: {list(sync_jobs.keys())}")
        return format_response(
            success=False,
            error='JOB_NOT_FOUND',
            message='Job not found',
            state='error'
        ), 404
    
    status = sync_jobs[job_id]
    #logger.info(f"Status job {job_id}: {status}")
    
    return jsonify(status), 200


@calendar_v2_bp.route('/sync/cancel', methods=['POST'])
@jwt_required()
def cancel_sync_job():
    """Cancel sync job. V1 logic."""
    try:
        data = request.get_json()
        job_id = data.get("job_id")
        
        if not job_id:
            return format_response(
                success=False,
                error='JOB_ID_REQUIRED',
                message='job_id is required',
                state='error'
            ), 400
        
        if job_id not in sync_jobs:
            return format_response(
                success=False,
                error='JOB_NOT_FOUND',
                message='Job not found',
                state='error'
            ), 404
        
        # Mark job as cancelled
        if sync_jobs[job_id]["status"] == "in_progress":
            sync_jobs[job_id]["cancelled"] = True
            logger.info(f"Job {job_id} marked for cancellation")
            
            return format_response(
                success=True,
                message='Job cancelled successfully',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error='JOB_NOT_IN_PROGRESS',
                message='Job is not in progress',
                state='error'
            ), 400
            
    except Exception as e:
        logger.error(f"Error cancelling sync job: {e}")
        return format_response(
            success=False,
            error='CANCEL_ERROR',
            message=f'Error cancelling job: {str(e)}',
            state='error'
        ), 500


@calendar_v2_bp.route('/clear/<path:calendar_id>', methods=['DELETE'])
@jwt_required()
def clear_calendar(calendar_id: str):
    """Clear all events from Google Calendar using async job. Uses new functional service."""
    try:
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job tracking
        clear_jobs[job_id] = {
            "status": "in_progress",
            "progress": 0,
            "deleted": 0,
            "total": 0, # Cannot know total events beforehand with new blocking function
            "message": "Starting calendar clearing...",
            "error": None,
            "cancelled": False,
            "calendar_id": calendar_id
        }
        
        def clear_job():
            try:
                # The new function is blocking and does not offer a progress callback.
                # So we simply call it and update status after completion.
                deleted_count = calendar_service_module.clear_calendar(calendar_id)
                
                # Mark as completed
                clear_jobs[job_id]["status"] = "completed"
                clear_jobs[job_id]["message"] = f"Calendar cleared successfully. Deleted {deleted_count} events."
                clear_jobs[job_id]["deleted"] = deleted_count
                clear_jobs[job_id]["total"] = deleted_count # Total is now deleted count
                clear_jobs[job_id]["progress"] = 100
                
            except GoogleQuotaError as e:
                logger.error(f"Google Quota Error stopped the clear job: {e}")
                clear_jobs[job_id]["status"] = "error"
                clear_jobs[job_id]["error"] = "Google API quota exceeded. Please try again later."
                clear_jobs[job_id]["message"] = "Errore: Quota API di Google superata."
            except Exception as e:
                if "cancelled by user" in str(e):
                    logger.info(f"Clear operation cancelled by user: {e}")
                    clear_jobs[job_id]["status"] = "cancelled"
                    clear_jobs[job_id]["message"] = "Clear operation cancelled by user"
                else:
                    logger.error(f"Clear operation error: {e}", exc_info=True)
                    clear_jobs[job_id]["status"] = "error"
                    clear_jobs[job_id]["error"] = str(e)
                    clear_jobs[job_id]["message"] = f"Error: {str(e)}"
        
        # Start async thread
        thread = threading.Thread(target=clear_job)
        thread.start()
        
        return jsonify({"job_id": job_id}), 202
        
    except Exception as e:
        logger.error(f"Error starting clear: {e}", exc_info=True)
        return format_response(
            success=False,
            error='CLEAR_START_ERROR',
            message=f'Error starting clear: {str(e)}',
            state='error'
        ), 500


@calendar_v2_bp.route('/clear-status', methods=['GET'])
@jwt_required()
def get_clear_status():
    """Get clear job status. V1 logic."""
    job_id = request.args.get("jobId")
    logger.info(f"Clear status request for job: {job_id}")
    
    if not job_id:
        return format_response(
            success=False,
            error='JOB_ID_REQUIRED',
            message='jobId parameter is required',
            state='error'
        ), 400
    
    if job_id not in clear_jobs:
        logger.warning(f"Clear job {job_id} not found. Available jobs: {list(clear_jobs.keys())}")
        return format_response(
            success=False,
            error='JOB_NOT_FOUND',
            message='Clear job not found',
            state='error'
        ), 404
    
    status = clear_jobs[job_id]
    logger.info(f"Clear status job {job_id}: {status}")
    
    return jsonify(status), 200


@calendar_v2_bp.route('/clear/cancel', methods=['POST'])
@jwt_required()
def cancel_clear_job():
    """Cancel clear job. V1 logic."""
    try:
        data = request.get_json()
        job_id = data.get("job_id")
        
        if not job_id:
            return format_response(
                success=False,
                error='JOB_ID_REQUIRED',
                message='job_id is required',
                state='error'
            ), 400
        
        if job_id not in clear_jobs:
            return format_response(
                success=False,
                error='JOB_NOT_FOUND',
                message='Clear job not found',
                state='error'
            ), 404
        
        # Mark job as cancelled
        if clear_jobs[job_id]["status"] == "in_progress":
            clear_jobs[job_id]["cancelled"] = True
            logger.info(f"Clear job {job_id} marked for cancellation")
            
            return format_response(
                success=True,
                message='Clear job cancelled successfully',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error='JOB_NOT_IN_PROGRESS',
                message='Clear job is not in progress',
                state='error'
            ), 400
            
    except Exception as e:
        logger.error(f"Error cancelling clear job: {e}", exc_info=True)
        return format_response(
            success=False,
            error='CANCEL_CLEAR_ERROR',
            message=f'Error cancelling clear job: {str(e)}',
            state='error'
        ), 500


# =============================================================================
# SECTION 3: APPOINTMENTS DATA (from V1)
# =============================================================================

@calendar_v2_bp.route('/appointments', methods=['GET'])
@jwt_required()
def get_appointments_for_month():
    """Get appointments for specific month/year using the optimized DBF reader."""
    try:
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        studio = request.args.get('studio', type=int) # This is the studio_id for filtering
        
        logger.info(f"Request appointments for month={month}, year={year}, studio={studio}")
        
        if not month or not year:
            logger.error("Missing month and year parameters")
            return format_response(
                success=False,
                error='MISSING_PARAMETERS',
                message='month and year are required',
                state='error'
            ), 400
        
        # Get the optimized DBF reader
        dbf_reader = get_optimized_reader()
        
        # Get appointments. The reader handles studio filtering.
        appointments = dbf_reader.get_appointments_optimized(month, year, studio_id=studio)
        
        logger.info(f"Returning {len(appointments)} appointments")
        
        return jsonify({'appointments': appointments})
        
    except Exception as e:
        logger.error(f"Error in get_appointments_for_month: {e}", exc_info=True)
        return format_response(
            success=False,
            error='APPOINTMENTS_ERROR',
            message=f'Error retrieving appointments: {str(e)}',
            state='error'
        ), 500


# =============================================================================
# SECTION 3.1: STATISTICS (Optimized)
# =============================================================================

@calendar_v2_bp.route('/stats/year', methods=['GET'])
@jwt_required()
def get_appointments_stats_for_year():
    """
    Get aggregated appointment statistics for current, next and prev year.
    Used for charts.
    """
    try:
        from datetime import datetime
        current_year = datetime.now().year
        years_to_fetch = [current_year - 1, current_year, current_year + 1]
        
        dbf_reader = get_optimized_reader()
        stats = dbf_reader.get_stats_aggregates(years_to_fetch)
        
        return format_response(
            success=True,
            data=stats,
            message='Yearly stats retrieved successfully'
        )
    except Exception as e:
        logger.error(f"Error getting yearly stats: {e}", exc_info=True)
        return format_response(success=False, error=str(e), state='error'), 500

@calendar_v2_bp.route('/stats/first-visits', methods=['GET'])
@jwt_required()
def get_first_visits_stats():
    """
    Get first visits statistics:
    - Current Year Total
    - Previous Year Total
    - Current Year YTD (01/01 -> Today)
    - Previous Year YTD (01/01 -> Same date last year)
    """
    try:
        from datetime import datetime
        now = datetime.now()
        current_year = now.year
        prev_year = current_year - 1
        
        # YTD Limit: today's month and day
        ytd_limit = (now.month, now.day)
        
        dbf_reader = get_optimized_reader()
        # Fetch stats for both years with YTD calculation
        stats = dbf_reader.get_stats_aggregates([prev_year, current_year], ytd_limit=ytd_limit)
        
        # Calculate totals
        def calculate_metrics(year_str):
            months_data = stats.get(year_str, [])
            total = sum(m.get('first_visits', 0) for m in months_data)
            ytd = sum(m.get('first_visits_ytd', 0) for m in months_data)
            return total, ytd

        curr_total, curr_ytd = calculate_metrics(str(current_year))
        prev_total, prev_ytd = calculate_metrics(str(prev_year))
        
        return format_response(
            success=True,
            data={
                'current_year': {
                    'year': current_year,
                    'total': curr_total,
                    'ytd': curr_ytd
                },
                'prev_year': {
                    'year': prev_year,
                    'total': prev_total,
                    'ytd': prev_ytd
                }
            },
            message='First visits stats retrieved successfully'
        )
    except Exception as e:
        logger.error(f"Error getting first visits stats: {e}", exc_info=True)
        return format_response(success=False, error=str(e), state='error'), 500

@calendar_v2_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def get_appointments_stats_summary():
    """
    Get summary stats for dashboard cards (curr, prev, next month counts).
    """
    try:
        from datetime import datetime, date
        today = date.today()
        current_month = today.month
        current_year = today.year
        
        # Calculate prev and next params
        prev_month = current_month - 1 if current_month > 1 else 12
        prev_year = current_year if current_month > 1 else current_year - 1
        
        next_month = current_month + 1 if current_month < 12 else 1
        next_year = current_year if current_month < 12 else current_year + 1
        
        # Fetch needed years
        years_needed = {current_year, prev_year, next_year}
        
        dbf_reader = get_optimized_reader()
        stats = dbf_reader.get_stats_aggregates(list(years_needed))
        
        # Helper to get count
        def get_count(y, m):
            year_data = stats.get(str(y), [])
            # year_data is a list of dicts, assuming they are ordered 1-12 OR we find by month
            # The get_stats_aggregates returns a list indexed 0..11 for months 1..12
            # Let's double check implementation: "for month in range(1, 13)... year_list.append"
            # So month M is at index M-1.
            if 0 < m <= 12 and len(year_data) >= m:
                 # Verification: list created with range(1,13), so length is 12.
                 return year_data[m-1]['count']
            return 0

        data = {
            'mese_corrente': get_count(current_year, current_month),
            'mese_precedente': get_count(prev_year, prev_month),
            'mese_prossimo': get_count(next_year, next_month)
        }
        
        return format_response(
            success=True,
            data=data,
            message='Stats summary retrieved successfully'
        )
    except Exception as e:
        logger.error(f"Error getting stats summary: {e}", exc_info=True)
        return format_response(success=False, error=str(e), state='error'), 500


# =============================================================================
# SECTION 4: OAUTH AUTHENTICATION (from V1)
# =============================================================================

@calendar_v2_bp.route('/reauth-url', methods=['GET'])
@jwt_required()
def get_google_oauth_url():
    """Get Google OAuth URL for web flow."""
    from flask_jwt_extended import get_jwt_identity
    
    try:
        # Verify JWT is working
        current_user = get_jwt_identity()
        logger.info(f"get_google_oauth_url called by user: {current_user}")
        
        # Check if credentials file exists
        if not _CREDENTIALS_PATH.exists():
            logger.error(f"Google credentials file not found at: {_CREDENTIALS_PATH}")
            return format_response(
                success=False,
                error='CREDENTIALS_FILE_NOT_FOUND',
                message=f'Google credentials file not found at: {_CREDENTIALS_PATH}. Please ensure credentials.json is in the server_v2 directory.',
                state='error'
            ), 404
        
        client = GoogleCalendarClient(
            credentials_path=_CREDENTIALS_PATH,
            token_path=_TOKEN_PATH,
        )
        # The redirect URI must match exactly what's in Google Cloud Console
        # This was the value used in the old service code.
        redirect_uri = 'http://localhost:5001/oauth/callback'

        auth_url = client.generate_web_auth_url(redirect_uri=redirect_uri)
        
        logger.info(f"OAuth URL generated successfully for user: {current_user}")
        return format_response(
            success=True,
            data={'auth_url': auth_url},
            message='OAuth URL generated successfully',
            state='success'
        ), 200
        
    except GoogleCredentialsNotFoundError as e:
        logger.error(f"Google credentials not found: {e}", exc_info=True)
        return format_response(
            success=False,
            error='GOOGLE_CREDENTIALS_NOT_FOUND',
            message=f'Google credentials not found: {str(e)}',
            state='error'
        ), 404
    except Exception as e:
        logger.error(f"Error generating OAuth URL: {e}", exc_info=True)
        return format_response(
            success=False,
            error='OAUTH_URL_ERROR',
            message=f'Error generating OAuth URL: {str(e)}',
            state='error'
        ), 500


# =============================================================================
# SECTION 5: OAUTH CALLBACK (from V1)
# =============================================================================

# OAuth callback moved to app_v2.py since Google calls /oauth/callback directly


@calendar_v2_bp.route('/oauth/status', methods=['GET'])
@jwt_required()
def oauth_status():
    """Check OAuth authentication status. V1 logic."""
    try:
        import os
        
        if os.path.exists('instance/token.json'):
            return format_response(
                success=True,
                data={'authenticated': True},
                message='Google authentication active',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                data={'authenticated': False},
                message='Google authentication required',
                state='warning'
            ), 200
            
    except Exception as e:
        logger.error(f"Error checking OAuth status: {e}")
        return format_response(
            success=False,
            error='STATUS_CHECK_ERROR',
            message=f'Error checking authentication status: {str(e)}',
            state='error'
        ), 500


# =============================================================================
# SECTION 6: UTILITIES AND TESTING
# =============================================================================

@calendar_v2_bp.route('/test-jwt', methods=['GET'])
@jwt_required()
def test_jwt():
    """Test endpoint to verify JWT authentication is working."""
    from flask_jwt_extended import get_jwt_identity
    
    try:
        current_user = get_jwt_identity()
        logger.info(f"JWT test successful for user: {current_user}")
        
        return format_response(
            success=True,
            data={
                'authenticated': True,
                'user': current_user,
                'message': 'JWT authentication is working correctly'
            },
            message='JWT test successful',
            state='success'
        ), 200
    except Exception as e:
        logger.error(f"JWT test error: {e}", exc_info=True)
        return format_response(
            success=False,
            error='JWT_TEST_ERROR',
            message=f'JWT test failed: {str(e)}',
            state='error'
        ), 500

@calendar_v2_bp.route('/sync/reset', methods=['POST'])
def reset_sync_state():
    """
    Resetta completamente lo stato di sincronizzazione.
    Da usare quando tutto è corrotto.
    """
    try:
        from services.sync_state_manager import get_sync_state_manager
        
        sync_manager = get_sync_state_manager()
        
        # Backup vecchio state (se esiste)
        import shutil
        import datetime
        import os
        
        sync_state_path = 'instance/sync_state.json'
        if os.path.exists(sync_state_path):
            backup_name = f"instance/sync_state.backup.{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            shutil.copy(sync_state_path, backup_name)
            backup_msg = f'Backup creato: {backup_name}'
        else:
            backup_name = None
            backup_msg = 'Nessun file da backuppare'
        
        # Reset state
        sync_manager.save_sync_state({})
        
        from app_v2 import format_response
        return format_response(
            success=True,
            message='Sync state resettato con successo',
            data={
                'message': 'Sync state resettato con successo',
                'backup': backup_name,
                'backup_info': backup_msg
            }
        ), 200
        
    except Exception as e:
        logger.error(f"Errore reset sync state: {e}")
        from app_v2 import format_response
        return format_response(
            success=False,
            error='RESET_ERROR',
            message=str(e),
            state='error'
        ), 500




@calendar_v2_bp.route('/first-sync-status', methods=['GET'])
@jwt_required()
def check_first_sync_status():
    """
    Verifica se è il primo avvio (sync_state.json mancante) e se il token OAuth esiste.
    Usato dalla Dashboard per decidere se avviare la procedura automatica.
    """
    try:
        import os
        from pathlib import Path
        
        # Check sync_state.json
        sync_state_path = Path('instance/sync_state.json')
        is_first_sync = not sync_state_path.exists()
        
        # Check token OAuth
        token_exists = os.path.exists(_TOKEN_PATH)
        
        # Check credentials
        credentials_exist = os.path.exists(_CREDENTIALS_PATH)
        
        return format_response(
            success=True,
            data={
                'is_first_sync': is_first_sync,
                'token_exists': token_exists,
                'credentials_exist': credentials_exist,
                'needs_auth': not token_exists or not credentials_exist,
                'needs_auto_sync': is_first_sync and token_exists and credentials_exist
            },
            message='First sync status retrieved',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error checking first sync status: {e}", exc_info=True)
        return format_response(
            success=False,
            error='FIRST_SYNC_CHECK_ERROR',
            message=str(e),
            state='error'
        ), 500


@calendar_v2_bp.route('/health', methods=['GET'])
def calendar_health_check():
    try:
        #from services.calendar_service import calendar_service as calendar_service_module
        import services.calendar_service as calendar_service_module

        from services.sync_state_manager import get_sync_state_manager
        
        # Test connessione
        connection_test = calendar_service_module.test_google_connection()
        
        # Conta sync state
        sync_manager = get_sync_state_manager()
        try:
            sync_manager._load_sync_state()
        except Exception:
            # Non-blocking error for sync state
            pass
        
        return format_response(
            success=True,
            data={
                'google_calendar_connected': connection_test,
                'google_error': None if connection_test else "Impossibile connettersi a Google Calendar",
                'sync_state_entries': len(sync_manager.sync_state) if hasattr(sync_manager, 'sync_state') else 0,
                'token_exists': os.path.exists('instance/token.json') or os.path.exists(_TOKEN_PATH),
                'credentials_exists': os.path.exists('instance/credentials.json') or os.path.exists(_CREDENTIALS_PATH)
            },
            message='Health check passed',
            state='success'
        )
    except Exception as e:
        logger.error(f"Error in calendar_health_check: {e}", exc_info=True)
        return format_response(
            success=False,
            error='HEALTH_CHECK_ERROR',
            message=str(e),
            state='error'
        ), 500




@calendar_v2_bp.route('/auto-reset-and-sync', methods=['POST'])
@jwt_required()
def auto_reset_and_sync():
    """
    Pulizia automatica Google Calendar + sincronizzazione 3 settimane successive.
    Usato al primo avvio quando sync_state.json manca.
    """
    try:
        from datetime import datetime, timedelta
        
        # Calcola range 3 settimane successive
        today = datetime.now()
        # Lunedì della settimana SUCCESSIVA
        days_until_next_monday = (7 - today.weekday()) % 7
        if days_until_next_monday == 0:
            days_until_next_monday = 7  # Se oggi è lunedì, prendi il prossimo
        next_monday = today + timedelta(days=days_until_next_monday)
        
        # 3 settimane = 21 giorni
        end_date = next_monday + timedelta(days=20)  # 20 giorni dopo lunedì = 3 settimane
        
        # Ottieni studio_id dalla richiesta
        data = request.get_json() or {}
        studio_id = data.get('studio_id', 1)  # Default studio 1
        
        # Determina calendar_id
        if studio_id == 1:
            calendar_id = os.getenv('CALENDAR_ID_STUDIO_1')
        elif studio_id == 2:
            calendar_id = os.getenv('CALENDAR_ID_STUDIO_2')
        else:
            return format_response(
                success=False,
                error='INVALID_STUDIO',
                message='Studio ID non valido',
                state='error'
            ), 400
        
        if not calendar_id:
            return format_response(
                success=False,
                error='CALENDAR_ID_MISSING',
                message=f'CALENDAR_ID_STUDIO_{studio_id} non configurato',
                state='error'
            ), 500
        
        # Genera job ID
        job_id = str(uuid.uuid4())
        
        # Verifica requisiti per il pre-check
        import os
        from pathlib import Path
        token_exists = os.path.exists(_TOKEN_PATH)
        credentials_exist = os.path.exists(_CREDENTIALS_PATH)
        sync_state_path = Path('instance/sync_state.json')
        sync_state_exists = sync_state_path.exists()
        
        # Inizializza job tracking con fase di pre-check
        sync_jobs[job_id] = {
            "status": "in_progress",
            "progress": 0,
            "phase": "pre_check",
            "message": "Verifica requisiti in corso...",
            "cleared": 0,
            "synced": 0,
            "total_weeks": 3,
            "current_week": 0,
            "error": None,
            "cancelled": False,
            "start_date": next_monday.strftime('%Y-%m-%d'),
            "end_date": end_date.strftime('%Y-%m-%d'),
            # Dettagli pre-check
            "pre_check": {
                "token_exists": token_exists,
                "credentials_exist": credentials_exist,
                "sync_state_exists": sync_state_exists,
                "completed": False
            }
        }
        
        def auto_sync_job():
            try:
                # FASE 0: Pre-check (già inizializzato, aspetta 2 secondi per mostrare i risultati)
                import time
                time.sleep(2)
                sync_jobs[job_id]["pre_check"]["completed"] = True
                sync_jobs[job_id]["progress"] = 10
                
                # FASE 1: Pulizia Calendar
                sync_jobs[job_id]["phase"] = "clearing"
                sync_jobs[job_id]["message"] = "Pulizia Google Calendar..."
                
                deleted_count = calendar_service_module.clear_calendar(calendar_id)
                sync_jobs[job_id]["cleared"] = deleted_count
                sync_jobs[job_id]["progress"] = 30
                
                # FASE 2: Sincronizzazione 3 settimane
                dbf_reader = get_optimized_reader()
                
                current_date = next_monday
                week_num = 1
                total_synced = 0
                
                while current_date <= end_date:
                    if sync_jobs[job_id]["cancelled"]:
                        raise Exception("Operazione annullata dall'utente")
                    
                    sync_jobs[job_id]["phase"] = f"syncing_week_{week_num}"
                    sync_jobs[job_id]["current_week"] = week_num
                    sync_jobs[job_id]["message"] = f"Sincronizzazione settimana {week_num}/3..."
                    
                    # Sincronizza la settimana corrente (7 giorni)
                    week_end = min(current_date + timedelta(days=6), end_date)
                    
                    # Leggi appuntamenti per questa settimana
                    month = current_date.month
                    year = current_date.year
                    appointments = dbf_reader.get_appointments_optimized(month, year, studio_id=studio_id)
                    
                    # Filtra per range settimana
                    week_appointments = [
                        app for app in appointments
                        if current_date.strftime('%Y%m%d') <= app.get('DATA', '') <= week_end.strftime('%Y%m%d')
                    ]
                    
                    # Sincronizza
                    if week_appointments:
                        result = calendar_service_module.sync_calendar_from_records(
                            week_appointments,
                            on_progress=None
                        )
                        total_synced += result['sync'].get('inserted', 0) + result['sync'].get('updated', 0)
                    
                    sync_jobs[job_id]["synced"] = total_synced
                    # Progresso: 10% pre-check + 30% clearing + 60% sync (20% per settimana)
                    sync_jobs[job_id]["progress"] = 40 + (week_num * 20)
                    
                    # Prossima settimana
                    current_date = week_end + timedelta(days=1)
                    week_num += 1
                
                # Completato
                sync_jobs[job_id]["status"] = "completed"
                sync_jobs[job_id]["progress"] = 100
                sync_jobs[job_id]["phase"] = "completed"
                sync_jobs[job_id]["message"] = f"Completato! {deleted_count} eventi rimossi, {total_synced} eventi sincronizzati"
                
            except GoogleQuotaError as e:
                logger.error(f"Google Quota Error: {e}")
                sync_jobs[job_id]["status"] = "error"
                sync_jobs[job_id]["error"] = "Quota API Google superata"
                sync_jobs[job_id]["message"] = "Errore: Quota API superata"
            except Exception as e:
                logger.error(f"Auto sync error: {e}", exc_info=True)
                sync_jobs[job_id]["status"] = "error"
                sync_jobs[job_id]["error"] = str(e)
                sync_jobs[job_id]["message"] = f"Errore: {str(e)}"
        
        # Avvia thread
        thread = threading.Thread(target=auto_sync_job)
        thread.start()
        
        return jsonify({"job_id": job_id}), 202
        
    except Exception as e:
        logger.error(f"Error starting auto-reset-and-sync: {e}", exc_info=True)
        return format_response(
            success=False,
            error='AUTO_SYNC_START_ERROR',
            message=str(e),
            state='error'
        ), 500




@calendar_v2_bp.route('/sync/job/<job_id>', methods=['GET'])
@jwt_required()
def get_auto_sync_job_status(job_id: str):
    """
    Controlla lo stato del job di auto-reset-and-sync.
    Usato dal frontend per mostrare il progress nella modal.
    """
    try:
        if job_id not in sync_jobs:
            return format_response(
                success=False,
                error='JOB_NOT_FOUND',
                message=f'Job {job_id} non trovato',
                state='error'
            ), 404
        
        job_status = sync_jobs[job_id]
        
        return format_response(
            success=True,
            data=job_status,
            message='Job status retrieved',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error getting job status: {e}", exc_info=True)
        return format_response(
            success=False,
            error='JOB_STATUS_ERROR',
            message=str(e),
            state='error'
        ), 500


# Error handlers
@calendar_v2_bp.errorhandler(GoogleCredentialsNotFoundError)
def handle_google_credentials_error(e):
    return format_response(
        success=False,
        error='GOOGLE_AUTH_REQUIRED',
        message=str(e),
        state='error'
    ), 401


@calendar_v2_bp.errorhandler(CalendarSyncError)  
def handle_calendar_sync_error(e):
    return format_response(
        success=False,
        error='CALENDAR_SYNC_ERROR',
        message=str(e),
        state='error'
    ), 400


@calendar_v2_bp.errorhandler(404)
def handle_not_found(e):
    return format_response(
        success=False,
        error='NOT_FOUND',
        message='Calendar endpoint not found',
        state='error'
    ), 404


@calendar_v2_bp.errorhandler(500)
def handle_internal_error(e):
    logger.error(f"Internal error: {e}")
    return format_response(
        success=False,
        error='INTERNAL_ERROR',
        message='Internal server error',
        state='error'
    ), 500