"""
🔧 Registro Globale delle Azioni di Automazione
=================================================

Questo modulo fornisce un registro centralizzato per tutte le azioni di automazione disponibili nell'applicazione.
Utilizza un pattern basato su decoratori per permettere alle azioni di "auto-registrarsi" al sistema.

Author: Gemini Code Architect
Version: 1.0.0
"""

import logging
from typing import Dict, Any, Callable, List

logger = logging.getLogger(__name__)

# Il registro globale che conterrà tutte le definizioni delle azioni
ACTION_REGISTRY: Dict[str, Dict[str, Any]] = {}

def register_action(name: str, parameters: List[Dict[str, Any]], description: str = ""):
    """
    Decoratore per registrare una funzione come un'azione di automazione.

    Args:
        name (str): Il nome univoco dell'azione (es. 'send_sms_link').
        parameters (List[Dict[str, Any]]): Una lista di dizionari che definiscono i parametri richiesti dall'azione.
        description (str): Una breve descrizione di cosa fa l'azione.
    """
    def decorator(func: Callable) -> Callable:
        if name in ACTION_REGISTRY:
            logger.warning(f"Azione '{name}' già registrata. Sovrascrivo.")
        
        ACTION_REGISTRY[name] = {
            'function': func,
            'parameters': parameters,
            'name': name,
            'description': description or f"Azione di sistema: {name}"
        }
        logger.debug(f"Azione '{name}' registrata con successo.")
        return func
    return decorator
