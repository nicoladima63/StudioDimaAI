import sys
import os
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add server_v2 root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# FIX: Remove SSLKEYLOGFILE if present to avoid PermissionError
if 'SSLKEYLOGFILE' in os.environ:
    del os.environ['SSLKEYLOGFILE']

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("VERIFY_SCHEDULER")

def main():
    try:
        from core.automation_config import get_automation_settings
        import services.calendar_service as calendar_service_module
        from utils.dbf_utils import get_optimized_reader
        
        # Load env vars
        load_dotenv()
        
        # 1. Check Settings
        settings = get_automation_settings()
        blu_id = settings.get("calendar_studio_blu_id")
        giallo_id = settings.get("calendar_studio_giallo_id")
        
        logger.info(f"Settings loaded from automation_settings.json")
        logger.info(f"Blue Calendar Configured in Settings: {'YES' if blu_id else 'NO'} ({blu_id})")
        logger.info(f"Yellow Calendar Configured in Settings: {'YES' if giallo_id else 'NO'} ({giallo_id})")
        
        # 2. Check Env Vars (Fallback/Primary for Sync Engine)
        env_blu = os.getenv("CALENDAR_ID_STUDIO_1")
        env_giallo = os.getenv("CALENDAR_ID_STUDIO_2")
        
        logger.info(f"Blue Calendar in ENV: {'YES' if env_blu else 'NO'}")
        logger.info(f"Yellow Calendar in ENV: {'YES' if env_giallo else 'NO'}")

        # 3. Simulate Logic Check
        if not blu_id or not giallo_id:
            logger.error("!!! SCHEDULER WOULD FAIL: automation_settings.json missing calendar IDs !!!")
            logger.warning("The Scheduler service code explicitly checks these keys before running sync.")
            if env_blu and env_giallo:
                logger.info("...however, ENV vars ARE present. The Scheduler code needs to be updated to check ENV vars or use them as fallback.")
        else:
            logger.info("Scheduler configuration check passed.")

        # 4. Run Sync Simulation
        weeks_to_sync = 1 # Override for test speed (1 week)
        start_date = datetime.now().date()
        end_date = start_date + timedelta(days=(weeks_to_sync * 7))
        
        logger.info(f"Starting Sync Simulation for range: {start_date} to {end_date}")

        months_to_sync_set = set()
        current_date_iter = start_date 
        while current_date_iter < end_date:
            months_to_sync_set.add((current_date_iter.month, current_date_iter.year))
            current_date_iter += timedelta(days=1)
        
        months_to_sync = sorted(list(months_to_sync_set))
        dbf_reader = get_optimized_reader()

        for month, year in months_to_sync:
            logger.info(f"Processing date range for {month}/{year}")
            try:
                all_apps = dbf_reader.get_appointments_optimized(month, year)
                
                # Filter dates
                filtered = []
                for app in all_apps:
                    d_str = app.get('DATA')
                    if d_str: 
                        try: 
                            d = datetime.fromisoformat(d_str).date()
                            if start_date <= d < end_date: filtered.append(app)
                        except: pass
                
                logger.info(f"Found {len(filtered)} appointments in target range for {month}/{year}")
                
                # Split (Simulate scheduler logic)
                blu_apps = [a for a in filtered if int(a.get('STUDIO', 0)) == 1]
                giallo_apps = [a for a in filtered if int(a.get('STUDIO', 0)) == 2]

                logger.info(f"Studio Blu Apps: {len(blu_apps)}")
                logger.info(f"Studio Giallo Apps: {len(giallo_apps)}")

                # Call Sync if we have apps (and if config allows, but we test logic here)
                if blu_apps:
                    logger.info("Syncing Blue Studio...")
                    try:
                        res = calendar_service_module.sync_calendar_from_records(blu_apps)
                        logger.info(f"Blue Result: {res['sync']}")
                    except Exception as e:
                        logger.error(f"Blue Sync Failed: {e}")

                if giallo_apps:
                    logger.info("Syncing Yellow Studio...")
                    try:
                        res = calendar_service_module.sync_calendar_from_records(giallo_apps)
                        logger.info(f"Yellow Result: {res['sync']}")
                    except Exception as e:
                        logger.error(f"Yellow Sync Failed: {e}")
            
            except Exception as e:
                logger.error(f"Error processing month {month}/{year}: {e}")

    except Exception as e:
        logger.error(f"Verification Script Failed: {e}", exc_info=True)

if __name__ == "__main__":
    main()
