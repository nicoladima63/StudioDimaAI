import sqlite3
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

# Path del database nella cartella instance
INSTANCE_DIR = os.path.join(os.path.dirname(__file__), '../../instance')
DB_PATH = os.path.join(INSTANCE_DIR, 'ricette_elettroniche.db')

def init_ricette_db():
    """Inizializza il database delle ricette elettroniche"""
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabella ricette elettroniche completa (denormalizzata)
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
            request_payload TEXT,                       -- Payload originale inviato
            
            -- Timestamps
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Indici per performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nre ON ricette_elettroniche(nre)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cf_assistito ON ricette_elettroniche(cf_assistito)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cf_medico ON ricette_elettroniche(cf_medico)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_stato ON ricette_elettroniche(stato)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_data_compilazione ON ricette_elettroniche(data_compilazione)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_protocollo_transazione ON ricette_elettroniche(protocollo_transazione)')
    
    conn.commit()
    conn.close()

class RicetteDB:
    """Classe per gestire operazioni sul database ricette elettroniche"""
    
    @staticmethod
    def save_ricetta(ricetta_data: Dict[str, Any]) -> int:
        """Salva una ricetta elettronica nel database"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
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
                    ambiente, response_xml, request_payload
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                ricetta_data['nre'],
                ricetta_data['codice_pin'],
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
                ricetta_data['gruppo_equivalenza_farmaco'],
                ricetta_data['prodotto_aic'],
                ricetta_data['codice_farmaco'],
                ricetta_data.get('quantita', 1),
                ricetta_data['posologia'],
                ricetta_data['durata_trattamento'],
                ricetta_data.get('note'),
                ricetta_data.get('ambiente', 'test'),
                ricetta_data['response_xml'],
                ricetta_data.get('request_payload')
            ))
            
            ricetta_id = cursor.lastrowid
            conn.commit()
            return ricetta_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    @staticmethod
    def get_ricetta_by_nre(nre: str) -> Optional[Dict[str, Any]]:
        """Recupera una ricetta per NRE"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM ricette_elettroniche WHERE nre = ?', (nre,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, result))
        return None
    
    @staticmethod
    def get_ricette_by_paziente(cf_assistito: str) -> List[Dict[str, Any]]:
        """Recupera tutte le ricette di un paziente"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM ricette_elettroniche 
            WHERE cf_assistito = ? 
            ORDER BY data_compilazione DESC
        ''', (cf_assistito,))
        
        results = cursor.fetchall()
        conn.close()
        
        columns = [description[0] for description in cursor.description]
        return [dict(zip(columns, row)) for row in results]
    
    @staticmethod
    def annulla_ricetta(nre: str, motivo: str) -> bool:
        """Annulla una ricetta"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE ricette_elettroniche 
                SET stato = 'annullata', 
                    data_annullamento = CURRENT_TIMESTAMP,
                    motivo_annullamento = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE nre = ?
            ''', (motivo, nre))
            
            conn.commit()
            return cursor.rowcount > 0
            
        except Exception:
            conn.rollback()
            return False
        finally:
            conn.close()

# Inizializza il database all'import
if not os.path.exists(DB_PATH):
    init_ricette_db()