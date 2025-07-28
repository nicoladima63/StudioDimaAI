import sqlite3
import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Path del database nella cartella instance
INSTANCE_DIR = os.path.join(os.path.dirname(__file__), '../../instance')
DB_PATH = os.path.join(INSTANCE_DIR, 'protocolli.db')

def init_protocolli_db():
    """Inizializza il database dei protocolli terapeutici"""
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabella diagnosi
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS diagnosi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codice TEXT NOT NULL,
            descrizione TEXT NOT NULL,
            categoria TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabella farmaci
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS farmaci (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            principio_attivo TEXT NOT NULL,
            posologia_standard TEXT,
            nomi_commerciali TEXT,
            indicazioni TEXT,
            categoria TEXT,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabella posologie
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS posologie (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descrizione TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabella durate
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS durate (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descrizione TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabella note terapeutiche
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS note_terapeutiche (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            testo TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabella centrale protocolli terapeutici
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS protocolli_terapeutici (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            diagnosiId INTEGER NOT NULL,
            farmacoId INTEGER NOT NULL,
            posologiaId INTEGER,
            durataId INTEGER,
            noteId INTEGER,
            ordine INTEGER DEFAULT 0,
            attivo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (diagnosiId) REFERENCES diagnosi (id) ON DELETE CASCADE,
            FOREIGN KEY (farmacoId) REFERENCES farmaci (id) ON DELETE CASCADE,
            FOREIGN KEY (posologiaId) REFERENCES posologie (id) ON DELETE SET NULL,
            FOREIGN KEY (durataId) REFERENCES durate (id) ON DELETE SET NULL,
            FOREIGN KEY (noteId) REFERENCES note_terapeutiche (id) ON DELETE SET NULL
        )
    ''')
    
    # Indici per performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_protocolli_diagnosi ON protocolli_terapeutici(diagnosiId)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_protocolli_farmaco ON protocolli_terapeutici(farmacoId)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_protocolli_attivo ON protocolli_terapeutici(attivo)')
    
    conn.commit()
    conn.close()

def load_initial_data():
    """Carica dati dai file txt nella nuova struttura"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Carica diagnosi da diagnosi.txt
        diagnosi_path = os.path.join(os.path.dirname(__file__), '../../../diagnosi.txt')
        if os.path.exists(diagnosi_path):
            with open(diagnosi_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            diagnosi_count = 0
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Parsing: "K00.0 Anodontia congenita"
                parts = line.split(' ', 1)
                if len(parts) >= 2:
                    codice = parts[0]
                    descrizione = parts[1]
                    
                    # Determina categoria base dal codice
                    categoria = "Generale"
                    if codice.startswith("K00"):
                        categoria = "Anomalie sviluppo"
                    elif codice.startswith("K01"):
                        categoria = "Denti inclusi"
                    elif codice.startswith("K02"):
                        categoria = "Carie"
                    elif codice.startswith("K03"):
                        categoria = "Alterazioni tessuti"
                    elif codice.startswith("K04"):
                        categoria = "Endodonzia"
                    elif codice.startswith("K05"):
                        categoria = "Parodontologia"
                    elif codice.startswith("K08"):
                        categoria = "Edentulia"
                    
                    cursor.execute('''
                        INSERT INTO diagnosi (codice, descrizione, categoria)
                        VALUES (?, ?, ?)
                    ''', (codice, descrizione, categoria))
                    diagnosi_count += 1
            
            logger.info(f"Caricate {diagnosi_count} diagnosi")
        else:
            logger.warning(f"File diagnosi non trovato: {diagnosi_path}")
        
        # Carica farmaci da farmaci.txt
        farmaci_path = os.path.join(os.path.dirname(__file__), '../../../farmaci.txt')
        if os.path.exists(farmaci_path):
            with open(farmaci_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            farmaci_count = 0
            for i, line in enumerate(lines[1:], 1):  # Salta header
                line = line.strip()
                if not line:
                    continue
                
                # Parsing: "Farmaco\tPosologia adulti\tNome/i commerciali\tIndicazione"
                parts = line.split('\t')
                if len(parts) >= 4:
                    principio_attivo = parts[0].strip()
                    posologia_standard = parts[1].strip()
                    nomi_commerciali = parts[2].strip()
                    indicazioni = parts[3].strip()
                    
                    # Determina categoria dal principio attivo
                    categoria = "Generale"
                    if any(x in principio_attivo.lower() for x in ['amoxicillina', 'clindamicina', 'claritromicina', 'azitromicina', 'cefalexina', 'metronidazolo']):
                        categoria = "Antibiotici"
                    elif any(x in principio_attivo.lower() for x in ['ibuprofene', 'paracetamolo', 'idrocodone']):
                        categoria = "Antidolorifici"
                    elif any(x in principio_attivo.lower() for x in ['clorexidina', 'triamcinolone', 'benzidamina', 'aciclovir', 'fluconazolo', 'nistatina']):
                        categoria = "Topici"
                    
                    cursor.execute('''
                        INSERT INTO farmaci 
                        (principio_attivo, posologia_standard, nomi_commerciali, indicazioni, categoria)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (principio_attivo, posologia_standard, nomi_commerciali, indicazioni, categoria))
                    farmaci_count += 1
            
            logger.info(f"Caricati {farmaci_count} farmaci")
        else:
            logger.warning(f"File farmaci non trovato: {farmaci_path}")
        
        conn.commit()
        logger.info("Dati caricati dai file txt nella nuova struttura database")
        
    except Exception as e:
        logger.error(f"Errore caricamento dati: {e}", exc_info=True)
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()

class ProtocolliDB:
    """Classe per gestire operazioni sul database protocolli"""
    
    @staticmethod
    def get_all_diagnosi() -> List[Dict[str, Any]]:
        """Recupera tutte le diagnosi"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT d.id, d.codice, d.descrizione, d.categoria,
                   COUNT(pt.id) as num_protocolli
            FROM diagnosi d
            LEFT JOIN protocolli_terapeutici pt ON d.id = pt.diagnosiId AND pt.attivo = 1
            GROUP BY d.id, d.codice, d.descrizione, d.categoria
            ORDER BY d.categoria, d.codice
        ''')
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'id': row[0],
                'codice': row[1], 
                'descrizione': row[2],
                'categoria': row[3],
                'num_protocolli': row[4]
            }
            for row in results
        ]
    
    @staticmethod
    def get_protocolli_per_diagnosi(diagnosi_id: int) -> List[Dict[str, Any]]:
        """Recupera protocolli terapeutici per una diagnosi"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT pt.id, pt.farmacoId, f.principio_attivo, f.nomi_commerciali, 
                       f.categoria, f.indicazioni, f.posologia_standard,
                       p.nome as posologia_custom, d.nome as durata_custom, 
                       nt.testo as note_custom, pt.ordine
                FROM protocolli_terapeutici pt
                JOIN farmaci f ON pt.farmacoId = f.id
                LEFT JOIN posologie p ON pt.posologiaId = p.id
                LEFT JOIN durate d ON pt.durataId = d.id
                LEFT JOIN note_terapeutiche nt ON pt.noteId = nt.id
                WHERE pt.diagnosiId = ? AND pt.attivo = 1
                ORDER BY pt.ordine, f.principio_attivo
            ''', (diagnosi_id,))
            
            results = cursor.fetchall()
            
            return [
                {
                    'protocollo_id': row[0],
                    'farmaco_id': row[1],
                    'principio_attivo': row[2],
                    'nomi_commerciali': row[3],
                    'categoria': row[4],
                    'indicazioni': row[5],
                    'posologia_standard': row[6],
                    'posologia_custom': row[7],
                    'durata_custom': row[8],
                    'note_custom': row[9],
                    'ordine': row[10]
                }
                for row in results
            ]
        except Exception as e:
            logger.error(f"Errore nel recupero protocolli per diagnosi {diagnosi_id}: {e}", exc_info=True)
            return []
        finally:
            conn.close()
    
    @staticmethod
    def get_all_farmaci(categoria: str = None) -> List[Dict[str, Any]]:
        """Recupera tutti i farmaci disponibili, opzionalmente filtrati per categoria"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if categoria:
            cursor.execute('''
                SELECT id, principio_attivo, posologia_standard, nomi_commerciali, 
                       indicazioni, categoria, note
                FROM farmaci
                WHERE categoria = ?
                ORDER BY principio_attivo
            ''', (categoria,))
        else:
            cursor.execute('''
                SELECT id, principio_attivo, posologia_standard, nomi_commerciali, 
                       indicazioni, categoria, note
                FROM farmaci
                ORDER BY categoria, principio_attivo
            ''')
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'id': row[0],
                'principio_attivo': row[1],
                'posologia_standard': row[2],
                'nomi_commerciali': row[3],
                'indicazioni': row[4],
                'categoria': row[5],
                'note': row[6]
            }
            for row in results
        ]
    
    @staticmethod
    def get_categorie_farmaci() -> List[str]:
        """Recupera tutte le categorie di farmaci"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT DISTINCT categoria FROM farmaci WHERE categoria IS NOT NULL ORDER BY categoria')
        results = cursor.fetchall()
        conn.close()
        
        return [row[0] for row in results]
    
    @staticmethod
    def create_diagnosi(codice: str, descrizione: str, categoria: str = None) -> int:
        """Crea una nuova diagnosi"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO diagnosi (codice, descrizione, categoria)
                VALUES (?, ?, ?)
            ''', (codice, descrizione, categoria))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None
        finally:
            conn.close()
    
    @staticmethod
    def update_diagnosi(id: int, codice: str, descrizione: str, categoria: str = None) -> bool:
        """Aggiorna una diagnosi esistente"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE diagnosi 
                SET codice = ?, descrizione = ?, categoria = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (codice, descrizione, categoria, id))
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            return False
        finally:
            conn.close()
    
    @staticmethod
    def duplicate_diagnosi(source_id: str, new_id: str, new_codice: str, new_descrizione: str) -> bool:
        """Duplica una diagnosi con tutte le sue associazioni"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            # Crea nuova diagnosi
            cursor.execute('''
                INSERT INTO diagnosi (id, codice, descrizione)
                VALUES (?, ?, ?)
            ''', (new_id, new_codice, new_descrizione))
            
            # Copia tutte le associazioni farmaci
            cursor.execute('''
                INSERT INTO diagnosi_farmaci (diagnosi_id, farmaco_codice, posologia, durata, note, ordine)
                SELECT ?, farmaco_codice, posologia, durata, note, ordine
                FROM diagnosi_farmaci
                WHERE diagnosi_id = ?
            ''', (new_id, source_id))
            
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            conn.rollback()
            return False
        finally:
            conn.close()
    
    @staticmethod
    def delete_diagnosi(id: str) -> bool:
        """Elimina una diagnosi e tutte le sue associazioni"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            # Elimina prima le associazioni
            cursor.execute('DELETE FROM diagnosi_farmaci WHERE diagnosi_id = ?', (id,))
            # Poi la diagnosi
            cursor.execute('DELETE FROM diagnosi WHERE id = ?', (id,))
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            return False
        finally:
            conn.close()
    
    @staticmethod
    def add_farmaco_to_diagnosi(diagnosi_id: str, farmaco_codice: str, posologia: str, durata: str, note: str = '') -> bool:
        """Aggiunge un farmaco a una diagnosi"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO diagnosi_farmaci (diagnosi_id, farmaco_codice, posologia, durata, note)
                VALUES (?, ?, ?, ?, ?)
            ''', (diagnosi_id, farmaco_codice, posologia, durata, note))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()
    
    @staticmethod
    def update_farmaco_associazione(associazione_id: int, posologia: str, durata: str, note: str = '') -> bool:
        """Aggiorna un'associazione farmaco esistente"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE diagnosi_farmaci 
                SET posologia = ?, durata = ?, note = ?
                WHERE id = ?
            ''', (posologia, durata, note, associazione_id))
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            return False
        finally:
            conn.close()
    
    @staticmethod
    def delete_farmaco_associazione(associazione_id: int) -> bool:
        """Rimuove un'associazione farmaco"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute('DELETE FROM diagnosi_farmaci WHERE id = ?', (associazione_id,))
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            return False
        finally:
            conn.close()
    
    # Nuovi metodi per protocolli terapeutici
    @staticmethod
    def create_protocollo(diagnosiId: int, farmacoId: int, posologia_custom: str = None, 
                         durata_custom: str = None, note_custom: str = None, ordine: int = 0) -> int:
        """Crea un nuovo protocollo terapeutico"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            # Inserisci posologia custom se specificata
            posologia_id = None
            if posologia_custom:
                cursor.execute('INSERT OR IGNORE INTO posologie (nome) VALUES (?)', (posologia_custom,))
                cursor.execute('SELECT id FROM posologie WHERE nome = ?', (posologia_custom,))
                posologia_id = cursor.fetchone()[0]
            
            # Inserisci durata custom se specificata
            durata_id = None
            if durata_custom:
                cursor.execute('INSERT OR IGNORE INTO durate (nome) VALUES (?)', (durata_custom,))
                cursor.execute('SELECT id FROM durate WHERE nome = ?', (durata_custom,))
                durata_id = cursor.fetchone()[0]
            
            # Inserisci note custom se specificata
            note_id = None
            if note_custom:
                cursor.execute('INSERT OR IGNORE INTO note_terapeutiche (testo) VALUES (?)', (note_custom,))
                cursor.execute('SELECT id FROM note_terapeutiche WHERE testo = ?', (note_custom,))
                note_id = cursor.fetchone()[0]
            
            # Inserisci protocollo
            cursor.execute('''
                INSERT INTO protocolli_terapeutici 
                (diagnosiId, farmacoId, posologiaId, durataId, noteId, ordine)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (diagnosiId, farmacoId, posologia_id, durata_id, note_id, ordine))
            
            protocollo_id = cursor.lastrowid
            conn.commit()
            return protocollo_id
        except Exception:
            conn.rollback()
            return None
        finally:
            conn.close()
    
    @staticmethod
    def update_protocollo(protocollo_id: int, posologia_custom: str = None, 
                         durata_custom: str = None, note_custom: str = None, ordine: int = None) -> bool:
        """Aggiorna un protocollo terapeutico esistente"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            # Gestisci posologia custom
            posologia_id = None
            if posologia_custom:
                cursor.execute('INSERT OR IGNORE INTO posologie (nome) VALUES (?)', (posologia_custom,))
                cursor.execute('SELECT id FROM posologie WHERE nome = ?', (posologia_custom,))
                posologia_id = cursor.fetchone()[0]
            
            # Gestisci durata custom
            durata_id = None
            if durata_custom:
                cursor.execute('INSERT OR IGNORE INTO durate (nome) VALUES (?)', (durata_custom,))
                cursor.execute('SELECT id FROM durate WHERE nome = ?', (durata_custom,))
                durata_id = cursor.fetchone()[0]
            
            # Gestisci note custom
            note_id = None
            if note_custom:
                cursor.execute('INSERT OR IGNORE INTO note_terapeutiche (testo) VALUES (?)', (note_custom,))
                cursor.execute('SELECT id FROM note_terapeutiche WHERE testo = ?', (note_custom,))
                note_id = cursor.fetchone()[0]
            
            # Aggiorna protocollo
            update_fields = []
            update_values = []
            
            if posologia_id is not None:
                update_fields.append('posologiaId = ?')
                update_values.append(posologia_id)
            if durata_id is not None:
                update_fields.append('durataId = ?')
                update_values.append(durata_id)
            if note_id is not None:
                update_fields.append('noteId = ?')
                update_values.append(note_id)
            if ordine is not None:
                update_fields.append('ordine = ?')
                update_values.append(ordine)
            
            if update_fields:
                update_values.append(protocollo_id)
                cursor.execute(f'''
                    UPDATE protocolli_terapeutici 
                    SET {', '.join(update_fields)}
                    WHERE id = ?
                ''', update_values)
                conn.commit()
                return cursor.rowcount > 0
            
            return True
        except Exception:
            return False
        finally:
            conn.close()
    
    @staticmethod
    def delete_protocollo(protocollo_id: int) -> bool:
        """Elimina un protocollo terapeutico"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute('UPDATE protocolli_terapeutici SET attivo = 0 WHERE id = ?', (protocollo_id,))
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            return False
        finally:
            conn.close()
    
    @staticmethod
    def duplicate_diagnosi_with_protocolli(source_id: int, new_codice: str, new_descrizione: str, new_categoria: str = None) -> int:
        """Duplica una diagnosi con tutti i suoi protocolli"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            # Crea nuova diagnosi
            cursor.execute('''
                INSERT INTO diagnosi (codice, descrizione, categoria)
                VALUES (?, ?, ?)
            ''', (new_codice, new_descrizione, new_categoria))
            new_diagnosi_id = cursor.lastrowid
            
            # Copia tutti i protocolli
            cursor.execute('''
                INSERT INTO protocolli_terapeutici 
                (diagnosiId, farmacoId, posologiaId, durataId, noteId, ordine, attivo)
                SELECT ?, farmacoId, posologiaId, durataId, noteId, ordine, attivo
                FROM protocolli_terapeutici
                WHERE diagnosiId = ? AND attivo = 1
            ''', (new_diagnosi_id, source_id))
            
            conn.commit()
            return new_diagnosi_id
        except sqlite3.IntegrityError:
            conn.rollback()
            return None
        finally:
            conn.close()

# Inizializza il database all'import
if not os.path.exists(DB_PATH):
    init_protocolli_db()
    load_initial_data()
else:
    # Controlla se il database è vuoto e carica i dati
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM diagnosi')
    count = cursor.fetchone()[0]
    conn.close()
    
    if count == 0:
        logger.info("Database vuoto, caricamento dati iniziali...")
        load_initial_data()