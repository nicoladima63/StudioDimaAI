
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
    
    def _register_default_implementations(self):
        """Registra le implementazioni Python per le azioni di sistema."""
        self.action_implementation_registry = {
            'send_sms_link': self._impl_send_sms_link,
            # Aggiungere qui altre implementazioni di azioni
        }

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
                if filters.get('attiva') is not None:
                    query += " AND r.attiva = ?"
                    params.append(1 if filters['attiva'] else 0)
                if filters.get('trigger_id'):
                    query += " AND r.trigger_id = ?"
                    params.append(filters['trigger_id'])
            
            query += " ORDER BY r.priorita ASC, r.id ASC"
            
            rules = self.execute_query(query, tuple(params) if params else None)

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
        if not all(k in rule_data for k in ['name', 'trigger_id', 'action_id']):
            raise ValidationError("Campi 'name', 'trigger_id', 'action_id' sono obbligatori.")

        query = """
            INSERT INTO automation_rules (
                name, description, trigger_type, trigger_id, 
                action_id, action_params_json, attiva, priorita
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            rule_data['name'],
            rule_data.get('description', ''),
            rule_data.get('trigger_type', 'prestazione'),
            rule_data['trigger_id'],
            rule_data['action_id'],
            json.dumps(rule_data.get('action_params', {})),
            rule_data.get('attiva', True),
            rule_data.get('priorita', 100)
        )
        
        try:
            rule_id = self.execute_command(query, params, insert=True)
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

    def _execute_single_rule(self, rule: Dict[str, Any], context_data: Dict[str, Any]) -> Dict[str, Any]:
        """Esegue una singola regola."""
        rule_id = rule['id']
        action_name = rule['action_name']
        
        if action_name not in self.action_implementation_registry:
            error_msg = f"Implementazione per l'azione '{action_name}' non trovata."
            logger.error(error_msg)
            return {'success': False, 'rule_id': rule_id, 'error': error_msg}

        try:
            impl_func = self.action_implementation_registry[action_name]
            action_params = rule.get('action_params', {})
            
            # Combina contesto e parametri specifici dell'azione
            full_context = {**context_data, **action_params}
            
            result = impl_func(full_context)
            
            logger.info(f"Regola {rule_id} (Azione: {action_name}) eseguita con successo.")
            return {'success': True, 'rule_id': rule_id, 'result': result}

        except Exception as e:
            logger.exception(f"Errore durante l'esecuzione della regola {rule_id} (Azione: {action_name}): {e}")
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
