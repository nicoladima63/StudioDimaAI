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
from typing import Dict, Any, List, Optional
from pathlib import Path
from core.google_calendar_client import GoogleCalendarClient
from utils.dbf_utils import get_optimized_reader # New import

import services.calendar_service as calendar_service_module

# Determine base path for Google Calendar credentials
# Go up from api/ to server_v2/
_BASE_DIR = Path(__file__).parent.parent  # api/ -> server_v2/
_CREDENTIALS_PATH = _BASE_DIR / "credentials.json"
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

@calendar_v2_bp.route('/stats/year', methods=['GET'])
@jwt_required()
def get_appointments_stats_for_year():
    """Get appointments statistics by year/month. V1 logic with V2 response."""
    try:
        # TODO: Funzionalità non disponibile nel nuovo calendar_service.
        # La logica di lettura dal DBF deve essere spostata qui o in un nuovo servizio.
        return format_response(
            success=False,
            error='NOT_IMPLEMENTED',
            message='This feature is temporarily unavailable due to service refactoring.',
            state='error'
        ), 501
        
    except Exception as e:
        logger.error(f"Error in get_appointments_stats_for_year: {e}", exc_info=True)
        return format_response(
            success=False,
            error='STATS_ERROR',
            message=f'Error retrieving year stats: {str(e)}',
            state='error'
        ), 500


@calendar_v2_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def get_appointments_stats():
    """Get appointments summary for current/prev/next month. V1 logic."""
    try:
        # TODO: Funzionalità non disponibile nel nuovo calendar_service.
        # La logica di lettura dal DBF deve essere spostata qui o in un nuovo servizio.
        return format_response(
            success=False,
            error='NOT_IMPLEMENTED',
            message='This feature is temporarily unavailable due to service refactoring.',
            state='error'
        ), 501
        
    except Exception as e:
        logger.error(f"Error in get_appointments_stats: {e}", exc_info=True)
        return format_response(
            success=False,
            error='STATS_ERROR',
            message=f'Error retrieving statistics: {str(e)}',
            state='error'
        ), 500


@calendar_v2_bp.route('/stats/first-visits', methods=['GET'])
@jwt_required()
def get_first_visits_stats():
    """Get first visits statistics. V1 placeholder logic."""
    try:
        # TODO: Funzionalità non disponibile nel nuovo calendar_service.
        # La logica di lettura dal DBF deve essere spostata qui o in un nuovo servizio.
        return format_response(
            success=False,
            error='NOT_IMPLEMENTED',
            message='This feature is temporarily unavailable due to service refactoring.',
            state='error'
        ), 501
        
    except Exception as e:
        logger.error(f"Error in get_first_visits_stats: {e}", exc_info=True)
        return format_response(
            success=False,
            error='STATS_ERROR',
            message=f'Error retrieving first visits stats: {str(e)}',
            state='error'
        ), 500


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
                def update_sync_progress_placeholder(synced_count, total_count, message=""):
                    if sync_jobs[job_id]["cancelled"]:
                        raise Exception("Synchronization cancelled by user")
                    
                    # This progress will be coarse-grained for now
                    sync_jobs[job_id]["progress"] = int(100 * synced_count / max(1, total_count)) if total_count > 0 else 0
                    sync_jobs[job_id]["synced"] = synced_count
                    sync_jobs[job_id]["total"] = total_count
                    if message:
                        sync_jobs[job_id]["message"] = message

                # Call the new functional service
                # The calendar_id from the request is configured in calendar_service.py itself (CALENDAR_ID_STUDIO_X)
                # and doesn't need to be passed to sync_calendar_from_records.
                sync_result = calendar_service_module.sync_calendar_from_records(filtered_appointments_for_sync)
                
                # Update final status
                sync_jobs[job_id]["status"] = "completed"
                sync_jobs[job_id]["message"] = "Synchronization completed."
                sync_jobs[job_id]["synced"] = sync_result['sync'].get('inserted', 0) + sync_result['sync'].get('updated', 0)
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