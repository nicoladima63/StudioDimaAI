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

from services.calendar_service import CalendarServiceV2
from core.exceptions import (
    GoogleCredentialsNotFoundError,
    CalendarSyncError
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
        service = CalendarServiceV2()
        stats = service.get_db_appointments_stats_for_year()
        
        return format_response(
            success=True,
            data=stats,
            message='Year statistics retrieved successfully',
            state='success'
        ), 200
        
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
        service = CalendarServiceV2()
        overview = service.get_appointments_overview()
        
        # Format as V1 expected
        summary_data = {
            'mese_corrente': overview['current_month']['count'],
            'mese_precedente': overview['previous_month']['count'],
            'mese_prossimo': overview['next_month']['count']
        }
        
        return format_response(
            success=True,
            data=summary_data,
            message='Statistics summary retrieved successfully',
            state='success'
        ), 200
        
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
        service = CalendarServiceV2()
        today = date.today()
        appointments_current_month = service.get_db_appointments_for_month(today.month, today.year)
        
        # TODO: Implement actual first visits logic from V1
        count_nuove_visite = len(appointments_current_month)
        
        return format_response(
            success=True,
            data={'nuove_visite': count_nuove_visite},
            message='First visits statistics retrieved successfully',
            state='success'
        ), 200
        
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
    try:
        service = CalendarServiceV2()
        calendars = service.google_list_calendars()
        
        return format_response(
            success=True,
            data={'calendars': calendars},
            message='Calendars retrieved successfully',
            state='success'
        ), 200
        
    except GoogleCredentialsNotFoundError as e:
        # Try to generate OAuth URL for re-authentication (like V1)
        try:
            service = CalendarServiceV2()
            auth_url = service.get_google_oauth_url()
            
            return format_response(
                success=False,
                error='GLOBAL_GOOGLE_AUTH_REQUIRED',
                message='Autenticazione Google richiesta. Completa il processo di autenticazione.',
                data={
                    'action_required': 'Complete Google authentication using the provided OAuth URL',
                    'auth_url': auth_url,
                    'error_code': 'GLOBAL_GOOGLE_AUTH_REQUIRED'
                },
                state='error'
            ), 200
            
        except Exception as oauth_error:
            logger.error(f"Error generating OAuth URL: {oauth_error}")
            return format_response(
                success=False,
                error='GOOGLE_AUTH_REQUIRED',
                message='Google authentication required but cannot generate OAuth URL',
                data={
                    'action_required': 'Check Google credentials configuration'
                },
                state='error'
            ), 200
        
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
    """Sync appointments to Google Calendar. V1 logic with job tracking."""
    try:
        data = request.get_json()
        calendar_id = data.get("calendar_id")
        month = data.get("month")
        year = data.get("year")
        studio_id = data.get("studio_id")
        end_month = data.get("end_month")
        end_year = data.get("end_year")
        
        if not (calendar_id and month and year and studio_id):
            return format_response(
                success=False,
                error='MISSING_PARAMETERS',
                message='calendar_id, month, year and studio_id are required',
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
                # Determine date range
                # if end_month and end_year:
                #     logger.info(f"Starting sync job for studio {studio_id}, range {month}/{year} to {end_month}/{end_year}")
                # else:
                #     logger.info(f"Starting sync job for studio {studio_id}, month {month}/{year}")
                
                service = CalendarServiceV2()
                
                # Get appointments for date range
                all_appointments = []
                if end_month and end_year:
                    # Range sync: iterate through months
                    current_month, current_year = month, year
                    while (current_year < end_year) or (current_year == end_year and current_month <= end_month):
                        month_appointments = service.get_db_appointments_for_month(current_month, current_year)
                        all_appointments.extend(month_appointments)
                        #logger.info(f"Retrieved {len(month_appointments)} appointments for {current_month}/{current_year}")
                        
                        # Move to next month
                        current_month += 1
                        if current_month > 12:
                            current_month = 1
                            current_year += 1
                else:
                    # Single month sync (backward compatibility)
                    all_appointments = service.get_db_appointments_for_month(month, year)
                    #logger.info(f"Retrieved {len(all_appointments)} total appointments")
                
                # Filter by studio
                filtered_appointments = [app for app in all_appointments if int(app.get('STUDIO', 0)) == int(studio_id)]
                #logger.info(f"Filtered {len(filtered_appointments)} appointments for studio {studio_id}")
                
                # Studio calendar mapping
                studio_calendar_ids = {int(studio_id): calendar_id}
                
                # Progress callback
                def update_sync_progress(synced, total, message=""):
                    if sync_jobs[job_id]["cancelled"]:
                        raise Exception("Synchronization cancelled by user")
                    
                    #logger.info(f"Sync progress: {synced}/{total} - {message}")
                    sync_jobs[job_id]["progress"] = int(100 * synced / max(1, total)) if total > 0 else 0
                    sync_jobs[job_id]["synced"] = synced
                    sync_jobs[job_id]["total"] = total
                    if message:
                        sync_jobs[job_id]["message"] = message
                
                # Execute synchronization
                result = service.sync_appointments_for_month(
                    month,
                    year,
                    studio_calendar_ids,
                    filtered_appointments,
                    progress_callback=update_sync_progress
                )
                
                #logger.info(f"Synchronization completed: {result}")
                
                # Update final status
                sync_jobs[job_id]["status"] = "completed"
                sync_jobs[job_id]["message"] = result.get('message', 'Synchronization completed')
                sync_jobs[job_id]["synced"] = result.get('success', 0)
                sync_jobs[job_id]["total"] = result.get('total_processed', 0)
                sync_jobs[job_id]["progress"] = 100
                
            except Exception as e:
                if "cancelled by user" in str(e):
                    #logger.info(f"Synchronization cancelled by user: {e}")
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
    """Clear all events from Google Calendar using async job. V1 logic."""
    try:
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job tracking
        clear_jobs[job_id] = {
            "status": "in_progress",
            "progress": 0,
            "deleted": 0,
            "total": 0,
            "message": "Starting calendar clearing...",
            "error": None,
            "cancelled": False,
            "calendar_id": calendar_id
        }
        
        def clear_job():
            try:
                #logger.info(f"Starting clear job for calendar {calendar_id}")
                
                service = CalendarServiceV2()
                
                # Progress callback function
                def update_clear_progress(deleted: int, total: int, message: str = None):
                    if clear_jobs[job_id]["cancelled"]:
                        raise Exception("Clear operation cancelled by user")
                    
                    #logger.info(f"Clear progress: {deleted}/{total} - {message}")
                    clear_jobs[job_id]["progress"] = int(100 * deleted / max(1, total)) if total > 0 else 0
                    clear_jobs[job_id]["deleted"] = deleted
                    clear_jobs[job_id]["total"] = total
                    if message:
                        clear_jobs[job_id]["message"] = message
                
                # Execute clearing with progress tracking
                result = service.google_clear_calendar_with_progress(
                    calendar_id, 
                    progress_callback=update_clear_progress
                )
                
                # Mark as completed
                clear_jobs[job_id]["status"] = "completed"
                clear_jobs[job_id]["message"] = result.get('message', 'Calendar cleared successfully')
                clear_jobs[job_id]["deleted"] = result.get('deleted_count', 0)
                clear_jobs[job_id]["total"] = result.get('deleted_count', 0)
                clear_jobs[job_id]["progress"] = 100
                
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
    """Get appointments for specific month/year. V1 logic."""
    try:
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        studio = request.args.get('studio', type=int)
        
        logger.info(f"Request appointments for month={month}, year={year}, studio={studio}")
        
        if not month or not year:
            logger.error("Missing month and year parameters")
            return format_response(
                success=False,
                error='MISSING_PARAMETERS',
                message='month and year are required',
                state='error'
            ), 400
        
        service = CalendarServiceV2()
        appointments = service.get_db_appointments_for_month(month, year)
        
        # Filter by studio if specified
        if studio is not None:
            appointments = [app for app in appointments if int(app.get('STUDIO', 0)) == studio]
            logger.info(f"Filtered {len(appointments)} appointments for studio {studio}")
        
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
    """Get Google OAuth URL. V1 logic."""
    try:
        service = CalendarServiceV2()
        auth_url = service.get_google_oauth_url()
        
        return format_response(
            success=True,
            data={'auth_url': auth_url},
            message='OAuth URL generated successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error generating OAuth URL: {e}")
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

@calendar_v2_bp.route('/test-connection', methods=['GET'])
@jwt_required()
def test_connection():
    """Test Google Calendar connection."""
    try:
        service = CalendarServiceV2()
        result = service.test_connection()
        
        if result['success']:
            return format_response(
                success=True,
                message=result['message'],
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=result.get('error', 'CONNECTION_ERROR'),
                message=result['message'],
                state='error'
            ), 400
            
    except Exception as e:
        logger.error(f"Error testing connection: {e}")
        return format_response(
            success=False,
            error='TEST_ERROR',
            message=f'Error testing connection: {str(e)}',
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