"""
🔧 Servizio Automazione - Gestione centralizzata di azioni e regole di automazione
================================================================================

Servizio per gestire azioni riutilizzabili e regole che le attivano in base a trigger.
Versione refattorizzata con registro di azioni dinamico.

Author: Gemini Code Architect
Version: 2.0.0
"""

import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from .base_service import BaseService
from core.exceptions import ValidationError, DatabaseError
from core.action_registry import ACTION_REGISTRY

# Importa i moduli delle azioni per popolarne il registro.
# Questo assicura che il decoratore @register_action venga eseguito.
from services.actions import system_actions

logger = logging.getLogger(__name__)

class AutomationService(BaseService):
    """
    Servizio per la gestione del motore di automazione (v2).
    Utilizza un registro dinamico per caricare le azioni disponibili.
    """
    
    def __init__(self, database_manager=None):
        from core.database_manager import get_database_manager
        super().__init__(database_manager or get_database_manager())
        
        # Il registro è ora popolato dinamicamente all'import dei moduli delle azioni
        self.action_definitions = ACTION_REGISTRY
        self.action_implementation_registry = {
            name: definition['function'] 
            for name, definition in self.action_definitions.items()
        }
        
        self._sync_registry_with_db()
    
    def _sync_registry_with_db(self):
        """Assicura che tutte le azioni registrate nel codice esistano nel DB (logica upsert)."""
        logger.debug("Sincronizzazione azioni (upsert) dal registro al database...")
        try:
            db_actions_rows = self.execute_query("SELECT name, parameters_json, description FROM actions")
            db_actions = {row['name']: row for row in db_actions_rows}
            
            code_actions = self.action_definitions

            for action_name, definition in code_actions.items():
                params_json_from_code = json.dumps(definition.get('parameters', []))
                description_from_code = definition.get('description', '')

                if action_name not in db_actions:
                    logger.debug(f"Azione '{action_name}' non trovata nel DB. Aggiungo...")
                    query = "INSERT INTO actions (name, description, parameters_json, is_system_action) VALUES (?, ?, ?, ?)"
                    params = (action_name, description_from_code, params_json_from_code, 1)
                    self.execute_command(query, params)
                    logger.debug(f"Azione '{action_name}' aggiunta con successo.")
                else:
                    db_action = db_actions[action_name]
                    if (db_action.get('parameters_json') != params_json_from_code or 
                        db_action.get('description') != description_from_code):
                        logger.debug(f"Dati per l'azione '{action_name}' non sono sincronizzati. Aggiorno...")
                        query = "UPDATE actions SET parameters_json = ?, description = ? WHERE name = ?"
                        params = (params_json_from_code, description_from_code, action_name)
                        self.execute_command(query, params)
                        logger.debug(f"Dati per '{action_name}' aggiornati con successo.")
            
            logger.debug("Sincronizzazione azioni completata.")

        except Exception as e:
            logger.error(f"Errore durante la sincronizzazione delle azioni con il DB: {e}", exc_info=True)

    def _execute_single_rule(self, rule: Dict[str, Any], initial_context_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Esegue una singola regola, arricchisce il contesto e invoca l'azione corretta.
        """
        start_time = datetime.now()
        action_name = rule.get('action_name')
        implementation_func = self.action_implementation_registry.get(action_name)

        if not implementation_func:
            logger.error(f"Implementazione per l'azione '{action_name}' non trovata nel registro.")
            return {'status': 'error', 'rule_id': rule['id'], 'message': f"Azione '{action_name}' non implementata."}

        try:
            # Prepara i parametri per l'azione
            action_params = rule.get('action_params', {})

            # Arricchisci il context con trigger_id per permettere il mapping automatico
            enriched_context = dict(initial_context_data)
            enriched_context['trigger_id'] = rule.get('trigger_id')
            enriched_context['trigger_type'] = rule.get('trigger_type')

            # Esegui l'azione passando il contesto arricchito e i parametri specifici della regola
            result = implementation_func(enriched_context, **action_params)
            
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.debug(f"Regola {rule['id']} ('{rule['name']}'): Azione '{action_name}' eseguita in {execution_time:.2f}s.")
            
            return {
                'status': 'success',
                'rule_id': rule['id'],
                'action_name': action_name,
                'result': result
            }

        except Exception as e:
            logger.error(f"Errore durante l'esecuzione dell'azione '{action_name}' per la regola {rule['id']}: {e}", exc_info=True)
            return {'status': 'error', 'rule_id': rule['id'], 'message': str(e)}

    # --- Metodi CRUD e di esecuzione (invariati rispetto a prima) ---
    # (Ho omesso i metodi che non cambiano per brevità, ma andrebbero copiati qui)

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
        rules = self.get_all_rules({'id': rule_id})
        return rules[0] if rules else None

    def create_rule(self, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        if not all(k in rule_data for k in ['name', 'trigger_id', 'action_id', 'monitor_id']):
            raise ValidationError("Campi 'name', 'trigger_id', 'action_id', 'monitor_id' sono obbligatori.")
        existing_rules = self.get_all_rules({
            'monitor_id': rule_data['monitor_id'],
            'trigger_id': rule_data['trigger_id'],
            'attiva': True
        })
        if existing_rules:
            raise ValidationError("Esiste già una regola attiva per questo trigger.")
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
        try:
            self.execute_command("DELETE FROM automation_rules WHERE monitor_id = ?", (monitor_id,))
            logger.info(f"Tutte le regole di automazione per il monitor {monitor_id} sono state eliminate.")
            return True
        except Exception as e:
            logger.error(f"Errore DB durante eliminazione regole per monitor {monitor_id}: {e}")
            raise DatabaseError(f"Errore DB durante eliminazione regole per monitor: {e}")

    def execute_rules_for_trigger(self, trigger_type: str, trigger_id: str, context_data: Dict[str, Any]) -> List[Dict[str, Any]]:
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
        try:
            rules = self.get_all_rules({'trigger_type': trigger_type, 'trigger_id': trigger_id, 'attiva': True})
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
