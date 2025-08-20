"""
Statistiche (Statistics) Repository for StudioDimaAI Server V2.

This repository handles all data access operations for statistics and reporting, including:
- Performance-optimized aggregation queries to eliminate N+1 problems
- Multiple data source integration (SQLite + DBF)
- Time-based filtering and grouping
- Supplier, collaborator, and expense analytics
- Caching strategies for expensive calculations
"""

import sqlite3
import pandas as pd
import logging
import json
from typing import Any, Dict, List, Optional, Tuple, Union
from datetime import datetime, date, timedelta
from ..core.base_repository import BaseRepository, QueryOptions, QueryResult
from ..core.database_manager import DatabaseManager
from ..core.exceptions import RepositoryError, ValidationError
from ..utils.dbf_utils import DbfProcessor, clean_dbf_value, safe_get_dbf_field

logger = logging.getLogger(__name__)


class StatisticheRepository(BaseRepository):
    """
    Repository for managing statistics and analytics with performance optimization.
    
    Features:
    - Optimized aggregation queries for large datasets
    - Time-based filtering and grouping
    - Multi-source data integration (SQLite + DBF)
    - Supplier analytics and classification metrics
    - Expense analysis by category and time period
    - Caching for expensive calculations
    - Performance monitoring and optimization
    """
    
    @property
    def table_name(self) -> str:
        return 'statistiche_cache'
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_cache_table_exists()
    
    def _ensure_cache_table_exists(self) -> None:
        """Ensure the statistics cache table exists."""
        try:
            create_cache_sql = '''
                CREATE TABLE IF NOT EXISTS statistiche_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cache_key TEXT UNIQUE NOT NULL,
                    cache_type TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    metadata_json TEXT,
                    hit_count INTEGER DEFAULT 0,
                    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            '''
            
            # Create indexes for cache performance
            indexes = [
                'CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_key ON statistiche_cache(cache_key)',
                'CREATE INDEX IF NOT EXISTS idx_cache_type ON statistiche_cache(cache_type)',
                'CREATE INDEX IF NOT EXISTS idx_cache_expires ON statistiche_cache(expires_at)',
                'CREATE INDEX IF NOT EXISTS idx_cache_accessed ON statistiche_cache(last_accessed)'
            ]
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(create_cache_sql)
                
                for index_sql in indexes:
                    cursor.execute(index_sql)
                    
                cursor.close()
                
            logger.info("Statistics cache table and indexes ensured")
            
        except Exception as e:
            logger.error(f"Failed to ensure statistics cache table: {e}")
            raise RepositoryError(f"Failed to ensure cache table: {str(e)}", cause=e)
    
    def get_supplier_statistics(
        self,
        periodo: str = 'anno_corrente',
        anni: Optional[List[int]] = None,
        data_inizio: Optional[str] = None,
        data_fine: Optional[str] = None,
        contoid: Optional[int] = None,
        brancaid: Optional[int] = None,
        sottocontoid: Optional[int] = None,
        use_cache: bool = True,
        cache_duration_minutes: int = 60
    ) -> Dict[str, Any]:
        """Get comprehensive supplier statistics with caching."""
        try:
            # Build cache key
            cache_key = f"supplier_stats_{periodo}_{anni}_{data_inizio}_{data_fine}_{contoid}_{brancaid}_{sottocontoid}"
            
            # Try cache first
            if use_cache:
                cached_data = self._get_cached_data(cache_key)
                if cached_data:
                    return cached_data
            
            # Calculate statistics
            stats = self._calculate_supplier_statistics(
                periodo, anni, data_inizio, data_fine, contoid, brancaid, sottocontoid
            )
            
            # Cache results
            if use_cache:
                self._cache_data(cache_key, 'supplier_stats', stats, cache_duration_minutes)
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get supplier statistics: {e}")
            raise RepositoryError(f"Failed to get supplier statistics: {str(e)}", cause=e)
    
    def _calculate_supplier_statistics(
        self,
        periodo: str,
        anni: Optional[List[int]],
        data_inizio: Optional[str],
        data_fine: Optional[str],
        contoid: Optional[int],
        brancaid: Optional[int],
        sottocontoid: Optional[int]
    ) -> Dict[str, Any]:
        """Calculate supplier statistics without caching."""
        
        # Build date filters
        date_conditions = []
        date_params = []
        
        if data_inizio and data_fine:
            date_conditions.append("m.data_fattura BETWEEN ? AND ?")
            date_params.extend([data_inizio, data_fine])
        elif anni:
            if len(anni) == 1:
                date_conditions.append("strftime('%Y', m.data_fattura) = ?")
                date_params.append(str(anni[0]))
            else:
                year_placeholders = ','.join(['?' for _ in anni])
                date_conditions.append(f"strftime('%Y', m.data_fattura) IN ({year_placeholders})")
                date_params.extend([str(year) for year in anni])
        else:
            # Default to current year
            current_year = datetime.now().year
            date_conditions.append("strftime('%Y', m.data_fattura) = ?")
            date_params.append(str(current_year))
        
        # Build classification filters
        classification_conditions = []
        classification_params = []
        
        if contoid:
            classification_conditions.append("cc.contoid = ?")
            classification_params.append(contoid)
        if brancaid:
            classification_conditions.append("cc.brancaid = ?")
            classification_params.append(brancaid)
        if sottocontoid:
            classification_conditions.append("cc.sottocontoid = ?")
            classification_params.append(sottocontoid)
        
        # Base WHERE conditions
        where_conditions = ["m.deleted_at IS NULL"]
        all_params = []
        
        if date_conditions:
            where_conditions.extend(date_conditions)
            all_params.extend(date_params)
        
        # Main statistics query with LEFT JOINs to avoid N+1 issues
        main_query = f"""
            SELECT 
                cc.codice_riferimento as fornitore_id,
                cc.fornitore_nome,
                cc.contoid,
                c.nome as conto_nome,
                cc.brancaid,
                b.nome as branca_nome,
                cc.sottocontoid,
                s.nome as sottoconto_nome,
                cc.confidence as classification_confidence,
                cc.metodo_classificazione,
                
                -- Material statistics
                COUNT(DISTINCT m.id) as total_materials,
                COUNT(DISTINCT CASE WHEN m.confermato = 1 THEN m.id END) as classified_materials,
                COUNT(DISTINCT m.codicearticolo) as unique_codes,
                AVG(m.confidence) as avg_material_confidence,
                SUM(m.occorrenze) as total_occurrences,
                
                -- Financial statistics
                COUNT(CASE WHEN m.costo_unitario > 0 THEN 1 END) as invoiced_items,
                COALESCE(SUM(CASE WHEN m.costo_unitario > 0 THEN m.costo_unitario END), 0) as total_amount,
                COALESCE(AVG(CASE WHEN m.costo_unitario > 0 THEN m.costo_unitario END), 0) as avg_amount,
                COALESCE(MIN(CASE WHEN m.costo_unitario > 0 THEN m.costo_unitario END), 0) as min_amount,
                COALESCE(MAX(CASE WHEN m.costo_unitario > 0 THEN m.costo_unitario END), 0) as max_amount,
                
                -- Date statistics
                MIN(m.data_fattura) as first_invoice_date,
                MAX(m.data_fattura) as last_invoice_date,
                COUNT(DISTINCT m.data_fattura) as unique_invoice_dates,
                COUNT(DISTINCT m.fattura_id) as unique_invoices
                
            FROM classificazioni_costi cc
            LEFT JOIN materiali m ON cc.codice_riferimento = m.fornitoreid 
                AND {' AND '.join(where_conditions) if where_conditions else '1=1'}
            LEFT JOIN conti c ON cc.contoid = c.id
            LEFT JOIN branche b ON cc.brancaid = b.id
            LEFT JOIN sottoconti s ON cc.sottocontoid = s.id
            WHERE cc.tipo_entita = 'fornitore' 
              AND cc.deleted_at IS NULL
              {' AND ' + ' AND '.join(classification_conditions) if classification_conditions else ''}
            GROUP BY cc.codice_riferimento, cc.contoid, cc.brancaid, cc.sottocontoid
            ORDER BY total_amount DESC, total_materials DESC
        """
        
        final_params = all_params + classification_params
        
        # Execute main query
        suppliers_data = self.execute_custom_query(main_query, tuple(final_params), fetch_all=True)
        suppliers_list = [dict(row) for row in suppliers_data] if suppliers_data else []
        
        # Calculate summary statistics
        summary_stats = self._calculate_summary_statistics(suppliers_list)
        
        # Get category breakdowns
        category_breakdown = self._get_category_breakdown(all_params, classification_params)
        
        # Get time series data
        time_series = self._get_time_series_data(all_params, classification_params)
        
        return {
            'suppliers': suppliers_list,
            'summary': summary_stats,
            'category_breakdown': category_breakdown,
            'time_series': time_series,
            'filters_applied': {
                'periodo': periodo,
                'anni': anni,
                'data_inizio': data_inizio,
                'data_fine': data_fine,
                'contoid': contoid,
                'brancaid': brancaid,
                'sottocontoid': sottocontoid
            },
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'query_performance': 'optimized_single_query'
            }
        }
    
    def _calculate_summary_statistics(self, suppliers_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate summary statistics from suppliers data."""
        if not suppliers_data:
            return {
                'total_suppliers': 0,
                'total_amount': 0,
                'total_materials': 0,
                'avg_amount_per_supplier': 0,
                'classification_rate': 0
            }
        
        total_suppliers = len(suppliers_data)
        total_amount = sum(float(s.get('total_amount', 0)) for s in suppliers_data)
        total_materials = sum(int(s.get('total_materials', 0)) for s in suppliers_data)
        classified_suppliers = len([s for s in suppliers_data if s.get('contoid')])
        
        return {
            'total_suppliers': total_suppliers,
            'classified_suppliers': classified_suppliers,
            'total_amount': total_amount,
            'total_materials': total_materials,
            'total_invoices': sum(int(s.get('unique_invoices', 0)) for s in suppliers_data),
            'avg_amount_per_supplier': total_amount / total_suppliers if total_suppliers > 0 else 0,
            'classification_rate': (classified_suppliers / total_suppliers * 100) if total_suppliers > 0 else 0,
            'avg_materials_per_supplier': total_materials / total_suppliers if total_suppliers > 0 else 0
        }
    
    def _get_category_breakdown(self, date_params: List, classification_params: List) -> List[Dict[str, Any]]:
        """Get breakdown by category (conto/branca/sottoconto)."""
        try:
            query = """
                SELECT 
                    c.id as contoid,
                    c.nome as conto_nome,
                    b.id as brancaid,
                    b.nome as branca_nome,
                    s.id as sottocontoid,
                    s.nome as sottoconto_nome,
                    COUNT(DISTINCT cc.codice_riferimento) as suppliers_count,
                    COUNT(DISTINCT m.id) as materials_count,
                    COALESCE(SUM(CASE WHEN m.costo_unitario > 0 THEN m.costo_unitario END), 0) as total_amount,
                    COUNT(DISTINCT m.fattura_id) as invoices_count
                FROM classificazioni_costi cc
                LEFT JOIN materiali m ON cc.codice_riferimento = m.fornitoreid
                LEFT JOIN conti c ON cc.contoid = c.id
                LEFT JOIN branche b ON cc.brancaid = b.id
                LEFT JOIN sottoconti s ON cc.sottocontoid = s.id
                WHERE cc.tipo_entita = 'fornitore' 
                  AND cc.deleted_at IS NULL
                  AND m.deleted_at IS NULL
                GROUP BY cc.contoid, cc.brancaid, cc.sottocontoid
                HAVING suppliers_count > 0
                ORDER BY total_amount DESC
            """
            
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(row) for row in results] if results else []
            
        except Exception as e:
            logger.warning(f"Failed to get category breakdown: {e}")
            return []
    
    def _get_time_series_data(self, date_params: List, classification_params: List) -> List[Dict[str, Any]]:
        """Get time series data for charts."""
        try:
            query = """
                SELECT 
                    strftime('%Y-%m', m.data_fattura) as period,
                    COUNT(DISTINCT cc.codice_riferimento) as suppliers_count,
                    COUNT(DISTINCT m.id) as materials_count,
                    COALESCE(SUM(CASE WHEN m.costo_unitario > 0 THEN m.costo_unitario END), 0) as total_amount,
                    COUNT(DISTINCT m.fattura_id) as invoices_count
                FROM classificazioni_costi cc
                LEFT JOIN materiali m ON cc.codice_riferimento = m.fornitoreid
                WHERE cc.tipo_entita = 'fornitore' 
                  AND cc.deleted_at IS NULL
                  AND m.deleted_at IS NULL
                  AND m.data_fattura IS NOT NULL
                GROUP BY strftime('%Y-%m', m.data_fattura)
                ORDER BY period
            """
            
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(row) for row in results] if results else []
            
        except Exception as e:
            logger.warning(f"Failed to get time series data: {e}")
            return []
    
    def get_collaboratori_statistics(
        self,
        periodo: str = 'anno_corrente',
        anni: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """Get collaborator statistics (placeholder for future implementation)."""
        # This would integrate with external collaborator data sources
        # For now, return basic structure
        return {
            'collaboratori': [],
            'summary': {
                'total_collaboratori': 0,
                'total_ore_lavorate': 0,
                'produttivita_media': 0
            },
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'source': 'placeholder'
            }
        }
    
    def get_utenze_statistics(
        self,
        periodo: str = 'anno_corrente',
        anni: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """Get utilities statistics by aggregating from classified expenses."""
        try:
            # Get utilities expenses based on classification
            utilities_query = """
                SELECT 
                    cc.codice_riferimento as fornitore_id,
                    cc.fornitore_nome,
                    SUM(CASE WHEN m.costo_unitario > 0 THEN m.costo_unitario ELSE 0 END) as total_amount,
                    COUNT(DISTINCT m.fattura_id) as invoices_count,
                    strftime('%Y-%m', m.data_fattura) as period
                FROM classificazioni_costi cc
                LEFT JOIN materiali m ON cc.codice_riferimento = m.fornitoreid
                LEFT JOIN conti c ON cc.contoid = c.id
                WHERE cc.tipo_entita = 'fornitore'
                  AND cc.deleted_at IS NULL
                  AND m.deleted_at IS NULL
                  AND (UPPER(c.nome) LIKE '%UTENZE%' OR UPPER(c.nome) LIKE '%UTILITIES%'
                       OR UPPER(cc.fornitore_nome) LIKE '%ENEL%' 
                       OR UPPER(cc.fornitore_nome) LIKE '%ENI%'
                       OR UPPER(cc.fornitore_nome) LIKE '%TIM%'
                       OR UPPER(cc.fornitore_nome) LIKE '%VODAFONE%')
                GROUP BY cc.codice_riferimento, strftime('%Y-%m', m.data_fattura)
                ORDER BY period, total_amount DESC
            """
            
            results = self.execute_custom_query(utilities_query, fetch_all=True)
            utilities_data = [dict(row) for row in results] if results else []
            
            # Calculate summary
            total_amount = sum(float(u.get('total_amount', 0)) for u in utilities_data)
            unique_suppliers = len(set(u.get('fornitore_id') for u in utilities_data))
            total_invoices = sum(int(u.get('invoices_count', 0)) for u in utilities_data)
            
            return {
                'utenze': utilities_data,
                'summary': {
                    'total_amount': total_amount,
                    'total_suppliers': unique_suppliers,
                    'total_invoices': total_invoices,
                    'avg_amount_per_invoice': total_amount / total_invoices if total_invoices > 0 else 0
                },
                'metadata': {
                    'generated_at': datetime.now().isoformat(),
                    'detection_method': 'classification_based'
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get utilities statistics: {e}")
            return {
                'utenze': [],
                'summary': {'total_amount': 0, 'total_suppliers': 0, 'total_invoices': 0},
                'metadata': {'error': str(e)}
            }
    
    def _get_cached_data(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get data from cache if valid."""
        try:
            result = self.execute_custom_query(
                """
                SELECT data_json, expires_at FROM statistiche_cache 
                WHERE cache_key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                """,
                (cache_key,),
                fetch_one=True
            )
            
            if result:
                # Update hit count and last accessed
                self.execute_custom_query(
                    """
                    UPDATE statistiche_cache 
                    SET hit_count = hit_count + 1, last_accessed = CURRENT_TIMESTAMP
                    WHERE cache_key = ?
                    """,
                    (cache_key,),
                    fetch_all=False
                )
                
                return json.loads(result['data_json'])
            
            return None
            
        except Exception as e:
            logger.warning(f"Failed to get cached data: {e}")
            return None
    
    def _cache_data(
        self, 
        cache_key: str, 
        cache_type: str, 
        data: Dict[str, Any], 
        duration_minutes: int
    ) -> None:
        """Cache data with expiration."""
        try:
            expires_at = datetime.now() + timedelta(minutes=duration_minutes)
            data_json = json.dumps(data, default=str)  # Handle datetime serialization
            
            # Upsert cache entry
            self.execute_custom_query(
                """
                INSERT OR REPLACE INTO statistiche_cache 
                (cache_key, cache_type, data_json, expires_at, created_at, last_accessed, hit_count)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
                """,
                (cache_key, cache_type, data_json, expires_at.isoformat()),
                fetch_all=False
            )
            
            logger.debug(f"Cached data for key: {cache_key}")
            
        except Exception as e:
            logger.warning(f"Failed to cache data: {e}")
    
    def clear_expired_cache(self) -> int:
        """Clear expired cache entries."""
        try:
            result = self.execute_custom_query(
                "DELETE FROM statistiche_cache WHERE expires_at < CURRENT_TIMESTAMP",
                fetch_all=False
            )
            
            cleared_count = result if isinstance(result, int) else 0
            logger.info(f"Cleared {cleared_count} expired cache entries")
            return cleared_count
            
        except Exception as e:
            logger.error(f"Failed to clear expired cache: {e}")
            return 0
    
    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache performance statistics."""
        try:
            stats = self.execute_custom_query(
                """
                SELECT 
                    cache_type,
                    COUNT(*) as total_entries,
                    COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as valid_entries,
                    COUNT(CASE WHEN expires_at <= CURRENT_TIMESTAMP THEN 1 END) as expired_entries,
                    SUM(hit_count) as total_hits,
                    AVG(hit_count) as avg_hits_per_entry,
                    MAX(last_accessed) as last_access_time
                FROM statistiche_cache
                GROUP BY cache_type
                """,
                fetch_all=True
            )
            
            return {
                'cache_types': [dict(row) for row in stats] if stats else [],
                'generated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache statistics: {e}")
            return {'cache_types': [], 'error': str(e)}
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for the statistics system."""
        try:
            # Database performance metrics
            db_stats = self.db_manager.get_statistics()
            
            # Cache performance
            cache_stats = self.get_cache_statistics()
            
            # Table sizes
            table_sizes = self.execute_custom_query(
                """
                SELECT 
                    'materiali' as table_name,
                    COUNT(*) as row_count,
                    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_rows
                FROM materiali
                UNION ALL
                SELECT 
                    'classificazioni_costi',
                    COUNT(*),
                    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END)
                FROM classificazioni_costi
                UNION ALL
                SELECT 
                    'statistiche_cache',
                    COUNT(*),
                    COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END)
                FROM statistiche_cache
                """,
                fetch_all=True
            )
            
            return {
                'database': db_stats,
                'cache': cache_stats,
                'table_sizes': [dict(row) for row in table_sizes] if table_sizes else [],
                'generated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get performance metrics: {e}")
            return {'error': str(e)}