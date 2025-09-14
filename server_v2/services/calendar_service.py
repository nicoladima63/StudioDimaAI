"""
Calendar Service V2 - Simplified version based on V1 logic

Migrated from V1 maintaining functionality with V2 architecture patterns.
Follows V1 working logic exactly but with V2 structure and conventions.
"""

import os
import json
import logging
import threading
from datetime import datetime, date
from typing import Dict, List, Any, Optional, Callable

# Google Calendar API
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request

# Core imports
from core.exceptions import (
    GoogleCredentialsNotFoundError,
    CalendarSyncError
)
from core.environment_manager import environment_manager
from utils.dbf_utils import get_optimized_reader
from services.sync_state_manager import get_sync_state_manager

logger = logging.getLogger(__name__)


class CalendarServiceV2:
    """
    Calendar Service V2 - Simplified version maintaining V1 functionality.
    
    This service handles:
    - DBF reading for appointments
    - Google Calendar synchronization  
    - Statistics and analytics
    - OAuth authentication
    
    DEVELOPMENT RULES:
    - I colori sono basati sul TIPO appuntamento (V, I, C, H, P), NON sullo studio
    - Usare sempre app.get('GOOGLE_COLOR_ID', '8') per colori Google Calendar
    - I colori sono definiti in server_v2/core/constants_v2.py
    - SEMPRE controllare sistemi esistenti prima di crearne di nuovi
    """
    
    def __init__(self):
        self.credentials_file = 'instance/credentials.json'
        self.token_file = 'instance/token.json'
        self.dbf_reader = get_optimized_reader()
        
    # =========================================================================
    # SECTION 1: DBF APPOINTMENTS READING (from V1)
    # =========================================================================
    
    def get_db_appointments_for_month(self, month: int, year: int) -> List[Dict[str, Any]]:
        """
        Get appointments from DBF for specific month/year.
        Maintains V1 exact logic.
        """
        try:
            appointments = self.dbf_reader.get_appointments_optimized(month, year)
            
            # Filter out cancelled appointments and apply transformations
            filtered_appointments = []
            for app in appointments:
                # Skip cancelled appointments
                if self._is_appointment_cancelled(app):
                    continue
                    
                # Convert 8:00 AM appointments to "Nota giornaliera" 
                ora_inizio = app.get('ORA_INIZIO')
                is_eight_am = False
                
                if isinstance(ora_inizio, str) and (ora_inizio.startswith("8:") or ora_inizio == "8.0" or ora_inizio == "08:00"):
                    is_eight_am = True
                elif isinstance(ora_inizio, (int, float)) and (ora_inizio == 8 or ora_inizio == 8.0):
                    is_eight_am = True
                
                if is_eight_am:
                    if app.get('PAZIENTE') == "Appuntamento" or app.get('PAZIENTE') == "":
                        app['PAZIENTE'] = "Nota giornaliera"
                    if app.get('DESCRIZIONE') == "Appuntamento" or app.get('DESCRIZIONE') == "":
                        app['DESCRIZIONE'] = "Nota giornaliera"
                
                filtered_appointments.append(app)
            
            return filtered_appointments
            
        except Exception as e:
            logger.error(f"Error getting appointments for {month}/{year}: {e}")
            raise
    
    def get_db_appointments_stats_for_year(self) -> Dict[str, Any]:
        """Get appointments statistics by year/month."""
        try:
            return self.dbf_reader.get_appointments_stats_for_year()
        except Exception as e:
            logger.error(f"Error getting year stats: {e}")
            raise
    
    # =========================================================================
    # SECTION 2: GOOGLE CALENDAR INTEGRATION (from V1) 
    # =========================================================================
    
    def _get_calendar_service(self):
        """Get authenticated Google Calendar service. V1 logic."""
        try:
            creds = None
            
            # Load existing token
            if os.path.exists(self.token_file):
                creds = Credentials.from_authorized_user_file(self.token_file)
            
            # Refresh if expired
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    try:
                        creds.refresh(Request())
                    except Exception as e:
                        logger.error(f"Error refreshing credentials: {e}")
                        raise GoogleCredentialsNotFoundError("Credentials expired and refresh failed")
                else:
                    raise GoogleCredentialsNotFoundError("No valid credentials found")
            
            # Save refreshed credentials
            with open(self.token_file, 'w') as token:
                token.write(creds.to_json())
            
            return build('calendar', 'v3', credentials=creds)
            
        except Exception as e:
            if isinstance(e, GoogleCredentialsNotFoundError):
                raise
            logger.error(f"Error getting calendar service: {e}")
            raise GoogleCredentialsNotFoundError(f"Cannot authenticate with Google: {str(e)}")
    
    def google_list_calendars(self) -> List[Dict[str, Any]]:
        """List Google calendars. V1 logic with same filtering."""
        try:
            service = self._get_calendar_service()
            
            # Get configured calendar IDs from environment (V1 logic)
            # Use environment manager to ensure .env is loaded
            automation_settings = environment_manager.get_automation_settings()
            configured_ids_str = os.environ.get("CONFIGURED_CALENDAR_IDS", "")
            
            # Fallback: get IDs from automation settings if env var not available
            if not configured_ids_str:
                studio_blu_id = automation_settings.get('calendar_studio_blu_id', '')
                studio_giallo_id = automation_settings.get('calendar_studio_giallo_id', '')
                if studio_blu_id and studio_giallo_id:
                    configured_ids_str = f"{studio_blu_id},{studio_giallo_id}"
            
            configured_calendar_ids = {id.strip() for id in configured_ids_str.split(',') if id.strip()}
            
            # Get all calendars from Google
            calendars_result = service.calendarList().list().execute()
            all_calendars = calendars_result.get('items', [])
            
            # Filter to show only configured calendars (V1 logic)
            relevant_calendars = [
                {
                    'id': cal['id'],
                    'name': cal.get('summary', cal['id']),
                    'primary': cal.get('primary', False)
                }
                for cal in all_calendars
                if cal['id'] in configured_calendar_ids
            ]
            
            logger.info(f"Found {len(relevant_calendars)} relevant calendars out of {len(all_calendars)} accessible")
            return relevant_calendars
            
        except GoogleCredentialsNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error listing calendars: {e}")
            raise CalendarSyncError(f"Failed to list calendars: {str(e)}")
    
    def sync_appointments_for_month(self, month: int, year: int, 
                                  studio_calendar_ids: Dict[int, str],
                                  appointments: List[Dict[str, Any]] = None,
                                  progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """
        Sync appointments to Google Calendar for specific month.
        Includes duplicate detection and incremental updates (V1 logic).
        """
        try:
            service = self._get_calendar_service()
            sync_manager = get_sync_state_manager()
            
            # Get appointments if not provided
            if appointments is None:
                appointments = self.get_db_appointments_for_month(month, year)
            
            # Filter sync state for current studios
            studio_ids = set(studio_calendar_ids.keys())
            sync_state = sync_manager.get_sync_state_for_studios(studio_ids)
            
            success_count = 0
            error_count = 0
            total_count = len(appointments)
            updated_count = 0
            new_count = 0
            skipped_count = 0
            
            logger.info(f"Starting intelligent sync of {total_count} appointments")
            
            if progress_callback:
                progress_callback(0, total_count, "Starting synchronization...")
            
            # Track current appointment IDs for deletion detection
            current_appointment_ids = set()
            
            for i, app in enumerate(appointments):
                try:
                    # Get studio and calendar ID
                    studio_id = int(app.get('STUDIO', 0))
                    calendar_id = studio_calendar_ids.get(studio_id)
                    
                    if not calendar_id:
                        logger.warning(f"No calendar ID for studio {studio_id}, skipping appointment")
                        continue
                    
                    # Generate appointment ID and hash
                    app_id = sync_manager.generate_appointment_id(app)
                    app_hash = sync_manager.generate_appointment_hash(app)
                    current_appointment_ids.add(app_id)
                    
                    # Check if appointment needs sync
                    existing_sync = sync_manager.is_appointment_synced(app)
                    
                    if existing_sync:
                        # Already synced and unchanged, skip
                        skipped_count += 1
                        logger.debug(f"Skipping unchanged appointment {app_id}")
                    else:
                        # Need to sync (new or changed)
                        event = self._create_event_from_appointment(app)
                        
                        if app_id in sync_state:
                            # Update existing event
                            try:
                                # Delete old event
                                old_event_id = sync_state[app_id]['event_id']
                                service.events().delete(
                                    calendarId=sync_state[app_id]['calendar_id'], 
                                    eventId=old_event_id
                                ).execute()
                                logger.debug(f"Deleted old event {old_event_id}")
                                
                                # Create new event
                                created_event = service.events().insert(
                                    calendarId=calendar_id, 
                                    body=event
                                ).execute()
                                
                                # Update sync state
                                sync_manager.mark_appointment_synced(
                                    app, calendar_id, created_event['id'], month, year
                                )
                                
                                updated_count += 1
                                success_count += 1
                                logger.info(f"Updated appointment {app_id}")
                                
                            except Exception as e:
                                logger.error(f"Error updating appointment {app_id}: {e}")
                                error_count += 1
                        else:
                            # Create new event
                            try:
                                created_event = service.events().insert(
                                    calendarId=calendar_id, 
                                    body=event
                                ).execute()
                                
                                # Mark as synced
                                sync_manager.mark_appointment_synced(
                                    app, calendar_id, created_event['id'], month, year
                                )
                                
                                new_count += 1
                                success_count += 1
                                logger.info(f"Created new appointment {app_id}")
                                
                            except Exception as e:
                                logger.error(f"Error creating appointment {app_id}: {e}")
                                error_count += 1
                    
                    # Progress update
                    if progress_callback and i % 5 == 0:
                        progress_callback(
                            success_count + error_count, 
                            total_count, 
                            f"Processed {i+1}/{total_count} appointments"
                        )
                    
                except Exception as e:
                    logger.error(f"Error processing appointment {i}: {e}")
                    error_count += 1
                    continue
            
            # Handle deletions (appointments in calendar but not in DBF)
            deleted_count = 0
            appointments_to_delete = sync_manager.get_appointments_to_delete(
                current_appointment_ids, month, year
            )
            
            if progress_callback:
                progress_callback(
                    success_count + error_count, 
                    total_count, 
                    f"Cleaning up deleted appointments... ({deleted_count}/{len(appointments_to_delete)})"
                )
            
            for app_id in appointments_to_delete:
                try:
                    sync_data = sync_state[app_id]
                    service.events().delete(
                        calendarId=sync_data['calendar_id'], 
                        eventId=sync_data['event_id']
                    ).execute()
                    
                    # Remove from sync state
                    sync_manager.remove_appointment_sync(
                        {'DATA': app_id.split('_')[0], 'ORA_INIZIO': app_id.split('_')[1], 
                         'STUDIO': app_id.split('_')[2]}
                    )
                    
                    deleted_count += 1
                    logger.info(f"Deleted appointment {app_id}")
                    
                except Exception as e:
                    logger.error(f"Error deleting appointment {app_id}: {e}")
                    error_count += 1
            
            # Final progress update
            if progress_callback:
                progress_callback(
                    total_count, 
                    total_count, 
                    f"Sync completed: {success_count} success, {error_count} errors"
                )
            
            result = {
                'success': success_count,
                'errors': error_count,
                'total_processed': total_count,
                'new_appointments': new_count,
                'updated_appointments': updated_count,
                'skipped_appointments': skipped_count,
                'deleted_appointments': deleted_count,
                'message': f"Sync completed: {success_count} success, {error_count} errors"
            }
            
            logger.info(f"Sync results: {result}")
            return result
            
        except GoogleCredentialsNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error syncing appointments: {e}")
            raise CalendarSyncError(f"Sync failed: {str(e)}")
    
    def _create_event_from_appointment(self, app: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create Google Calendar event from appointment data.
        Maintains V1 exact logic.
        """
        try:
            # Basic event info
            paziente = app.get('PAZIENTE', 'Appuntamento')
            descrizione = app.get('DESCRIZIONE', '')
            data_str = app.get('DATA', '')
            ora_inizio = app.get('ORA_INIZIO', 9)
            ora_fine = app.get('ORA_FINE', 10)
            
            # Parse date
            if isinstance(data_str, str) and len(data_str) >= 10:
                event_date = datetime.fromisoformat(data_str[:10])
            else:
                event_date = datetime.now()
            
            # Parse times - gestione formato decimale del gestionale
            try:
                if isinstance(ora_inizio, str):
                    if ':' in ora_inizio:
                        hour, minute = ora_inizio.split(':')
                        start_hour = int(hour)
                        start_minute = int(minute)
                    else:
                        # Formato decimale: 14.5 = 14 ore e 50 minuti
                        decimal_time = float(ora_inizio)
                        start_hour = int(decimal_time)
                        start_minute = int((decimal_time - start_hour) * 100)
                else:
                    # Formato decimale: 14.5 = 14 ore e 50 minuti
                    decimal_time = float(ora_inizio)
                    start_hour = int(decimal_time)
                    start_minute = int((decimal_time - start_hour) * 100)
                
                if isinstance(ora_fine, str):
                    if ':' in ora_fine:
                        hour, minute = ora_fine.split(':')
                        end_hour = int(hour)
                        end_minute = int(minute)
                    else:
                        # Formato decimale: 14.5 = 14 ore e 50 minuti
                        decimal_time = float(ora_fine)
                        end_hour = int(decimal_time)
                        end_minute = int((decimal_time - end_hour) * 100)
                else:
                    # Formato decimale: 14.5 = 14 ore e 50 minuti
                    decimal_time = float(ora_fine)
                    end_hour = int(decimal_time)
                    end_minute = int((decimal_time - end_hour) * 100)
                    
            except (ValueError, TypeError):
                start_hour, start_minute = 9, 0
                end_hour, end_minute = 10, 0
            
            # Create datetime objects
            start_datetime = event_date.replace(hour=start_hour, minute=start_minute, second=0)
            end_datetime = event_date.replace(hour=end_hour, minute=end_minute, second=0)
            
            # Build event
            summary = paziente if paziente != "Appuntamento" else "Appuntamento"
            if descrizione and descrizione != summary:
                summary += f" - {descrizione}"
            
            # Use existing color system based on appointment type
            color_id = app.get('GOOGLE_COLOR_ID', '8')  # Default gray if not set
            
            event = {
                'summary': summary,
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': 'Europe/Rome',
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': 'Europe/Rome',
                },
                'description': f"Paziente: {paziente}\nDescrizione: {descrizione}",
                'colorId': color_id,
                'reminders': {
                    'useDefault': False,
                    'overrides': []  # No reminders to avoid notifications
                }
            }
            
            return event
            
        except Exception as e:
            logger.error(f"Error creating event from appointment: {e}")
            # Return minimal event
            return {
                'summary': 'Appuntamento',
                'start': {'dateTime': datetime.now().isoformat(), 'timeZone': 'Europe/Rome'},
                'end': {'dateTime': datetime.now().isoformat(), 'timeZone': 'Europe/Rome'},
                'colorId': '8'  # Default gray color
            }
    
    def _is_appointment_cancelled(self, appointment: Dict[str, Any]) -> bool:
        """
        Check if an appointment is cancelled based on various indicators.
        """
        # Check for explicit cancellation indicators
        paziente = (appointment.get('PAZIENTE') or '').lower()
        descrizione = (appointment.get('DESCRIZIONE') or '').lower()
        tipo = (appointment.get('TIPO') or '').lower()
        note = (appointment.get('NOTE') or '').lower()
        
        # Common cancellation keywords
        cancellation_keywords = [
            'cancellato', 'cancellata', 'cancellazione',
            'annullato', 'annullata', 'annullamento',
            'disdetto', 'disdetta', 'disdetta',
            'rimandato', 'rimandata', 'rimandamento',
            'spostato', 'spostata', 'spostamento'
        ]
        
        # Check if any field contains cancellation keywords
        for keyword in cancellation_keywords:
            if (keyword in paziente or 
                keyword in descrizione or 
                keyword in tipo or 
                keyword in note):
                return True
        
        # Check for empty or invalid appointments
        if (not paziente or paziente.strip() == '' or 
            paziente == 'appuntamento' or paziente == 'cancellato'):
            return True
            
        # Check for zero duration appointments (might indicate cancellation)
        ora_inizio = appointment.get('ORA_INIZIO', 0)
        ora_fine = appointment.get('ORA_FINE', 0)
        
        try:
            if isinstance(ora_inizio, str):
                ora_inizio = float(ora_inizio.replace(':', '.'))
            if isinstance(ora_fine, str):
                ora_fine = float(ora_fine.replace(':', '.'))
            
            if ora_inizio == ora_fine:  # Zero duration
                return True
        except (ValueError, TypeError):
            pass
        
        return False
    
    def google_clear_calendar(self, calendar_id: str) -> Dict[str, Any]:
        """
        Clear all events from Google Calendar.
        Maintains V1 logic.
        """
        return self.google_clear_calendar_with_progress(calendar_id, None)
    
    def google_clear_calendar_with_progress(self, calendar_id: str, progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """
        Clear all events from Google Calendar with progress tracking.
        Maintains V1 logic.
        """
        try:
            service = self._get_calendar_service()
            deleted_count = 0
            total_events = 0
            
            # First pass: count total events
            logger.info(f"Counting events in calendar {calendar_id}")
            page_token = None
            while True:
                events_result = service.events().list(
                    calendarId=calendar_id,
                    pageToken=page_token,
                    maxResults=2500  # Max allowed by Google
                ).execute()
                
                events = events_result.get('items', [])
                total_events += len(events)
                
                page_token = events_result.get('nextPageToken')
                if not page_token:
                    break
            
            logger.info(f"Found {total_events} events to delete")
            
            # Second pass: delete events with progress tracking
            page_token = None
            while True:
                events_result = service.events().list(
                    calendarId=calendar_id,
                    pageToken=page_token,
                    maxResults=2500  # Max allowed by Google
                ).execute()
                
                events = events_result.get('items', [])
                
                # Delete events in batch
                for event in events:
                    try:
                        event_summary = event.get('summary', '')
                        service.events().delete(
                            calendarId=calendar_id, 
                            eventId=event['id']
                        ).execute()
                        deleted_count += 1
                        logger.debug(f"Deleted event: {event['id']} - {event_summary}")
                        
                        # Update progress
                        if progress_callback:
                            progress_callback(
                                deleted_count, 
                                total_events, 
                                f"Deleted {deleted_count} of {total_events} events"
                            )
                            
                    except Exception as e:
                        logger.warning(f"Error deleting event {event['id']}: {e}")
                        continue
                
                page_token = events_result.get('nextPageToken')
                if not page_token:
                    break
            
            final_message = f"Deleted {deleted_count} events from calendar"
            logger.info(final_message)
            
            return {
                'deleted_count': deleted_count,
                'message': final_message
            }
            
        except GoogleCredentialsNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error clearing calendar {calendar_id}: {e}")
            raise CalendarSyncError(f"Failed to clear calendar: {str(e)}")
    
    # =========================================================================
    # SECTION 3: OAUTH AUTHENTICATION (from V1)
    # =========================================================================
    
    def get_google_oauth_url(self) -> str:
        """Generate OAuth URL for Google authentication. V1 logic with state saving."""
        try:
            if not os.path.exists(self.credentials_file):
                raise GoogleCredentialsNotFoundError("credentials.json not found")
            
            flow = Flow.from_client_secrets_file(
                self.credentials_file,
                scopes=['https://www.googleapis.com/auth/calendar']
            )
            
            # Use localhost for development - must match authorized redirect URI
            flow.redirect_uri = 'http://localhost:5001/oauth/callback'
            
            auth_url, state = flow.authorization_url(
                access_type='offline',
                prompt='consent',
                login_hint='studiodrnicoladimartino@gmail.com'
            )
            
            # Save state and flow data for callback (V1 logic)
            import json
            
            # Read the full credentials file to preserve structure
            with open(self.credentials_file, 'r') as f:
                full_credentials = json.load(f)
            
            state_data = {
                'state': state,
                'flow_data': full_credentials  # Save full credentials instead of client_config
            }
            
            os.makedirs('instance', exist_ok=True)
            with open('instance/oauth_state.json', 'w') as f:
                json.dump(state_data, f)
            
            logger.info(f"OAuth URL generated with state: {state[:10]}...")
            return auth_url
            
        except Exception as e:
            logger.error(f"Error generating OAuth URL: {e}")
            raise GoogleCredentialsNotFoundError(f"Cannot generate OAuth URL: {str(e)}")
    
    def handle_oauth_callback(self, code: str, state: str) -> Dict[str, Any]:
        """Handle OAuth callback from Google. V1 logic."""
        try:
            import json
            
            # Load saved state
            state_file = 'instance/oauth_state.json'
            if not os.path.exists(state_file):
                raise Exception("OAuth state file not found")
            
            with open(state_file, 'r') as f:
                state_data = json.load(f)
            
            saved_state = state_data['state']
            flow_data = state_data['flow_data']
            
            # Verify state for security
            if state != saved_state:
                raise Exception("OAuth state mismatch - possible CSRF attack")
            
            # Recreate flow with same parameters using full credentials
            flow = Flow.from_client_config(
                flow_data,
                scopes=['https://www.googleapis.com/auth/calendar']
            )
            flow.redirect_uri = 'http://localhost:5001/oauth/callback'
            
            # Exchange code for token
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            # Save token
            with open(self.token_file, 'w') as token_file:
                token_file.write(credentials.to_json())
            
            # Clean up temporary state file
            if os.path.exists(state_file):
                os.remove(state_file)
            
            logger.info("Google authentication completed successfully")
            return {
                'success': True,
                'message': 'Google authentication completed successfully'
            }
            
        except Exception as e:
            logger.error(f"Error in OAuth callback: {e}")
            # Clean up on error
            state_file = 'instance/oauth_state.json'
            if os.path.exists(state_file):
                os.remove(state_file)
            raise Exception(f"OAuth callback failed: {str(e)}")
    
    # =========================================================================
    # SECTION 4: STATISTICS AND UTILITIES (from V1)
    # =========================================================================
    
    def get_appointments_overview(self, year: int = None, studio_id: int = None) -> Dict[str, Any]:
        """
        Get appointments overview with statistics.
        V2 enhancement with caching support.
        """
        try:
            if year is None:
                year = datetime.now().year
            
            # Get current month stats (V1 logic)
            current_month = datetime.now().month
            current_stats = len(self.get_db_appointments_for_month(current_month, year))
            
            # Previous month
            prev_month = 12 if current_month == 1 else current_month - 1
            prev_year = year - 1 if current_month == 1 else year
            prev_stats = len(self.get_db_appointments_for_month(prev_month, prev_year))
            
            # Next month  
            next_month = 1 if current_month == 12 else current_month + 1
            next_year = year + 1 if current_month == 12 else year
            next_stats = len(self.get_db_appointments_for_month(next_month, next_year))
            
            return {
                'current_month': {
                    'count': current_stats,
                    'month': current_month,
                    'year': year
                },
                'previous_month': {
                    'count': prev_stats,
                    'month': prev_month,
                    'year': prev_year
                },
                'next_month': {
                    'count': next_stats,
                    'month': next_month,  
                    'year': next_year
                },
                '_cached': False,
                '_cache_ttl': 0
            }
            
        except Exception as e:
            logger.error(f"Error getting overview: {e}")
            raise
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Google Calendar connection."""
        try:
            service = self._get_calendar_service()
            # Simple test call
            service.calendarList().list(maxResults=1).execute()
            
            return {
                'success': True,
                'message': 'Google Calendar connection successful'
            }
            
        except GoogleCredentialsNotFoundError as e:
            return {
                'success': False,
                'error': 'CREDENTIALS_NOT_FOUND',
                'message': str(e)
            }
        except Exception as e:
            return {
                'success': False,
                'error': 'CONNECTION_ERROR',
                'message': f'Connection failed: {str(e)}'
            }


# Global singleton instance
calendar_service = CalendarServiceV2()