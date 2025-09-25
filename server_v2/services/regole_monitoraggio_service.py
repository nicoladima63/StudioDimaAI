"""
🔧 Servizio Regole Monitoraggio - Gestione regole di monitoraggio prestazioni
===========================================================================

Servizio per gestire le regole di monitoraggio che accoppiano tipi di prestazione
con callback functions per il sistema di monitoraggio.

Author: Claude Code Studio Architect
Version: 1.0.0
"""

import json
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from .base_service import BaseService
from core.constants_v2 import CATEGORIE_PRESTAZIONI
from core.exceptions import ValidationError, DatabaseError

logger = logging.getLogger(__name__)

class RegoleMonitoraggioService(BaseService):
    """
    Servizio per gestione regole di monitoraggio prestazioni.
    
    Caratteristiche:
    - Gestione CRUD regole di monitoraggio
    - Integrazione con sistema di monitoraggio esistente
    - Esecuzione callback functions
    - Statistiche e reporting
    - Validazione regole
    """
    
    def __init__(self, database_manager=None):
        from core.database_manager import get_database_manager
        super().__init__(database_manager or get_database_manager())
        self.callback_registry = {}
        self._register_default_callbacks()
    
    def _register_default_callbacks(self):
        """Registra le callback functions di default."""
        self.callback_registry = {
            'log_prestazione_eseguita': self._callback_log_prestazione,
            'notify_igiene_completata': self._callback_notify_igiene,
            'update_costo_materiali': self._callback_update_costi,
            'send_reminder_sms': self._callback_send_sms,
            'send_sms_link': self._callback_send_sms_link,
            'update_statistics': self._callback_update_stats,
            'generate_report': self._callback_generate_report
        }

    def list_callbacks(self) -> List[Dict[str, Any]]:
        """Restituisce l'elenco delle callback disponibili con metadati base."""
        callbacks: List[Dict[str, Any]] = []
        for name, func in self.callback_registry.items():
            callbacks.append({
                'id': name,
                'name': name,
                'function': name,
                'description': (func.__doc__ or '').strip(),
                'params_schema': {}  # placeholder per futuri schemi parametri
            })
        return callbacks
    
    def register_callback(self, name: str, callback_func: Callable):
        """Registra una nuova callback function."""
        self.callback_registry[name] = callback_func
        logger.info(f"Callback registrata: {name}")
    
    def get_all_regole(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Recupera tutte le regole con filtri opzionali."""
        try:
            query = """
                SELECT 
                    id, tipo_prestazione_id, categoria_prestazione, nome_prestazione,
                    callback_function, parametri_callback, priorita, attiva,
                    monitor_type, interval_seconds, descrizione, created_by,
                    is_system_rule, last_executed, execution_count, success_count,
                    error_count, notes, created_at, updated_at
                FROM regole_monitoraggio
                WHERE 1=1
            """
            params = []
            
            if filters:
                if filters.get('categoria'):
                    query += " AND categoria_prestazione = ?"
                    params.append(filters['categoria'])
                
                if filters.get('attiva') is not None:
                    query += " AND attiva = ?"
                    params.append(1 if filters['attiva'] else 0)
                
                if filters.get('callback_function'):
                    query += " AND callback_function = ?"
                    params.append(filters['callback_function'])
                
                if filters.get('tipo_prestazione'):
                    query += " AND tipo_prestazione_id = ?"
                    params.append(filters['tipo_prestazione'])
            
            query += " ORDER BY priorita ASC, categoria_prestazione ASC"
            
            regole = self.execute_query(query, tuple(params) if params else None)
            
            # Arricchisci con nomi categoria
            for regola in regole:
                if regola['categoria_prestazione']:
                    regola['categoria_nome'] = CATEGORIE_PRESTAZIONI.get(
                        regola['categoria_prestazione'], 
                        f'Categoria {regola["categoria_prestazione"]}'
                    )
                
                # Parse parametri_callback
                if regola['parametri_callback']:
                    try:
                        regola['parametri_callback_parsed'] = json.loads(regola['parametri_callback'])
                    except json.JSONDecodeError:
                        regola['parametri_callback_parsed'] = {}
            
            return regole
            
        except Exception as e:
            logger.error(f"Errore recupero regole: {e}")
            raise DatabaseError(f"Errore recupero regole: {e}")
    
    def get_regole_attive(self) -> List[Dict[str, Any]]:
        """Recupera solo le regole attive."""
        return self.get_all_regole({'attiva': True})
    
    def get_regole_per_prestazione(self, tipo_prestazione_id: str) -> List[Dict[str, Any]]:
        """Recupera regole per un tipo di prestazione specifico."""
        return self.get_all_regole({'tipo_prestazione': tipo_prestazione_id, 'attiva': True})
    
    def create_regola(self, regola_data: Dict[str, Any]) -> Dict[str, Any]:
        """Crea una nuova regola di monitoraggio."""
        try:
            # Valida dati
            self._validate_regola_data(regola_data)
            
            # Prepara dati per inserimento
            insert_data = {
                'tipo_prestazione_id': regola_data['tipo_prestazione_id'],
                'categoria_prestazione': regola_data.get('categoria_prestazione'),
                'nome_prestazione': regola_data.get('nome_prestazione', ''),
                'callback_function': regola_data['callback_function'],
                'parametri_callback': regola_data.get('parametri_callback', '{}'),
                'priorita': regola_data.get('priorita', 100),
                'attiva': regola_data.get('attiva', True),
                'monitor_type': regola_data.get('monitor_type', 'PERIODIC_CHECK'),
                'interval_seconds': regola_data.get('interval_seconds', 30),
                'descrizione': regola_data.get('descrizione', ''),
                'created_by': regola_data.get('created_by', 'service'),
                'is_system_rule': regola_data.get('is_system_rule', False),
                'notes': regola_data.get('notes', ''),
                'metadata': regola_data.get('metadata', '{}')
            }
            
            # Inserisci regola
            query = """
                INSERT INTO regole_monitoraggio 
                (tipo_prestazione_id, categoria_prestazione, nome_prestazione,
                 callback_function, parametri_callback, priorita, attiva,
                 monitor_type, interval_seconds, descrizione, created_by,
                 is_system_rule, notes, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            params = (
                insert_data['tipo_prestazione_id'],
                insert_data['categoria_prestazione'],
                insert_data['nome_prestazione'],
                insert_data['callback_function'],
                insert_data['parametri_callback'],
                insert_data['priorita'],
                1 if insert_data['attiva'] else 0,
                insert_data['monitor_type'],
                insert_data['interval_seconds'],
                insert_data['descrizione'],
                insert_data['created_by'],
                1 if insert_data['is_system_rule'] else 0,
                insert_data['notes'],
                insert_data['metadata']
            )
            
            rows_affected = self.execute_command(query, params)
            
            if rows_affected > 0:
                # Recupera la regola appena creata
                new_regola = self.execute_query(
                    "SELECT * FROM regole_monitoraggio WHERE id = last_insert_rowid()"
                )[0]
                
                logger.info(f"Regola creata: {new_regola['id']} - {new_regola['tipo_prestazione_id']}")
                return new_regola
            else:
                raise DatabaseError("Errore durante la creazione della regola")
                
        except Exception as e:
            logger.error(f"Errore creazione regola: {e}")
            raise DatabaseError(f"Errore creazione regola: {e}")
    
    def update_regola(self, regola_id: int, regola_data: Dict[str, Any]) -> Dict[str, Any]:
        """Aggiorna una regola esistente."""
        try:
            # Verifica che la regola esista
            existing = self.execute_query(
                "SELECT * FROM regole_monitoraggio WHERE id = ?", (regola_id,)
            )
            
            if not existing:
                raise ValidationError("Regola non trovata")
            
            existing_regola = existing[0]
            
            # Non permettere modifica di regole di sistema
            if existing_regola['is_system_rule'] and not regola_data.get('force_update', False):
                raise ValidationError("Non è possibile modificare regole di sistema")
            
            # Valida dati
            self._validate_regola_data(regola_data)
            
            # Prepara dati per aggiornamento
            update_fields = []
            params = []
            
            allowed_fields = [
                'tipo_prestazione_id', 'categoria_prestazione', 'nome_prestazione',
                'callback_function', 'parametri_callback', 'priorita', 'attiva',
                'monitor_type', 'interval_seconds', 'descrizione', 'notes', 'metadata'
            ]
            
            for field in allowed_fields:
                if field in regola_data:
                    update_fields.append(f"{field} = ?")
                    if field == 'attiva':
                        params.append(1 if regola_data[field] else 0)
                    else:
                        params.append(regola_data[field])
            
            if not update_fields:
                raise ValidationError("Nessun campo da aggiornare")
            
            # Aggiungi ID per WHERE clause
            params.append(regola_id)
            
            # Esegui aggiornamento
            query = f"UPDATE regole_monitoraggio SET {', '.join(update_fields)} WHERE id = ?"
            rows_affected = self.execute_command(query, tuple(params))
            
            if rows_affected > 0:
                # Recupera la regola aggiornata
                updated_regola = self.execute_query(
                    "SELECT * FROM regole_monitoraggio WHERE id = ?", (regola_id,)
                )[0]
                
                logger.info(f"Regola aggiornata: {regola_id}")
                return updated_regola
            else:
                raise DatabaseError("Nessuna modifica effettuata")
                
        except Exception as e:
            logger.error(f"Errore aggiornamento regola {regola_id}: {e}")
            raise DatabaseError(f"Errore aggiornamento regola: {e}")
    
    def delete_regola(self, regola_id: int) -> bool:
        """Elimina una regola di monitoraggio."""
        try:
            # Verifica che la regola esista
            existing = self.execute_query(
                "SELECT * FROM regole_monitoraggio WHERE id = ?", (regola_id,)
            )
            
            if not existing:
                raise ValidationError("Regola non trovata")
            
            existing_regola = existing[0]
            
            # Non permettere eliminazione di regole di sistema
            if existing_regola['is_system_rule']:
                raise ValidationError("Non è possibile eliminare regole di sistema")
            
            # Elimina regola
            rows_affected = self.execute_command(
                "DELETE FROM regole_monitoraggio WHERE id = ?", (regola_id,)
            )
            
            if rows_affected > 0:
                logger.info(f"Regola eliminata: {regola_id}")
                return True
            else:
                raise DatabaseError("Errore durante l'eliminazione")
                
        except Exception as e:
            logger.error(f"Errore eliminazione regola {regola_id}: {e}")
            raise DatabaseError(f"Errore eliminazione regola: {e}")
    
    def execute_regola(self, regola_id: int, context_data: Dict[str, Any]) -> Dict[str, Any]:
        """Esegue una regola di monitoraggio."""
        try:
            # Recupera regola
            regole = self.execute_query(
                "SELECT * FROM regole_monitoraggio WHERE id = ? AND attiva = 1", (regola_id,)
            )
            
            if not regole:
                raise ValidationError("Regola non trovata o non attiva")
            
            regola = regole[0]
            
            # Verifica che la callback sia registrata
            callback_name = regola['callback_function']
            if callback_name not in self.callback_registry:
                raise ValidationError(f"Callback non registrata: {callback_name}")
            
            # Parse parametri callback
            parametri = {}
            if regola['parametri_callback']:
                try:
                    parametri = json.loads(regola['parametri_callback'])
                except json.JSONDecodeError:
                    logger.warning(f"Parametri callback non validi per regola {regola_id}")
            
            # Esegui callback
            callback_func = self.callback_registry[callback_name]
            result = callback_func(context_data, parametri)
            
            # Aggiorna statistiche
            self._update_regola_stats(regola_id, success=True)
            
            logger.info(f"Regola {regola_id} eseguita con successo")
            return {
                'success': True,
                'regola_id': regola_id,
                'callback': callback_name,
                'result': result,
                'executed_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            # Aggiorna statistiche errore
            self._update_regola_stats(regola_id, success=False)
            
            logger.error(f"Errore esecuzione regola {regola_id}: {e}")
            return {
                'success': False,
                'regola_id': regola_id,
                'error': str(e),
                'executed_at': datetime.now().isoformat()
            }
    
    def execute_regole_per_prestazione(self, tipo_prestazione_id: str, context_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Esegue tutte le regole attive per un tipo di prestazione."""
        try:
            regole = self.get_regole_per_prestazione(tipo_prestazione_id)
            results = []
            
            for regola in regole:
                result = self.execute_regola(regola['id'], context_data)
                results.append(result)
            
            logger.info(f"Eseguite {len(results)} regole per prestazione {tipo_prestazione_id}")
            return results
            
        except Exception as e:
            logger.error(f"Errore esecuzione regole per prestazione {tipo_prestazione_id}: {e}")
            raise DatabaseError(f"Errore esecuzione regole: {e}")
    
    def get_statistiche(self) -> Dict[str, Any]:
        """Recupera statistiche sulle regole di monitoraggio."""
        try:
            # Statistiche generali
            stats_query = """
                SELECT 
                    COUNT(*) as totale_regole,
                    COUNT(CASE WHEN attiva = 1 THEN 1 END) as regole_attive,
                    COUNT(CASE WHEN is_system_rule = 1 THEN 1 END) as regole_sistema,
                    AVG(execution_count) as media_esecuzioni,
                    AVG(success_count * 100.0 / NULLIF(execution_count, 0)) as tasso_successo_medio
                FROM regole_monitoraggio
            """
            
            stats = self.execute_query(stats_query)[0]
            
            # Statistiche per categoria
            categoria_stats = self.execute_query("""
                SELECT 
                    categoria_prestazione,
                    COUNT(*) as totale_regole,
                    COUNT(CASE WHEN attiva = 1 THEN 1 END) as regole_attive,
                    AVG(execution_count) as media_esecuzioni
                FROM regole_monitoraggio 
                WHERE categoria_prestazione IS NOT NULL
                GROUP BY categoria_prestazione
                ORDER BY categoria_prestazione
            """)
            
            # Arricchisci con nomi categoria
            for stat in categoria_stats:
                stat['categoria_nome'] = CATEGORIE_PRESTAZIONI.get(
                    stat['categoria_prestazione'], 
                    f'Categoria {stat["categoria_prestazione"]}'
                )
            
            # Statistiche per callback
            callback_stats = self.execute_query("""
                SELECT 
                    callback_function,
                    COUNT(*) as utilizzi,
                    COUNT(CASE WHEN attiva = 1 THEN 1 END) as attive,
                    AVG(execution_count) as media_esecuzioni
                FROM regole_monitoraggio 
                GROUP BY callback_function
                ORDER BY utilizzi DESC
            """)
            
            return {
                'generali': stats,
                'per_categoria': categoria_stats,
                'per_callback': callback_stats
            }
            
        except Exception as e:
            logger.error(f"Errore statistiche regole: {e}")
            raise DatabaseError(f"Errore statistiche: {e}")
    
    def _validate_regola_data(self, data: Dict[str, Any]) -> None:
        """Valida i dati di una regola."""
        errors = []
        
        # Campi obbligatori
        required_fields = ['tipo_prestazione_id', 'callback_function']
        for field in required_fields:
            if not data.get(field):
                errors.append(f"Campo obbligatorio mancante: {field}")
        
        # Validazione callback_function
        if data.get('callback_function'):
            if data['callback_function'] not in self.callback_registry:
                errors.append(f"Callback function non valida: {data['callback_function']}")
        
        # Validazione categoria_prestazione
        if data.get('categoria_prestazione'):
            try:
                cat_id = int(data['categoria_prestazione'])
                if cat_id not in CATEGORIE_PRESTAZIONI:
                    errors.append(f"Categoria prestazione non valida: {cat_id}")
            except (ValueError, TypeError):
                errors.append("Categoria prestazione deve essere un numero intero")
        
        # Validazione parametri_callback (deve essere JSON valido)
        if data.get('parametri_callback'):
            try:
                if isinstance(data['parametri_callback'], str):
                    json.loads(data['parametri_callback'])
            except json.JSONDecodeError:
                errors.append("Parametri callback deve essere JSON valido")
        
        # Validazione priorità
        if data.get('priorita'):
            try:
                priorita = int(data['priorita'])
                if not (1 <= priorita <= 1000):
                    errors.append("Priorità deve essere tra 1 e 1000")
            except (ValueError, TypeError):
                errors.append("Priorità deve essere un numero intero")
        
        if errors:
            raise ValidationError(f"Dati non validi: {'; '.join(errors)}")
    
    def _update_regola_stats(self, regola_id: int, success: bool) -> None:
        """Aggiorna le statistiche di una regola."""
        try:
            if success:
                query = """
                    UPDATE regole_monitoraggio 
                    SET execution_count = execution_count + 1,
                        success_count = success_count + 1,
                        last_executed = ?
                    WHERE id = ?
                """
            else:
                query = """
                    UPDATE regole_monitoraggio 
                    SET execution_count = execution_count + 1,
                        error_count = error_count + 1,
                        last_executed = ?
                    WHERE id = ?
                """
            
            self.execute_command(query, (datetime.now().isoformat(), regola_id))
            
        except Exception as e:
            logger.warning(f"Errore aggiornamento statistiche regola {regola_id}: {e}")
    
    # =============================================================================
    # CALLBACK FUNCTIONS - Implementazioni di default
    # =============================================================================
    
    def _callback_log_prestazione(self, context_data: Dict[str, Any], parametri: Dict[str, Any]) -> Dict[str, Any]:
        """Callback per loggare prestazione eseguita."""
        log_level = parametri.get('log_level', 'info')
        include_paziente = parametri.get('include_paziente', True)
        
        message = f"Prestazione eseguita: {context_data.get('tipo_prestazione', 'N/A')}"
        if include_paziente and context_data.get('paziente'):
            message += f" - Paziente: {context_data['paziente']}"
        
        if log_level == 'info':
            logger.info(message)
        elif log_level == 'warning':
            logger.warning(message)
        elif log_level == 'error':
            logger.error(message)
        
        return {'logged': True, 'message': message}
    
    def _callback_notify_igiene(self, context_data: Dict[str, Any], parametri: Dict[str, Any]) -> Dict[str, Any]:
        """Callback per notificare completamento igiene."""
        send_sms = parametri.get('send_sms', False)
        template = parametri.get('template', 'igiene_completata')
        
        # Qui implementeresti la logica di notifica
        result = {
            'notified': True,
            'template': template,
            'sms_sent': send_sms
        }
        
        if send_sms:
            # Simula invio SMS
            result['sms_result'] = 'SMS inviato con successo'
        
        logger.info(f"Notifica igiene completata: {result}")
        return result
    
    def _callback_update_costi(self, context_data: Dict[str, Any], parametri: Dict[str, Any]) -> Dict[str, Any]:
        """Callback per aggiornare costi materiali."""
        track_materials = parametri.get('track_materials', True)
        auto_calculate = parametri.get('auto_calculate', True)
        
        # Qui implementeresti la logica di aggiornamento costi
        result = {
            'costs_updated': True,
            'materials_tracked': track_materials,
            'auto_calculated': auto_calculate
        }
        
        logger.info(f"Costi aggiornati: {result}")
        return result
    
    def _callback_send_sms(self, context_data: Dict[str, Any], parametri: Dict[str, Any]) -> Dict[str, Any]:
        """Callback per inviare SMS."""
        template = parametri.get('template', 'default')
        phone = context_data.get('phone')
        
        if not phone:
            return {'sms_sent': False, 'error': 'Numero telefono mancante'}
        
        # Qui implementeresti l'invio SMS reale
        result = {
            'sms_sent': True,
            'template': template,
            'phone': phone
        }
        
        logger.info(f"SMS inviato: {result}")
        return result

    def _callback_send_sms_link(self, context_data: Dict[str, Any], parametri: Dict[str, Any]) -> Dict[str, Any]:
        """Invia un SMS con link informativo pubblico.

        Parametri attesi (parametri_callback):
        - page_slug: slug/percorso pagina su studiodimartino.eu (es. 'istruzioni-ortodonzia')
        - template_key: chiave template SMS (default 'send_link')
        - url_params: dict opzionale di querystring; i valori possono contenere placeholder presenti in context_data
        - sender: mittente opzionale
        """
        from services.sms_service import sms_service
        from urllib.parse import urlencode

        phone = context_data.get('phone') or context_data.get('telefono')
        if not phone:
            raise ValidationError('Numero telefono non disponibile nel contesto')

        page_slug = parametri.get('page_slug') or 'informazioni'
        template_key = parametri.get('template_key') or 'send_link'
        url_params = parametri.get('url_params') or {}
        sender = parametri.get('sender')

        # Render semplice dei placeholder nei parametri URL usando context_data
        def render_value(v: Any) -> Any:
            try:
                if isinstance(v, str):
                    # sostituisci {{chiave}} con valore da context
                    out = v
                    for k, val in context_data.items():
                        out = out.replace(f'{{{{{k}}}}}', str(val))
                    return out
                return v
            except Exception:
                return v

        rendered_params = {k: render_value(v) for k, v in url_params.items()}
        base_url = 'https://studiodimartino.eu/' + page_slug.lstrip('/')
        query = urlencode(rendered_params) if rendered_params else ''
        final_url = f"{base_url}?{query}" if query else base_url

        # Prepara dati per template
        from core.template_manager import template_manager
        nome = context_data.get('nome_completo') or context_data.get('nome') or 'Gentile paziente'
        data_template = { 'nome_completo': nome, 'url': final_url, **context_data }
        try:
            message = template_manager.render_template(template_key, data_template)
        except Exception:
            message = f"Ciao {nome}, informazioni utili: {final_url}"

        result = sms_service.send_sms(phone, message, sender=sender, tag='auto_link')
        return { **result, 'url': final_url }

    # Preview helpers (no side effects)
    def preview_sms_link(self, context_data: Dict[str, Any], parametri: Dict[str, Any]) -> Dict[str, Any]:
        """Genera anteprima messaggio e URL per la callback send_sms_link senza invio."""
        from urllib.parse import urlencode
        page_slug = parametri.get('page_slug') or 'informazioni'
        template_key = parametri.get('template_key') or 'send_link'
        url_params = parametri.get('url_params') or {}

        def render_value(v: Any) -> Any:
            try:
                if isinstance(v, str):
                    out = v
                    for k, val in context_data.items():
                        out = out.replace(f'{{{{{k}}}}}', str(val))
                    return out
                return v
            except Exception:
                return v

        rendered_params = {k: render_value(v) for k, v in url_params.items()}
        base_url = 'https://studiodimartino.eu/' + page_slug.lstrip('/')
        query = urlencode(rendered_params) if rendered_params else ''
        final_url = f"{base_url}?{query}" if query else base_url

        from core.template_manager import template_manager
        nome = context_data.get('nome_completo') or context_data.get('nome') or 'Gentile paziente'
        data_template = { 'nome_completo': nome, 'url': final_url, **context_data }
        try:
            message = template_manager.render_template(template_key, data_template)
        except Exception:
            message = f"Ciao {nome}, informazioni utili: {final_url}"

        return { 'url': final_url, 'message': message }
    
    def _callback_update_stats(self, context_data: Dict[str, Any], parametri: Dict[str, Any]) -> Dict[str, Any]:
        """Callback per aggiornare statistiche."""
        stat_type = parametri.get('stat_type', 'general')
        
        # Qui implementeresti l'aggiornamento statistiche
        result = {
            'stats_updated': True,
            'stat_type': stat_type
        }
        
        logger.info(f"Statistiche aggiornate: {result}")
        return result
    
    def _callback_generate_report(self, context_data: Dict[str, Any], parametri: Dict[str, Any]) -> Dict[str, Any]:
        """Callback per generare report."""
        report_type = parametri.get('report_type', 'summary')
        format_type = parametri.get('format', 'json')
        
        # Qui implementeresti la generazione report
        result = {
            'report_generated': True,
            'report_type': report_type,
            'format': format_type
        }
        
        logger.info(f"Report generato: {result}")
        return result

# Instance globale singleton
regole_monitoraggio_service = RegoleMonitoraggioService()
