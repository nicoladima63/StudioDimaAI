
"""
🔧 Servizio Automazione - Gestione centralizzata di azioni e regole di automazione
================================================================================

Servizio per gestire azioni riutilizzabili e regole che le attivano in base a trigger.

Author: Gemini Code Architect
Version: 2.0.0
"""

import json
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from .base_service import BaseService
from core.exceptions import ValidationError, DatabaseError
from core.constants_v2 import COLONNE # <--- NEW IMPORT

logger = logging.getLogger(__name__)

class AutomationService(BaseService):
    """
    Servizio per la gestione dell'engine di automazione.
    
    Caratteristiche:
    - Gestione CRUD per Azioni e Regole
    - Esecuzione di regole basate su trigger
    - Registro dinamico delle funzioni di implementazione delle azioni
    """
    
    def __init__(self, database_manager=None):
        from core.database_manager import get_database_manager
        super().__init__(database_manager or get_database_manager())
        self.action_implementation_registry = {}
        self._register_default_implementations()
        self._sync_registry_with_db() # Sincronizza azioni all'avvio
    
    def _register_default_implementations(self):
        """Registra le implementazioni e le definizioni dei parametri per le azioni di sistema."""
        self.action_definitions = {
            'send_sms_link': {
                'function': self._impl_send_sms_link,
                'parameters': [
                    {'name': 'template_key', 'type': 'string', 'required': True, 'label': 'Chiave Template SMS'},
                    {'name': 'page_slug', 'type': 'string', 'required': False, 'label': 'Slug Pagina Destinazione'}
                ]
            },
            'send_appointment_sms': {
                'function': self._impl_send_appointment_sms,
                'parameters': [
                    {'name': 'template_id', 'type': 'number', 'required': True, 'label': 'ID Template SMS'}
                ]
            }
        }
        self.action_implementation_registry = {
            name: definition['function'] 
            for name, definition in self.action_definitions.items()
        }

    def _sync_registry_with_db(self):
        """Assicura che tutte le azioni definite nel codice esistano nel DB (logica upsert)."""
        logger.info("Sincronizzazione azioni (upsert) dal codice al database...")
        try:
            db_actions_rows = self.execute_query("SELECT name, parameters_json FROM actions")
            db_actions = {row['name']: row.get('parameters_json') for row in db_actions_rows}
            
            code_actions = self.action_definitions

            for action_name, definition in code_actions.items():
                params_json_from_code = json.dumps(definition.get('parameters', []))

                if action_name not in db_actions:
                    # Azione mancante, la inserisco
                    logger.info(f"Azione '{action_name}' non trovata nel DB. Aggiungo...")
                    query = "INSERT INTO actions (name, description, parameters_json, is_system_action) VALUES (?, ?, ?, ?)"
                    params = (action_name, f"Azione di sistema: {action_name}", params_json_from_code, 1)
                    self.execute_command(query, params)
                    logger.info(f"Azione '{action_name}' aggiunta con successo.")
                else:
                    # Azione esistente, controllo se i parametri sono aggiornati
                    params_json_from_db = db_actions[action_name]
                    if params_json_from_db != params_json_from_code:
                        logger.info(f"Parametri per l'azione '{action_name}' non sono sincronizzati. Aggiorno...")
                        query = "UPDATE actions SET parameters_json = ? WHERE name = ?"
                        params = (params_json_from_code, action_name)
                        self.execute_command(query, params)
                        logger.info(f"Parametri per '{action_name}' aggiornati con successo.")
            
            logger.info("Sincronizzazione azioni completata.")

        except Exception as e:
            logger.error(f"Errore durante la sincronizzazione delle azioni con il DB: {e}", exc_info=True)

    # --- Actions Management ---

    def list_actions(self) -> List[Dict[str, Any]]:
        """Restituisce l'elenco delle azioni disponibili dal database."""
        try:
            actions = self.execute_query("SELECT id, name, description, parameters_json, is_system_action FROM actions ORDER BY name")
            for action in actions:
                if action.get('parameters_json'):
                    action['parameters'] = json.loads(action['parameters_json'])
            return actions
        except Exception as e:
            logger.error(f"Errore nel recuperare le azioni: {e}")
            raise DatabaseError("Errore nel recupero delle azioni.")

    # --- Rules Management ---

    def get_all_rules(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Recupera tutte le regole con filtri opzionali."""
        try:
            query = """
                SELECT r.*, a.name as action_name, a.description as action_description
                FROM automation_rules r
                JOIN actions a ON r.action_id = a.id
                WHERE 1=1
            """
            params = []
            
            if filters:
                if filters.get('id'):
                    query += " AND r.id = ?"
                    params.append(filters['id'])
                if filters.get('monitor_id'):
                    query += " AND r.monitor_id = ?"
                    params.append(filters['monitor_id'])
                if filters.get('attiva') is not None:
                    query += " AND r.attiva = ?"
                    params.append(1 if filters['attiva'] else 0)
                if filters.get('trigger_id'):
                    query += " AND r.trigger_id = ?"
                    params.append(filters['trigger_id'])
            
            query += " ORDER BY r.priorita ASC, r.id ASC"
            
            rules = self.execute_query(query, tuple(params) if params else ())

            for rule in rules:
                if rule.get('action_params_json'):
                    try:
                        rule['action_params'] = json.loads(rule['action_params_json'])
                    except json.JSONDecodeError:
                        rule['action_params'] = {}
            
            return rules
            
        except Exception as e:
            logger.error(f"Errore recupero regole di automazione: {e}")
            raise DatabaseError(f"Errore recupero regole di automazione: {e}")

    def get_rule_by_id(self, rule_id: int) -> Optional[Dict[str, Any]]:
        """Recupera una singola regola per ID."""
        rules = self.get_all_rules({'id': rule_id})
        return rules[0] if rules else None

    def create_rule(self, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        """Crea una nuova regola di automazione."""
        # Basic validation
        if not all(k in rule_data for k in ['name', 'trigger_id', 'action_id', 'monitor_id']):
            raise ValidationError("Campi 'name', 'trigger_id', 'action_id', 'monitor_id' sono obbligatori.")

        # --- PREVENZIONE REGOLE DUPLICATE ---
        # Controlla se esiste già una regola attiva con lo stesso monitor, trigger e azione
        existing_rules = self.get_all_rules({
            'monitor_id': rule_data['monitor_id'],
            'trigger_id': rule_data['trigger_id'],
            'action_id': rule_data['action_id'],
            'attiva': True # Consideriamo solo le regole attive come duplicati
        })
        if existing_rules:
            raise ValidationError("Esiste già una regola attiva con lo stesso monitor, trigger e azione.")
        # --- FINE PREVENZIONE REGOLE DUPLICATE ---

        query = """
            INSERT INTO automation_rules (
                name, description, trigger_type, trigger_id, 
                action_id, action_params_json, attiva, priorita, monitor_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            rule_data['name'],
            rule_data.get('description', ''),
            rule_data.get('trigger_type', 'prestazione'),
            rule_data['trigger_id'],
            rule_data['action_id'],
            json.dumps(rule_data.get('action_params', {})),
            rule_data.get('attiva', True),
            rule_data.get('priorita', 100),
            rule_data['monitor_id']
        )
        
        try:
            rule_id = self.execute_command(query, params)
            if not rule_id:
                raise DatabaseError("Creazione regola fallita, nessun ID restituito.")
            
            logger.info(f"Regola di automazione creata con ID: {rule_id}")
            return self.get_rule_by_id(rule_id)
        except Exception as e:
            logger.error(f"Errore DB durante creazione regola: {e}")
            raise DatabaseError(f"Errore DB durante creazione regola: {e}")

    def update_rule(self, rule_id: int, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        """Aggiorna una regola esistente."""
        if not self.get_rule_by_id(rule_id):
            raise ValidationError(f"Regola con ID {rule_id} non trovata.")

        fields = ['name', 'description', 'trigger_id', 'action_id', 'action_params_json', 'attiva', 'priorita']
        update_clauses = []
        params = []

        for field in fields:
            if field in rule_data:
                update_clauses.append(f"{field} = ?")
                value = rule_data[field]
                if field == 'action_params_json' and isinstance(value, dict):
                    value = json.dumps(value)
                params.append(value)

        if not update_clauses:
            raise ValidationError("Nessun dato da aggiornare.")

        query = f"UPDATE automation_rules SET { ', '.join(update_clauses)}, updated_at = datetime('now') WHERE id = ?"
        params.append(rule_id)

        try:
            self.execute_command(query, tuple(params))
            logger.info(f"Regola di automazione {rule_id} aggiornata.")
            return self.get_rule_by_id(rule_id)
        except Exception as e:
            logger.error(f"Errore DB durante aggiornamento regola {rule_id}: {e}")
            raise DatabaseError(f"Errore DB durante aggiornamento regola: {e}")

    def delete_rule(self, rule_id: int) -> bool:
        """Elimina una regola di automazione."""
        if not self.get_rule_by_id(rule_id):
            raise ValidationError(f"Regola con ID {rule_id} non trovata.")
        
        try:
            self.execute_command("DELETE FROM automation_rules WHERE id = ?", (rule_id,))
            logger.info(f"Regola di automazione {rule_id} eliminata.")
            return True
        except Exception as e:
            logger.error(f"Errore DB durante eliminazione regola {rule_id}: {e}")
            raise DatabaseError(f"Errore DB durante eliminazione regola: {e}")

    def delete_rules_for_monitor(self, monitor_id: str) -> bool:
        """Elimina tutte le regole di automazione associate a un monitor specifico."""
        try:
            self.execute_command("DELETE FROM automation_rules WHERE monitor_id = ?", (monitor_id,))
            logger.info(f"Tutte le regole di automazione per il monitor {monitor_id} sono state eliminate.")
            return True
        except Exception as e:
            logger.error(f"Errore DB durante eliminazione regole per monitor {monitor_id}: {e}")
            raise DatabaseError(f"Errore DB durante eliminazione regole per monitor: {e}")

    def delete_rules_for_monitor(self, monitor_id: str) -> bool:
        """Elimina tutte le regole di automazione associate a un monitor specifico."""
        try:
            self.execute_command("DELETE FROM automation_rules WHERE monitor_id = ?", (monitor_id,))
            logger.info(f"Tutte le regole di automazione per il monitor {monitor_id} sono state eliminate.")
            return True
        except Exception as e:
            logger.error(f"Errore DB durante eliminazione regole per monitor {monitor_id}: {e}")
            raise DatabaseError(f"Errore DB durante eliminazione regole per monitor: {e}")

    # --- Rule Execution ---

    def execute_rules_for_trigger(self, trigger_type: str, trigger_id: str, context_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Esegue tutte le regole attive per un dato trigger."""
        try:
            rules = self.get_all_rules({'trigger_type': trigger_type, 'trigger_id': trigger_id, 'attiva': True})
            results = []
            
            for rule in rules:
                result = self._execute_single_rule(rule, context_data)
                results.append(result)
            
            logger.info(f"Eseguite {len(results)} regole per trigger {trigger_type}:{trigger_id}")
            return results
            
        except Exception as e:
            logger.error(f"Errore esecuzione regole per trigger {trigger_type}:{trigger_id}: {e}")
            raise

    def dry_run_rules_for_trigger(self, trigger_type: str, trigger_id: str, context_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Simula l'esecuzione delle regole per un dato trigger senza eseguire le azioni.
        Restituisce le regole che sarebbero state eseguite.
        """
        try:
            rules = self.get_all_rules({'trigger_type': trigger_type, 'trigger_id': trigger_id, 'attiva': True})
            
            # Log the rules that would be executed
            if rules:
                logger.info(f"DRY RUN: Trovate {len(rules)} regole attive per trigger {trigger_type}:{trigger_id}.")
                for rule in rules:
                    logger.info(f"DRY RUN:   - Regola ID: {rule['id']}, Nome: {rule['name']}, Azione: {rule['action_name']}")
            else:
                logger.info(f"DRY RUN: Nessuna regola attiva trovata per trigger {trigger_type}:{trigger_id}.")
            
            return rules
            
        except Exception as e:
            logger.error(f"Errore DRY RUN regole per trigger {trigger_type}:{trigger_id}: {e}")
            return []

    def dry_run_rules_for_trigger(self, trigger_type: str, trigger_id: str, context_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Simula l'esecuzione delle regole per un dato trigger senza eseguire le azioni.
        Restituisce le regole che sarebbero state eseguite.
        """
        try:
            rules = self.get_all_rules({'trigger_type': trigger_type, 'trigger_id': trigger_id, 'attiva': True})
            
            # Log the rules that would be executed
            if rules:
                logger.info(f"DRY RUN: Trovate {len(rules)} regole attive per trigger {trigger_type}:{trigger_id}.")
                for rule in rules:
                    logger.info(f"DRY RUN:   - Regola ID: {rule['id']}, Nome: {rule['name']}, Azione: {rule['action_name']}")
            else:
                logger.info(f"DRY RUN: Nessuna regola attiva trovata per trigger {trigger_type}:{trigger_id}.")
            
            return rules
            
        except Exception as e:
            logger.error(f"Errore DRY RUN regole per trigger {trigger_type}:{trigger_id}: {e}")
            return []

    def _execute_single_rule(self, rule: Dict[str, Any], initial_context_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Esegue una singola regola, orchestrando l'arricchimento del contesto e l'esecuzione dell'azione.
        Implementa un approccio 'fail-fast' per validare i dati necessari prima dell'esecuzione.
        """
        rule_id = rule['id']
        action_name = rule['action_name']

        if action_name not in self.action_implementation_registry:
            error_msg = f"Implementazione per l'azione '{action_name}' non trovata."
            logger.error(error_msg)
            return {'success': False, 'rule_id': rule_id, 'error': error_msg}

        try:
            impl_func = self.action_implementation_registry[action_name]
            action_params = rule.get('action_params', {})
            context = initial_context_data.copy()

            # --- LOGICA DI ARRICCHIMENTO CONTESTO PER AZIONI SPECIFICHE ---
            if action_name in ['send_sms_link']:
                from services.dbf_data_service import get_dbf_data_service
                dbf_data_service = get_dbf_data_service()

                # NUOVA LOGICA: Usa l'id_paziente se già presente nel contesto (dal monitoring_service)
                patient_id = context.get('id_paziente')
                
                # FALLBACK: Se id_paziente non è nel contesto, prova a recuperarlo alla vecchia maniera
                if not patient_id:
                    logger.warning(f"id_paziente non trovato nel contesto iniziale. Tento recupero da prestazione (trigger_id).")
                    trigger_id = rule.get('trigger_id')
                    prestazione_data = dbf_data_service.get_prestazione_by_id(trigger_id)
                    if prestazione_data:
                        context.update(prestazione_data)
                        patient_id = prestazione_data.get(COLONNE['preventivi']['id_paziente'])

                if not patient_id:
                    raise ValidationError(f"Azione '{action_name}' fallita: ID paziente non trovato né nel contesto né tramite trigger.")

                # Ora che abbiamo il patient_id, recuperiamo i dati del paziente
                patient_data = dbf_data_service.get_patient_by_id(patient_id)
                if not patient_data:
                    raise ValidationError(f"Azione '{action_name}' fallita: dati paziente non trovati per ID '{patient_id}'.")
                
                # DEBUG: Log dei dati grezzi del paziente per ispezionare il formato del telefono
                logger.info(f"DEBUG PAZIENTE (Regola {rule_id}): {patient_data}")

                context.update(patient_data)
                
                # 4. Recupera il telefono (SOLO DB_PACELLU come da specifica)
                extracted_phone = patient_data.get(COLONNE['pazienti']['cellulare'])
                if not extracted_phone:
                    raise ValidationError(f"Azione '{action_name}' fallita: numero di cellulare non trovato per il paziente con ID '{patient_id}'.")
                
                # Arricchisci il contesto finale con i dati necessari all'azione
                context['nome_completo'] = patient_data.get(COLONNE['pazienti']['nome'], '')
                context['telefono'] = extracted_phone
                logger.info(f"Prerequisiti per azione '{action_name}' validati. Dati paziente e telefono aggiunti al contesto.")

            # Combina contesto arricchito e parametri specifici dell'azione
            full_context = {**context, **action_params}
            
            result = impl_func(full_context)
            
            logger.info(f"Regola {rule_id} (Azione: {action_name}) eseguita con successo.")
            return {'success': True, 'rule_id': rule_id, 'result': result}

        except Exception as e:
            # La ValidationError sollevata dai nostri controlli verrà catturata qui.
            logger.error(f"Errore durante l'esecuzione della regola {rule_id} (Azione: {action_name}): {e}")
            return {'success': False, 'rule_id': rule_id, 'error': str(e)}
    # =============================================================================
    # ACTION IMPLEMENTATIONS - Logica effettiva delle azioni
    # =============================================================================
    
    def _impl_send_sms_link(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Implementazione per l'azione 'send_sms_link'."""
        from services.sms_service import sms_service
        from urllib.parse import urlencode

        phone = context.get('phone') or context.get('telefono')
        if not phone:
            raise ValidationError('Numero telefono non disponibile nel contesto')

        page_slug = context.get('page_slug', 'informazioni')
        template_key = context.get('template_key', 'send_link')
        url_params = context.get('url_params', {})
        sender = context.get('sender')

        def render_value(v: Any) -> Any:
            if isinstance(v, str):
                return v.format(**context)
            return v

        rendered_params = {k: render_value(v) for k, v in url_params.items()}
        base_url = f'https://studiodimartino.eu/{page_slug.lstrip("/")}'
        query = urlencode(rendered_params) if rendered_params else ''
        final_url = f"{base_url}?{query}" if query else base_url

        from core.template_manager import template_manager
        nome = context.get('nome_completo', 'Gentile paziente')
        template_data = {'nome_completo': nome, 'url': final_url, **context}
        
        try:
            message = template_manager.render_template(template_key, template_data)
        except Exception:
            message = f"Ciao {nome}, informazioni utili: {final_url}"

        result = sms_service.send_sms(phone, message, sender=sender, tag='auto_link')
        return {**result, 'url': final_url}

    def _impl_send_appointment_sms(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Implementazione per l'azione 'send_appointment_sms'.
        Estrae il telefono da DB_NOTE e invia un SMS usando un template.
        """
        import re
        from services.sms_service import sms_service
        from core.template_manager import get_template_manager

        note_content = context.get('DB_NOTE', '')
        if not note_content:
            raise ValidationError("Campo DB_NOTE non disponibile nel contesto.")

        # Estrai il primo numero di 10 cifre da DB_NOTE
        phone_match = re.search(r'\d{10}', note_content)
        if not phone_match:
            raise ValidationError(f"Nessun numero di telefono di 10 cifre trovato in DB_NOTE: '{note_content}'")
        
        phone = phone_match.group(0)
        
        patient_name = context.get('DB_APDESCR', 'Gentile paziente').strip()
        
        template_id = context.get('template_id') # CAMBIATO: da template_key a template_id
        if not template_id:
            raise ValidationError("Il parametro 'template_id' è obbligatorio per l'azione 'send_appointment_sms'.")

        template_data = {
            'nome_paziente': patient_name,
            'data_appuntamento': context.get('DB_APDATA'),
            'ora_appuntamento': context.get('DB_APOREIN'),
            **context
        }
        
        template_manager = get_template_manager()
        try:
            message = template_manager.render_template_by_id(template_id, template_data) # CAMBIATO: render_template_by_id
        except Exception as e:
            logger.error(f"Errore rendering template con ID '{template_id}': {e}")
            message = f"Ciao {patient_name}, ti confermiamo il tuo appuntamento per il giorno {template_data['data_appuntamento']} alle ore {template_data['ora_appuntamento']}."

        sender = 'StudioDima' # Hardcoded come richiesto
        result = sms_service.send_sms(phone, message, sender=sender, tag='appuntamento_v')
        
        return {**result, 'phone_extracted': phone}

import threading

# Singleton instance
_automation_service = None
_automation_service_lock = threading.Lock()

def get_automation_service() -> "AutomationService":
    """Get singleton automation service instance."""
    global _automation_service
    if _automation_service is None:
        with _automation_service_lock:
            if _automation_service is None:
                _automation_service = AutomationService()
    return _automation_service
