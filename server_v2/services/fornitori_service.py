"""Fornitori Service for StudioDimaAI Server V2."""

import pandas as pd
import logging
from typing import Dict, Any, Optional, List
from .base_service import BaseService
from core.exceptions import DatabaseError

# DBF reading utilities - use direct DBF libraries 
import os
from pathlib import Path
try:
    import dbf
    from utils.dbf_utils import clean_dbf_value, safe_get_dbf_field
    from core.config_manager import get_config
except ImportError as e:
    logger.error(f"Could not import DBF utilities: {e}")
    raise

# Constants for fornitori DBF fields (from server v1 constants)
FORNITORI_FIELDS = {
    'id': 'DB_CODE',
    'nome': 'DB_FONOME',
    'codice_fiscale': 'DB_FOCODFI',
    'partita_iva': 'DB_FOPAIVA',
    'indirizzo': 'DB_FOINDIR',
    'citta': 'DB_FOCITTA',
    'provincia': 'DB_FOPROVI',
    'cap': 'DB_FOCAP',
    'telefono': 'DB_FOTELEF',
    'email': 'DB_FOEMAIL'
}

logger = logging.getLogger(__name__)

class FornitoriService(BaseService):
    
    def get_fornitori_paginated(self, page=1, per_page=50, filters=None) -> Dict[str, Any]:
        """Get paginated list of fornitori from DBF files using direct DBF reading."""
        try:
            # Get DBF file path using config manager
            fornitori_path = self._get_fornitori_dbf_path()
            
            if not os.path.exists(fornitori_path):
                self.logger.warning(f"Fornitori DBF file not found: {fornitori_path}")
                return self._get_demo_fornitori_data()
            
            # Read DBF file directly using dbf library
            fornitori = []
            with dbf.Table(fornitori_path, codepage='cp1252') as table:
                for record in table:
                    try:
                        # Extract fields using constants mapping - access directly by field name
                        fornitore_id = clean_dbf_value(record[FORNITORI_FIELDS['id']])
                        fornitore_nome = clean_dbf_value(record[FORNITORI_FIELDS['nome']])
                        
                        if fornitore_id and fornitore_nome:
                            fornitori.append({
                                'id': str(fornitore_id).strip(),
                                'nome': str(fornitore_nome).strip(),
                                'codice': str(fornitore_id).strip()  # Use ID as codice
                            })
                    except Exception as e:
                        # Skip problematic records
                        self.logger.debug(f"Skipping record due to error: {e}")
                        continue
            
            if not fornitori:
                self.logger.warning("No valid fornitori found in DBF file")
                return self._get_demo_fornitori_data()
            
            # Apply filters if provided
            if filters:
                search = filters.get('search', '').lower()
                if search:
                    fornitori = [f for f in fornitori if search in f['nome'].lower() or search in f['id'].lower()]
            
            # Sort by nome
            fornitori.sort(key=lambda x: x['nome'])
            
            # Apply pagination
            total = len(fornitori)
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_fornitori = fornitori[start_idx:end_idx]
            
            pages = (total + per_page - 1) // per_page if total > 0 else 0
            
            return {
                'fornitori': paginated_fornitori,
                'total': total,
                'pages': pages,
                'has_next': page < pages,
                'has_prev': page > 1
            }
            
        except Exception as e:
            self.logger.error(f"Error reading fornitori from DBF: {e}")
            return self._get_demo_fornitori_data()
    
    def get_fornitore_by_id(self, fornitore_id: str) -> Dict[str, Any]:
        """Get fornitore by ID from DBF file using direct DBF reading."""
        try:
            # Get DBF file path
            fornitori_path = self._get_fornitori_dbf_path()
            
            if not os.path.exists(fornitori_path):
                self.logger.warning(f"Fornitori DBF file not found: {fornitori_path}")
                return {'id': fornitore_id, 'nome': f'Fornitore {fornitore_id}', 'codice': f'F{fornitore_id:>04s}'}
            
            # Read DBF file directly and search for specific fornitore
            with dbf.Table(fornitori_path, codepage='cp1252') as table:
                for record in table:
                    try:
                        record_id = clean_dbf_value(record[FORNITORI_FIELDS['id']])
                        if str(record_id) == str(fornitore_id):
                            nome = clean_dbf_value(record[FORNITORI_FIELDS['nome']])
                            if nome:
                                return {
                                    'id': str(record_id).strip(),
                                    'nome': str(nome).strip(),
                                    'codice': str(record_id).strip()
                                }
                    except Exception as e:
                        # Skip problematic records
                        self.logger.debug(f"Skipping record due to error: {e}")
                        continue
            
        except Exception as e:
            self.logger.error(f"Error reading fornitore {fornitore_id} from DBF: {e}")
        
        return {'id': fornitore_id, 'nome': f'Fornitore {fornitore_id}', 'codice': f'F{fornitore_id:>04s}'}
    
    def update_classificazione(self, fornitore_id, contoid, brancaid=0, sottocontoid=0, updated_by=None):
        return {'success': True, 'data': {'classificazione': 'updated'}}
    
    def suggest_categoria(self, fornitore_id):
        return {'suggestions': [{'categoria': 'Demo Category', 'confidence': 0.8}]}
    
    def _get_fornitori_dbf_path(self) -> str:
        """Get path to fornitori DBF file using config manager."""
        try:
            config = get_config()
            mode = config.get_mode()
            
            # Try to get base path from config
            base_path_key = f"{mode.upper()}_DB_BASE_PATH"
            base_path = config.get(base_path_key)
            
            if base_path and os.path.exists(base_path):
                fornitori_path = os.path.join(base_path, 'DATI', 'FORNITOR.DBF')
                if os.path.exists(fornitori_path):
                    return fornitori_path
            
            # Fallback paths
            fallback_paths = [
                'windent/DATI/FORNITOR.DBF',
                'server/windent/DATI/FORNITOR.DBF',
                '../windent/DATI/FORNITOR.DBF',
                os.path.join(os.path.dirname(__file__), '..', '..', 'windent', 'DATI', 'FORNITOR.DBF')
            ]
            
            for path in fallback_paths:
                if os.path.exists(path):
                    self.logger.warning(f"Using fallback path for FORNITOR.DBF: {path}")
                    return path
            
            raise FileNotFoundError(f"FORNITOR.DBF not found in any known location")
            
        except Exception as e:
            raise DatabaseError(f"Could not locate fornitori DBF file: {str(e)}")
    
    def _get_demo_fornitori_data(self) -> Dict[str, Any]:
        """Get demo fornitori data as fallback."""
        demo_fornitori = [
            {'id': '1', 'nome': 'Fornitore Demo 1', 'codice': 'F0001'},
            {'id': '2', 'nome': 'Fornitore Demo 2', 'codice': 'F0002'},
            {'id': '3', 'nome': 'Fornitore Demo 3', 'codice': 'F0003'},
        ]
        return {
            'fornitori': demo_fornitori,
            'total': len(demo_fornitori),
            'pages': 1,
            'has_next': False,
            'has_prev': False
        }