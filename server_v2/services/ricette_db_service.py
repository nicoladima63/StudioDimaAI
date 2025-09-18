"""
Servizio per la gestione delle ricette elettroniche nel database locale - Versione 2
Replica la logica di server/app/core/ricette_db.py adattata all'architettura V2
"""

import os
import sqlite3
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from core.database_manager import get_database_manager
from core.exceptions import DatabaseError, ValidationError
from .base_service import BaseService


logger = logging.getLogger(__name__)


class RicetteDbService(BaseService):
    """
    Servizio per l'accesso al database locale delle ricette elettroniche.
    
    Replica tutti i metodi di V1 RicetteDB adattati al pattern V2:
    - save_ricetta()
    - get_ricetta_by_nre() 
    - get_ricette_by_paziente()
    - get_all_ricette()
    - annulla_ricetta()
    """
    
    def __init__(self):
        super().__init__(get_database_manager())
        self.db_path = self._get_ricette_db_path()
        self._ensure_ricette_db_exists()
    
    def _get_ricette_db_path(self) -> str:
        """Ottiene il path del database ricette - stesso di V1"""
        # Usa instance directory come V1
        instance_dir = os.path.join(os.path.dirname(__file__), '../instance')
        os.makedirs(instance_dir, exist_ok=True)
        return os.path.join(instance_dir, 'ricette_elettroniche.db')
    
    def _ensure_ricette_db_exists(self):
        """Assicura che il database ricette esista - copia esatta da V1"""
        if not os.path.exists(self.db_path):
            self._init_ricette_db()
    
    def _init_ricette_db(self):
        """Inizializza il database delle ricette - copia esatta da V1"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Tabella ricette elettroniche - schema identico a V1
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS ricette_elettroniche (
                    -- Chiave primaria
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    
                    -- === IDENTIFICATIVI RICETTA (da Sistema TS) ===
                    nre TEXT NOT NULL,                      -- Numero Ricetta Elettronica
                    codice_pin TEXT NOT NULL,               -- PIN per farmacista
                    protocollo_transazione TEXT,            -- Protocollo transazione
                    stato TEXT NOT NULL DEFAULT 'inviata',  -- 'inviata', 'annullata', 'erogata'
                    categoria_ricetta TEXT,                 -- categoria ricetta
                    
                    -- === DATI MEDICO COMPLETI ===
                    cf_medico TEXT NOT NULL,
                    medico_cognome TEXT NOT NULL,
                    medico_nome TEXT NOT NULL,
                    specializzazione TEXT NOT NULL,
                    nr_iscrizione_albo TEXT NOT NULL,
                    medico_indirizzo TEXT,
                    medico_telefono TEXT,
                    
                    -- === DATI PAZIENTE ===
                    cf_assistito TEXT NOT NULL,
                    paziente_cognome TEXT NOT NULL,
                    paziente_nome TEXT NOT NULL,
                    paziente_indirizzo TEXT,
                    paziente_cap TEXT,
                    paziente_citta TEXT,
                    paziente_provincia TEXT,
                    
                    -- === DATI PRESCRIZIONE E FARMACO ===
                    data_compilazione DATETIME NOT NULL,
                    tipo_prescrizione TEXT DEFAULT 'farmaceutica',
                    
                    -- Diagnosi snapshot
                    codice_diagnosi TEXT NOT NULL,
                    descrizione_diagnosi TEXT NOT NULL,
                    
                    -- Farmaco snapshot
                    gruppo_equivalenza_farmaco TEXT NOT NULL,    -- principio attivo
                    prodotto_aic TEXT NOT NULL,                  -- nome commerciale
                    codice_farmaco TEXT NOT NULL,               -- codice interno
                    quantita INTEGER DEFAULT 1,                 -- quantità (1 per ripetibili)
                    posologia TEXT NOT NULL,
                    sostituibilita TEXT DEFAULT 'sostituibile',
                    numero_ripetizioni INTEGER DEFAULT 1,
                    validita TEXT,                               -- validità ricetta
                    durata_trattamento TEXT NOT NULL,
                    note TEXT,
                    
                    -- === GESTIONE ANNULLAMENTO ===
                    data_annullamento DATETIME NULL,
                    motivo_annullamento TEXT NULL,
                    
                    -- === METADATI TECNICI ===
                    ambiente TEXT NOT NULL DEFAULT 'test',      -- 'test' o 'prod'
                    response_xml TEXT NOT NULL,                 -- XML completo risposta
                    pdf_base64 TEXT,                            -- PDF ricetta per ristampa immediata
                    
                    -- Timestamps
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Indici per performance - identici a V1
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_nre ON ricette_elettroniche(nre)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_cf_assistito ON ricette_elettroniche(cf_assistito)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_cf_medico ON ricette_elettroniche(cf_medico)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_stato ON ricette_elettroniche(stato)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_data_compilazione ON ricette_elettroniche(data_compilazione)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_protocollo_transazione ON ricette_elettroniche(protocollo_transazione)')
            
            conn.commit()
            conn.close()
            
            self.logger.info(f"Database ricette inizializzato: {self.db_path}")
            
        except Exception as e:
            self.logger.error(f"Errore inizializzazione database ricette: {e}")
            raise DatabaseError(f"Impossibile inizializzare database ricette: {e}")
    
    def save_ricetta(self, ricetta_data: Dict[str, Any]) -> int:
        """
        Salva una ricetta elettronica nel database.
        Replica esatta di V1 con gestione errori V2.
        
        Args:
            ricetta_data: Dati ricetta (stesso formato V1)
            
        Returns:
            ID ricetta salvata
            
        Raises:
            ValidationError: Se mancano campi obbligatori
            DatabaseError: Se errore database
        """
        try:
            # Validazione campi obbligatori - come V1
            required_fields = [
                'cf_medico', 'cf_assistito', 'data_compilazione',
                'codice_diagnosi', 'descrizione_diagnosi', 'codice_farmaco', 'posologia', 
                'durata_trattamento'
            ]
            self.validate_required_fields(ricetta_data, required_fields)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Query identica a V1
            cursor.execute('''
                INSERT INTO ricette_elettroniche (
                    nre, codice_pin, protocollo_transazione, stato,
                    cf_medico, medico_cognome, medico_nome, specializzazione, nr_iscrizione_albo,
                    medico_indirizzo, medico_telefono,
                    cf_assistito, paziente_cognome, paziente_nome, paziente_indirizzo,
                    paziente_cap, paziente_citta, paziente_provincia,
                    data_compilazione, tipo_prescrizione,
                    codice_diagnosi, descrizione_diagnosi,
                    gruppo_equivalenza_farmaco, prodotto_aic, codice_farmaco,
                    quantita, posologia, durata_trattamento, note,
                    ambiente, response_xml, pdf_base64
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                ricetta_data.get('nre', ''),
                ricetta_data.get('codice_pin', ''),
                ricetta_data.get('protocollo_transazione'),
                ricetta_data.get('stato', 'inviata'),
                ricetta_data['cf_medico'],
                ricetta_data['medico_cognome'],
                ricetta_data['medico_nome'],
                ricetta_data['specializzazione'],
                ricetta_data['nr_iscrizione_albo'],
                ricetta_data.get('medico_indirizzo'),
                ricetta_data.get('medico_telefono'),
                ricetta_data['cf_assistito'],
                ricetta_data['paziente_cognome'],
                ricetta_data['paziente_nome'],
                ricetta_data.get('paziente_indirizzo'),
                ricetta_data.get('paziente_cap'),
                ricetta_data.get('paziente_citta'),
                ricetta_data.get('paziente_provincia'),
                ricetta_data['data_compilazione'],
                ricetta_data.get('tipo_prescrizione', 'farmaceutica'),
                ricetta_data['codice_diagnosi'],
                ricetta_data['descrizione_diagnosi'],
                ricetta_data.get('gruppo_equivalenza_farmaco', ''),
                ricetta_data.get('prodotto_aic', ''),
                ricetta_data['codice_farmaco'],
                ricetta_data.get('quantita', 1),
                ricetta_data['posologia'],
                ricetta_data['durata_trattamento'],
                ricetta_data.get('note'),
                ricetta_data.get('ambiente', 'test'),
                ricetta_data.get('response_xml', ''),
                ricetta_data.get('pdf_base64')
            ))
            
            ricetta_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            self.logger.info(f"Ricetta salvata: ID {ricetta_id}, NRE {ricetta_data['nre']}")
            return ricetta_id
            
        except ValidationError:
            raise
        except Exception as e:
            self.logger.error(f"Errore salvataggio ricetta: {e}")
            raise DatabaseError(f"Impossibile salvare ricetta: {e}")
    
    def get_ricetta_by_nre(self, nre: str) -> Optional[Dict[str, Any]]:
        """
        Recupera una ricetta per NRE.
        Replica esatta di V1.
        
        Args:
            nre: Numero Ricetta Elettronica
            
        Returns:
            Dati ricetta o None se non trovata
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM ricette_elettroniche WHERE nre = ?', (nre,))
            result = cursor.fetchone()
            
            if result:
                columns = [description[0] for description in cursor.description]
                conn.close()
                return dict(zip(columns, result))
            
            conn.close()
            return None
            
        except Exception as e:
            self.logger.error(f"Errore recupero ricetta per NRE {nre}: {e}")
            raise DatabaseError(f"Impossibile recuperare ricetta: {e}")
    
    def get_ricette_by_paziente(self, cf_assistito: str) -> List[Dict[str, Any]]:
        """
        Recupera tutte le ricette di un paziente.
        Replica esatta di V1.
        
        Args:
            cf_assistito: Codice fiscale paziente
            
        Returns:
            Lista ricette del paziente
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM ricette_elettroniche 
                WHERE cf_assistito = ? 
                ORDER BY data_compilazione DESC
            ''', (cf_assistito,))
            
            results = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            conn.close()
            
            return [dict(zip(columns, row)) for row in results]
            
        except Exception as e:
            self.logger.error(f"Errore recupero ricette paziente {cf_assistito}: {e}")
            raise DatabaseError(f"Impossibile recuperare ricette paziente: {e}")
    
    def get_all_ricette(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Recupera tutte le ricette (ultime prima).
        Replica esatta di V1.
        
        Args:
            limit: Numero massimo ricette da recuperare
            
        Returns:
            Lista di tutte le ricette
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM ricette_elettroniche 
                ORDER BY data_compilazione DESC
                LIMIT ?
            ''', (limit,))
            
            results = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            conn.close()
            
            return [dict(zip(columns, row)) for row in results]
            
        except Exception as e:
            self.logger.error(f"Errore recupero tutte le ricette: {e}")
            raise DatabaseError(f"Impossibile recuperare ricette: {e}")
    
    def update_ricetta_stato(self, nre: str, nuovo_stato: str, motivo: str = None) -> bool:
        """
        Aggiorna lo stato di una ricetta nel database locale (solo per storico).
        Da usare dopo aver annullato sul Sistema TS.
        
        Args:
            nre: Numero Ricetta Elettronica
            nuovo_stato: Nuovo stato ('annullata', 'erogata', ecc.)
            motivo: Motivo del cambio stato (opzionale)
            
        Returns:
            True se aggiornata con successo
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            if nuovo_stato == 'annullata':
                cursor.execute('''
                    UPDATE ricette_elettroniche 
                    SET stato = ?, 
                        data_annullamento = CURRENT_TIMESTAMP,
                        motivo_annullamento = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE nre = ?
                ''', (nuovo_stato, motivo, nre))
            else:
                cursor.execute('''
                    UPDATE ricette_elettroniche 
                    SET stato = ?, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE nre = ?
                ''', (nuovo_stato, nre))
            
            conn.commit()
            success = cursor.rowcount > 0
            conn.close()
            
            if success:
                self.logger.info(f"Ricetta {nre} aggiornata a stato '{nuovo_stato}': {motivo or 'nessun motivo'}")
            else:
                self.logger.warning(f"Ricetta {nre} non trovata per aggiornamento stato")
            
            return success
            
        except Exception as e:
            self.logger.error(f"Errore aggiornamento stato ricetta {nre}: {e}")
            raise DatabaseError(f"Impossibile aggiornare stato ricetta: {e}")


# Istanza globale del servizio
ricette_db_service = RicetteDbService()