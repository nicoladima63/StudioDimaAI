import os
import json
import logging
import sqlite3
import threading
from typing import Dict, Any, List, Optional
from datetime import datetime

from core.database_manager import get_database_manager # Assumendo che esista
from core.exceptions import TemplateNotFoundError, TemplateRenderError, DatabaseError

logger = logging.getLogger(__name__)

class TemplateManager:
    def __init__(self):
        self.db_manager = get_database_manager()
        # Non carichiamo più da JSON all'avvio, ma dal DB on-demand o in cache
        logger.info("TemplateManager inizializzato. I template verranno gestiti tramite DB.")
        logger.debug("TemplateManager: __init__ called.")

    def _execute_query(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Esegue una query di selezione sul DB."""
        return self.db_manager.execute_query(query, params)

    def _execute_command(self, query: str, params: tuple = ()) -> Optional[int]:
        """Esegue un comando (INSERT, UPDATE, DELETE) sul DB all'interno di una transazione."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                # Per INSERT, vogliamo l'ID dell'ultima riga inserita
                if query.strip().upper().startswith('INSERT'):
                    return cursor.lastrowid
                else: # Per UPDATE/DELETE, vogliamo il numero di righe modificate
                    return cursor.rowcount
        except Exception as e:
            logger.error(f"Errore durante l'esecuzione del comando DB: {query} con parametri {params}: {e}", exc_info=True)
            raise DatabaseError(f"Errore durante l'esecuzione del comando DB: {str(e)}")

    def get_template_by_id(self, template_id: int) -> Optional[Dict[str, Any]]:
        """Recupera un template dal DB tramite il suo ID."""
        logger.debug(f"TemplateManager: get_template_by_id called with ID: {template_id}")
        query = "SELECT id, name, content, description, type, category_id, created_at, updated_at FROM sms_templates WHERE id = ?"
        result = self._execute_query(query, (template_id,))
        return result[0] if result else None

    def get_template_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Recupera un template dal DB tramite il suo nome."""
        query = "SELECT id, name, content, description, type, category_id, created_at, updated_at FROM sms_templates WHERE name = ?"
        result = self._execute_query(query, (name.strip(),))
        return result[0] if result else None

    def get_all_templates(self, template_type: Optional[str] = None, category_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Recupera tutti i template dal DB, opzionalmente filtrati per type e/o category_id.

        Args:
            template_type: Filtra per type (es. 'social', 'promemoria', 'richiami')
            category_id: Filtra per category_id. Se None, restituisce tutti. Se fornito, filtra per quella categoria + template generici (category_id NULL)

        Returns:
            Lista di template
        """
        base_query = "SELECT id, name, content, description, type, category_id, created_at, updated_at FROM sms_templates"
        conditions = []
        params = []

        if template_type:
            conditions.append("type = ?")
            params.append(template_type)

        if category_id is not None:
            # Filtra per categoria specifica + template generici (category_id IS NULL)
            conditions.append("(category_id = ? OR category_id IS NULL)")
            params.append(category_id)

        if conditions:
            query = f"{base_query} WHERE {' AND '.join(conditions)} ORDER BY name"
        else:
            query = f"{base_query} ORDER BY name"

        return self._execute_query(query, tuple(params))

    def create_template(self, name: str, content: str, description: Optional[str] = None, template_type: str = 'promemoria', category_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Crea un nuovo template nel DB.

        Args:
            name: Nome univoco del template
            content: Contenuto del template con placeholders
            description: Descrizione opzionale
            template_type: Tipo di template (promemoria, richiami, social, newsletter, email_team)
            category_id: ID categoria associata (opzionale, NULL = template generico)

        Returns:
            Template creato con tutti i campi
        """
        if self.get_template_by_name(name):
            raise ValueError(f"Template con nome '{name}' esiste già.")

        query = "INSERT INTO sms_templates (name, content, description, type, category_id) VALUES (?, ?, ?, ?, ?)"
        template_id = self._execute_command(query, (name, content, description, template_type, category_id))
        if not template_id:
            raise Exception("Errore nella creazione del template.")
        return self.get_template_by_name(name) # Recupera il template completo con ID e timestamp

    def update_template(self, name: str, new_content: str, new_description: Optional[str] = None, new_type: Optional[str] = None, new_category_id: Optional[int] = None, update_category: bool = False) -> Dict[str, Any]:
        """
        Aggiorna un template esistente nel DB.

        Args:
            name: Nome del template da aggiornare
            new_content: Nuovo contenuto
            new_description: Nuova descrizione (opzionale)
            new_type: Nuovo type (opzionale)
            new_category_id: Nuovo category_id (opzionale)
            update_category: Se True, aggiorna category_id (anche se None per rimuoverlo)

        Returns:
            Template aggiornato
        """
        template = self.get_template_by_name(name)
        if not template:
            raise ValueError(f"Template con nome '{name}' non trovato.")

        # Build dynamic update query
        update_fields = ["content = ?", "description = ?", "updated_at = CURRENT_TIMESTAMP"]
        params = [new_content, new_description]

        if new_type is not None:
            update_fields.insert(2, "type = ?")
            params.insert(2, new_type)

        if update_category:
            update_fields.insert(len(update_fields) - 1, "category_id = ?")
            params.insert(len(params), new_category_id)

        params.append(name)  # WHERE name = ?
        query = f"UPDATE sms_templates SET {', '.join(update_fields)} WHERE name = ?"
        self._execute_command(query, tuple(params))
        return self.get_template_by_name(name)

    def delete_template(self, name: str) -> bool:
        """Elimina un template dal DB, dopo aver verificato che non sia in uso."""
        template = self.get_template_by_name(name)
        if not template:
            raise ValueError(f"Template con nome '{name}' non trovato.")
        
        # --- LOGICA "IN USO" ---
        # Questo è il punto critico. Dobbiamo controllare se il template è referenziato
        # da qualche regola di automazione attiva.
        # Per farlo, dobbiamo accedere all'AutomationService.
        # Evitiamo import circolari importando qui.
        from services.automation_service import get_automation_service
        automation_service = get_automation_service()
        
        # Cerca regole attive che usano questo template_name nei loro action_params
        # Questo richiede di leggere action_params_json e parsarlo
        query = """
            SELECT id, action_params_json FROM automation_rules 
            WHERE attiva = 1 AND action_params_json LIKE ?
        """
        # Cerchiamo il template_key nel JSON. Questo è un po' grezzo con LIKE,
        # ma funziona per JSON semplici. Una soluzione più robusta userebbe JSON_EXTRACT.
        # Assumiamo che il template_key sia sempre 'template_key' nell'action_params.
        search_pattern = f'"template_key": "{name}"'
        referencing_rules = automation_service.execute_query(query, (search_pattern,))

        if referencing_rules:
            rule_ids = [str(r['id']) for r in referencing_rules]
            raise ValueError(f"Impossibile eliminare il template '{name}'. È in uso dalle regole di automazione ID: {', '.join(rule_ids)}.")
        # --- FINE LOGICA "IN USO" ---

        query = "DELETE FROM sms_templates WHERE name = ?"
        self._execute_command(query, (name,))
        return True

    def render_template(self, template_name: str, data: Dict[str, Any]) -> str:
        """Renderizza un template con i dati forniti."""
        template = self.get_template_by_name(template_name)
        if not template:
            raise TemplateNotFoundError(f"Template '{template_name}' non trovato nel DB.")
        
        try:
            return template['content'].format(**data)
        except KeyError as e:
            raise TemplateRenderError(f"Variabile mancante '{e}' per template '{template_name}'.") from e

    def render_template_by_id(self, template_id: int, data: Dict[str, Any]) -> str:
        """Renderizza un template con i dati forniti, cercandolo per ID."""
        logger.debug(f"TemplateManager: render_template_by_id called with ID: {template_id}")
        template = self.get_template_by_id(template_id)
        if not template:
            raise TemplateNotFoundError(f"Template con ID '{template_id}' non trovato nel DB.")
        
        try:
            return template['content'].format(**data)
        except KeyError as e:
            raise TemplateRenderError(f"Variabile mancante '{e}' per template con ID '{template_id}'.") from e

    def preview_template(self, name: Optional[str] = None, id: Optional[int] = None, data: Dict[str, Any] = None, custom_content: Optional[str] = None) -> Dict[str, Any]:
        """Genera un'anteprima di un template."""
        content_to_render = custom_content
        template_source_name = None # Per i messaggi di errore/warning

        if not content_to_render:
            template = None
            if id:
                template = self.get_template_by_id(id)
                template_source_name = f"ID {id}"
            elif name:
                template = self.get_template_by_name(name)
                template_source_name = f"'{name}'"
            
            if not template:
                return {'success': False, 'message': f"Template {template_source_name or ''} non trovato."}
            content_to_render = template['content']
        else:
            template_source_name = "contenuto custom"
        
        try:
            rendered_message = content_to_render.format(**(data or {}))
            return {
                'success': True,
                'message': rendered_message,
                'length': len(rendered_message),
                'estimated_sms_parts': (len(rendered_message) // 160) + 1
            }
        except KeyError as e:
            return {'success': False, 'message': f"Variabile mancante nel template {template_source_name}: {e}"}
        except Exception as e:
            return {'success': False, 'message': f"Errore durante l'anteprima del template {template_source_name}: {e}"}

# Singleton instance
_template_manager = None
_template_manager_lock = threading.Lock()

def get_template_manager() -> TemplateManager:
    """Get singleton template manager instance."""
    global _template_manager
    if _template_manager is None:
        with _template_manager_lock:
            if _template_manager is None:
                _template_manager = TemplateManager()
    return _template_manager
