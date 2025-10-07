"""
Servizio per il recupero dati specifici da DBF (Pazienti, Prestazioni).
"""

import logging
from typing import Dict, Any, Optional

import dbf # <--- NEW IMPORT

from core.constants_v2 import COLONNE
from utils.dbf_utils import DBFOptimizedReader, clean_dbf_value, safe_get_dbf_field, get_optimized_reader

logger = logging.getLogger(__name__)

class DbfDataService:
    def __init__(self, reader: Optional[DBFOptimizedReader] = None):
        self.reader = reader or get_optimized_reader()

    def get_patient_by_id(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """
        Recupera i dati di un singolo paziente tramite ID.
        """
        try:
            patients_path = self.reader._get_dbf_path('PAZIENTI.DBF')
            
            # Carica tutti i pazienti (o usa cache se già caricati)
            # Nota: _load_patients_optimized restituisce un dict {id: nome}, non i dati completi
            # Dovremmo leggere il DBF PAZIENTI e filtrare per ID
            
            # Per ora, implementazione semplificata: legge il file e cerca l'ID
            with dbf.Table(patients_path, codepage='cp1252') as table:
                col_paz = COLONNE['pazienti']
                id_field = col_paz['id'] # DB_CODE - No .lower() here

                for record in table:
                    current_id = clean_dbf_value(getattr(record, id_field)) # Use id_field directly
                    if current_id == patient_id:
                        # Trovato il paziente, estrai tutti i campi mappati
                        patient_data = {}
                        for logical_name, dbf_field in col_paz.items():
                            patient_data[logical_name] = clean_dbf_value(getattr(record, dbf_field, '')) # No .lower() here
                        
                        # Aggiungi i campi DBF originali per i placeholder
                        for field_name in table.field_names:
                            patient_data[field_name] = clean_dbf_value(getattr(record, field_name, '')) # No .lower() here

                        return patient_data
            return None
        except Exception as e:
            logger.error(f"Errore nel recupero paziente {patient_id}: {e}", exc_info=True)
            return None

    def get_prestazione_by_id(self, prestazione_id: str) -> Optional[Dict[str, Any]]:
        """
        Recupera i dati di una singola prestazione tramite ID.
        """
        try:
            # Assumiamo che le prestazioni siano in PREVENT.DBF
            prevent_path = self.reader._get_dbf_path('PREVENT.DBF')

            with dbf.Table(prevent_path, codepage='cp1252') as table:
                col_prev = COLONNE['preventivi']
                id_prestazione_field = col_prev['id_prestazione'] # DB_PRONCOD - No .lower() here
                
                for record in table:
                    current_id = clean_dbf_value(getattr(record, id_prestazione_field)) # Use id_prestazione_field directly
                    if current_id == prestazione_id:
                        prestazione_data = {}
                        for logical_name, dbf_field in col_prev.items():
                            prestazione_data[logical_name] = clean_dbf_value(getattr(record, dbf_field, '')) # No .lower() here
                        
                        # Aggiungi i campi DBF originali per i placeholder
                        for field_name in table.field_names:
                            prestazione_data[field_name] = clean_dbf_value(getattr(record, field_name, '')) # No .lower() here
                        return prestazione_data
            return None
        except Exception as e:
            logger.error(f"Errore nel recupero prestazione {prestazione_id}: {e}", exc_info=True)
            return None

    def enrich_record(self, source_record: Dict[str, Any], enrichment_config: Dict[str, Any]) -> None:
        """
        Arricchisce un record sorgente con dati presi da un'altra tabella DBF,
        seguendo una configurazione di arricchimento.
        Modifica il dizionario source_record direttamente.
        """
        try:
            source_field = enrichment_config.get('source_field')
            target_table_name = enrichment_config.get('target_table')
            target_key_field = enrichment_config.get('target_key_field')
            target_value_field = enrichment_config.get('target_value_field')
            new_field_name = enrichment_config.get('new_field_name')

            if not all([source_field, target_table_name, target_key_field, target_value_field, new_field_name]):
                logger.warning("Configurazione di arricchimento incompleta. Salto.")
                return

            join_code = source_record.get(source_field)
            if not join_code:
                logger.warning(f"Campo sorgente '{source_field}' non trovato nel record. Salto arricchimento.")
                return

            target_path = self.reader._get_dbf_path(target_table_name)
            with dbf.Table(target_path, codepage='cp1252') as table:
                for record in table:
                    current_join_code = clean_dbf_value(getattr(record, target_key_field, ''))
                    if current_join_code == join_code:
                        value_to_add = clean_dbf_value(getattr(record, target_value_field, ''))
                        source_record[new_field_name] = value_to_add
                        logger.info(f"Record arricchito con successo: '{new_field_name}' = '{value_to_add}'.")
                        return
            
            logger.warning(f"Nessun record corrispondente trovato in {target_table_name} per il codice '{join_code}'.")

        except Exception as e:
            logger.error(f"Errore durante l'arricchimento del record: {e}", exc_info=True)

# Singleton instance
_dbf_data_service = None

def get_dbf_data_service() -> "DbfDataService":
    global _dbf_data_service
    if _dbf_data_service is None:
        _dbf_data_service = DbfDataService()
    return _dbf_data_service
