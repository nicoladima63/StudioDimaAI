import time
import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from core.automation_config import get_automation_settings
from services.calendar_service import CalendarServiceV2
from services.sms_service import SMSService
from utils.dbf_utils import get_optimized_reader

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
            logger.info("Scheduler avviato")
            
        # Programma tutti i job all'avvio
        self.schedule_reminder_job()
        self.schedule_recall_job() 
        self.schedule_calendar_sync_job()
        
    def shutdown(self):
        """Ferma lo scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Scheduler fermato")

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
            logger.info("Automazione promemoria appuntamenti disattivata.")
            return

        def job():
            logger.info(f"[AUTOMAZIONE] Invio promemoria appuntamenti: ora={hour:02d}:{minute:02d}")
            # Usa DBF reader per ottenere appuntamenti domani
            dbf_reader = get_optimized_reader()
            log = dbf_reader.get_tomorrow_appointments_for_reminder()
            for line in log:
                logger.info(f"[PROMEMORIA] {line}")

        trigger = CronTrigger(hour=hour, minute=minute)
        self._current_reminder_job = self.scheduler.add_job(
            job, trigger, id="reminder_job_v2", replace_existing=True
        )
        logger.info(f"Automazione promemoria appuntamenti schedulata alle {hour:02d}:{minute:02d}.")

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
            logger.info("Automazione richiami disattivata.")
            return

        def job():
            logger.info(f"[AUTOMAZIONE] Invio richiami: ora={hour}:{minute:02d}")
            
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
            logger.info(f"[RICHIMI] Inviati: {sent}, Errori: {len(errors)}")

        trigger = CronTrigger(hour=hour, minute=minute)
        self._current_recall_job = self.scheduler.add_job(
            job, trigger, id="recall_job_v2", replace_existing=True
        )
        logger.info(f"Automazione richiami schedulata alle {hour}:{minute:02d}.")

    def schedule_calendar_sync_job(self):
        """Schedula job sincronizzazione calendario - logica esatta da V1"""
        settings = get_automation_settings()
        hour = int(settings.get("calendar_sync_hour", 21))
        minute = int(settings.get("calendar_sync_minute", 0))
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
            """Job di sincronizzazione automatica calendario - logica identica V1"""
            now = datetime.now()
            
            # Controlla se è weekend (sabato=5, domenica=6)
            if now.weekday() >= 5:
                logger.info(f"[CALENDAR SYNC] Saltato: è weekend ({now.strftime('%A')})")
                return
                
            logger.info(f"[CALENDAR SYNC] Avvio sincronizzazione automatica alle {now.strftime('%H:%M')}")
            
            # Ottieni ID calendari dalla configurazione
            studio_blu_calendar = settings.get("calendar_studio_blu_id")
            studio_giallo_calendar = settings.get("calendar_studio_giallo_id")
            
            if not studio_blu_calendar or not studio_giallo_calendar:
                logger.error("[CALENDAR SYNC] ID calendari non configurati in automation_settings.json")
                return
                
            # Sincronizza mese corrente e prossimo mese
            current_month = now.month
            current_year = now.year
            next_month = current_month + 1 if current_month < 12 else 1
            next_year = current_year if current_month < 12 else current_year + 1
            
            months_to_sync = [
                (current_month, current_year),
                (next_month, next_year)
            ]
            
            total_synced = 0
            total_errors = 0
            calendar_service = CalendarServiceV2()
            
            for month, year in months_to_sync:
                logger.info(f"[CALENDAR SYNC] Sincronizzazione {month:02d}/{year}")
                
                # Ottieni tutti gli appuntamenti del mese
                all_appointments = calendar_service.get_db_appointments_for_month(month, year)
                
                # Sincronizza Studio Blu (studio_id=1)
                try:
                    logger.info(f"[CALENDAR SYNC] Studio Blu -> {studio_blu_calendar}")
                    # Filtra appuntamenti per Studio Blu
                    studio_blu_appointments = [app for app in all_appointments if int(app.get('STUDIO', 0)) == 1]
                    logger.info(f"[CALENDAR SYNC] Studio Blu: {len(studio_blu_appointments)} appuntamenti da sincronizzare")
                    
                    result_blu = calendar_service.sync_appointments_for_month(
                        month, year, 
                        {1: studio_blu_calendar},  # Studio 1 -> Calendario Blu
                        studio_blu_appointments
                    )
                    total_synced += result_blu.get('success', 0)
                    logger.info(f"[CALENDAR SYNC] Studio Blu: {result_blu.get('message', 'Completato')}")
                except Exception as e:
                    logger.error(f"[CALENDAR SYNC] Errore Studio Blu {month:02d}/{year}: {e}")
                    total_errors += 1
                    
                # Sincronizza Studio Giallo (studio_id=2)  
                try:
                    logger.info(f"[CALENDAR SYNC] Studio Giallo -> {studio_giallo_calendar}")
                    # Filtra appuntamenti per Studio Giallo
                    studio_giallo_appointments = [app for app in all_appointments if int(app.get('STUDIO', 0)) == 2]
                    logger.info(f"[CALENDAR SYNC] Studio Giallo: {len(studio_giallo_appointments)} appuntamenti da sincronizzare")
                    
                    result_giallo = calendar_service.sync_appointments_for_month(
                        month, year,
                        {2: studio_giallo_calendar},  # Studio 2 -> Calendario Giallo
                        studio_giallo_appointments
                    )
                    total_synced += result_giallo.get('success', 0)
                    logger.info(f"[CALENDAR SYNC] Studio Giallo: {result_giallo.get('message', 'Completato')}")
                except Exception as e:
                    logger.error(f"[CALENDAR SYNC] Errore Studio Giallo {month:02d}/{year}: {e}")
                    total_errors += 1
                    
            # Log finale identico a V1
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
                
            logger.info(f"[CALENDAR SYNC] Completato: {total_synced} sincronizzati, {total_errors} errori")

        # Programma il job
        trigger = CronTrigger(hour=hour, minute=minute)
        self._current_calendar_sync_job = self.scheduler.add_job(
            job, trigger, id="calendar_sync_job_v2", replace_existing=True
        )
        logger.info(f"Automazione sincronizzazione calendario schedulata alle {hour}:{minute:02d}.")

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