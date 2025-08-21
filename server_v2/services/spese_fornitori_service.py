"""Spese Fornitori Service for StudioDimaAI Server V2."""

import pandas as pd
import logging
from typing import Dict, Any, Optional, List
from .base_service import BaseService
from core.exceptions import DatabaseError, ValidationError

# DBF reading utilities
import os
try:
    import dbf
    from utils.dbf_utils import clean_dbf_value, safe_get_dbf_field
    from core.config_manager import get_config
except ImportError as e:
    logger.error(f"Could not import DBF utilities: {e}")
    raise

# Constants for spese DBF fields (from server v1 constants)
SPESE_FIELDS = {
    'id': 'DB_CODE',
    'codice_fornitore': 'DB_SPFOCOD', 
    'descrizione': 'DB_SPDESCR',
    'costo_netto': 'DB_SPCOSTO',
    'costo_iva': 'DB_SPCOIVA', 
    'data_spesa': 'DB_SPDATA',
    'data_registrazione': 'DB_SPDATAR',
    'numero_documento': 'DB_SPNUMER',
    'note': 'DB_NOTE'
}

DETTAGLI_SPESE_FIELDS = {
    'codice_fattura': 'DB_VOSPCOD',
    'codice_articolo': 'DB_VOSOCOD', 
    'descrizione': 'DB_VODESCR',
    'quantita': 'DB_VOQUANT',
    'prezzo_unitario': 'DB_VOPREZZ',
    'sconto': 'DB_VOSCONT',
    'ritenuta': 'DB_VORITEN',
    'aliquota_iva': 'DB_VOIVA',
    'codice_iva': 'DB_VOIVCOD'
}

logger = logging.getLogger(__name__)


class SpeseFornitoService(BaseService):
    
    def get_spese_by_fornitore(self, fornitore_id: str, page: int = 1, per_page: int = 10, filters: Dict = None) -> Dict[str, Any]:
        """Get paginated expenses for a specific supplier."""
        try:
            # Get DBF file path using config manager
            spese_path = self._get_spese_dbf_path()
            
            if not os.path.exists(spese_path):
                self.logger.warning(f"Spese DBF file not found: {spese_path}")
                return {
                    'spese': [],
                    'total': 0,
                    'page': page,
                    'per_page': per_page,
                    'pages': 0,
                    'has_next': False,
                    'has_prev': False
                }
            
            # Read DBF file
            spese_raw = []
            with dbf.Table(spese_path, codepage='cp1252') as table:
                for record in table:
                    if not record.db_spfocod:  # Skip records without supplier code
                        continue
                    
                    # Clean supplier code for comparison    
                    supplier_code = clean_dbf_value(record.db_spfocod)
                    if str(supplier_code).strip() == str(fornitore_id).strip():
                        
                        # Build spesa record
                        spesa = {
                            'id': clean_dbf_value(record.db_code),
                            'data_spesa': clean_dbf_value(record.db_spdata),
                            'numero_documento': clean_dbf_value(record.db_spnumer),
                            'descrizione': clean_dbf_value(record.db_spdescr),
                            'costo_netto': self._safe_float(record.db_spcosto),
                            'costo_iva': self._safe_float(record.db_spcoiva),
                            'note': clean_dbf_value(record.db_note)
                        }
                        
                        # Calculate total
                        spesa['totale'] = (spesa['costo_netto'] or 0) + (spesa['costo_iva'] or 0)
                        
                        spese_raw.append(spesa)
            
            # Apply additional filters if provided
            if filters:
                spese_raw = self._apply_filters(spese_raw, filters)
            
            # Sort by date descending
            spese_raw.sort(key=lambda x: x.get('data_spesa') or '', reverse=True)
            
            # Calculate pagination
            total = len(spese_raw)
            pages = (total + per_page - 1) // per_page if per_page > 0 else 1
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            
            spese_page = spese_raw[start_idx:end_idx]
            
            return {
                'spese': spese_page,
                'total': total,
                'page': page,
                'per_page': per_page,
                'pages': pages,
                'has_next': page < pages,
                'has_prev': page > 1
            }
            
        except Exception as e:
            self.logger.error(f"Error getting spese for fornitore {fornitore_id}: {e}")
            raise DatabaseError(f"Failed to retrieve supplier expenses: {str(e)}")
    
    def get_spesa_by_id(self, spesa_id: str) -> Optional[Dict[str, Any]]:
        """Get single expense by ID."""
        try:
            spese_path = self._get_spese_dbf_path()
            
            if not os.path.exists(spese_path):
                return None
            
            with dbf.Table(spese_path, codepage='cp1252') as table:
                for record in table:
                    if str(clean_dbf_value(record.db_code)).strip() == str(spesa_id).strip():
                        return {
                            'id': clean_dbf_value(record.db_code),
                            'codice_fornitore': clean_dbf_value(record.db_spfocod),
                            'data_spesa': clean_dbf_value(record.db_spdata),
                            'data_registrazione': clean_dbf_value(record.db_spdatar),
                            'numero_documento': clean_dbf_value(record.db_spnumer),
                            'descrizione': clean_dbf_value(record.db_spdescr),
                            'costo_netto': self._safe_float(record.db_spcosto),
                            'costo_iva': self._safe_float(record.db_spcoiva),
                            'note': clean_dbf_value(record.db_note),
                            'totale': (self._safe_float(record.db_spcosto) or 0) + (self._safe_float(record.db_spcoiva) or 0)
                        }
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting spesa {spesa_id}: {e}")
            raise DatabaseError(f"Failed to retrieve expense: {str(e)}")
    
    def get_righe_spesa(self, spesa_id: str) -> List[Dict[str, Any]]:
        """Get expense line items/details."""
        try:
            dettagli_path = self._get_dettagli_spese_dbf_path()
            
            if not os.path.exists(dettagli_path):
                return []
            
            righe = []
            with dbf.Table(dettagli_path, codepage='cp1252') as table:
                for record in table:
                    if str(clean_dbf_value(record.db_vospcod)).strip() == str(spesa_id).strip():
                        
                        quantita = self._safe_float(record.db_voquant) or 0
                        prezzo_unitario = self._safe_float(record.db_voprezz) or 0
                        sconto = self._safe_float(record.db_voscont) or 0
                        
                        # Calculate total per row
                        totale_riga = quantita * prezzo_unitario * (1 - sconto / 100)
                        
                        riga = {
                            'codice_articolo': clean_dbf_value(record.db_vosocod),
                            'descrizione': clean_dbf_value(record.db_vodescr),
                            'quantita': quantita,
                            'prezzo_unitario': prezzo_unitario,
                            'sconto': sconto,
                            'aliquota_iva': self._safe_float(record.db_voiva) or 0,
                            'totale_riga': totale_riga
                        }
                        
                        righe.append(riga)
            
            return righe
            
        except Exception as e:
            self.logger.error(f"Error getting righe for spesa {spesa_id}: {e}")
            raise DatabaseError(f"Failed to retrieve expense details: {str(e)}")
    
    def _safe_float(self, value) -> Optional[float]:
        """Safely convert value to float."""
        if pd.isna(value) or value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _apply_filters(self, spese: List[Dict], filters: Dict) -> List[Dict]:
        """Apply additional filters to expenses list."""
        if not filters:
            return spese
        
        filtered_spese = spese
        
        # Date range filter
        if 'data_inizio' in filters and 'data_fine' in filters:
            data_inizio = pd.to_datetime(filters['data_inizio'])
            data_fine = pd.to_datetime(filters['data_fine'])
            
            filtered_spese = [
                spesa for spesa in filtered_spese
                if spesa.get('data_spesa') and 
                data_inizio <= pd.to_datetime(spesa['data_spesa']) <= data_fine
            ]
        
        # Search filter
        if 'search' in filters and filters['search']:
            search_term = filters['search'].lower()
            filtered_spese = [
                spesa for spesa in filtered_spese
                if (search_term in (spesa.get('descrizione') or '').lower() or
                    search_term in (spesa.get('numero_documento') or '').lower())
            ]
        
        return filtered_spese
    
    def _get_spese_dbf_path(self) -> str:
        """Get path to spese fornitori DBF file using config manager."""
        try:
            config = get_config()
            mode = config.get_mode()
            
            # Try to get base path from config
            base_path_key = f"{mode.upper()}_DB_BASE_PATH"
            base_path = config.get(base_path_key)
            
            if base_path and os.path.exists(base_path):
                spese_path = os.path.join(base_path, 'DATI', 'SPESAFOR.DBF')
                if os.path.exists(spese_path):
                    return spese_path
            
            raise FileNotFoundError(f"SPESAFOR.DBF not found in configured location: {base_path}")
            
        except Exception as e:
            raise DatabaseError(f"Could not locate spese fornitori DBF file: {str(e)}")
    
    def _get_dettagli_spese_dbf_path(self) -> str:
        """Get path to dettagli spese DBF file using config manager."""
        try:
            config = get_config()
            mode = config.get_mode()
            
            # Try to get base path from config
            base_path_key = f"{mode.upper()}_DB_BASE_PATH"
            base_path = config.get(base_path_key)
            
            if base_path and os.path.exists(base_path):
                dettagli_path = os.path.join(base_path, 'DATI', 'VOCISPES.DBF')
                if os.path.exists(dettagli_path):
                    return dettagli_path
            
            raise FileNotFoundError(f"VOCISPES.DBF not found in configured location: {base_path}")
            
        except Exception as e:
            raise DatabaseError(f"Could not locate dettagli spese DBF file: {str(e)}")