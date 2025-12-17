"""
Calendar Service V2 - Simplified version based on V1 logic

Migrated from V1 maintaining functionality with V2 architecture patterns.
Follows V1 working logic exactly but with V2 structure and conventions.

IMPROVEMENTS:
- Added rate limiting to prevent Google API quota errors
- Added exponential backoff retry mechanism
- Thread-safe API call tracking
"""

import os
import json
import logging
import threading
import time
import random
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional, Callable
from collections import deque

# Google Calendar API
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request

# Core imports
from core.exceptions import (
    GoogleCredentialsNotFoundError,
    CalendarSyncError,
    GoogleQuotaError
)
from core.environment_manager import environment_manager
from utils.dbf_utils import get_optimized_reader
from core.constants_v2 import get_campo_dbf
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
    - Rate limiting and retry logic
    
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
        
        # Rate limiter per prevenire quota errors
        self.api_calls = deque()
        self.max_calls_per_100s = 95  # Margine di sicurezza (limite Google: 100)
        self.rate_limit_lock = threading.Lock()
    
    # =========================================================================
    # SECTION 0: RATE LIMITING AND RETRY LOGIC
    # =========================================================================
    
    def _wait_for_rate_limit(self):
        """Attende se necessario per rispettare il rate limit di Google (100 calls/100s)."""
        with self.rate_limit_lock:
            now = time.time()
            
            # Rimuovi chiamate più vecchie di 100 secondi
            while self.api_calls and self.api_calls[0] < now - 100:
                self.api_calls.popleft()
            
            # Se abbiamo raggiunto il limite, aspetta
            if len(self.api_calls) >= self.max_calls_per_100s:
                sleep_time = 100 - (now - self.api_calls[0]) + 1
                if sleep_time > 0:
                    logger.warning(f"Rate limit preventivo: aspetto {sleep_time:.1f}s prima di continuare")
                    time.sleep(sleep_time)
                    # Pulisci dopo l'attesa
                    self.api_calls.clear()
            
            # Registra questa chiamata
            self.api_calls.append(now)
    
    def _execute_with_retry(self, request, operation_name="API call", max_retries=5):
        """
        Esegue una richiesta API con exponential backoff in caso di rate limit.
        
        Args:
            request: Google API request object
            operation_name: Nome dell'operazione per logging
            max_retries: Numero massimo di tentativi
            
        Returns:
            Response from Google API or None if resource not found (404/410)
            
        Raises:
            GoogleQuotaError: Se il rate limit viene superato dopo tutti i retry
            HttpError: Per altri errori HTTP
        """
        for attempt in range(max_retries):
            try:
                # Attendi preventivamente se necessario
                self._wait_for_rate_limit()
                
                # Esegui la richiesta
                return request.execute()
                
            except HttpError as e:
                # Rate limit: retry con backoff
                if e.status_code == 403 and ('rateLimitExceeded' in str(e.content) or 'userRateLimitExceeded' in str(e.content)):
                    if attempt < max_retries - 1:
                        # Exponential backoff: 2s, 4s, 8s, 16s, 32s + jitter
                        sleep_time = (2 ** (attempt + 1)) + random.uniform(0, 1)
                        logger.warning(f"Rate limit hit durante {operation_name}, retry {attempt + 1}/{max_retries} in {sleep_time:.1f}s")
                        time.sleep(sleep_time)
                        # Pulisci il rate limiter dopo l'errore
                        with self.rate_limit_lock:
                            self.api_calls.clear()
                    else:
                        # Ultimo tentativo fallito
                        logger.error(f"Rate limit persistente dopo {max_retries} tentativi per {operation_name}")
                        raise GoogleQuotaError(f"Google API quota exceeded during {operation_name} after {max_retries} retries")
                
                # 404/410: risorsa non trovata (già cancellata)
                elif e.status_code in [404, 410]:
                    logger.info(f"Risorsa non trovata durante {operation_name} (già cancellata o non esistente)")
                    return None  # Non è un errore critico
                
                # Altri errori HTTP: solleva immediatamente
                else:
                    logger.error(f"HTTP error {e.status_code} durante {operation_name}: {e}")
                    raise
                    
            except Exception as e:
                # Errori non-HTTP: solleva immediatamente
                logger.error(f"Errore non-HTTP durante {operation_name}: {e}")
                raise
        
        # Non dovrebbe mai arrivare qui
        raise GoogleQuotaError(f"Max retries exceeded for {operation_name}")
    
    def _batch_delete_events(self, service, calendar_id: str, event_ids: List[str], 
                        operation_context: str = "batch delete") -> Dict[str, int]:
        """
        Cancella eventi in batch (max 50 per batch).
        Returns: {'success': count, 'errors': count, 'not_found': count}
        """
        if not event_ids:
            return {'success': 0, 'errors': 0, 'not_found': 0}
        
        from googleapiclient.http import BatchHttpRequest
        
        results = {'success': 0, 'errors': 0, 'not_found': 0}
        
        def callback(request_id, response, exception):
            if exception is None:
                results['success'] += 1
            elif isinstance(exception, HttpError):
                if exception.status_code in [404, 410]:
                    results['not_found'] += 1
                    logger.debug(f"Event {request_id} già cancellato")
                else:
                    results['errors'] += 1
                    logger.warning(f"Errore cancellazione {request_id}: {exception}")
            else:
                results['errors'] += 1
                logger.error(f"Errore generico cancellazione {request_id}: {exception}")
        
        # Processa in batch (limite Google 50 – usiamo un valore prudente)
        batch_size = 50
        for i in range(0, len(event_ids), batch_size):
            batch_ids = event_ids[i:i+batch_size]
            
            try:
                # Attendi rate limit prima del batch
                self._wait_for_rate_limit()
                
                batch = service.new_batch_http_request(callback=callback)
                for event_id in batch_ids:
                    batch.add(
                        service.events().delete(
                            calendarId=calendar_id,
                            eventId=event_id
                        ),
                        request_id=event_id
                    )
                
                batch.execute()
                logger.debug(f"Batch delete: {len(batch_ids)} eventi processati")
                
                # Piccola pausa tra batch
                if i + batch_size < len(event_ids):
                    time.sleep(0.1)
                    
            except HttpError as e:
                if e.status_code == 403 and 'rateLimitExceeded' in str(e.content):
                    logger.warning(f"Rate limit su batch, attendo 5s...")
                    time.sleep(5)
                    # Riprova questo batch
                    try:
                        batch.execute()
                    except Exception as retry_error:
                        logger.error(f"Retry batch fallito: {retry_error}")
                        results['errors'] += len(batch_ids)
                else:
                    logger.error(f"Errore HTTP durante batch delete: {e}")
                    results['errors'] += len(batch_ids)
            except Exception as e:
                # Gestione esplicita dei timeout di rete: facciamo un solo retry prudente
                msg = str(e).lower()
                if "timed out" in msg or "timeout" in msg:
                    logger.warning("Timeout durante batch delete, retry singolo tra 5s...")
                    time.sleep(5)
                    try:
                        batch.execute()
                        logger.debug(f"Batch delete retry: {len(batch_ids)} eventi processati dopo timeout")
                    except Exception as retry_error:
                        logger.error(f"Retry batch fallito dopo timeout: {retry_error}")
                        results['errors'] += len(batch_ids)
                else:
                    logger.error(f"Errore generico durante batch delete: {e}")
                    results['errors'] += len(batch_ids)
        
        logger.info(f"Batch delete {operation_context}: {results['success']} success, "
                    f"{results['not_found']} già cancellati, {results['errors']} errori")
        return results

    def _batch_create_events(self, service, calendar_id: str, events: List[Dict[str, Any]], 
                            operation_context: str = "batch create") -> Dict[str, Any]:
        """
        Crea eventi in batch (max 50 per batch).
        Returns: {'created': [(event_data, event_id)], 'errors': count}
        """
        if not events:
            return {'created': [], 'errors': 0}
        
        from googleapiclient.http import BatchHttpRequest
        
        created_events = []
        error_count = 0
        
        def callback(request_id, response, exception):
            nonlocal error_count
            if exception is None:
                # response contiene l'evento creato
                created_events.append((events[int(request_id)], response['id']))
            else:
                error_count += 1
                logger.error(f"Errore creazione evento {request_id}: {exception}")
        
        # Processa in batch di 50
        batch_size = 50
        for i in range(0, len(events), batch_size):
            batch_events = events[i:i+batch_size]
            
            try:
                # Attendi rate limit prima del batch
                self._wait_for_rate_limit()
                
                batch = service.new_batch_http_request(callback=callback)
                for idx, event in enumerate(batch_events):
                    batch.add(
                        service.events().insert(
                            calendarId=calendar_id,
                            body=event
                        ),
                        request_id=str(i + idx)  # Indice nell'array originale
                    )
                
                batch.execute()
                logger.debug(f"Batch create: {len(batch_events)} eventi processati")
                
                # Piccola pausa tra batch
                if i + batch_size < len(events):
                    time.sleep(0.1)
                    
            except HttpError as e:
                if e.status_code == 403 and 'rateLimitExceeded' in str(e.content):
                    logger.warning(f"Rate limit su batch, attendo 5s...")
                    time.sleep(5)
                    # Riprova questo batch
                    try:
                        batch.execute()
                    except Exception as retry_error:
                        logger.error(f"Retry batch fallito: {retry_error}")
                        error_count += len(batch_events)
                else:
                    logger.error(f"Errore HTTP durante batch create: {e}")
                    error_count += len(batch_events)
            except Exception as e:
                # Gestione esplicita dei timeout di rete: facciamo un solo retry prudente
                msg = str(e).lower()
                if "timed out" in msg or "timeout" in msg:
                    logger.warning("Timeout durante batch create, retry singolo tra 5s...")
                    time.sleep(5)
                    try:
                        batch.execute()
                        logger.debug(f"Batch create retry: {len(batch_events)} eventi processati dopo timeout")
                    except Exception as retry_error:
                        logger.error(f"Retry batch create fallito dopo timeout: {retry_error}")
                        error_count += len(batch_events)
                else:
                    logger.error(f"Errore generico durante batch create: {e}")
                    error_count += len(batch_events)
        
        logger.info(f"Batch create {operation_context}: {len(created_events)} creati, {error_count} errori")
        return {'created': created_events, 'errors': error_count}

    # =========================================================================
    # SECTION 1: DBF APPOINTMENTS READING
    # =========================================================================
    
    def get_db_appointments_for_month(self, month: int, year: int, start_date_str: Optional[str] = None, end_date_str: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get appointments from DBF for specific month/year.
        Can be filtered by a specific date range.
        """
        try:
            appointments = self.dbf_reader.get_appointments_optimized(month, year)

            # Se viene fornito un intervallo di date, filtra gli appuntamenti
            if start_date_str and end_date_str:
                try:
                    start_date = datetime.fromisoformat(start_date_str).date()
                    end_date = datetime.fromisoformat(end_date_str).date()
                    
                    filtered_appointments_by_date = []
                    for app in appointments:
                        app_date_val = app.get('DATA')
                        if not app_date_val:
                            continue
                        
                        app_date = None
                        if isinstance(app_date_val, str):
                            try:
                                app_date = datetime.fromisoformat(app_date_val).date()
                            except ValueError:
                                logger.warning(f"Could not parse date string: {app_date_val}")
                                continue
                        elif hasattr(app_date_val, 'date'):  # Handles datetime.datetime
                            app_date = app_date_val.date()
                        elif isinstance(app_date_val, date): # Handles datetime.date
                            app_date = app_date_val
                        else:
                            logger.warning(f"Unknown date type for filtering: {type(app_date_val)}")
                            continue

                        if start_date <= app_date <= end_date:
                            filtered_appointments_by_date.append(app)
                    
                    appointments = filtered_appointments_by_date

                except (ValueError, TypeError) as e:
                    logger.error(f"Formato data non valido per il filtro: {e}. Ignoro il filtro per data.")

            # Filter out cancelled appointments and apply transformations
            filtered_appointments = []
            for app in appointments:
                # Skip cancelled appointments
                # Aggiunto controllo per scartare righe vuote o invalide fin da subito (ora usa i nomi logici)
                if not app.get('DATA') or not app.get('ORA_INIZIO'):
                    logger.debug(f"Scartato appuntamento invalido o vuoto: {app}")
                    continue

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
    # SECTION 2: GOOGLE CALENDAR INTEGRATION
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
            calendars_result = self._execute_with_retry(
                service.calendarList().list(),
                operation_name="list calendars"
            )
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
            
            return relevant_calendars
            
        except GoogleCredentialsNotFoundError:
            raise
        except GoogleQuotaError:
            raise
        except Exception as e:
            logger.error(f"Error listing calendars: {e}")
            raise CalendarSyncError(f"Failed to list calendars: {str(e)}")
 
    def sync_appointments_for_month(self, month: int, year: int, 
                                studio_calendar_ids: Dict[int, str],
                                appointments: List[Dict[str, Any]] = None,
                                progress_callback: Optional[Callable] = None,
                                start_date_str: Optional[str] = None,
                                end_date_str: Optional[str] = None,
                                force_resync: bool = False) -> Dict[str, Any]:
        """
        Sync appointments usando BATCH OPERATIONS per efficienza.
        """
        try:
            service = self._get_calendar_service()
            sync_manager = get_sync_state_manager()
            
            # Get appointments if not provided
            if appointments is None:
                appointments = self.get_db_appointments_for_month(month, year, start_date_str, end_date_str)
            
            # Filter sync state for current studios
            studio_ids = set(studio_calendar_ids.keys())
            sync_state = sync_manager.get_sync_state_for_studios(studio_ids)
            
            success_count = 0
            error_count = 0
            total_count = len(appointments)
            updated_count = 0
            new_count = 0
            skipped_count = 0
            
            if progress_callback:
                progress_callback(0, total_count, "Analyzing appointments...")
            
            # Track current appointment IDs for deletion detection
            current_appointment_ids = set()

            # Set per evitare duplicati logici nello stesso run
            # Chiave: (calendar_id, DATA, ORA_INIZIO, STUDIO, PAZIENTE/descrizione)
            processed_slots = set()

            # Raggruppa operazioni per calendar_id
            events_to_update = {}  # {calendar_id: [(app, old_event_id, new_event)]}
            events_to_create = {}  # {calendar_id: [(app, event)]}
            
            # FASE 1: Analisi e raggruppamento
            for i, app in enumerate(appointments):
                try:
                    studio_id = int(app.get('STUDIO', 0))
                    calendar_id = studio_calendar_ids.get(studio_id)
                    
                    if not calendar_id:
                        logger.warning(f"No calendar ID for studio {studio_id}, skipping")
                        continue

                    app_id = sync_manager.generate_appointment_id(app)
                    current_appointment_ids.add(app_id)

                    # Evita duplicati logici nello stesso slot durante un singolo run
                    slot_key = (
                        calendar_id,
                        app.get('DATA'),
                        app.get('ORA_INIZIO'),
                        app.get('STUDIO'),
                        (app.get('PAZIENTE') or app.get('DESCRIZIONE') or '').strip()
                    )
                    if slot_key in processed_slots:
                        logger.debug(f"Slot duplicato nello stesso run, salto: {slot_key}")
                        skipped_count += 1
                        continue
                    processed_slots.add(slot_key)

                    # Verifica stato sincronizzazione.
                    # Se force_resync=True forziamo comunque la risincronizzazione
                    # (ma usiamo ancora lo stato per distinguere update/creazione).
                    already_synced = sync_manager.is_appointment_synced(app)
                    if already_synced and not force_resync:
                        skipped_count += 1
                    else:
                        event = self._create_event_from_appointment(app)
                        
                        if app_id in sync_state:
                            # Da aggiornare
                            if calendar_id not in events_to_update:
                                events_to_update[calendar_id] = []
                            events_to_update[calendar_id].append((app, sync_state[app_id], event))
                        else:
                            # Da creare
                            if calendar_id not in events_to_create:
                                events_to_create[calendar_id] = []
                            events_to_create[calendar_id].append((app, event))
                    
                    if progress_callback and i % 10 == 0:
                        progress_callback(i, total_count, f"Analyzing {i}/{total_count}...")
                        
                except Exception as e:
                    logger.error(f"Error analyzing appointment {i}: {e}")
                    error_count += 1
            
            # FASE 2: Batch updates (delete vecchi + create nuovi)
            if progress_callback:
                progress_callback(
                    skipped_count, 
                    total_count, 
                    f"Updating {sum(len(v) for v in events_to_update.values())} appointments..."
                )
            
            for calendar_id, updates in events_to_update.items():
                if not updates:
                    continue
                    
                # Prima cancella i vecchi eventi in batch
                old_event_ids = [sync_data['event_id'] for _, sync_data, _ in updates]
                delete_results = self._batch_delete_events(
                    service, calendar_id, old_event_ids, 
                    operation_context=f"update {len(updates)} events"
                )
                
                # Poi crea i nuovi in batch
                new_events = [event for _, _, event in updates]
                create_results = self._batch_create_events(
                    service, calendar_id, new_events,
                    operation_context=f"create {len(new_events)} updated events"
                )
                
                # Aggiorna sync state
                for (app, _, _), (_, new_event_id) in zip(updates, create_results['created']):
                    sync_manager.mark_appointment_synced(app, calendar_id, new_event_id, month, year)
                    updated_count += 1
                    success_count += 1
                
                error_count += create_results['errors']
            
            # FASE 3: Batch create nuovi eventi
            if progress_callback:
                progress_callback(
                    skipped_count + updated_count,
                    total_count,
                    f"Creating {sum(len(v) for v in events_to_create.values())} new appointments..."
                )
            
            for calendar_id, creates in events_to_create.items():
                if not creates:
                    continue
                
                apps = [app for app, _ in creates]
                events = [event for _, event in creates]
                
                create_results = self._batch_create_events(
                    service, calendar_id, events,
                    operation_context=f"create {len(events)} new events"
                )
                
                # Aggiorna sync state
                for app, (_, new_event_id) in zip(apps, create_results['created']):
                    sync_manager.mark_appointment_synced(app, calendar_id, new_event_id, month, year)
                    new_count += 1
                    success_count += 1
                
                error_count += create_results['errors']
            
            # FASE 4: Batch delete appuntamenti rimossi
            deleted_count = 0
            appointments_to_delete = sync_manager.get_appointments_to_delete(
                current_appointment_ids, month, year, studio_ids
            )
            
            if appointments_to_delete:
                if progress_callback:
                    progress_callback(
                        success_count + error_count,
                        total_count,
                        f"Deleting {len(appointments_to_delete)} removed appointments..."
                    )
                
                # Raggruppa per calendar
                deletes_by_calendar = {}
                for app_id in appointments_to_delete:
                    sync_data = sync_state[app_id]
                    cal_id = sync_data['calendar_id']
                    if cal_id not in deletes_by_calendar:
                        deletes_by_calendar[cal_id] = []
                    deletes_by_calendar[cal_id].append((app_id, sync_data['event_id']))
                
                # Batch delete per calendar
                for cal_id, deletes in deletes_by_calendar.items():
                    event_ids = [event_id for _, event_id in deletes]
                    delete_results = self._batch_delete_events(
                        service, cal_id, event_ids,
                        operation_context=f"cleanup {len(event_ids)} events"
                    )
                    
                    # Rimuovi da sync state
                    for app_id, _ in deletes:
                        parts = app_id.split('_')
                        sync_manager.remove_appointment_sync({
                            'DATA': parts[0], 
                            'ORA_INIZIO': parts[1], 
                            'STUDIO': parts[2]
                        })
                    
                    deleted_count += delete_results['success'] + delete_results['not_found']
            
            # Final progress
            if progress_callback:
                progress_callback(
                    total_count,
                    total_count,
                    f"Sync completed!"
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
            
            logger.info(f"Batch sync results: {result}")
            return result
            
        except GoogleCredentialsNotFoundError:
            raise
        except GoogleQuotaError:
            raise
        except Exception as e:
            logger.error(f"Error in batch sync: {e}")
            raise CalendarSyncError(f"Sync failed: {str(e)}")

    def _create_event_from_appointment(self, app: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create Google Calendar event from appointment data.
        Maintains V1 exact logic.
        """
        try:
            # Recupera i dati logici dall'appuntamento
            descrizione = (app.get('DESCRIZIONE') or '').strip()
            note = (app.get('NOTE') or '').strip()
            data_str = app.get('DATA', '')
            ora_inizio = app.get('ORA_INIZIO', 9)
            ora_fine = app.get('ORA_FINE', 10)
            
            # Parse date
            if isinstance(data_str, str):
                event_date = datetime.fromisoformat(data_str)
            elif isinstance(data_str, date):
                event_date = datetime.combine(data_str, datetime.min.time())
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
            
            # --- LOGICA CORRETTA PER TITOLO E DESCRIZIONE ---
            # Il titolo è la descrizione. Se manca (es. nota giornaliera), usa le note.
            summary = descrizione or note or "Appuntamento"
            
            # La descrizione dell'evento è sempre il campo NOTE.
            event_description = note
            
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
                'description': event_description,
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
        paziente_id = (appointment.get('_PATIENT_ID') or '').strip()
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
            if keyword in descrizione or keyword in note:
                return True
        
        # Check for empty or invalid appointments (solo se non è un appuntamento di servizio)
        if not paziente_id and not descrizione and not note and tipo not in ['F', 'A', 'M']:
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
    
    def google_clear_calendar_with_progress(self, calendar_id: str, 
                                       progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """
        Clear calendar usando BATCH DELETE.
        """
        try:
            service = self._get_calendar_service()
            
            # Ottieni tutti gli event IDs
            logger.info(f"Listing all events in calendar {calendar_id}")
            all_event_ids = []
            page_token = None
            
            while True:
                events_result = self._execute_with_retry(
                    service.events().list(
                        calendarId=calendar_id,
                        pageToken=page_token,
                        maxResults=2500,
                        fields="items(id),nextPageToken"  # Solo IDs per velocità
                    ),
                    operation_name="list events for clearing"
                )
                
                if events_result:
                    events = events_result.get('items', [])
                    all_event_ids.extend([e['id'] for e in events])
                    page_token = events_result.get('nextPageToken')
                    
                    if progress_callback:
                        progress_callback(
                            len(all_event_ids), 
                            len(all_event_ids),
                            f"Found {len(all_event_ids)} events..."
                        )
                    
                    if not page_token:
                        break
                else:
                    break
            
            total_events = len(all_event_ids)
            logger.info(f"Deleting {total_events} events (simple mode, no batch)...")
            
            if total_events == 0:
                return {'deleted_count': 0, 'message': 'Calendar already empty'}
            
            # Cancellazione semplice evento-per-evento con retry centralizzato
            deleted_count = 0
            error_count = 0
            
            for idx, event_id in enumerate(all_event_ids, start=1):
                try:
                    # Usiamo il wrapper con rate limiting e backoff
                    self._execute_with_retry(
                        service.events().delete(
                            calendarId=calendar_id,
                            eventId=event_id
                        ),
                        operation_name=f"clear event {event_id}",
                    )
                    deleted_count += 1
                except GoogleQuotaError:
                    # Se Google quota è esaurita, interrompiamo e segnaliamo l'errore
                    logger.error("Google quota error during clear calendar, aborting further deletes")
                    error_count += 1
                    break
                except Exception as e:
                    # Qualsiasi altro errore (inclusi 409 Conflict) viene loggato e si continua
                    logger.warning(f"Errore cancellazione singolo evento {event_id}: {e}")
                    error_count += 1
                
                if progress_callback and (idx % 20 == 0 or idx == total_events):
                    progress_callback(
                        deleted_count,
                        total_events,
                        f"Deleted {deleted_count}/{total_events} events (errors: {error_count})"
                    )
            
            final_message = f"Deleted {deleted_count} events from calendar (errors: {error_count})"
            logger.info(final_message)
            
            return {
                'deleted_count': deleted_count,
                'errors': error_count,
                'message': final_message
            }
            
        except GoogleCredentialsNotFoundError:
            raise
        except GoogleQuotaError:
            raise
        except Exception as e:
            logger.error(f"Error clearing calendar {calendar_id}: {e}")
            raise CalendarSyncError(f"Failed to clear calendar: {str(e)}")
        
    # =========================================================================
    # SECTION 3: OAUTH AUTHENTICATION
    # =========================================================================
    
    def get_google_oauth_url(self, base_url: str) -> str:
        """Generate OAuth URL for Google authentication. V1 logic with state saving."""
        try:
            if not os.path.exists(self.credentials_file):
                raise GoogleCredentialsNotFoundError("credentials.json not found")

            flow = Flow.from_client_secrets_file(
                self.credentials_file,
                scopes=['https://www.googleapis.com/auth/calendar']
            )

            # Dynamically build redirect_uri from the provided base_url
            redirect_uri = base_url.rstrip('/') + '/oauth/callback'
            flow.redirect_uri = redirect_uri

            auth_url, state = flow.authorization_url(
                access_type='offline',
                prompt='consent',
                login_hint='studiodrnicoladimartino@gmail.com'
            )

            # Save state and flow data for callback (V1 logic)
            # Read the full credentials file to preserve structure
            with open(self.credentials_file, 'r') as f:
                full_credentials = json.load(f)

            state_data = {
                'state': state,
                'flow_data': full_credentials,  # Save full credentials instead of client_config
                'redirect_uri': redirect_uri  # Save redirect_uri for the callback
            }

            os.makedirs('instance', exist_ok=True)
            with open('instance/oauth_state.json', 'w') as f:
                json.dump(state_data, f)

            logger.info(f"OAuth URL generated with redirect_uri: {redirect_uri}")
            return auth_url

        except Exception as e:
            logger.error(f"Error generating OAuth URL: {e}")
            raise GoogleCredentialsNotFoundError(f"Cannot generate OAuth URL: {str(e)}")
    
    def handle_oauth_callback(self, code: str, state: str) -> Dict[str, Any]:
        """Handle OAuth callback from Google. V1 logic."""
        try:
            # Load saved state
            state_file = 'instance/oauth_state.json'
            if not os.path.exists(state_file):
                raise Exception("OAuth state file not found")
            
            with open(state_file, 'r') as f:
                state_data = json.load(f)
            
            saved_state = state_data['state']
            flow_data = state_data['flow_data']
            # Load the saved redirect_uri with a fallback for backward compatibility
            redirect_uri = state_data.get('redirect_uri', 'http://localhost:5001/oauth/callback') 
            
            # Verify state for security
            if state != saved_state:
                raise Exception("OAuth state mismatch - possible CSRF attack")
            
            # Recreate flow with same parameters using full credentials
            flow = Flow.from_client_config(
                flow_data,
                scopes=['https://www.googleapis.com/auth/calendar']
            )
            flow.redirect_uri = redirect_uri # Use the dynamic redirect_uri
            
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
    # SECTION 4: STATISTICS AND UTILITIES
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