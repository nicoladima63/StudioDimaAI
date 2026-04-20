"""Pazienti Service for StudioDimaAI Server V2."""

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
    logger = logging.getLogger(__name__)
    logger.error(f"Could not import DBF utilities: {e}")
    raise

# Constants for pazienti DBF fields (from V1 constants.py - VERIFIED)
PAZIENTI_FIELDS = {
    'id': 'DB_CODE',
    'nome': 'DB_PANOME',
    'codice_fiscale': 'DB_PACODFI',
    'data_nascita': 'DB_PADANAS',
    'sesso': 'DB_PASESSO',
    'telefono': 'DB_PATELEF',
    'cellulare': 'DB_PACELLU',
    'email': 'DB_PAEMAIL',
    'indirizzo': 'DB_PAINDIR',
    'citta': 'DB_PACITTA',
    'provincia': 'DB_PAPROVI',
    'cap': 'DB_PACAP',
    'note': 'DB_NOTE',
    'ultima_visita': 'DB_PAULTVI',
    'tempo_richiamo': 'DB_PARITAR',
    'tipo_richiamo': 'DB_PARIMOT',
    'da_richiamare': 'DB_PARICHI',
    'non_in_cura': 'DB_PANONCU'
}

logger = logging.getLogger(__name__)

class PazientiService(BaseService):
    
    def get_pazienti_paginated(self, page=1, per_page=50, filters=None) -> Dict[str, Any]:
        """Get paginated list of pazienti from DBF files."""
        try:
            # Get DBF file path using config manager
            pazienti_path = self._get_pazienti_dbf_path()
            
            if not os.path.exists(pazienti_path):
                self.logger.warning(f"Pazienti DBF file not found: {pazienti_path}")
                raise DatabaseError(f"Pazienti DBF file not found: {pazienti_path}")
            
            # Read DBF file directly using dbf library
            pazienti_raw = []
            with dbf.Table(pazienti_path, codepage='cp1252') as table:
                for record in table:
                    try:
                        # Extract fields using constants mapping - access directly by field name
                        paziente_id = clean_dbf_value(record[PAZIENTI_FIELDS['id']])
                        paziente_nome = clean_dbf_value(record[PAZIENTI_FIELDS['nome']])
                        
                        if paziente_id and paziente_nome:
                            # Extract all available fields
                            paziente_data = {
                                'id': str(paziente_id).strip(),
                                'nome': str(paziente_nome).strip()
                            }
                            
                            # Add optional fields if available
                            try:
                                if 'codice_fiscale' in PAZIENTI_FIELDS:
                                    cf = clean_dbf_value(record[PAZIENTI_FIELDS['codice_fiscale']])
                                    if cf:
                                        paziente_data['codice_fiscale'] = str(cf).strip()
                                        
                                if 'data_nascita' in PAZIENTI_FIELDS:
                                    data_nascita = clean_dbf_value(record[PAZIENTI_FIELDS['data_nascita']])
                                    if data_nascita:
                                        paziente_data['data_nascita'] = self._format_date_field(data_nascita)
                                        
                                if 'sesso' in PAZIENTI_FIELDS:
                                    sesso = clean_dbf_value(record[PAZIENTI_FIELDS['sesso']])
                                    if sesso:
                                        paziente_data['sesso'] = str(sesso).strip()
                                        
                                if 'telefono' in PAZIENTI_FIELDS:
                                    telefono = clean_dbf_value(record[PAZIENTI_FIELDS['telefono']])
                                    if telefono:
                                        paziente_data['telefono'] = str(telefono).strip()
                                        
                                if 'cellulare' in PAZIENTI_FIELDS:
                                    cellulare = clean_dbf_value(record[PAZIENTI_FIELDS['cellulare']])
                                    if cellulare:
                                        paziente_data['cellulare'] = str(cellulare).strip()
                                        
                                if 'email' in PAZIENTI_FIELDS:
                                    email = clean_dbf_value(record[PAZIENTI_FIELDS['email']])
                                    if email:
                                        paziente_data['email'] = str(email).strip()
                                        
                                if 'indirizzo' in PAZIENTI_FIELDS:
                                    indirizzo = clean_dbf_value(record[PAZIENTI_FIELDS['indirizzo']])
                                    if indirizzo:
                                        paziente_data['indirizzo'] = str(indirizzo).strip()
                                        
                                if 'citta' in PAZIENTI_FIELDS:
                                    citta = clean_dbf_value(record[PAZIENTI_FIELDS['citta']])
                                    if citta:
                                        paziente_data['citta'] = str(citta).strip()
                                        
                                if 'provincia' in PAZIENTI_FIELDS:
                                    provincia = clean_dbf_value(record[PAZIENTI_FIELDS['provincia']])
                                    if provincia:
                                        paziente_data['provincia'] = str(provincia).strip()
                                        
                                if 'cap' in PAZIENTI_FIELDS:
                                    cap = clean_dbf_value(record[PAZIENTI_FIELDS['cap']])
                                    if cap:
                                        paziente_data['cap'] = str(cap).strip()
                                        
                                if 'note' in PAZIENTI_FIELDS:
                                    note = clean_dbf_value(record[PAZIENTI_FIELDS['note']])
                                    if note:
                                        paziente_data['note'] = str(note).strip()
                                        
                                if 'ultima_visita' in PAZIENTI_FIELDS:
                                    ultima_visita = clean_dbf_value(record[PAZIENTI_FIELDS['ultima_visita']])
                                    if ultima_visita:
                                        paziente_data['ultima_visita'] = self._format_date_field(ultima_visita)
                                        
                                if 'mesi_richiamo' in PAZIENTI_FIELDS:
                                    mesi = clean_dbf_value(record[PAZIENTI_FIELDS['mesi_richiamo']])
                                    if mesi and str(mesi).isdigit():
                                        paziente_data['mesi_richiamo'] = int(mesi)
                                        
                                if 'tipo_richiamo' in PAZIENTI_FIELDS:
                                    tipo = clean_dbf_value(record[PAZIENTI_FIELDS['tipo_richiamo']])
                                    if tipo:
                                        paziente_data['tipo_richiamo'] = str(tipo).strip()
                                        
                                if 'da_richiamare' in PAZIENTI_FIELDS:
                                    da_richiamare = clean_dbf_value(record[PAZIENTI_FIELDS['da_richiamare']])
                                    if da_richiamare:
                                        paziente_data['da_richiamare'] = str(da_richiamare).strip()
                                        
                                if 'non_in_cura' in PAZIENTI_FIELDS:
                                    non_in_cura = clean_dbf_value(record[PAZIENTI_FIELDS['non_in_cura']])
                                    if non_in_cura:
                                        paziente_data['non_in_cura'] = bool(non_in_cura)
                                        
                            except Exception as field_error:
                                # Skip optional fields if they cause errors, but keep the record
                                self.logger.debug(f"Error extracting optional fields for paziente {paziente_id}: {field_error}")
                            
                            pazienti_raw.append(paziente_data)
                            
                    except Exception as record_error:
                        # Skip problematic records but continue processing
                        self.logger.debug(f"Error processing record: {record_error}")
                        continue
            
            # Apply filters
            if filters:
                pazienti_raw = self._apply_filters(pazienti_raw, filters)
            
            # Merge with richiami table data
            pazienti_raw = self._merge_with_richiami_data(pazienti_raw)
            
            # Calculate pagination
            total = len(pazienti_raw)
            start = (page - 1) * per_page
            end = start + per_page
            pazienti_page = pazienti_raw[start:end]
            
            return {
                'success': True,
                'data': {
                    'pazienti': pazienti_page,
                    'pagination': {
                        'page': page,
                        'per_page': per_page,
                        'total': total,
                        'pages': (total + per_page - 1) // per_page,
                        'has_next': end < total,
                        'has_prev': page > 1
                    }
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error getting pazienti: {e}")
            raise DatabaseError(f"Failed to get pazienti: {str(e)}")

    def get_paziente_by_id(self, paziente_id: str) -> Dict[str, Any]:
        """Get single paziente by ID."""
        try:
            pazienti_path = self._get_pazienti_dbf_path()
            
            if not os.path.exists(pazienti_path):
                raise DatabaseError(f"Pazienti DBF file not found: {pazienti_path}")
            
            with dbf.Table(pazienti_path, codepage='cp1252') as table:
                for record in table:
                    if str(record[PAZIENTI_FIELDS['id']]) == str(paziente_id):
                        paziente_data = self._extract_paziente_data(record)
                        if paziente_data:
                            return {
                                'success': True,
                                'data': paziente_data
                            }
            
            return {
                'success': False,
                'error': 'PAZIENTE_NOT_FOUND',
                'message': f'Paziente {paziente_id} non trovato'
            }
            
        except Exception as e:
            self.logger.error(f"Error getting paziente {paziente_id}: {e}")
            raise DatabaseError(f"Failed to get paziente: {str(e)}")

    def search_pazienti(self, query: str, limit: int = 20, telefono: str = '') -> Dict[str, Any]:
        """Search pazienti by name, codice fiscale or telefono."""
        try:
            pazienti_path = self._get_pazienti_dbf_path()

            if not os.path.exists(pazienti_path):
                raise DatabaseError(f"Pazienti DBF file not found: {pazienti_path}")

            results = []
            query_lower = query.lower().strip()
            telefono_clean = telefono.strip()

            with dbf.Table(pazienti_path, codepage='cp1252') as table:
                for record in table:
                    if len(results) >= limit:
                        break

                    if record[PAZIENTI_FIELDS['id']]:
                        match = False

                        if telefono_clean:
                            tel = str(clean_dbf_value(record[PAZIENTI_FIELDS['telefono']]))
                            cell = str(clean_dbf_value(record[PAZIENTI_FIELDS['cellulare']]))
                            match = telefono_clean in tel or telefono_clean in cell
                        elif query_lower:
                            nome = clean_dbf_value(record[PAZIENTI_FIELDS['nome']])
                            cf = clean_dbf_value(record[PAZIENTI_FIELDS['codice_fiscale']])
                            match = query_lower in nome.lower() or query_lower in cf.lower()

                        if match:
                            paziente = self._extract_paziente_data(record)
                            if paziente:
                                results.append(paziente)
            
            return {
                'success': True,
                'data': results,
                'count': len(results),
                'query': query
            }
            
        except Exception as e:
            self.logger.error(f"Error searching pazienti: {e}")
            raise DatabaseError(f"Failed to search pazienti: {str(e)}")

    def _extract_paziente_data(self, record) -> Optional[Dict[str, Any]]:
        """Extract paziente data from DBF record."""
        try:
            paziente = {}
            
            for field_name, dbf_field in PAZIENTI_FIELDS.items():
                value = clean_dbf_value(record[dbf_field])
                
                # Clean and format values
                if field_name in ['id']:
                    paziente[field_name] = str(value) if value else None
                elif field_name in ['data_nascita', 'ultima_visita']:
                    # Convert date fields if needed
                    paziente[field_name] = self._format_date_field(value)
                elif field_name in ['tempo_richiamo']:
                    paziente[field_name] = int(value) if value and str(value).isdigit() else None
                elif field_name in ['non_in_cura']:
                    paziente[field_name] = bool(value) if value else False
                else:
                    paziente[field_name] = str(value).strip() if value else None
            
            return paziente if paziente.get('id') else None
            
        except Exception as e:
            self.logger.error(f"Error extracting paziente data: {e}")
            return None

    def _format_date_field(self, value):
        """Format date field from DBF."""
        if not value:
            return None
        
        try:
            # Handle different date formats from DBF
            if hasattr(value, 'isoformat'):
                return value.isoformat()
            elif isinstance(value, str) and len(value) >= 8:
                # YYYYMMDD format
                return f"{value[:4]}-{value[4:6]}-{value[6:8]}"
            else:
                return str(value) if value else None
        except:
            return str(value) if value else None

    def _apply_filters(self, pazienti: List[Dict], filters: Dict) -> List[Dict]:
        """Apply filters to pazienti list."""
        if not filters:
            return pazienti
        
        filtered = pazienti
        
        # Filter by search term
        if filters.get('search'):
            search_term = filters['search'].lower()
            filtered = [p for p in filtered 
                       if (search_term in p.get('nome', '').lower() or
                           search_term in p.get('codice_fiscale', '').lower())]
        
        # Filter by da_richiamare
        if filters.get('da_richiamare') is not None:
            filtered = [p for p in filtered 
                       if p.get('da_richiamare') == 'S']
        
        # Filter by non_in_cura
        if filters.get('in_cura') is not None:
            in_cura = filters['in_cura']
            filtered = [p for p in filtered 
                       if p.get('non_in_cura') != in_cura]
        
        return filtered

    def _merge_with_richiami_data(self, pazienti: List[Dict]) -> List[Dict]:
        """Merge pazienti data with richiami table data."""
        if not pazienti:
            return pazienti
        
        try:
            # Get all paziente IDs
            paziente_ids = [p['id'] for p in pazienti if p.get('id')]
            if not paziente_ids:
                return pazienti
            
            # Query richiami table for these patients
            placeholders = ','.join(['?' for _ in paziente_ids])
            query = f"""
                SELECT paziente_id, nome, data_ultima_visita, data_richiamo, 
                       tipo_richiamo, tempo_richiamo, da_richiamare, richiamato_il, sms_sent
                FROM richiami 
                WHERE paziente_id IN ({placeholders})
            """
            
            richiami_data = {}
            try:
                import sqlite3
                db_path = os.path.join(
                    os.path.dirname(os.path.dirname(__file__)), 
                    'instance', 
                    'studio_dima.db'
                )
                
                if os.path.exists(db_path):
                    conn = sqlite3.connect(db_path)
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    cursor.execute(query, paziente_ids)
                    
                    for row in cursor.fetchall():
                        richiami_data[row['paziente_id']] = dict(row)
                    
                    conn.close()
            except Exception as e:
                self.logger.warning(f"Could not fetch richiami data: {e}")
            
            # Merge data for each paziente
            for paziente in pazienti:
                paziente_id = paziente.get('id')
                if not paziente_id:
                    continue
                
                richiamo = richiami_data.get(paziente_id)
                if richiamo:
                    # Patient exists in richiami table - use that data
                    paziente['is_in_richiami_table'] = True
                    paziente['tipo_richiamo_gestionale'] = paziente.get('tipo_richiamo')  # Keep original
                    paziente['tipo_richiamo'] = richiamo['tipo_richiamo']
                    paziente['tempo_richiamo'] = richiamo['tempo_richiamo']
                    paziente['da_richiamare'] = richiamo['da_richiamare']
                    paziente['data_richiamo'] = richiamo['data_richiamo']
                    paziente['richiamato_il'] = richiamo['richiamato_il']
                    paziente['sms_sent'] = richiamo['sms_sent']
                    if richiamo['data_ultima_visita']:
                        paziente['ultima_visita'] = richiamo['data_ultima_visita']
                else:
                    # Patient not in richiami table - use gestionale data
                    paziente['is_in_richiami_table'] = False
                    paziente['tipo_richiamo_gestionale'] = paziente.get('tipo_richiamo')
            
            return pazienti
            
        except Exception as e:
            self.logger.error(f"Error merging richiami data: {e}")
            return pazienti

    def _get_pazienti_dbf_path(self) -> str:
        """Get path to pazienti DBF file."""
        try:
            config = get_config()
            mode = config.get_mode()
            
            # Try to get base path from config
            base_path_key = f"{mode.upper()}_DB_BASE_PATH"
            base_path = config.get(base_path_key)
            
            if base_path and os.path.exists(base_path):
                pazienti_path = os.path.join(base_path, 'DATI', 'PAZIENTI.DBF')
                if os.path.exists(pazienti_path):
                    return pazienti_path
            
            raise FileNotFoundError(f"PAZIENTI.DBF not found in configured location: {base_path}")
            
        except Exception as e:
            raise DatabaseError(f"Could not locate pazienti DBF file: {str(e)}")