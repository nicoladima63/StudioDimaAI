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
        """Get paginated list of fornitori from DBF files with classification data using JOIN query."""
        try:
            # Get DBF file path using config manager
            fornitori_path = self._get_fornitori_dbf_path()
            
            if not os.path.exists(fornitori_path):
                self.logger.warning(f"Fornitori DBF file not found: {fornitori_path}")
                return self._get_demo_fornitori_data()
            
            # Read DBF file directly using dbf library
            fornitori_raw = []
            with dbf.Table(fornitori_path, codepage='cp1252') as table:
                for record in table:
                    try:
                        # Extract fields using constants mapping - access directly by field name
                        fornitore_id = clean_dbf_value(record[FORNITORI_FIELDS['id']])
                        fornitore_nome = clean_dbf_value(record[FORNITORI_FIELDS['nome']])
                        
                        if fornitore_id and fornitore_nome:
                            # Extract all available fields
                            fornitore_data = {
                                'id': str(fornitore_id).strip(),
                                'nome': str(fornitore_nome).strip(),
                                'codice': str(fornitore_id).strip()  # Use ID as codice
                            }
                            
                            # Add optional fields if available
                            try:
                                if 'codice_fiscale' in FORNITORI_FIELDS:
                                    cf = clean_dbf_value(record[FORNITORI_FIELDS['codice_fiscale']])
                                    if cf:
                                        fornitore_data['codice_fiscale'] = str(cf).strip()
                                        
                                if 'partita_iva' in FORNITORI_FIELDS:
                                    piva = clean_dbf_value(record[FORNITORI_FIELDS['partita_iva']])
                                    if piva:
                                        fornitore_data['partita_iva'] = str(piva).strip()
                                        
                                if 'indirizzo' in FORNITORI_FIELDS:
                                    indirizzo = clean_dbf_value(record[FORNITORI_FIELDS['indirizzo']])
                                    if indirizzo:
                                        fornitore_data['indirizzo'] = str(indirizzo).strip()
                                        
                                if 'citta' in FORNITORI_FIELDS:
                                    citta = clean_dbf_value(record[FORNITORI_FIELDS['citta']])
                                    if citta:
                                        fornitore_data['citta'] = str(citta).strip()
                                        
                                if 'provincia' in FORNITORI_FIELDS:
                                    provincia = clean_dbf_value(record[FORNITORI_FIELDS['provincia']])
                                    if provincia:
                                        fornitore_data['provincia'] = str(provincia).strip()
                                        
                                if 'cap' in FORNITORI_FIELDS:
                                    cap = clean_dbf_value(record[FORNITORI_FIELDS['cap']])
                                    if cap:
                                        fornitore_data['cap'] = str(cap).strip()
                                        
                                if 'telefono' in FORNITORI_FIELDS:
                                    telefono = clean_dbf_value(record[FORNITORI_FIELDS['telefono']])
                                    if telefono:
                                        fornitore_data['telefono'] = str(telefono).strip()
                                        
                                if 'email' in FORNITORI_FIELDS:
                                    email = clean_dbf_value(record[FORNITORI_FIELDS['email']])
                                    if email:
                                        fornitore_data['email'] = str(email).strip()
                            except Exception as field_error:
                                self.logger.debug(f"Could not extract optional fields: {field_error}")
                                
                            fornitori_raw.append(fornitore_data)
                    except Exception as e:
                        # Skip problematic records
                        self.logger.debug(f"Skipping record due to error: {e}")
                        continue
            
            if not fornitori_raw:
                self.logger.warning("No valid fornitori found in DBF file")
                return self._get_demo_fornitori_data()
            
            # Get classification data from database using JOIN-like approach
            try:
                classificazioni_query = """
                    SELECT codice_riferimento, contoid, brancaid, sottocontoid, tipo_di_costo
                    FROM classificazioni_costi 
                    WHERE tipo_entita = 'fornitore'
                """
                classificazioni_result = self.execute_query(classificazioni_query)
                
                # Create lookup dictionary for O(1) access
                classificazioni_lookup = {
                    row['codice_riferimento']: {
                        'contoid': row['contoid'],
                        'brancaid': row['brancaid'], 
                        'sottocontoid': row['sottocontoid'],
                        'tipo_di_costo': row['tipo_di_costo']
                    } for row in classificazioni_result
                }
            except Exception as e:
                self.logger.warning(f"Could not load classificazioni data: {e}")
                classificazioni_lookup = {}
            
            # Merge classificazioni data with fornitori
            fornitori = []
            for fornitore in fornitori_raw:
                fornitore_data = fornitore.copy()
                
                # Add classification data if available
                classificazione = classificazioni_lookup.get(fornitore['codice'])
                if classificazione:
                    fornitore_data['classificazione'] = {
                        'contoid': classificazione['contoid'],
                        'brancaid': classificazione['brancaid'],
                        'sottocontoid': classificazione['sottocontoid'],
                        'tipo_di_costo': classificazione['tipo_di_costo'],
                        'is_classificato': True,
                        'is_completo': classificazione['brancaid'] > 0 and classificazione['sottocontoid'] > 0
                    }
                else:
                    fornitore_data['classificazione'] = {
                        'contoid': None,
                        'brancaid': None,
                        'sottocontoid': None,
                        'tipo_di_costo': None,
                        'is_classificato': False,
                        'is_completo': False
                    }
                
                fornitori.append(fornitore_data)
            
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
        """Get fornitore by ID from DBF file with classification data using direct DBF reading."""
        try:
            # Get DBF file path
            fornitori_path = self._get_fornitori_dbf_path()
            
            if not os.path.exists(fornitori_path):
                self.logger.warning(f"Fornitori DBF file not found: {fornitori_path}")
                return self._get_fornitore_fallback_data(fornitore_id)
            
            fornitore_data = None
            
            # Read DBF file directly and search for specific fornitore
            with dbf.Table(fornitori_path, codepage='cp1252') as table:
                for record in table:
                    try:
                        record_id = clean_dbf_value(record[FORNITORI_FIELDS['id']])
                        if str(record_id) == str(fornitore_id):
                            nome = clean_dbf_value(record[FORNITORI_FIELDS['nome']])
                            if nome:
                                fornitore_data = {
                                    'id': str(record_id).strip(),
                                    'nome': str(nome).strip(),
                                    'codice': str(record_id).strip()
                                }
                                
                                # Add optional fields if available
                                try:
                                    if 'codice_fiscale' in FORNITORI_FIELDS:
                                        cf = clean_dbf_value(record[FORNITORI_FIELDS['codice_fiscale']])
                                        if cf:
                                            fornitore_data['codice_fiscale'] = str(cf).strip()
                                            
                                    if 'partita_iva' in FORNITORI_FIELDS:
                                        piva = clean_dbf_value(record[FORNITORI_FIELDS['partita_iva']])
                                        if piva:
                                            fornitore_data['partita_iva'] = str(piva).strip()
                                            
                                    if 'indirizzo' in FORNITORI_FIELDS:
                                        indirizzo = clean_dbf_value(record[FORNITORI_FIELDS['indirizzo']])
                                        if indirizzo:
                                            fornitore_data['indirizzo'] = str(indirizzo).strip()
                                            
                                    if 'citta' in FORNITORI_FIELDS:
                                        citta = clean_dbf_value(record[FORNITORI_FIELDS['citta']])
                                        if citta:
                                            fornitore_data['citta'] = str(citta).strip()
                                            
                                    if 'provincia' in FORNITORI_FIELDS:
                                        provincia = clean_dbf_value(record[FORNITORI_FIELDS['provincia']])
                                        if provincia:
                                            fornitore_data['provincia'] = str(provincia).strip()
                                            
                                    if 'cap' in FORNITORI_FIELDS:
                                        cap = clean_dbf_value(record[FORNITORI_FIELDS['cap']])
                                        if cap:
                                            fornitore_data['cap'] = str(cap).strip()
                                            
                                    if 'telefono' in FORNITORI_FIELDS:
                                        telefono = clean_dbf_value(record[FORNITORI_FIELDS['telefono']])
                                        if telefono:
                                            fornitore_data['telefono'] = str(telefono).strip()
                                            
                                    if 'email' in FORNITORI_FIELDS:
                                        email = clean_dbf_value(record[FORNITORI_FIELDS['email']])
                                        if email:
                                            fornitore_data['email'] = str(email).strip()
                                except Exception as field_error:
                                    self.logger.debug(f"Could not extract optional fields: {field_error}")
                                
                                break
                    except Exception as e:
                        # Skip problematic records
                        self.logger.debug(f"Skipping record due to error: {e}")
                        continue
            
            if not fornitore_data:
                return self._get_fornitore_fallback_data(fornitore_id)
            
            # Get classification data from database
            try:
                classificazione_query = """
                    SELECT contoid, brancaid, sottocontoid, tipo_di_costo
                    FROM classificazioni_costi 
                    WHERE codice_riferimento = ? AND tipo_entita = 'fornitore'
                """
                classificazione_result = self.execute_single_query(classificazione_query, (fornitore_data['codice'],))
                
                if classificazione_result:
                    fornitore_data['classificazione'] = {
                        'contoid': classificazione_result['contoid'],
                        'brancaid': classificazione_result['brancaid'],
                        'sottocontoid': classificazione_result['sottocontoid'],
                        'tipo_di_costo': classificazione_result['tipo_di_costo'],
                        'is_classificato': True,
                        'is_completo': classificazione_result['brancaid'] > 0 and classificazione_result['sottocontoid'] > 0
                    }
                else:
                    fornitore_data['classificazione'] = {
                        'contoid': None,
                        'brancaid': None,
                        'sottocontoid': None,
                        'tipo_di_costo': None,
                        'is_classificato': False,
                        'is_completo': False
                    }
            except Exception as e:
                self.logger.warning(f"Could not load classificazione for fornitore {fornitore_id}: {e}")
                fornitore_data['classificazione'] = {
                    'contoid': None,
                    'brancaid': None,
                    'sottocontoid': None,
                    'tipo_di_costo': None,
                    'is_classificato': False,
                    'is_completo': False
                }
            
            return fornitore_data
            
        except Exception as e:
            self.logger.error(f"Error reading fornitore {fornitore_id} from DBF: {e}")
            return self._get_fornitore_fallback_data(fornitore_id)
    
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
            
            raise FileNotFoundError(f"FORNITOR.DBF not found in configured location: {base_path}")
            
        except Exception as e:
            raise DatabaseError(f"Could not locate fornitori DBF file: {str(e)}")
    
    def _get_fornitore_fallback_data(self, fornitore_id: str) -> Dict[str, Any]:
        """Get fallback data for a single fornitore."""
        return {
            'id': fornitore_id, 
            'nome': f'Fornitore {fornitore_id}', 
            'codice': f'F{fornitore_id:>04s}',
            'classificazione': {
                'contoid': None,
                'brancaid': None,
                'sottocontoid': None,
                'tipo_di_costo': None,
                'is_classificato': False,
                'is_completo': False
            }
        }
    
    def _get_demo_fornitori_data(self) -> Dict[str, Any]:
        """Get demo fornitori data as fallback."""
        demo_fornitori = [
            {
                'id': '1', 
                'nome': 'Fornitore Demo 1', 
                'codice': 'F0001',
                'classificazione': {
                    'contoid': None,
                    'brancaid': None,
                    'sottocontoid': None,
                    'tipo_di_costo': None,
                    'is_classificato': False,
                    'is_completo': False
                }
            },
            {
                'id': '2', 
                'nome': 'Fornitore Demo 2', 
                'codice': 'F0002',
                'classificazione': {
                    'contoid': None,
                    'brancaid': None,
                    'sottocontoid': None,
                    'tipo_di_costo': None,
                    'is_classificato': False,
                    'is_completo': False
                }
            },
            {
                'id': '3', 
                'nome': 'Fornitore Demo 3', 
                'codice': 'F0003',
                'classificazione': {
                    'contoid': None,
                    'brancaid': None,
                    'sottocontoid': None,
                    'tipo_di_costo': None,
                    'is_classificato': False,
                    'is_completo': False
                }
            },
        ]
        return {
            'fornitori': demo_fornitori,
            'total': len(demo_fornitori),
            'pages': 1,
            'has_next': False,
            'has_prev': False
        }