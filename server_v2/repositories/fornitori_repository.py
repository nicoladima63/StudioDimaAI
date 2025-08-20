"""
Fornitori (Suppliers) Repository for StudioDimaAI Server V2.

This repository handles all data access operations for suppliers, including:
- Supplier classification management (conto->branca->sottoconto hierarchy)
- DBF data integration from fornitori tables
- Historical pattern analysis for auto-categorization
- Statistics aggregation for supplier analytics
- Performance optimized queries for supplier-related operations
"""

import sqlite3
import pandas as pd
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
from datetime import datetime, date
from ..core.base_repository import BaseRepository, QueryOptions, QueryResult
from ..core.database_manager import DatabaseManager
from ..core.exceptions import RepositoryError, ValidationError
from ..utils.dbf_utils import DbfProcessor, clean_dbf_value, safe_get_dbf_field

logger = logging.getLogger(__name__)


class FornitoriRepository(BaseRepository):
    """
    Repository for managing supplier data with advanced classification capabilities.
    
    Features:
    - Supplier classification management (direct/indirect/non-deductible)
    - Hierarchical categorization (conto->branca->sottoconto)
    - DBF integration for supplier data
    - Historical pattern analysis for auto-classification
    - Confidence scoring and validation
    - Performance optimized queries for analytics
    """
    
    @property
    def table_name(self) -> str:
        return 'classificazioni_costi'
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_tables_exist()
    
    def _ensure_tables_exist(self) -> None:
        """Ensure the classificazioni_costi and related tables exist."""
        try:
            # Main classificazioni_costi table
            create_classificazioni_sql = '''
                CREATE TABLE IF NOT EXISTS classificazioni_costi (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    codice_riferimento TEXT NOT NULL,
                    tipo_entita TEXT NOT NULL DEFAULT 'fornitore',
                    tipo_di_costo INTEGER DEFAULT 0,
                    contoid INTEGER,
                    brancaid INTEGER DEFAULT 0,
                    sottocontoid INTEGER DEFAULT 0,
                    categoria TEXT,
                    categoria_conto TEXT,
                    note TEXT,
                    confidence INTEGER DEFAULT 0,
                    metodo_classificazione TEXT DEFAULT 'manuale',
                    confermato INTEGER DEFAULT 1,
                    fornitore_nome TEXT,
                    data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    data_modifica TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT,
                    deleted_at TIMESTAMP NULL
                )
            '''
            
            # Fornitori cache table (for DBF data)
            create_fornitori_cache_sql = '''
                CREATE TABLE IF NOT EXISTS fornitori_cache (
                    codice_fornitore TEXT PRIMARY KEY,
                    nome_fornitore TEXT NOT NULL,
                    descrizione TEXT,
                    indirizzo TEXT,
                    citta TEXT,
                    provincia TEXT,
                    cap TEXT,
                    telefono TEXT,
                    email TEXT,
                    piva TEXT,
                    codice_fiscale TEXT,
                    data_ultimo_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    fonte_dati TEXT DEFAULT 'dbf'
                )
            '''
            
            # Create indexes for performance
            indexes = [
                'CREATE INDEX IF NOT EXISTS idx_classificazioni_codice ON classificazioni_costi(codice_riferimento)',
                'CREATE INDEX IF NOT EXISTS idx_classificazioni_tipo ON classificazioni_costi(tipo_entita)',
                'CREATE INDEX IF NOT EXISTS idx_classificazioni_conto ON classificazioni_costi(contoid)',
                'CREATE INDEX IF NOT EXISTS idx_classificazioni_branca ON classificazioni_costi(brancaid)',
                'CREATE INDEX IF NOT EXISTS idx_classificazioni_sottoconto ON classificazioni_costi(sottocontoid)',
                'CREATE INDEX IF NOT EXISTS idx_classificazioni_confidence ON classificazioni_costi(confidence DESC)',
                'CREATE INDEX IF NOT EXISTS idx_classificazioni_tipo_costo ON classificazioni_costi(tipo_di_costo)',
                'CREATE INDEX IF NOT EXISTS idx_classificazioni_confermato ON classificazioni_costi(confermato)',
                'CREATE INDEX IF NOT EXISTS idx_classificazioni_deleted ON classificazioni_costi(deleted_at)',
                'CREATE INDEX IF NOT EXISTS idx_fornitori_cache_nome ON fornitori_cache(nome_fornitore)',
                'CREATE UNIQUE INDEX IF NOT EXISTS idx_fornitori_cache_codice ON fornitori_cache(codice_fornitore)'
            ]
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(create_classificazioni_sql)
                cursor.execute(create_fornitori_cache_sql)
                
                for index_sql in indexes:
                    cursor.execute(index_sql)
                    
                cursor.close()
                
            logger.info("Fornitori-related tables and indexes ensured")
            
        except Exception as e:
            logger.error(f"Failed to ensure fornitori tables: {e}")
            raise RepositoryError(f"Failed to ensure fornitori tables: {str(e)}", cause=e)
    
    def get_supplier_classification(self, fornitore_id: str) -> Optional[Dict[str, Any]]:
        """Get classification for a specific supplier."""
        try:
            result = self.execute_custom_query(
                """
                SELECT * FROM classificazioni_costi
                WHERE codice_riferimento = ? 
                  AND tipo_entita = 'fornitore'
                  AND deleted_at IS NULL
                ORDER BY data_modifica DESC
                LIMIT 1
                """,
                (fornitore_id,),
                fetch_one=True
            )
            
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"Failed to get supplier classification for {fornitore_id}: {e}")
            raise RepositoryError(f"Failed to get supplier classification: {str(e)}", cause=e)
    
    def classify_supplier(
        self,
        fornitore_id: str,
        contoid: int,
        brancaid: int = 0,
        sottocontoid: int = 0,
        fornitore_nome: Optional[str] = None,
        tipo_di_costo: int = 0,
        categoria: Optional[str] = None,
        note: Optional[str] = None,
        confidence: int = 100,
        metodo_classificazione: str = 'manuale'
    ) -> Dict[str, Any]:
        """Classify or update supplier classification."""
        try:
            classification_data = {
                'codice_riferimento': fornitore_id,
                'tipo_entita': 'fornitore',
                'contoid': contoid,
                'brancaid': brancaid,
                'sottocontoid': sottocontoid,
                'tipo_di_costo': tipo_di_costo,
                'categoria': categoria,
                'note': note,
                'confidence': confidence,
                'metodo_classificazione': metodo_classificazione,
                'confermato': 1,
                'fornitore_nome': fornitore_nome,
                'data_modifica': datetime.now().isoformat()
            }
            
            # Check if classification already exists
            existing = self.get_supplier_classification(fornitore_id)
            
            if existing:
                # Update existing classification
                updated = self.update(existing['id'], classification_data)
                logger.info(f"Updated supplier classification for {fornitore_id}")
                return updated
            else:
                # Create new classification
                created = self.create(classification_data)
                logger.info(f"Created new supplier classification for {fornitore_id}")
                return created
                
        except Exception as e:
            logger.error(f"Failed to classify supplier {fornitore_id}: {e}")
            raise RepositoryError(f"Failed to classify supplier: {str(e)}", cause=e)
    
    def get_suppliers_by_classification(
        self,
        contoid: Optional[int] = None,
        brancaid: Optional[int] = None,
        sottocontoid: Optional[int] = None,
        tipo_di_costo: Optional[int] = None,
        options: Optional[QueryOptions] = None
    ) -> QueryResult:
        """Get suppliers filtered by classification criteria."""
        options = options or QueryOptions()
        if not options.filters:
            options.filters = {}
        
        options.filters['tipo_entita'] = 'fornitore'
        
        if contoid is not None:
            options.filters['contoid'] = contoid
        if brancaid is not None:
            options.filters['brancaid'] = brancaid
        if sottocontoid is not None:
            options.filters['sottocontoid'] = sottocontoid
        if tipo_di_costo is not None:
            options.filters['tipo_di_costo'] = tipo_di_costo
            
        return self.list(options)
    
    def get_unclassified_suppliers(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get suppliers that need classification."""
        try:
            # Get suppliers from DBF that don't have classification
            query = """
                SELECT DISTINCT fc.codice_fornitore, fc.nome_fornitore, fc.descrizione
                FROM fornitori_cache fc
                LEFT JOIN classificazioni_costi cc ON fc.codice_fornitore = cc.codice_riferimento 
                    AND cc.tipo_entita = 'fornitore' 
                    AND cc.deleted_at IS NULL
                WHERE cc.id IS NULL
                ORDER BY fc.nome_fornitore
            """
            
            if limit:
                query += f" LIMIT {limit}"
            
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(row) for row in results] if results else []
            
        except Exception as e:
            logger.error(f"Failed to get unclassified suppliers: {e}")
            raise RepositoryError(f"Failed to get unclassified suppliers: {str(e)}", cause=e)
    
    def analyze_supplier_historical_patterns(self, fornitore_id: str) -> List[Dict[str, Any]]:
        """Analyze historical patterns for supplier auto-classification."""
        try:
            # Get historical classifications for materials from this supplier
            patterns = self.execute_custom_query(
                """
                SELECT 
                    m.contoid, m.brancaid, m.sottocontoid,
                    m.contonome, m.brancanome, m.sottocontonome,
                    COUNT(*) as frequency,
                    AVG(m.confidence) as avg_confidence,
                    MAX(m.created_at) as last_used,
                    GROUP_CONCAT(DISTINCT m.nome) as sample_materials
                FROM materiali m
                WHERE m.fornitoreid = ?
                  AND m.confermato = 1
                  AND m.contoid IS NOT NULL
                  AND m.deleted_at IS NULL
                GROUP BY m.contoid, m.brancaid, m.sottocontoid
                ORDER BY frequency DESC, avg_confidence DESC
                LIMIT 5
                """,
                (fornitore_id,),
                fetch_all=True
            )
            
            return [dict(pattern) for pattern in patterns] if patterns else []
            
        except Exception as e:
            logger.error(f"Failed to analyze historical patterns for {fornitore_id}: {e}")
            return []
    
    def suggest_supplier_classification(self, fornitore_id: str) -> List[Dict[str, Any]]:
        """Get classification suggestions for a supplier based on historical data."""
        try:
            suggestions = []
            
            # 1. Historical material patterns (highest priority)
            historical_patterns = self.analyze_supplier_historical_patterns(fornitore_id)
            
            for pattern in historical_patterns:
                confidence = min(90, int(pattern['avg_confidence'] * 0.9))  # Slightly lower confidence
                suggestions.append({
                    'contoid': pattern['contoid'],
                    'brancaid': pattern['brancaid'],
                    'sottocontoid': pattern['sottocontoid'],
                    'contonome': pattern['contonome'],
                    'brancanome': pattern['brancanome'],
                    'sottocontonome': pattern['sottocontonome'],
                    'confidence': confidence,
                    'motivo': f"Pattern materiali storici (frequenza: {pattern['frequency']})",
                    'source': 'historical_materials',
                    'details': {
                        'frequency': pattern['frequency'],
                        'avg_confidence': pattern['avg_confidence'],
                        'sample_materials': pattern['sample_materials'][:200] if pattern['sample_materials'] else ''
                    }
                })
            
            # 2. Similar supplier names (medium priority)
            if len(suggestions) < 3:
                # Get supplier name for similarity matching
                supplier_info = self.get_supplier_info(fornitore_id)
                if supplier_info and supplier_info.get('nome_fornitore'):
                    similar_suggestions = self._find_similar_supplier_classifications(
                        supplier_info['nome_fornitore']
                    )
                    suggestions.extend(similar_suggestions)
            
            # 3. Most common classifications (fallback)
            if len(suggestions) < 3:
                common_classifications = self.get_most_common_classifications(3)
                for classification in common_classifications:
                    suggestions.append({
                        'contoid': classification['contoid'],
                        'brancaid': classification['brancaid'],
                        'sottocontoid': classification['sottocontoid'],
                        'contonome': classification.get('contonome', ''),
                        'brancanome': classification.get('brancanome', ''),
                        'sottocontonome': classification.get('sottocontonome', ''),
                        'confidence': 50,
                        'motivo': f"Classificazione comune (frequenza: {classification['frequency']})",
                        'source': 'common_pattern',
                        'details': classification
                    })
            
            # Remove duplicates and sort by confidence
            unique_suggestions = []
            seen_combinations = set()
            
            for suggestion in suggestions:
                key = (suggestion['contoid'], suggestion['brancaid'], suggestion['sottocontoid'])
                if key not in seen_combinations:
                    unique_suggestions.append(suggestion)
                    seen_combinations.add(key)
                    
                if len(unique_suggestions) >= 5:
                    break
            
            return sorted(unique_suggestions, key=lambda x: x['confidence'], reverse=True)
            
        except Exception as e:
            logger.error(f"Failed to get supplier classification suggestions: {e}")
            return []
    
    def _find_similar_supplier_classifications(self, supplier_name: str) -> List[Dict[str, Any]]:
        """Find classifications of suppliers with similar names."""
        try:
            # Extract key words from supplier name for matching
            name_words = [word.upper() for word in supplier_name.split() if len(word) > 3]
            if not name_words:
                return []
            
            # Build LIKE conditions for name matching
            like_conditions = []
            params = []
            for word in name_words[:3]:  # Use up to 3 key words
                like_conditions.append("UPPER(cc.fornitore_nome) LIKE ?")
                params.append(f"%{word}%")
            
            if not like_conditions:
                return []
            
            query = f"""
                SELECT 
                    cc.contoid, cc.brancaid, cc.sottocontoid,
                    c.nome as contonome, b.nome as brancanome, s.nome as sottocontonome,
                    COUNT(*) as frequency,
                    AVG(cc.confidence) as avg_confidence,
                    GROUP_CONCAT(DISTINCT cc.fornitore_nome) as similar_suppliers
                FROM classificazioni_costi cc
                LEFT JOIN conti c ON cc.contoid = c.id
                LEFT JOIN branche b ON cc.brancaid = b.id
                LEFT JOIN sottoconti s ON cc.sottocontoid = s.id
                WHERE cc.tipo_entita = 'fornitore'
                  AND cc.confermato = 1
                  AND cc.deleted_at IS NULL
                  AND ({' OR '.join(like_conditions)})
                GROUP BY cc.contoid, cc.brancaid, cc.sottocontoid
                ORDER BY frequency DESC, avg_confidence DESC
                LIMIT 3
            """
            
            results = self.execute_custom_query(query, tuple(params), fetch_all=True)
            
            suggestions = []
            for result in results:
                confidence = min(75, int(result['avg_confidence'] * 0.8))
                suggestions.append({
                    'contoid': result['contoid'],
                    'brancaid': result['brancaid'],
                    'sottocontoid': result['sottocontoid'],
                    'contonome': result['contonome'],
                    'brancanome': result['brancanome'],
                    'sottocontonome': result['sottocontonome'],
                    'confidence': confidence,
                    'motivo': f"Fornitori simili (frequenza: {result['frequency']})",
                    'source': 'similar_suppliers',
                    'details': {
                        'similar_suppliers': result['similar_suppliers'],
                        'frequency': result['frequency']
                    }
                })
            
            return suggestions
            
        except Exception as e:
            logger.warning(f"Error finding similar supplier classifications: {e}")
            return []
    
    def get_most_common_classifications(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get most commonly used supplier classifications."""
        try:
            results = self.execute_custom_query(
                """
                SELECT 
                    cc.contoid, cc.brancaid, cc.sottocontoid,
                    c.nome as contonome, b.nome as brancanome, s.nome as sottocontonome,
                    COUNT(*) as frequency,
                    AVG(cc.confidence) as avg_confidence
                FROM classificazioni_costi cc
                LEFT JOIN conti c ON cc.contoid = c.id
                LEFT JOIN branche b ON cc.brancaid = b.id
                LEFT JOIN sottoconti s ON cc.sottocontoid = s.id
                WHERE cc.tipo_entita = 'fornitore'
                  AND cc.confermato = 1
                  AND cc.deleted_at IS NULL
                GROUP BY cc.contoid, cc.brancaid, cc.sottocontoid
                ORDER BY frequency DESC
                LIMIT ?
                """,
                (limit,),
                fetch_all=True
            )
            
            return [dict(result) for result in results] if results else []
            
        except Exception as e:
            logger.error(f"Failed to get common classifications: {e}")
            return []
    
    def get_supplier_info(self, fornitore_id: str) -> Optional[Dict[str, Any]]:
        """Get supplier information from cache."""
        try:
            result = self.execute_custom_query(
                "SELECT * FROM fornitori_cache WHERE codice_fornitore = ?",
                (fornitore_id,),
                fetch_one=True
            )
            
            return dict(result) if result else None
            
        except Exception as e:
            logger.warning(f"Failed to get supplier info for {fornitore_id}: {e}")
            return None
    
    def update_supplier_cache(self, suppliers_data: List[Dict[str, Any]]) -> Tuple[int, int]:
        """Update suppliers cache from DBF data."""
        try:
            updated_count = 0
            inserted_count = 0
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                
                for supplier in suppliers_data:
                    codice = supplier.get('codice_fornitore', '').strip()
                    nome = supplier.get('nome_fornitore', '').strip()
                    
                    if not codice or not nome:
                        continue
                    
                    # Check if supplier exists
                    cursor.execute(
                        "SELECT codice_fornitore FROM fornitori_cache WHERE codice_fornitore = ?",
                        (codice,)
                    )
                    exists = cursor.fetchone()
                    
                    if exists:
                        # Update existing
                        cursor.execute(
                            """
                            UPDATE fornitori_cache 
                            SET nome_fornitore = ?, descrizione = ?, 
                                data_ultimo_aggiornamento = CURRENT_TIMESTAMP
                            WHERE codice_fornitore = ?
                            """,
                            (nome, supplier.get('descrizione', ''), codice)
                        )
                        updated_count += 1
                    else:
                        # Insert new
                        cursor.execute(
                            """
                            INSERT INTO fornitori_cache 
                            (codice_fornitore, nome_fornitore, descrizione)
                            VALUES (?, ?, ?)
                            """,
                            (codice, nome, supplier.get('descrizione', ''))
                        )
                        inserted_count += 1
                
                cursor.close()
            
            logger.info(f"Updated supplier cache: {inserted_count} inserted, {updated_count} updated")
            return inserted_count, updated_count
            
        except Exception as e:
            logger.error(f"Failed to update supplier cache: {e}")
            raise RepositoryError(f"Failed to update supplier cache: {str(e)}", cause=e)
    
    def get_supplier_statistics(self, fornitore_id: str) -> Dict[str, Any]:
        """Get comprehensive statistics for a supplier."""
        try:
            # Basic classification info
            classification = self.get_supplier_classification(fornitore_id)
            
            # Material statistics
            material_stats = self.execute_custom_query(
                """
                SELECT 
                    COUNT(*) as total_materials,
                    COUNT(CASE WHEN confermato = 1 THEN 1 END) as classified_materials,
                    COUNT(DISTINCT codicearticolo) as unique_codes,
                    AVG(confidence) as avg_confidence,
                    SUM(occorrenze) as total_occurrences,
                    MIN(created_at) as first_material_date,
                    MAX(created_at) as last_material_date
                FROM materiali
                WHERE fornitoreid = ? AND deleted_at IS NULL
                """,
                (fornitore_id,),
                fetch_one=True
            )
            
            # Expense statistics (if available)
            expense_stats = self.execute_custom_query(
                """
                SELECT 
                    COUNT(*) as total_invoices,
                    SUM(CASE WHEN costo_unitario > 0 THEN costo_unitario END) as total_amount,
                    AVG(CASE WHEN costo_unitario > 0 THEN costo_unitario END) as avg_amount,
                    MIN(data_fattura) as first_invoice_date,
                    MAX(data_fattura) as last_invoice_date
                FROM materiali
                WHERE fornitoreid = ? 
                  AND costo_unitario IS NOT NULL 
                  AND deleted_at IS NULL
                """,
                (fornitore_id,),
                fetch_one=True
            )
            
            return {
                'fornitore_id': fornitore_id,
                'classification': dict(classification) if classification else None,
                'material_stats': dict(material_stats) if material_stats else {},
                'expense_stats': dict(expense_stats) if expense_stats else {},
                'is_classified': classification is not None,
                'classification_completeness': (
                    'complete' if classification and classification.get('sottocontoid')
                    else 'partial' if classification and classification.get('contoid')
                    else 'none'
                )
            }
            
        except Exception as e:
            logger.error(f"Failed to get supplier statistics for {fornitore_id}: {e}")
            raise RepositoryError(f"Failed to get supplier statistics: {str(e)}", cause=e)
    
    def bulk_classify_suppliers(
        self, 
        classifications: List[Dict[str, Any]],
        auto_confirm: bool = False
    ) -> Tuple[int, int, List[str]]:
        """Bulk classify suppliers with error handling."""
        try:
            success_count = 0
            error_count = 0
            errors = []
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                
                for idx, classification in enumerate(classifications):
                    try:
                        fornitore_id = classification.get('codice_riferimento')
                        if not fornitore_id:
                            raise ValueError("Missing codice_riferimento")
                        
                        # Set auto-confirm based on confidence
                        confidence = classification.get('confidence', 0)
                        confermato = 1 if auto_confirm or confidence >= 90 else 0
                        
                        classification_data = {
                            'codice_riferimento': fornitore_id,
                            'tipo_entita': 'fornitore',
                            'contoid': classification.get('contoid'),
                            'brancaid': classification.get('brancaid', 0),
                            'sottocontoid': classification.get('sottocontoid', 0),
                            'confidence': confidence,
                            'metodo_classificazione': classification.get('metodo_classificazione', 'auto'),
                            'confermato': confermato,
                            'fornitore_nome': classification.get('fornitore_nome'),
                            'data_modifica': datetime.now().isoformat()
                        }
                        
                        # Check if exists
                        existing = self.get_supplier_classification(fornitore_id)
                        
                        if existing:
                            self.update(existing['id'], classification_data)
                        else:
                            self.create(classification_data)
                        
                        success_count += 1
                        
                    except Exception as e:
                        error_count += 1
                        errors.append(f"Classification {idx}: {str(e)}")
                        logger.warning(f"Failed to classify supplier {idx}: {e}")
                        continue
                
                cursor.close()
            
            logger.info(f"Bulk classification completed: {success_count} success, {error_count} errors")
            return success_count, error_count, errors
            
        except Exception as e:
            logger.error(f"Bulk classification failed: {e}")
            raise RepositoryError(f"Bulk classification failed: {str(e)}", cause=e)