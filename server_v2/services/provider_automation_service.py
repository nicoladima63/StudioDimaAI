
import logging
from typing import Dict, Any, Optional
from core.database_manager import DatabaseManager
from services.base_service import BaseService

logger = logging.getLogger(__name__)

class ProviderAutomationService(BaseService):
    """
    Service for handling provider-related automations (e.g., sending emails to labs).
    """
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__(db_manager)
        
    def check_and_trigger_automation(self, step_data: Dict[str, Any], task_data: Dict[str, Any]) -> None:
        """
        Check if the step requires automation and trigger it.
        """
        provider_id = step_data.get('provider_id')
        if not provider_id:
            return
            
        logger.info(f"Checking automation for step {step_data['id']} (Provider: {provider_id})")
        
        try:
            # 1. Get Provider Details
            from services.provider_service import ProviderService
            provider_service = ProviderService(self.db_manager)
            provider = provider_service.get_provider_by_id(provider_id)
            
            if not provider:
                logger.warning(f"Provider {provider_id} not found for automation")
                return

            # 2. Prepare Message
            # Get Patient Name (Assuming we can fetch it or it is passed? task_data usually has id)
            # Optimally we should enrich task_data with patient info before calling this or do a query here.
            # For now, let's use available info.
            
            patient_id = task_data.get('patient_id')
            work_name = task_data.get('description') or "Lavorazione"
            step_name = step_data.get('name')
            
            message = f"Studio Dima: È il tuo turno per {work_name} (Fase: {step_name}). Paziente: {patient_id}."
            
            # 3. Send Notification
            # Check for Phone (SMS)
            phone = provider.get('phone')
            if phone:
                from services.sms_service import sms_service
                logger.info(f"Sending SMS to Provider {provider['name']} ({phone}): {message}")
                # We use tag 'provider_notification'
                sms_service.send_sms(phone, message, tag='provider_notification')
            elif provider.get('email'):
                 # Placeholder for email
                 logger.info(f"Email notification for provider {provider['name']} not implemented yet.")
            else:
                logger.info(f"No contact info for provider {provider['name']}. Log only.")

        except Exception as e:
            logger.error(f"Error executing provider automation: {e}")
