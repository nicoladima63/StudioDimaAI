"""Spese Fornitori Service for StudioDimaAI Server V2."""
import os
import dbf
import pandas as pd
import logging
from typing import Dict, Any, Optional, List
from .base_service import BaseService
from core.exceptions import DatabaseError, ValidationError
from utils.dbf_utils import clean_dbf_value, safe_get_dbf_field
from core.config_manager import get_config
from datetime import datetime
from .classificazioni_service import ClassificazioniService

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


class SpeseFornitoriService(BaseService):
    
    def get_spese(self, page: int = 1, per_page: int = 10, filters: Dict = None) -> Dict[str, Any]:
        """Get paginated expenses with filters."""
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
            
            # Extract filters
            fornitore_id = filters.get('codice_fornitore') if filters else None
            anno = filters.get('anno') if filters else None
            conto_id = filters.get('conto_id') if filters else None
            branca_id = filters.get('branca_id') if filters else None
            sottoconto_id = filters.get('sottoconto_id') if filters else None
            
            # Pre-fetch suppliers for category/branch/subaccount filter if needed
            allowed_suppliers = None
            if conto_id or branca_id or sottoconto_id:
                try:
                    class_service = ClassificazioniService()
                    allowed_suppliers = set(class_service.get_supplier_ids_by_classification(
                        contoid=conto_id, 
                        brancaid=branca_id, 
                        sottocontoid=sottoconto_id
                    ))
                    self.logger.info(f"Filtering by Classification: {len(allowed_suppliers)} suppliers found.")
                except Exception as e:
                    self.logger.error(f"Error fetching suppliers for classification: {e}")
                    allowed_suppliers = set()

            # Load Suppliers Mapping from FORNITOR.DBF
            supplier_names = {}
            try:
                fornitori_path = self._get_fornitori_dbf_path()
                if os.path.exists(fornitori_path):
                     with dbf.Table(fornitori_path, codepage='cp1252') as table_forn:
                        for record in table_forn:
                            f_code = str(clean_dbf_value(getattr(record, 'db_code', ''))).strip()
                            f_name = clean_dbf_value(getattr(record, 'db_fonome', ''))
                            if f_code:
                                supplier_names[f_code] = f_name
            except Exception as e:
                self.logger.error(f"Error loading suppliers mapping: {e}")

            # Read DBF file
            spese_raw = []
            with dbf.Table(spese_path, codepage='cp1252') as table:
                for record in table:
                    # Skip invalid records
                    if not getattr(record, 'db_code', None):
                        continue
                    
                    # Filter by Supplier if provided
                    supplier_code = clean_dbf_value(getattr(record, 'db_spfocod', None))
                    supplier_code_str = str(supplier_code).strip()
                    
                    if fornitore_id:
                        # Handle multi-id selection (comma separated)
                        target_ids = [t.strip() for t in str(fornitore_id).split(',')]
                        if supplier_code_str not in target_ids:
                            continue
                    
                    # Filter by Classification (Conto/Branca/Sottoconto) if provided
                    if allowed_suppliers is not None:
                        if supplier_code_str not in allowed_suppliers:
                            continue

                    # Filter by Year if provided (optimize early filtering)
                    if anno:
                        data_spesa = getattr(record, 'db_spdata', None)
                        if not data_spesa:
                            continue
                        
                        try:
                            if isinstance(data_spesa, datetime):
                                spesa_year = data_spesa.year
                            else:
                                spesa_year = pd.to_datetime(data_spesa).year
                                
                            if spesa_year != int(anno):
                                continue
                        except:
                            continue

                    # Build spesa record using correct field names
                    supplier_name = supplier_names.get(supplier_code_str, supplier_code_str) # Default to code if name not found
                    
                    spesa = {
                        'id': clean_dbf_value(getattr(record, 'db_code', None)),
                        'codice_fornitore': supplier_code_str,
                        'nome_fornitore': supplier_name,
                        'data_spesa': clean_dbf_value(getattr(record, 'db_spdata', None)),
                        'numero_documento': clean_dbf_value(getattr(record, 'db_spnumer', None)),
                        'descrizione': clean_dbf_value(getattr(record, 'db_spdescr', None)),
                        'costo_netto': self._safe_float(getattr(record, 'db_spcosto', None)),
                        'costo_iva': self._safe_float(getattr(record, 'db_spcoiva', None)),
                        'note': clean_dbf_value(getattr(record, 'db_note', None))
                    }
                    
                    # Calculate total
                    spesa['totale'] = (spesa['costo_netto'] or 0) + (spesa['costo_iva'] or 0)
                    
                    spese_raw.append(spesa)
            
            # Apply additional filters (date range, search)
            if filters:
                spese_raw = self._apply_filters(spese_raw, filters)
            
            # Sort: Name ASC first, then Date DESC
            spese_raw.sort(key=lambda x: (x.get('nome_fornitore') or '').lower())
            spese_raw.sort(key=lambda x: x.get('data_spesa') or '', reverse=True)
            
            # Calculate pagination
            total = len(spese_raw)
            per_page = int(per_page)
            if per_page <= 0: per_page = 10
            
            pages = (total + per_page - 1) // per_page
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
            self.logger.error(f"Error getting spese list: {e}")
            raise DatabaseError(f"Failed to retrieve expenses: {str(e)}")

    def get_active_suppliers(self, anno: int, conto_id: int = None, branca_id: int = None, sottoconto_id: int = None) -> List[Dict[str, Any]]:
        """
        Get list of active suppliers for the given filters.
        Active means they have at least one expense record in the selected year.
        The list is filtered by classification if parameters are provided.
        """
        try:
            # 1. Get filtered supplier IDs from Classification
            allowed_suppliers = None
            if conto_id or branca_id or sottoconto_id:
                try:
                    class_service = ClassificazioniService()
                    allowed_suppliers = set(class_service.get_supplier_ids_by_classification(
                        contoid=conto_id, 
                        brancaid=branca_id, 
                        sottocontoid=sottoconto_id
                    ))
                except Exception as e:
                    self.logger.error(f"Error fetching suppliers for classification: {e}")
                    allowed_suppliers = set()
            
            # 2. Load Supplier Names map
            supplier_names = {}
            try:
                fornitori_path = self._get_fornitori_dbf_path()
                if os.path.exists(fornitori_path):
                     with dbf.Table(fornitori_path, codepage='cp1252') as table_forn:
                        for record in table_forn:
                            f_code = str(clean_dbf_value(getattr(record, 'db_code', ''))).strip()
                            f_name = clean_dbf_value(getattr(record, 'db_fonome', ''))
                            if f_code:
                                supplier_names[f_code] = f_name
            except Exception as e:
                self.logger.error(f"Error loading suppliers mapping: {e}")

            # 3. Read Spese DBF and collect unique supplier IDs for the year
            active_supplier_ids = set()
            spese_path = self._get_spese_dbf_path()
            
            if not os.path.exists(spese_path):
                 return []
                 
            with dbf.Table(spese_path, codepage='cp1252') as table:
                for record in table:
                    # Filter by Year first
                    if anno:
                        data_spesa = getattr(record, 'db_spdata', None)
                        if not data_spesa:
                            continue
                        try:
                             if isinstance(data_spesa, datetime):
                                spesa_year = data_spesa.year
                             else:
                                spesa_year = pd.to_datetime(data_spesa).year
                             if spesa_year != int(anno):
                                continue
                        except:
                            continue
                            
                    # Get Supplier Code
                    supplier_code = clean_dbf_value(getattr(record, 'db_spfocod', None))
                    supplier_code_str = str(supplier_code).strip()
                    
                    if not supplier_code_str:
                        continue
                        
                    # Filter by Classification
                    if allowed_suppliers is not None:
                        if supplier_code_str not in allowed_suppliers:
                            continue
                            
                    active_supplier_ids.add(supplier_code_str)

            # 4. Build Result List
            # 4. Build Result List (Deduplicate by Name)
            suppliers_by_name = {}
            for supp_id in active_supplier_ids:
                name = supplier_names.get(supp_id, f"Fornitore {supp_id}")
                if name not in suppliers_by_name:
                    suppliers_by_name[name] = []
                suppliers_by_name[name].append(supp_id)
            
            active_suppliers = []
            for name, ids in suppliers_by_name.items():
                active_suppliers.append({
                    'id': ",".join(ids),
                    'nome': name
                })
            
            # Sort by name
            active_suppliers.sort(key=lambda x: (x['nome'] or '').lower())
            
            return active_suppliers

        except Exception as e:
            self.logger.error(f"Error getting active suppliers: {e}")
            raise DatabaseError(f"Failed to retrieve active suppliers: {str(e)}")

    def get_spese_by_fornitore(self, fornitore_id: str, page: int = 1, per_page: int = 10, filters: Dict = None) -> Dict[str, Any]:
        """Wrapper for backward compatibility."""
        if filters is None:
            filters = {}
        filters['codice_fornitore'] = fornitore_id
        return self.get_spese(page, per_page, filters)

    def get_riepilogo_spese(self, anno: int, conto_id: int = None, branca_id: int = None, sottoconto_id: int = None) -> Dict[str, Any]:
        """
        Get aggregated expenses by supplier for a specific year and classification filters.
        Returns total cost, iva, and count of invoices per supplier name (merging duplicates).
        """
        try:
            spese_path = self._get_spese_dbf_path()
            
            if not os.path.exists(spese_path):
                return {'success': False, 'error': f"Spese DBF not found: {spese_path}"}
            
            # 1. Pre-fetch suppliers for category/branch/subaccount filter if needed
            allowed_suppliers = None
            if conto_id or branca_id or sottoconto_id:
                try:
                    class_service = ClassificazioniService()
                    allowed_suppliers = set(class_service.get_supplier_ids_by_classification(
                        contoid=conto_id, 
                        brancaid=branca_id, 
                        sottocontoid=sottoconto_id
                    ))
                except Exception as e:
                    self.logger.error(f"Error fetching suppliers for classification: {e}")
                    allowed_suppliers = set()

            # 2. Load Supplier Names map (Code -> Name)
            supplier_names = {}
            try:
                fornitori_path = self._get_fornitori_dbf_path()
                if os.path.exists(fornitori_path):
                     with dbf.Table(fornitori_path, codepage='cp1252') as table_forn:
                        for record in table_forn:
                            f_code = str(clean_dbf_value(getattr(record, 'db_code', ''))).strip()
                            f_name = clean_dbf_value(getattr(record, 'db_fonome', ''))
                            if f_code:
                                supplier_names[f_code] = f_name
            except Exception as e:
                self.logger.error(f"Error loading suppliers mapping: {e}")

            stats = {} # { 'Nome Fornitore': { 'ids': set(), 'netto': 0, 'iva': 0, 'totale': 0, 'count': 0 } }
            
            with dbf.Table(spese_path, codepage='cp1252') as table:
                for record in table:
                    # Skip invalid records
                    if not getattr(record, 'db_code', None):
                        continue

                    # Filter by year
                    data_spesa = getattr(record, 'db_spdata', None)
                    if not data_spesa:
                        continue
                        
                    try:
                        if isinstance(data_spesa, datetime):
                            spesa_year = data_spesa.year
                        else:
                            spesa_year = pd.to_datetime(data_spesa).year
                            
                        if spesa_year != int(anno):
                            continue
                    except:
                        continue
                        
                    # Get Supplier Code
                    forn_code = clean_dbf_value(getattr(record, 'db_spfocod', None))
                    if not forn_code:
                        continue
                    
                    forn_code = str(forn_code).strip()

                    # Filter by Classification
                    if allowed_suppliers is not None:
                        if forn_code not in allowed_suppliers:
                            continue
                    
                    # Get Supplier Name
                    forn_name = supplier_names.get(forn_code, f"Fornitore {forn_code}")
                    
                    # Initialize stats for supplier name if new
                    if forn_name not in stats:
                        stats[forn_name] = {
                            'nome': forn_name,
                            'ids': set(),
                            'netto': 0.0,
                            'iva': 0.0,
                            'totale': 0.0,
                            'num_fatture': 0
                        }
                    
                    stats[forn_name]['ids'].add(forn_code)
                    
                    # Aggregate values
                    netto = self._safe_float(getattr(record, 'db_spcosto', 0)) or 0
                    iva = self._safe_float(getattr(record, 'db_spcoiva', 0)) or 0
                    
                    stats[forn_name]['netto'] += netto
                    stats[forn_name]['iva'] += iva
                    stats[forn_name]['totale'] += (netto + iva)
                    stats[forn_name]['num_fatture'] += 1
            
            # Format results
            results = []
            for name, data in stats.items():
                results.append({
                    'id': ",".join(data['ids']), # Comma separated IDs
                    'nome': name,
                    'importo_netto': round(data['netto'], 2),
                    'importo_iva': round(data['iva'], 2),
                    'importo_totale': round(data['totale'], 2),
                    'numero_fatture': data['num_fatture']
                })
                
            # Sort by total amount descending
            results.sort(key=lambda x: x['importo_totale'], reverse=True)
            
            self.logger.info(f"Riepilogo Spese: found {len(results)} suppliers out of {len(table)} records.")
            
            return {
                'success': True, 
                'anno': anno,
                'total_suppliers': len(results),
                'grand_total': round(sum(x['importo_totale'] for x in results), 2),
                'data': results
            }
            
        except Exception as e:
            self.logger.error(f"Error aggregating spese for year {anno}: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_spesa_by_id(self, spesa_id: str) -> Optional[Dict[str, Any]]:
        """Get single expense by ID."""
        try:
            spese_path = self._get_spese_dbf_path()
            
            if not os.path.exists(spese_path):
                return None
            
            with dbf.Table(spese_path, codepage='cp1252') as table:
                for record in table:
                    if str(clean_dbf_value(getattr(record, 'db_code', None))).strip() == str(spesa_id).strip():
                        return {
                            'id': clean_dbf_value(getattr(record, 'db_code', None)),
                            'codice_fornitore': clean_dbf_value(getattr(record, 'db_spfocod', None)),
                            'data_spesa': clean_dbf_value(getattr(record, 'db_spdata', None)),
                            'data_registrazione': clean_dbf_value(getattr(record, 'db_spdatar', None)),
                            'numero_documento': clean_dbf_value(getattr(record, 'db_spnumer', None)),
                            'descrizione': clean_dbf_value(getattr(record, 'db_spdescr', None)),
                            'costo_netto': self._safe_float(getattr(record, 'db_spcosto', None)),
                            'costo_iva': self._safe_float(getattr(record, 'db_spcoiva', None)),
                            'note': clean_dbf_value(getattr(record, 'db_note', None)),
                            'totale': (self._safe_float(getattr(record, 'db_spcosto', None)) or 0) + (self._safe_float(getattr(record, 'db_spcoiva', None)) or 0)
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
                    if str(clean_dbf_value(getattr(record, 'db_vospcod', None))).strip() == str(spesa_id).strip():
                        
                        quantita = self._safe_float(getattr(record, 'db_voquant', None)) or 0
                        prezzo_unitario = self._safe_float(getattr(record, 'db_voprezz', None)) or 0
                        sconto = self._safe_float(getattr(record, 'db_voscont', None)) or 0
                        
                        # Calculate total per row
                        totale_riga = quantita * prezzo_unitario * (1 - sconto / 100)
                        
                        riga = {
                            'codice_articolo': clean_dbf_value(getattr(record, 'db_vosocod', None)),
                            'descrizione': clean_dbf_value(getattr(record, 'db_vodescr', None)),
                            'quantita': quantita,
                            'prezzo_unitario': prezzo_unitario,
                            'sconto': sconto,
                            'aliquota_iva': self._safe_float(getattr(record, 'db_voiva', None)) or 0,
                            'totale_riga': totale_riga
                        }
                        
                        righe.append(riga)
            
            return righe
            
        except Exception as e:
            self.logger.error(f"Error getting righe for spesa {spesa_id}: {e}")
            raise DatabaseError(f"Failed to retrieve expense details: {str(e)}")
    
    def get_analisi_produzione_operatore(self, start_date_str: str, end_date_str: str, operator_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Calcola la produzione per operatore basandosi su PREVENT.DBF (prestazioni eseguite).
        Strategia 3: Ripartizione basata su produzione reale.
        """
        try:
            from core.constants_v2 import COLONNE, MEDICI, CATEGORIE_PRESTAZIONI
            
            config = get_config()
            preventivi_path = config.get_dbf_path('preventivi')
            onorario_path = config.get_dbf_path('onorario')
            
            if not os.path.exists(preventivi_path) or not os.path.exists(onorario_path):
                return {'success': False, 'error': 'File DBF preventivi o onorario non trovati'}

            # 1. Mappa Onorario (Codice Prestazione -> ID Categoria)
            onorario_map = {}
            with dbf.Table(onorario_path, codepage='cp1252') as table:
                for record in table:
                    # dbf lib usa nomi campo lowercase
                    code_field = COLONNE['onorario']['id_prestazione'].lower()
                    cat_field = COLONNE['onorario']['categoria'].lower()
                    
                    code = clean_dbf_value(getattr(record, code_field, None))
                    cat_id = clean_dbf_value(getattr(record, cat_field, None))
                    if code:
                        onorario_map[str(code).strip()] = cat_id

            # 2. Date
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()

            # 3. Aggregazione
            stats = {} # { 'Nome Medico': { 'Nome Branca': importo } }

            with dbf.Table(preventivi_path, codepage='cp1252') as table:
                # Campi preventivi (lowercase per dbf lib)
                f_stato = COLONNE['preventivi']['stato_prestazione'].lower()
                f_data = COLONNE['preventivi']['data_prestazione'].lower()
                f_medico = COLONNE['preventivi']['medico'].lower()
                f_spesa = COLONNE['preventivi']['spesa'].lower()
                f_codice = COLONNE['preventivi']['id_prestazione'].lower()

                for record in table:
                    # Filtro Stato Eseguito (3)
                    status = clean_dbf_value(getattr(record, f_stato, None))
                    if status != 3:
                        continue

                    # Filtro Data
                    data_prest = getattr(record, f_data, None)
                    if not data_prest:
                        continue
                    
                    if isinstance(data_prest, datetime):
                        data_prest = data_prest.date()
                    
                    if not (start_date <= data_prest <= end_date):
                        continue

                    # Medico
                    medico_id = clean_dbf_value(getattr(record, f_medico, None))
                    if medico_id is None:
                        continue
                    
                    try:
                        medico_id_int = int(medico_id)
                        # Usa mapping MEDICI, fallback su ID se mancante (es. chirurgo non ancora aggiunto)
                        medico_nome = MEDICI.get(medico_id_int, f"Medico {medico_id_int}")
                    except (ValueError, TypeError):
                        medico_nome = f"Medico {medico_id}"

                    # Filtro opzionale nome operatore (case insensitive)
                    if operator_name and operator_name.lower() not in medico_nome.lower():
                        continue

                    # Importo
                    importo = self._safe_float(getattr(record, f_spesa, 0)) or 0
                    if importo == 0:
                        continue

                    # Categoria
                    prest_code = str(clean_dbf_value(getattr(record, f_codice, ''))).strip()
                    cat_id = onorario_map.get(prest_code)
                    
                    # Decodifica Categoria
                    cat_nome = "Non Definito"
                    if cat_id is not None:
                        try:
                            cat_id_int = int(cat_id)
                            cat_nome = CATEGORIE_PRESTAZIONI.get(cat_id_int, f"Cat {cat_id_int}")
                        except:
                            pass
                    
                    # Aggiorna statistiche
                    if medico_nome not in stats:
                        stats[medico_nome] = {}
                    
                    if cat_nome not in stats[medico_nome]:
                        stats[medico_nome][cat_nome] = 0.0
                    
                    stats[medico_nome][cat_nome] += importo

            # 4. Formattazione Output
            result_data = []
            for medico, cat_data in stats.items():
                total_medico = sum(cat_data.values())
                branches = []
                for cat, amount in cat_data.items():
                    branches.append({
                        'branca': cat,
                        'importo': round(amount, 2),
                        'percentuale': round((amount / total_medico * 100), 2) if total_medico > 0 else 0
                    })
                
                # Ordina branche per importo decrescente
                branches.sort(key=lambda x: x['importo'], reverse=True)
                
                result_data.append({
                    'operatore': medico,
                    'totale_periodo': round(total_medico, 2),
                    'dettaglio_branche': branches
                })

            result_data.sort(key=lambda x: x['totale_periodo'], reverse=True)
            return {'success': True, 'data': result_data}

        except Exception as e:
            self.logger.error(f"Error analyzing production: {e}")
            return {'success': False, 'error': str(e)}

    def get_available_production_years(self) -> Dict[str, Any]:
        """
        Get distinct years from production data (PREVENT.DBF).
        """
        try:
            from core.constants_v2 import COLONNE
            config = get_config()
            preventivi_path = config.get_dbf_path('preventivi')

            if not os.path.exists(preventivi_path):
                return {'success': False, 'error': 'File DBF preventivi non trovato'}

            years = set()
            with dbf.Table(preventivi_path, codepage='cp1252') as table:
                f_data = COLONNE['preventivi']['data_prestazione'].lower()

                for record in table:
                    data_prest = getattr(record, f_data, None)
                    if data_prest:
                        if isinstance(data_prest, datetime):
                            years.add(data_prest.year)
                        elif hasattr(data_prest, 'year'): # date object
                            years.add(data_prest.year)
            
            sorted_years = sorted(list(years), reverse=True)
            return {'success': True, 'data': sorted_years}

        except Exception as e:
            self.logger.error(f"Error extracting production years: {e}")
            return {'success': False, 'error': str(e)}

    def get_stats(self, filters: Dict = None) -> Dict[str, Any]:
        """
        Get statistics for expenses based on filters.
        """
        try:
            spese_path = self._get_spese_dbf_path()
            if not os.path.exists(spese_path):
                return {'success': False, 'error': 'File DBF spese non trovato'}
            
            # Extract filters
            fornitore_id = filters.get('codice_fornitore') if filters else None
            anno = filters.get('anno') if filters else None
            conto_id = filters.get('conto_id') if filters else None
            
            allowed_suppliers = None
            if conto_id:
                try:
                    class_service = ClassificazioniService()
                    allowed_suppliers = set(class_service.get_fornitori_by_conto(conto_id))
                except:
                    allowed_suppliers = set()

            total_costo = 0.0
            total_iva = 0.0
            count = 0
            
            with dbf.Table(spese_path, codepage='cp1252') as table:
                for record in table:
                     # Skip invalid records
                    if not getattr(record, 'db_code', None):
                        continue
                    
                    supplier_code = clean_dbf_value(getattr(record, 'db_spfocod', None))
                    supplier_code_str = str(supplier_code).strip()
                    
                    if fornitore_id:
                        if supplier_code_str != str(fornitore_id).strip():
                            continue

                    if allowed_suppliers is not None:
                        if supplier_code_str not in allowed_suppliers:
                            continue

                    if anno:
                        data_spesa = getattr(record, 'db_spdata', None)
                        if not data_spesa:
                            continue
                        try:
                            if isinstance(data_spesa, datetime):
                                spesa_year = data_spesa.year
                            else:
                                spesa_year = pd.to_datetime(data_spesa).year
                            if spesa_year != int(anno):
                                continue
                        except:
                            continue
                    
                    costo = self._safe_float(getattr(record, 'db_spcosto', None)) or 0
                    iva = self._safe_float(getattr(record, 'db_spcoiva', None)) or 0
                    
                    total_costo += costo
                    total_iva += iva
                    count += 1
            
            return {
                'success': True,
                'data': {
                    'total_costo': total_costo,
                    'total_iva': total_iva,
                    'total_grand': total_costo + total_iva,
                    'count': count
                }
            }

        except Exception as e:
            self.logger.error(f"Error getting stats: {e}")
            return {'success': False, 'error': str(e)}

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

    def _get_fornitori_dbf_path(self) -> str:
        """Get path to fornitori DBF file."""
        try:
            config = get_config()
            return config.get_dbf_path('fornitori')
        except Exception:
            # Fallback
            mode = config.get_mode() if 'config' in locals() else 'dev'
            base_path = get_config().get(f"{mode.upper()}_DB_BASE_PATH")
            return os.path.join(base_path, 'DATI', 'FORNITOR.DBF')

# Istanza singleton
spese_fornitori_service = SpeseFornitoriService(None) # Pass None as db_manager is initialized in BaseService via get_database_manager if None