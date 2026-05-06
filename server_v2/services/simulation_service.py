import logging
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

from services.appointment_reminder_service import run_reminders, run_followup_reminders
from services.richiami_service import RichiamiService
from services.email_service import email_service
from core.constants_v2 import TIPO_RICHIAMI

logger = logging.getLogger(__name__)

class SimulationService:
    """Service to orchestrate and manage theoretical (dry run) executions."""

    def __init__(self):
        self.richiami_service = RichiamiService()
        self._last_results = {
            'timestamp': None,
            'reminders': [],
            'recalls': [],
            'emails': []
        }

    def run_all_simulations(self) -> Dict[str, Any]:
        """Runs all simulations and stores results."""
        results = {
            'timestamp': datetime.now().isoformat(),
            'reminders': self.simulate_reminders(),
            'recalls': self.simulate_recalls(),
            'emails': self.simulate_emails()
        }
        self._last_results = results
        return results

    def simulate_reminders(self) -> List[Dict[str, Any]]:
        """Simulates 24h and 2h reminders."""
        all_simulated = []
        
        # 24h reminders
        res_24h = run_reminders('24h', dry_run=True)
        all_simulated.extend(res_24h.get('simulated_actions', []))
        
        # 2h reminders
        res_2h = run_reminders('2h', dry_run=True)
        all_simulated.extend(res_2h.get('simulated_actions', []))
        
        # Followup
        res_followup = run_followup_reminders(dry_run=True)
        all_simulated.extend(res_followup.get('simulated_actions', []))
        
        return all_simulated

    def simulate_recalls(self) -> List[Dict[str, Any]]:
        """Simulates patient recalls."""
        # Note: we reuse the logic from v2_richiami.py to find who to recall
        # For simulation, we just take the first N (e.g. 50) that would be recalled today
        
        from api.v2_richiami import _months_between, _parse_date, _add_months, build_last_igiene_lookup
        from services.pazienti_service import PazientiService
        from core.database_manager import get_database_manager
        from services.sms_service import sms_service as sms_svc
        
        db_manager = get_database_manager()
        paz_service = PazientiService(db_manager)
        
        # Get patients from DBF
        raw = paz_service.get_pazienti_paginated(page=1, per_page=20000)
        if not raw.get('success'):
            return []
            
        pazienti = raw['data']['pazienti']
        today = datetime.now().date()
        igiene_lookup = build_last_igiene_lookup()
        
        simulated = []
        for p in pazienti:
            if p.get('da_richiamare', '').strip().upper() != 'S':
                continue
            
            tipo_paz = p.get('tipo_richiamo', '').strip()
            paziente_id = p.get('id', '').strip()
            
            # Use same logic as v2_richiami.py
            igiene_entry = igiene_lookup.get(paziente_id) if '2' in tipo_paz else None
            uv = igiene_entry[0] if igiene_entry else _parse_date(p.get('ultima_visita'))
            
            raw_mesi = p.get('tempo_richiamo') or p.get('mesi_richiamo')
            try:
                mesi = int(raw_mesi) if raw_mesi else None
            except:
                mesi = None
                
            if uv and mesi:
                data_richiamo_prevista = _add_months(uv, mesi)
                if data_richiamo_prevista <= today:
                    # Patient should be recalled
                    # Generate preview message
                    richiamo_data = {
                        'id': paziente_id,
                        'nome': p.get('nome', '').strip(),
                        'telefono': p.get('cellulare', '').strip() or p.get('telefono', '').strip(),
                        'tipo_richiamo': tipo_paz,
                        'tempo_richiamo': mesi,  # numero di mesi (es. 6)
                        'data_richiamo': data_richiamo_prevista.isoformat()
                    }
                    
                    preview = sms_svc.preview_recall_message(richiamo_data)
                    
                    simulated.append({
                        'patient_id': paziente_id,
                        'patient_name': richiamo_data['nome'],
                        'phone': richiamo_data['telefono'],
                        'type': 'recall',
                        'recall_type_names': [TIPO_RICHIAMI[c] for c in tipo_paz if c in TIPO_RICHIAMI],
                        'scheduled_date': richiamo_data['data_richiamo'],
                        'message': preview.get('message', ''),
                        'channel': 'sms' # Recalls are usually SMS in this app
                    })
        
        # Sort by urgency (older first)
        simulated.sort(key=lambda x: x['scheduled_date'])
        return simulated[:100] # Limit simulation to 100

    def simulate_emails(self) -> List[Dict[str, Any]]:
        """Simulates Mediolanum email processing."""
        query = 'from:Bmed.Comunicazioni@bancamediolanum.it subject:"Conferma di pagamento Bonifico"'
        
        try:
            email_results = email_service.get_emails(max_results=10, query=query)
            emails = email_results.get('emails', [])
            
            simulated = []
            for email in emails:
                # Get full detail to see attachments
                detail = email_service.get_email_detail(email['id'])
                attachments = detail.get('attachments', [])
                
                for att in attachments:
                    # Simulate saving
                    save_path = f"/data/documenti_studio/Bonifici effettuati/2026/{att['filename']}"
                    
                    # Simulate email to accountant
                    recipient = "segreteria@studiodimartino.eu"
                    subject = f"Bonifico Mediolanum — {email['subject']}"
                    body = (
                        "Buongiorno,\n\nin allegato la conferma di pagamento ricevuta da Banca Mediolanum.\n\n"
                        "Cordiali saluti,\nStudio Dr. Di Martino"
                    )
                    
                    simulated.append({
                        'email_id': email['id'],
                        'original_subject': email['subject'],
                        'original_date': email['date'],
                        'attachment_name': att['filename'],
                        'save_path': save_path,
                        'accountant_email': {
                            'to': recipient,
                            'subject': subject,
                            'body': body
                        }
                    })
            return simulated
        except Exception as e:
            logger.error(f"Error simulating emails: {e}")
            return []

    def get_last_results(self) -> Dict[str, Any]:
        """Returns the last simulation results."""
        return self._last_results

# Singleton
simulation_service = SimulationService()
