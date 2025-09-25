"""
Database Service V2
Servizio per gestione database con switching locale/rete
"""
import logging
import sqlite3
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from core.environment_manager import environment_manager, ServiceType, Environment
from core.database_manager import DatabaseManager
from core.exceptions import ValidationError, DatabaseError

logger = logging.getLogger(__name__)

class DatabaseService:
    """Servizio database con environment switching"""
    
    def __init__(self):
        self.service_type = ServiceType.DATABASE
        self._current_config = None
        self._current_environment = None
        self._db_manager = None
        self._reload_configuration()
    
    def _reload_configuration(self):
        """Ricarica configurazione basata su ambiente corrente"""
        self._current_environment = environment_manager.get_environment(self.service_type)
        self._current_config = environment_manager.get_service_config(self.service_type)
        
        # Ricrea database manager con nuova configurazione
        if self._current_environment == Environment.PROD:
            # Database rete studio
            db_path = self._current_config.get('path', '')
        else:
            # Database locale
            db_path = self._current_config.get('path', 'studio_dima.db')
        
        self._db_manager = DatabaseManager()
        logger.info(f"Database Service configurato per ambiente: {self._current_environment.value}")
    
    def get_current_environment(self) -> Environment:
        """Ottiene ambiente corrente"""
        return self._current_environment
    
    def get_current_config(self) -> Dict[str, Any]:
        """Ottiene configurazione corrente"""
        if self._current_environment != environment_manager.get_environment(self.service_type):
            self._reload_configuration()
        return self._current_config.copy()
    
    def get_database_path(self) -> str:
        """Ottiene path database corrente"""
        config = self.get_current_config()
        return config.get('path', '')
    
    def is_network_database(self) -> bool:
        """Verifica se database corrente è su rete"""
        return self._current_environment == Environment.PROD
    
    def get_service_status(self) -> Dict[str, Any]:
        """Ottiene stato completo del servizio"""
        config = self.get_current_config()
        validation = environment_manager.validate_service_config(self.service_type)
        
        # Test connessione database
        connection_test = self.test_connection()
        
        return {
            'environment': self._current_environment.value,
            'type': config.get('type', 'local'),
            'path': config.get('path', ''),
            'is_network': self.is_network_database(),
            'connection': {
                'available': connection_test['success'],
                'details': connection_test
            },
            'validation': {
                'valid': validation.valid,
                'errors': validation.errors,
                'warnings': validation.warnings,
                'checks': validation.checks
            }
        }
    
    def test_connection(self) -> Dict[str, Any]:
        """Testa connessione al database"""
        try:
            config = self.get_current_config()
            
            if self._current_environment == Environment.PROD:
                # Test database rete
                return self._test_network_database(config)
            else:
                # Test database locale
                return self._test_local_database(config)
                
        except Exception as e:
            logger.error(f"Errore test database: {e}")
            return {
                'success': False,
                'error': 'TEST_ERROR',
                'message': f'Errore test connessione: {e}'
            }
    
    def _test_network_database(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test database rete studio"""
        try:
            # Test ping server
            result = subprocess.run(
                ['ping', '-n', '1', 'SERVERDIMA'], 
                capture_output=True, 
                timeout=5
            )
            network_ok = (result.returncode == 0)
            
            # Test accesso cartella condivisa
            db_path = Path(config.get('path', ''))
            share_accessible = db_path.exists()
            
            # Se cartella accessibile, test connessione database
            db_connection_ok = False
            db_info = {}
            
            if share_accessible:
                try:
                    # Test connessione SQLite
                    test_db_path = db_path / "WINDENT.DBF"  # Esempio file database
                    if test_db_path.exists():
                        db_connection_ok = True
                        db_info = {
                            'file_size': test_db_path.stat().st_size,
                            'last_modified': datetime.fromtimestamp(test_db_path.stat().st_mtime).isoformat()
                        }
                except Exception as e:
                    logger.warning(f"Errore test file database: {e}")
            
            return {
                'success': network_ok and share_accessible,
                'environment': Environment.PROD.value,
                'details': {
                    'network_connectivity': network_ok,
                    'share_accessible': share_accessible,
                    'database_connection': db_connection_ok,
                    'path_tested': str(db_path),
                    'database_info': db_info
                },
                'message': self._get_network_test_message(network_ok, share_accessible, db_connection_ok)
            }
            
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'NETWORK_TIMEOUT',
                'message': 'Timeout test rete - server non raggiungibile'
            }
        except Exception as e:
            return {
                'success': False,
                'error': 'NETWORK_TEST_ERROR',
                'message': f'Errore test rete: {e}'
            }
    
    def _test_local_database(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test database locale"""
        try:
            db_path = Path(config.get('path', ''))
            
            # Verifica esistenza file
            file_exists = db_path.exists()
            
            # Test connessione SQLite se file esiste
            connection_ok = False
            db_info = {}
            
            if file_exists:
                try:
                    with sqlite3.connect(str(db_path), timeout=5) as conn:
                        cursor = conn.cursor()
                        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
                        table_count = cursor.fetchone()[0]
                        
                        # Ottieni info database
                        cursor.execute("PRAGMA database_list")
                        db_list = cursor.fetchall()
                        
                        connection_ok = True
                        db_info = {
                            'file_size': db_path.stat().st_size,
                            'last_modified': datetime.fromtimestamp(db_path.stat().st_mtime).isoformat(),
                            'table_count': table_count,
                            'databases': [{'name': db[1], 'file': db[2]} for db in db_list]
                        }
                        
                except sqlite3.Error as e:
                    logger.warning(f"Errore connessione SQLite: {e}")
            
            return {
                'success': file_exists and connection_ok,
                'environment': Environment.DEV.value,
                'details': {
                    'file_exists': file_exists,
                    'database_connection': connection_ok,
                    'path_tested': str(db_path),
                    'database_info': db_info
                },
                'message': self._get_local_test_message(file_exists, connection_ok)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': 'LOCAL_TEST_ERROR',
                'message': f'Errore test database locale: {e}'
            }
    
    def _get_network_test_message(self, network_ok: bool, share_ok: bool, db_ok: bool) -> str:
        """Messaggio risultato test rete"""
        if network_ok and share_ok and db_ok:
            return "Database rete completamente accessibile"
        elif network_ok and share_ok:
            return "Rete e cartella condivisa OK, problemi accesso database"
        elif network_ok:
            return "Rete OK, cartella condivisa non accessibile"
        else:
            return "Server rete non raggiungibile"
    
    def _get_local_test_message(self, file_ok: bool, connection_ok: bool) -> str:
        """Messaggio risultato test locale"""
        if file_ok and connection_ok:
            return "Database locale completamente accessibile"
        elif file_ok:
            return "File database esiste ma connessione fallita"
        else:
            return "File database locale non trovato"
    
    def get_database_manager(self) -> DatabaseManager:
        """Ottiene database manager configurato per ambiente corrente"""
        # Ricarica se ambiente cambiato
        if self._current_environment != environment_manager.get_environment(self.service_type):
            self._reload_configuration()
        
        return self._db_manager
    
    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """
        Esegue query SQL e ritorna risultati
        
        Args:
            query: Query SQL da eseguire
            params: Parametri query (opzionale)
            
        Returns:
            Lista dizionari con risultati
        """
        try:
            db_manager = self.get_database_manager()
            
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                
                # Ottieni nomi colonne
                columns = [description[0] for description in cursor.description] if cursor.description else []
                
                # Converti risultati in lista dizionari
                results = []
                for row in cursor.fetchall():
                    results.append(dict(zip(columns, row)))
                
                return results
                
        except Exception as e:
            logger.error(f"Errore esecuzione query: {e}")
            raise DatabaseError(f"Errore database: {e}")
    
    def execute_command(self, command: str, params: Optional[tuple] = None) -> int:
        """
        Esegue comando SQL (INSERT, UPDATE, DELETE)
        
        Args:
            command: Comando SQL da eseguire
            params: Parametri comando (opzionale)
            
        Returns:
            Numero righe modificate
        """
        try:
            db_manager = self.get_database_manager()
            
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                if params:
                    cursor.execute(command, params)
                else:
                    cursor.execute(command)
                
                conn.commit()
                return cursor.rowcount
                
        except Exception as e:
            logger.error(f"Errore esecuzione comando: {e}")
            raise DatabaseError(f"Errore database: {e}")
    
    def get_table_info(self, table_name: str) -> Dict[str, Any]:
        """Ottiene informazioni su una tabella"""
        try:
            # Schema tabella
            schema_query = f"PRAGMA table_info({table_name})"
            schema = self.execute_query(schema_query)
            
            # Conteggio righe
            count_query = f"SELECT COUNT(*) as count FROM {table_name}"
            count_result = self.execute_query(count_query)
            row_count = count_result[0]['count'] if count_result else 0
            
            return {
                'table_name': table_name,
                'columns': schema,
                'row_count': row_count,
                'environment': self._current_environment.value
            }
            
        except Exception as e:
            logger.error(f"Errore info tabella {table_name}: {e}")
            raise DatabaseError(f"Errore recupero info tabella: {e}")
    
    def list_tables(self) -> List[str]:
        """Lista tutte le tabelle nel database"""
        try:
            query = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            results = self.execute_query(query)
            return [row['name'] for row in results]
            
        except Exception as e:
            logger.error(f"Errore lista tabelle: {e}")
            raise DatabaseError(f"Errore lista tabelle: {e}")
    
    def backup_database(self, backup_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Crea backup del database
        
        Args:
            backup_path: Path backup personalizzato
            
        Returns:
            Informazioni backup creato
        """
        try:
            if backup_path is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_filename = f"studio_dima_backup_{timestamp}.db"
                backup_path = str(Path.cwd() / "backups" / backup_filename)
            
            # Crea directory backup se non esiste
            backup_dir = Path(backup_path).parent
            backup_dir.mkdir(parents=True, exist_ok=True)
            
            db_manager = self.get_database_manager()
            current_db_path = self.get_database_path()
            
            if self.is_network_database():
                # Per database rete, copia file fisicamente
                import shutil
                shutil.copy2(current_db_path, backup_path)
            else:
                # Per database locale SQLite, usa backup API
                with db_manager.get_connection() as source_conn:
                    with sqlite3.connect(backup_path) as backup_conn:
                        source_conn.backup(backup_conn)
            
            backup_info = {
                'success': True,
                'backup_path': backup_path,
                'original_path': current_db_path,
                'environment': self._current_environment.value,
                'timestamp': datetime.now().isoformat(),
                'file_size': Path(backup_path).stat().st_size
            }
            
            logger.info(f"Backup database creato: {backup_path}")
            return backup_info
            
        except Exception as e:
            logger.error(f"Errore backup database: {e}")
            raise DatabaseError(f"Errore creazione backup: {e}")
    
    def get_database_statistics(self) -> Dict[str, Any]:
        """Ottiene statistiche database"""
        try:
            stats = {
                'environment': self._current_environment.value,
                'database_path': self.get_database_path(),
                'is_network': self.is_network_database(),
                'connection_test': self.test_connection()
            }
            
            # Aggiungi statistiche dettagliate se connessione OK
            if stats['connection_test']['success']:
                try:
                    tables = self.list_tables()
                    stats['table_count'] = len(tables)
                    stats['tables'] = []
                    
                    for table in tables[:10]:  # Limita a prime 10 tabelle
                        try:
                            table_info = self.get_table_info(table)
                            stats['tables'].append({
                                'name': table,
                                'row_count': table_info['row_count'],
                                'column_count': len(table_info['columns'])
                            })
                        except Exception:
                            # Ignora errori per singole tabelle
                            pass
                            
                except Exception as e:
                    stats['statistics_error'] = str(e)
            
            return stats
            
        except Exception as e:
            logger.error(f"Errore statistiche database: {e}")
            return {
                'error': str(e),
                'environment': self._current_environment.value
            }

# Instance globale singleton
database_service = DatabaseService()