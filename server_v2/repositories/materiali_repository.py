"""
Materiali (Materials) Repository for StudioDimaAI Server V2.

This repository handles all data access operations for materials, including:
- Material classification and categorization
- Supplier relationship management  
- DBF data integration for invoice details
- Pattern matching and auto-classification
- Price history and transaction tracking
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


class MaterialiRepository(BaseRepository):
    """
    Repository for managing materials data with advanced classification capabilities.
    
    Features:
    - Material CRUD operations with classification support
    - Supplier relationship management
    - DBF integration for invoice processing
    - Auto-classification based on patterns and history
    - Price tracking and statistics
    - Bulk operations for performance
    """
    
    @property
    def table_name(self) -> str:
        return 'materiali'
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_table_exists()
    
    def _ensure_table_exists(self) -> None:
        """Ensure the materiali table exists with all required fields."""
        try:
            create_table_sql = '''
                CREATE TABLE IF NOT EXISTS materiali (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    codicearticolo TEXT,
                    nome TEXT NOT NULL,
                    fornitoreid TEXT,
                    fornitorenome TEXT,
                    contoid INTEGER,
                    contonome TEXT,
                    brancaid INTEGER,
                    brancanome TEXT,
                    sottocontoid INTEGER,
                    sottocontonome TEXT,
                    metodo_classificazione TEXT DEFAULT 'manuale',
                    confidence INTEGER DEFAULT 0,
                    confermato INTEGER DEFAULT 0,
                    occorrenze INTEGER DEFAULT 0,
                    conto_codice TEXT,
                    sottoconto_codice TEXT,
                    categoria_contabile TEXT,
                    data_fattura DATE,
                    costo_unitario REAL,
                    fattura_id TEXT,
                    riga_fattura_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP NULL
                )
            '''
            
            # Create indexes for performance
            indexes = [
                'CREATE INDEX IF NOT EXISTS idx_materiali_fornitore ON materiali(fornitoreid)',
                'CREATE INDEX IF NOT EXISTS idx_materiali_conto ON materiali(contoid)',
                'CREATE INDEX IF NOT EXISTS idx_materiali_branca ON materiali(brancaid)',
                'CREATE INDEX IF NOT EXISTS idx_materiali_sottoconto ON materiali(sottocontoid)',
                'CREATE INDEX IF NOT EXISTS idx_materiali_lookup ON materiali(nome, fornitoreid, confermato, contoid)',
                'CREATE INDEX IF NOT EXISTS idx_materiali_confidence ON materiali(confidence DESC, id DESC)',
                'CREATE INDEX IF NOT EXISTS idx_materiali_codice ON materiali(codicearticolo)',
                'CREATE INDEX IF NOT EXISTS idx_materiali_fattura ON materiali(fattura_id)',
                'CREATE INDEX IF NOT EXISTS idx_materiali_data ON materiali(data_fattura)',
                'CREATE INDEX IF NOT EXISTS idx_materiali_deleted ON materiali(deleted_at)'
            ]
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(create_table_sql)
                
                for index_sql in indexes:
                    cursor.execute(index_sql)
                    
                cursor.close()
                
            logger.info("Materiali table and indexes ensured")
            
        except Exception as e:
            logger.error(f"Failed to ensure materiali table: {e}")
            raise RepositoryError(f"Failed to ensure materiali table: {str(e)}", cause=e)
    
    def _validate_entity_data(self, data: Dict[str, Any], is_update: bool = False) -> None:
        """Validate materiali entity data."""
        super()._validate_entity_data(data, is_update)
        
        # Required fields for creation
        if not is_update:
            required_fields = ['nome', 'fornitoreid', 'fornitorenome']
            for field in required_fields:
                if not data.get(field) or not str(data[field]).strip():
                    raise ValidationError(f"Field '{field}' is required and cannot be empty")
        
        # Validate numeric fields
        numeric_fields = ['contoid', 'brancaid', 'sottocontoid', 'confidence', 'occorrenze']
        for field in numeric_fields:
            if field in data and data[field] is not None:
                try:
                    data[field] = int(data[field])
                except (ValueError, TypeError):
                    raise ValidationError(f"Field '{field}' must be a valid integer")
        
        # Validate confidence range
        if 'confidence' in data and data['confidence'] is not None:
            if not 0 <= data['confidence'] <= 100:
                raise ValidationError("Confidence must be between 0 and 100")
        
        # Validate price fields
        price_fields = ['costo_unitario']
        for field in price_fields:
            if field in data and data[field] is not None:
                try:
                    data[field] = float(data[field])
                except (ValueError, TypeError):
                    raise ValidationError(f"Field '{field}' must be a valid number")
        
        # Clean string fields
        string_fields = ['codicearticolo', 'nome', 'fornitoreid', 'fornitorenome', 
                        'contonome', 'brancanome', 'sottocontonome', 'conto_codice',
                        'sottoconto_codice', 'categoria_contabile', 'metodo_classificazione',
                        'fattura_id', 'riga_fattura_id']
        for field in string_fields:
            if field in data and data[field] is not None:
                data[field] = str(data[field]).strip()
    
    def get_by_supplier(self, fornitoreid: str, options: Optional[QueryOptions] = None) -> QueryResult:
        """Get materials by supplier ID."""
        options = options or QueryOptions()
        if not options.filters:
            options.filters = {}
        options.filters['fornitoreid'] = fornitoreid
        
        return self.list(options)
    
    def get_by_classification(
        self, 
        contoid: Optional[int] = None,
        brancaid: Optional[int] = None,
        sottocontoid: Optional[int] = None,
        options: Optional[QueryOptions] = None
    ) -> QueryResult:
        """Get materials by classification hierarchy."""
        options = options or QueryOptions()
        if not options.filters:
            options.filters = {}
        
        if contoid:
            options.filters['contoid'] = contoid
        if brancaid:
            options.filters['brancaid'] = brancaid
        if sottocontoid:
            options.filters['sottocontoid'] = sottocontoid
            
        return self.list(options)
    
    def search_by_description(self, search_term: str, options: Optional[QueryOptions] = None) -> QueryResult:
        """Search materials by description using LIKE query."""
        try:
            options = options or QueryOptions()
            
            # Build search query
            base_query, base_params = self._build_select_query(
                options, 
                additional_conditions="nome LIKE ?"
            )
            search_params = base_params + (f"%{search_term}%",)
            
            # Get total count
            count_query = f"SELECT COUNT(*) as total FROM ({base_query})"
            total_count = self.db_manager.execute_query(
                count_query, 
                search_params, 
                fetch_one=True
            )['total']
            
            # Get results
            results = self.db_manager.execute_query(base_query, search_params, fetch_all=True)
            data = [dict(row) for row in results] if results else []
            
            return QueryResult(
                data=data,
                total_count=total_count,
                page=options.page,
                page_size=options.page_size
            )
            
        except Exception as e:
            logger.error(f"Failed to search materials by description '{search_term}': {e}")
            raise RepositoryError(f"Search failed: {str(e)}", cause=e)
    
    def find_similar_materials(
        self, 
        descrizione: str, 
        fornitoreid: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Find similar materials based on description and supplier."""
        try:
            conditions = ["nome LIKE ?"]
            params = [f"%{descrizione}%"]
            
            if fornitoreid:
                conditions.append("fornitoreid = ?")
                params.append(fornitoreid)
            
            # Add confirmed materials filter
            conditions.append("confermato = 1")
            conditions.append("contoid IS NOT NULL")
            
            query = f"""
                SELECT * FROM {self.table_name}
                WHERE {' AND '.join(conditions)}
                ORDER BY confidence DESC, occorrenze DESC
                LIMIT ?
            """
            params.append(limit)
            
            results = self.db_manager.execute_query(query, tuple(params), fetch_all=True)
            return [dict(row) for row in results] if results else []
            
        except Exception as e:
            logger.error(f"Failed to find similar materials: {e}")
            raise RepositoryError(f"Failed to find similar materials: {str(e)}", cause=e)
    
    def get_classification_suggestions(
        self, 
        materiale_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Get classification suggestions based on similar materials and patterns."""
        try:
            suggestions = []
            
            descrizione = materiale_data.get('nome', '')
            codice_articolo = materiale_data.get('codicearticolo', '')
            fornitoreid = materiale_data.get('fornitoreid', '')
            
            # 1. Exact code match (highest priority)
            if codice_articolo and fornitoreid:
                exact_matches = self.execute_custom_query(
                    """
                    SELECT contoid, brancaid, sottocontoid, contonome, brancanome, sottocontonome, 
                           confidence, COUNT(*) as occorrenze
                    FROM materiali 
                    WHERE TRIM(LOWER(codicearticolo)) = TRIM(LOWER(?)) 
                      AND fornitoreid = ? 
                      AND confermato = 1 
                      AND contoid IS NOT NULL
                    GROUP BY contoid, brancaid, sottocontoid
                    ORDER BY confidence DESC, occorrenze DESC
                    LIMIT 3
                    """,
                    (codice_articolo, fornitoreid),
                    fetch_all=True
                )
                
                for match in exact_matches:
                    suggestions.append({
                        'contoid': match['contoid'],
                        'brancaid': match['brancaid'],
                        'sottocontoid': match['sottocontoid'],
                        'contonome': match['contonome'],
                        'brancanome': match['brancanome'],
                        'sottocontonome': match['sottocontonome'],
                        'confidence': 95,
                        'motivo': f"Codice identico già classificato (occorrenze: {match['occorrenze']})",
                        'source': 'exact_code_match'
                    })
            
            # 2. Description similarity (medium priority)
            if descrizione and len(suggestions) < 3:
                similar_materials = self.find_similar_materials(descrizione, fornitoreid, 5)
                for material in similar_materials:
                    if material['contoid']:
                        suggestions.append({
                            'contoid': material['contoid'],
                            'brancaid': material['brancaid'],
                            'sottocontoid': material['sottocontoid'],
                            'contonome': material['contonome'],
                            'brancanome': material['brancanome'],
                            'sottocontonome': material['sottocontonome'],
                            'confidence': 85,
                            'motivo': f"Materiale simile: {material['nome'][:50]}...",
                            'source': 'description_similarity'
                        })
            
            # 3. Supplier pattern (lower priority)
            if fornitoreid and len(suggestions) < 3:
                supplier_patterns = self.execute_custom_query(
                    """
                    SELECT contoid, brancaid, sottocontoid, contonome, brancanome, sottocontonome,
                           COUNT(*) as frequency, AVG(confidence) as avg_confidence
                    FROM materiali 
                    WHERE fornitoreid = ? 
                      AND confermato = 1 
                      AND contoid IS NOT NULL
                    GROUP BY contoid, brancaid, sottocontoid
                    ORDER BY frequency DESC, avg_confidence DESC
                    LIMIT 3
                    """,
                    (fornitoreid,),
                    fetch_all=True
                )
                
                for pattern in supplier_patterns:
                    suggestions.append({
                        'contoid': pattern['contoid'],
                        'brancaid': pattern['brancaid'],
                        'sottocontoid': pattern['sottocontoid'],
                        'contonome': pattern['contonome'],
                        'brancanome': pattern['brancanome'],
                        'sottocontonome': pattern['sottocontonome'],
                        'confidence': min(70, int(pattern['avg_confidence'])),
                        'motivo': f"Pattern fornitore (frequenza: {pattern['frequency']})",
                        'source': 'supplier_pattern'
                    })
            
            # Remove duplicates and limit results
            unique_suggestions = []
            seen_combinations = set()
            
            for suggestion in suggestions:
                key = (suggestion['contoid'], suggestion['brancaid'], suggestion['sottocontoid'])
                if key not in seen_combinations:
                    unique_suggestions.append(suggestion)
                    seen_combinations.add(key)
                    
                if len(unique_suggestions) >= 5:
                    break
            
            return unique_suggestions
            
        except Exception as e:
            logger.error(f"Failed to get classification suggestions: {e}")
            return []
    
    def save_classification(
        self, 
        materiale_data: Dict[str, Any],
        classification_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Save or update material classification."""
        try:
            # Combine material and classification data
            combined_data = {**materiale_data, **classification_data}
            combined_data['confermato'] = 1
            combined_data['metodo_classificazione'] = 'manuale'
            combined_data['confidence'] = 100
            
            # Check if material already exists
            existing = self._find_existing_material(
                combined_data.get('codicearticolo', ''),
                combined_data.get('nome', ''),
                combined_data.get('fornitoreid', '')
            )
            
            if existing:
                # Update existing material
                updated_material = self.update(existing['id'], combined_data)
                logger.info(f"Updated material classification for ID {existing['id']}")
                return updated_material
            else:
                # Create new material
                created_material = self.create(combined_data)
                logger.info(f"Created new material with classification: {created_material['id']}")
                return created_material
                
        except Exception as e:
            logger.error(f"Failed to save material classification: {e}")
            raise RepositoryError(f"Failed to save classification: {str(e)}", cause=e)
    
    def _find_existing_material(
        self, 
        codicearticolo: str, 
        nome: str, 
        fornitoreid: str
    ) -> Optional[Dict[str, Any]]:
        """Find existing material by key fields."""
        try:
            result = self.execute_custom_query(
                """
                SELECT * FROM materiali
                WHERE IFNULL(codicearticolo, '') = ? 
                  AND nome = ? 
                  AND IFNULL(fornitoreid, '') = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (codicearticolo or '', nome, fornitoreid or ''),
                fetch_one=True
            )
            
            return dict(result) if result else None
            
        except Exception as e:
            logger.warning(f"Error finding existing material: {e}")
            return None
    
    def bulk_insert_materials(self, materials_data: List[Dict[str, Any]]) -> Tuple[int, int, List[str]]:
        """Bulk insert materials with error handling."""
        try:
            inserted_count = 0
            error_count = 0
            errors = []
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                
                for idx, material_data in enumerate(materials_data):
                    try:
                        # Validate data
                        self._validate_entity_data(material_data, is_update=False)
                        
                        # Build insert query
                        query, params = self._build_insert_query(material_data)
                        cursor.execute(query, params)
                        
                        inserted_count += 1
                        
                    except Exception as e:
                        error_count += 1
                        errors.append(f"Material {idx}: {str(e)}")
                        logger.warning(f"Failed to insert material {idx}: {e}")
                        continue
                
                cursor.close()
            
            logger.info(f"Bulk insert completed: {inserted_count} inserted, {error_count} failed")
            return inserted_count, error_count, errors
            
        except Exception as e:
            logger.error(f"Bulk insert failed: {e}")
            raise RepositoryError(f"Bulk insert failed: {str(e)}", cause=e)
    
    def get_price_history(self, materiale_id: int) -> List[Dict[str, Any]]:
        """Get price history for a material."""
        try:
            material = self.get_by_id(materiale_id)
            if not material:
                raise RepositoryError(f"Material not found", entity_id=materiale_id)
            
            # Get all materials with same code/description/supplier
            query = """
                SELECT data_fattura, costo_unitario, fattura_id, riga_fattura_id, created_at
                FROM materiali
                WHERE IFNULL(codicearticolo, '') = IFNULL(?, '')
                  AND nome = ?
                  AND IFNULL(fornitoreid, '') = IFNULL(?, '')
                  AND costo_unitario IS NOT NULL
                  AND costo_unitario > 0
                ORDER BY COALESCE(data_fattura, created_at) DESC
            """
            
            results = self.execute_custom_query(
                query,
                (material['codicearticolo'], material['nome'], material['fornitoreid']),
                fetch_all=True
            )
            
            return [dict(row) for row in results] if results else []
            
        except Exception as e:
            logger.error(f"Failed to get price history for material {materiale_id}: {e}")
            raise RepositoryError(f"Failed to get price history: {str(e)}", cause=e)
    
    def get_statistics_by_supplier(self, fornitoreid: str) -> Dict[str, Any]:
        """Get material statistics for a supplier."""
        try:
            stats = self.execute_custom_query(
                """
                SELECT 
                    COUNT(*) as total_materials,
                    COUNT(CASE WHEN confermato = 1 THEN 1 END) as classified_materials,
                    COUNT(CASE WHEN contoid IS NOT NULL THEN 1 END) as materials_with_account,
                    COUNT(DISTINCT IFNULL(codicearticolo, '')) as unique_codes,
                    AVG(confidence) as avg_confidence,
                    MIN(created_at) as first_material,
                    MAX(created_at) as last_material,
                    SUM(occorrenze) as total_occurrences
                FROM materiali
                WHERE fornitoreid = ? AND deleted_at IS NULL
                """,
                (fornitoreid,),
                fetch_one=True
            )
            
            return dict(stats) if stats else {}
            
        except Exception as e:
            logger.error(f"Failed to get supplier statistics: {e}")
            raise RepositoryError(f"Failed to get statistics: {str(e)}", cause=e)
    
    def get_unclassified_materials(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get materials that need classification."""
        try:
            query = """
                SELECT * FROM materiali
                WHERE (contoid IS NULL OR confermato = 0)
                  AND deleted_at IS NULL
                ORDER BY created_at DESC, occorrenze DESC
            """
            
            if limit:
                query += f" LIMIT {limit}"
            
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(row) for row in results] if results else []
            
        except Exception as e:
            logger.error(f"Failed to get unclassified materials: {e}")
            raise RepositoryError(f"Failed to get unclassified materials: {str(e)}", cause=e)
    
    def confirm_auto_classifications(self, confidence_threshold: int = 80) -> int:
        """Confirm auto-classifications above confidence threshold."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                
                cursor.execute(
                    """
                    UPDATE materiali 
                    SET confermato = 1, metodo_classificazione = 'auto_confirmed'
                    WHERE confidence >= ? 
                      AND confermato = 0 
                      AND contoid IS NOT NULL
                      AND deleted_at IS NULL
                    """,
                    (confidence_threshold,)
                )
                
                confirmed_count = cursor.rowcount
                cursor.close()
                
            logger.info(f"Auto-confirmed {confirmed_count} materials with confidence >= {confidence_threshold}")
            return confirmed_count
            
        except Exception as e:
            logger.error(f"Failed to confirm auto-classifications: {e}")
            raise RepositoryError(f"Failed to confirm auto-classifications: {str(e)}", cause=e)