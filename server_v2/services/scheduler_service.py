import time
import logging
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from dateutil.relativedelta import relativedelta
from core.automation_config import get_automation_settings
import services.calendar_service as calendar_service_module
from services.sms_service import SMSService
from utils.dbf_utils import get_optimized_reader

# Disabilita log inutili
logging.getLogger('apscheduler').setLevel(logging.WARNING)
logging.getLogger('apscheduler.scheduler').setLevel(logging.WARNING)
logging.getLogger('apscheduler.executors').setLevel(logging.WARNING)
logging.getLogger('apscheduler.jobstores').setLevel(logging.WARNING)
logging.getLogger('tzlocal').setLevel(logging.WARNING)

logger = logging.getLogger("scheduler_v2")

class SchedulerService:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self._current_reminder_job = None
        self._current_recall_job = None
        self._current_calendar_sync_job = None
        
    def start(self):
        """Avvia lo scheduler e programma tutti i job"""
        if not self.scheduler.running:
            self.scheduler.start()
            # logger.info("Scheduler avviato")
            
        # Programma tutti i job all'avvio
        self.schedule_reminder_job()
        self.schedule_recall_job() 
        self.schedule_calendar_sync_job()
        
    def shutdown(self):
        """Ferma lo scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            # logger.info("Scheduler fermato")

    def schedule_reminder_job(self):
        """Schedula job promemoria appuntamenti - logica esatta da V1"""
        settings = get_automation_settings()
        hour = int(settings.get("reminder_hour", 15))
        minute = int(settings.get("reminder_minute", 0))
        enabled = settings.get("reminder_enabled", True)

        # Rimuovi job precedente se esiste
        if self._current_reminder_job:
            try:
                self.scheduler.remove_job(self._current_reminder_job.id)
            except Exception:
                pass
            self._current_reminder_job = None

        if not enabled:
            # logger.info("Automazione promemoria appuntamenti disattivata.")
            return

        def job():
            # logger.info(f"[AUTOMAZIONE] Invio promemoria appuntamenti: ora={hour:02d}:{minute:02d}")
            # Usa DBF reader per ottenere appuntamenti domani
            dbf_reader = get_optimized_reader()
            log = dbf_reader.get_tomorrow_appointments_for_reminder()
            for line in log:
                # logger.info(f"[PROMEMORIA] {line}")
                pass

        trigger = CronTrigger(hour=hour, minute=minute)
        self._current_reminder_job = self.scheduler.add_job(
            job, trigger, id="reminder_job_v2", replace_existing=True
        )
        # logger.info(f"Automazione promemoria appuntamenti schedulata alle {hour:02d}:{minute:02d}.")

    def schedule_recall_job(self):
        """Schedula job richiami - logica esatta da V1"""
        settings = get_automation_settings()
        hour = int(settings.get("recall_hour", 16))
        minute = int(settings.get("recall_minute", 0))
        enabled = settings.get("recall_enabled", True)

        # Rimuovi job precedente se esiste
        if self._current_recall_job:
            try:
                self.scheduler.remove_job(self._current_recall_job.id)
            except Exception:
                pass
            self._current_recall_job = None

        if not enabled:
            # logger.info("Automazione richiami disattivata.")
            return

        def job():
            # logger.info(f"[AUTOMAZIONE] Invio richiami: ora={hour}:{minute:02d}")
            
            # Usa il richiami service V2 per ottenere i richiami
            from .richiami_service import RichiamiService
            recall_service = RichiamiService()
            recalls = recall_service.get_all_recalls()
            
            sent = 0
            errors = []
            sms_service = SMSService()
            
            for recall in recalls:
                try:
                    # Configura SMS service con modalità da settings
                    mode = settings.get('sms_richiami_mode', 'prod')
                    sms_service.mode = mode
                    sms_service.params = sms_service.get_env_params('sms', mode)
                    sms_service._setup_client()
                    
                    result = sms_service.send_recall_sms(recall)
                    if result.get('success'):
                        sent += 1
                    else:
                        errors.append({
                            'paziente': recall.get('nome_completo', ''),
                            'numero': recall.get('telefono', ''),
                            'errore': result.get('error', 'Errore invio')
                        })
                except Exception as e:
                    errors.append({
                        'paziente': recall.get('nome_completo', ''),
                        'numero': recall.get('telefono', ''),
                        'errore': str(e)
                    })
            
            # Log esatto come V1
            log_entry = {
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
                'sent': sent,
                'errors': errors
            }
            try:
                with open('automation_recall.log', 'a', encoding='utf-8') as f:
                    f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
            except Exception as e:
                logger.error(f"Errore scrittura log richiami: {e}")
            # logger.info(f"[RICHIMI] Inviati: {sent}, Errori: {len(errors)}")

        trigger = CronTrigger(hour=hour, minute=minute)
        self._current_recall_job = self.scheduler.add_job(
            job, trigger, id="recall_job_v2", replace_existing=True
        )
        # logger.info(f"Automazione richiami schedulata alle {hour}:{minute:02d}.")

    def schedule_calendar_sync_job(self):
        """Schedula job sincronizzazione calendario"""
        settings = get_automation_settings()
        hour = int(settings.get("calendar_sync_hour", 21))
        minute = int(settings.get("calendar_sync_minute", 0))
        weeks_to_sync = int(settings.get("calendar_sync_weeks_to_sync", 3))
        enabled = settings.get("calendar_sync_enabled", True)
        
        # Rimuovi job precedente se esiste
        if self._current_calendar_sync_job:
            try:
                self.scheduler.remove_job(self._current_calendar_sync_job.id)
            except Exception:
                pass
            self._current_calendar_sync_job = None

        if not enabled:
            logger.info("Automazione sincronizzazione calendario disattivata.")
            return

        def job():
            """Job di sincronizzazione automatica calendario"""
            now = datetime.now()
            
            # Controlla se è weekend (sabato=5, domenica=6)
            if now.weekday() >= 5:
                logger.info(f"[CALENDAR SYNC] Saltato: è weekend ({now.strftime('%A')})")
                return
                
            logger.info(f"[CALENDAR SYNC] Avvio sincronizzazione automatica per {weeks_to_sync} settimane.")
            
            # Ottieni ID calendari dalla configurazione
            # The calendar_ids are now configured in calendar_service.py itself and are not passed.
            # We still check for their existence as a guard clause for overall config validity.
            studio_blu_calendar = settings.get("calendar_studio_blu_id")
            studio_giallo_calendar = settings.get("calendar_studio_giallo_id")
            
            if not studio_blu_calendar or not studio_giallo_calendar:
                logger.error("[CALENDAR SYNC] ID calendari non configurati in automation_settings.json")
                return
                
            # Calcola l'intervallo di date esatto
            start_date = now.date()
            end_date = start_date + timedelta(days=(weeks_to_sync * 7))
            
            # Determina i mesi coinvolti per l'iterazione
            months_to_sync_set = set()
            current_date_iter = start_date # Use a separate iterator for clarity
            while current_date_iter < end_date:
                months_to_sync_set.add((current_date_iter.month, current_date_iter.year))
                current_date_iter += timedelta(days=1)
            
            months_to_sync = sorted(list(months_to_sync_set)) # Sorted list of (month, year) tuples
            
            total_synced = 0
            total_errors = 0

            # Instantiate DBF reader
            dbf_reader = get_optimized_reader()
            
            for month, year in months_to_sync:
                logger.info(f"[CALENDAR SYNC] Sincronizzazione mese {month:02d}/{year} (intervallo dal {start_date} al {end_date})")
                
                # Get all appointments for the month/year range from DBF
                all_appointments_raw_for_month = dbf_reader.get_appointments_optimized(month, year)

                # Filter by exact date range (start_date to end_date)
                filtered_by_date_range = []
                for app in all_appointments_raw_for_month:
                    app_date_str = app.get('DATA') # 'DATA' field is expected to be ISO format string
                    if app_date_str:
                        try:
                            app_date = datetime.fromisoformat(app_date_str).date()
                            if start_date <= app_date < end_date: 
                                filtered_by_date_range.append(app)
                        except ValueError:
                            logger.warning(f"Invalid date format in appointment record: {app_date_str}")
                
                # Sincronizza Studio Blu (studio_id=1)
                try:
                    studio_blu_appointments = [app for app in filtered_by_date_range if int(app.get('STUDIO', 0)) == 1]
                    # The sync_calendar_from_records takes a list of raw appointments.
                    # It will internally handle normalization, Google Client setup, and actual sync.
                    result_blu = calendar_service_module.sync_calendar_from_records(
                        records=studio_blu_appointments
                    )
                    total_synced += result_blu['sync'].get('inserted', 0) + result_blu['sync'].get('updated', 0)
                    total_errors += result_blu['sync'].get('errors', 0)
                except Exception as e:
                    logger.error(f"[CALENDAR SYNC] Errore Studio Blu {month:02d}/{year}: {e}", exc_info=True)
                    total_errors += 1
                    
                # Sincronizza Studio Giallo (studio_id=2)  
                try:
                    studio_giallo_appointments = [app for app in filtered_by_date_range if int(app.get('STUDIO', 0)) == 2]
                    result_giallo = calendar_service_module.sync_calendar_from_records(
                        records=studio_giallo_appointments
                    )
                    total_synced += result_giallo['sync'].get('inserted', 0) + result_giallo['sync'].get('updated', 0)
                    total_errors += result_giallo['sync'].get('errors', 0)
                except Exception as e:
                    logger.error(f"[CALENDAR SYNC] Errore Studio Giallo {month:02d}/{year}: {e}", exc_info=True)
                    total_errors += 1
                    
            # Log finale
            log_entry = {
                'timestamp': now.strftime('%Y-%m-%dT%H:%M:%S'),
                'total_synced': total_synced,
                'total_errors': total_errors,
                'months_processed': len(months_to_sync)
            }
            
            try:
                with open('automation_calendar_sync.log', 'a', encoding='utf-8') as f:
                    f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
            except Exception as e:
                logger.error(f"[CALENDAR SYNC] Errore scrittura log: {e}")

        # Programma il job
        trigger = CronTrigger(hour=hour, minute=minute)
        self._current_calendar_sync_job = self.scheduler.add_job(
            job, trigger, id="calendar_sync_job_v2", replace_existing=True
        )

    def reschedule_recall_job(self):
        """Riprogramma job richiami quando cambia la configurazione"""
        self.schedule_recall_job()
        
    def reschedule_reminder_job(self):
        """Riprogramma job promemoria quando cambia la configurazione"""
        self.schedule_reminder_job()
        
    def reschedule_calendar_sync_job(self):
        """Riprogramma job sync calendario quando cambia la configurazione"""
        self.schedule_calendar_sync_job()
        
    def get_scheduler_status(self) -> Dict[str, Any]:
        """Ottieni status dello scheduler e dei job attivi"""
        jobs = []
        for job in self.scheduler.get_jobs():
            try:
                next_run = getattr(job, 'next_run_time', None)
                if next_run:
                    next_run_str = next_run.isoformat()
                else:
                    next_run_str = None
            except:
                next_run_str = None
                
            jobs.append({
                'id': job.id,
                'name': getattr(job, 'name', None) or job.id,
                'next_run': next_run_str,
                'trigger': str(getattr(job, 'trigger', 'Unknown'))
            })
            
        return {
            'running': self.scheduler.running,
            'jobs': jobs
        }

# Istanza globale del scheduler
scheduler_service = SchedulerService()