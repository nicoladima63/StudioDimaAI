"""
Trigger Configuration System
=============================

Sistema per configurare trigger di monitoraggio tramite JSON invece di logica hardcoded.
Supporta diversi tipi di condizioni: transition, value_in_list, any_change, ecc.

Author: Claude Code Studio Architect
Version: 1.0.0
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class TriggerConditionType(Enum):
    """Tipi di condizioni supportate per i trigger."""
    TRANSITION = "transition"
    VALUE_IN_LIST = "value_in_list"
    ANY_CHANGE = "any_change"
    FIELD_CHANGE = "field_change"
    VALUE_MATCH = "value_match"


@dataclass
class TriggerConfig:
    """Configurazione di un trigger per una tabella."""
    table_name: str
    enabled: bool
    description: str
    trigger_type: str
    trigger_id_field: str
    trigger_condition: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None
    
    def should_trigger(self, old_data: Dict[str, Any], new_data: Dict[str, Any]) -> bool:
        """
        Valuta se il trigger deve essere eseguito basandosi sui dati.
        
        Args:
            old_data: Dati precedenti del record
            new_data: Dati nuovi del record
            
        Returns:
            True se il trigger deve essere eseguito, False altrimenti
        """
        if not self.enabled:
            return False
        
        try:
            condition_type = TriggerConditionType(self.trigger_condition.get('type'))
            
            if condition_type == TriggerConditionType.ANY_CHANGE:
                return True
            
            elif condition_type == TriggerConditionType.TRANSITION:
                return self._check_transition(old_data, new_data)
            
            elif condition_type == TriggerConditionType.VALUE_IN_LIST:
                return self._check_value_in_list(new_data)
            
            elif condition_type == TriggerConditionType.FIELD_CHANGE:
                return self._check_field_change(old_data, new_data)
            
            elif condition_type == TriggerConditionType.VALUE_MATCH:
                return self._check_value_match(new_data)
            
        except Exception as e:
            logger.error(f"Error evaluating trigger condition for {self.table_name}: {e}")
            return False
        
        return False
    
    def _check_transition(self, old_data: Dict, new_data: Dict) -> bool:
        """
        Verifica transizione di stato.
        Esempio: da "!= 3" a "== 3"
        """
        watch_field = self.trigger_condition.get('watch_field')
        from_condition = self.trigger_condition.get('from_value')
        to_condition = self.trigger_condition.get('to_value')
        
        if not all([watch_field, from_condition, to_condition]):
            logger.warning(f"Missing required fields for transition trigger in {self.table_name}")
            return False
        
        old_value = str(old_data.get(watch_field, ''))
        new_value = str(new_data.get(watch_field, ''))
        
        # Valuta condizioni
        from_match = self._evaluate_condition(old_value, from_condition)
        to_match = self._evaluate_condition(new_value, to_condition)
        
        return from_match and to_match
    
    def _check_value_in_list(self, new_data: Dict) -> bool:
        """
        Verifica se il valore del campo è in una lista di valori permessi.
        Esempio: DB_GUARDIA in ["V", "C"]
        """
        watch_field = self.trigger_condition.get('watch_field')
        allowed_values = self.trigger_condition.get('allowed_values', [])
        
        if not watch_field or not allowed_values:
            logger.warning(f"Missing required fields for value_in_list trigger in {self.table_name}")
            return False
        
        current_value = str(new_data.get(watch_field, ''))
        return current_value in allowed_values
    
    def _check_field_change(self, old_data: Dict, new_data: Dict) -> bool:
        """Verifica se un campo specifico è cambiato."""
        watch_field = self.trigger_condition.get('watch_field')
        
        if not watch_field:
            return False
        
        old_value = str(old_data.get(watch_field, ''))
        new_value = str(new_data.get(watch_field, ''))
        
        return old_value != new_value
    
    def _check_value_match(self, new_data: Dict) -> bool:
        """Verifica se un campo ha un valore specifico."""
        watch_field = self.trigger_condition.get('watch_field')
        operator = self.trigger_condition.get('operator', '==')
        expected_value = str(self.trigger_condition.get('value', ''))
        
        if not watch_field:
            return False
        
        current_value = str(new_data.get(watch_field, ''))
        return self._evaluate_condition(current_value, f"{operator} {expected_value}")
    
    def _evaluate_condition(self, value: str, condition: str) -> bool:
        """
        Valuta una condizione (es: "== 3", "!= 0").
        
        Args:
            value: Valore da confrontare
            condition: Condizione nel formato "operator value" (es: "== 3")
            
        Returns:
            True se la condizione è soddisfatta
        """
        # Parse "operator value" (es: "== 3")
        parts = condition.strip().split(' ', 1)
        if len(parts) != 2:
            logger.warning(f"Invalid condition format: {condition}")
            return False
        
        operator, expected = parts
        
        try:
            if operator == '==':
                return value == expected
            elif operator == '!=':
                return value != expected
            elif operator == '>':
                return float(value) > float(expected)
            elif operator == '<':
                return float(value) < float(expected)
            elif operator == '>=':
                return float(value) >= float(expected)
            elif operator == '<=':
                return float(value) <= float(expected)
        except (ValueError, TypeError) as e:
            logger.warning(f"Error comparing values: {value} {operator} {expected}: {e}")
            return False
        
        return False


class TriggerConfigManager:
    """Gestisce il caricamento e l'accesso alle configurazioni trigger."""
    
    def __init__(self, config_file: str = "config/trigger_configs.json"):
        self.config_file = Path(config_file)
        self.configs: Dict[str, TriggerConfig] = {}
        self._load_configs()
    
    def _load_configs(self):
        """Carica configurazioni da file JSON."""
        if not self.config_file.exists():
            logger.warning(f"Trigger config file not found: {self.config_file}")
            logger.info("Trigger system will not be active until config file is created")
            return
        
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for table_name, config_data in data.items():
                self.configs[table_name] = TriggerConfig(
                    table_name=table_name,
                    **config_data
                )
            
            logger.info(f"Loaded {len(self.configs)} trigger configurations from {self.config_file}")
            
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing trigger config file: {e}")
        except Exception as e:
            logger.error(f"Error loading trigger configs: {e}")
    
    def get_config(self, table_name: str) -> Optional[TriggerConfig]:
        """
        Recupera configurazione per una tabella.
        
        Args:
            table_name: Nome della tabella
            
        Returns:
            TriggerConfig se esiste, None altrimenti
        """
        return self.configs.get(table_name)
    
    def reload(self):
        """Ricarica configurazioni da file (utile per hot-reload)."""
        self.configs.clear()
        self._load_configs()
        logger.info("Trigger configurations reloaded")
    
    def get_all_configs(self) -> Dict[str, TriggerConfig]:
        """Ritorna tutte le configurazioni caricate."""
        return self.configs.copy()
