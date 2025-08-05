import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from server.app.config.config import Config

class ClassificazioneCostiService:
    """Service per gestire le classificazioni dei costi in database SQLite separato"""
    
    def __init__(self):
        self.db_path = os.path.join(Config.INSTANCE_FOLDER, 'classificazioni_costi.db')
        self._init_database()
    
    def _init_database(self):
        """Inizializza il database SQLite con la tabella classificazioni_costi"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS classificazioni_costi (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    codice_riferimento TEXT NOT NULL,
                    tipo_entita TEXT NOT NULL CHECK (tipo_entita IN ('fornitore', 'spesa')),
                    tipo_di_costo INTEGER NOT NULL CHECK (tipo_di_costo IN (1, 2, 3)),
                    categoria INTEGER,
                    categoria_conto TEXT,  -- Codice conto contabile (es: ZZZZZZ per Materiali Dentali)
                    note TEXT,
                    data_classificazione DATETIME DEFAULT CURRENT_TIMESTAMP,
                    data_modifica DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    UNIQUE(codice_riferimento, tipo_entita)
                )
            ''')
            
            # Migrazione: aggiungi categoria_conto se non esiste
            try:
                conn.execute('ALTER TABLE classificazioni_costi ADD COLUMN categoria_conto TEXT')
                conn.commit()
            except sqlite3.OperationalError:
                # La colonna esiste già, continua
                pass
            
            # Indici per performance
            conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_codice_tipo 
                ON classificazioni_costi(codice_riferimento, tipo_entita)
            ''')
            
            conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_tipo_costo 
                ON classificazioni_costi(tipo_di_costo)
            ''')
            
            conn.commit()
    
    def classifica_fornitore(self, codice_fornitore: str, tipo_di_costo: int, 
                           categoria: Optional[int] = None, categoria_conto: Optional[str] = None, 
                           note: Optional[str] = None) -> bool:
        """
        Classifica un fornitore
        
        Args:
            codice_fornitore: Codice del fornitore (DB_CODE)
            tipo_di_costo: 1=diretto, 2=indiretto, 3=non_deducibile
            categoria: Categoria gestionale (opzionale)
            categoria_conto: Codice conto contabile (es: ZZZZZZ per Materiali Dentali)
            note: Note aggiuntive (opzionale)
            
        Returns:
            True se l'operazione è riuscita
        """
        if tipo_di_costo not in [1, 2, 3]:
            raise ValueError("tipo_di_costo deve essere 1, 2 o 3")
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO classificazioni_costi 
                    (codice_riferimento, tipo_entita, tipo_di_costo, categoria, categoria_conto, note, data_modifica)
                    VALUES (?, 'fornitore', ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (codice_fornitore, tipo_di_costo, categoria, categoria_conto, note))
                conn.commit()
                return True
        except Exception as e:
            print(f"Errore nella classificazione fornitore {codice_fornitore}: {e}")
            return False
    
    def classifica_spesa(self, codice_spesa: str, tipo_di_costo: int,
                        categoria: Optional[int] = None, note: Optional[str] = None) -> bool:
        """
        Classifica una spesa (fallback se AI non funziona)
        
        Args:
            codice_spesa: ID della spesa
            tipo_di_costo: 1=diretto, 2=indiretto, 3=non_deducibile
            categoria: Categoria gestionale (opzionale)
            note: Note aggiuntive (opzionale)
            
        Returns:
            True se l'operazione è riuscita
        """
        if tipo_di_costo not in [1, 2, 3]:
            raise ValueError("tipo_di_costo deve essere 1, 2 o 3")
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO classificazioni_costi 
                    (codice_riferimento, tipo_entita, tipo_di_costo, categoria, note, data_modifica)
                    VALUES (?, 'spesa', ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (codice_spesa, tipo_di_costo, categoria, note))
                conn.commit()
                return True
        except Exception as e:
            print(f"Errore nella classificazione spesa {codice_spesa}: {e}")
            return False
    
    def get_classificazione_fornitore(self, codice_fornitore: str) -> Optional[Dict[str, Any]]:
        """
        Ottiene la classificazione di un fornitore
        
        Args:
            codice_fornitore: Codice del fornitore
            
        Returns:
            Dizionario con i dati della classificazione o None se non trovata
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute('''
                    SELECT * FROM classificazioni_costi 
                    WHERE codice_riferimento = ? AND tipo_entita = 'fornitore'
                ''', (codice_fornitore,))
                
                row = cursor.fetchone()
                if row:
                    return dict(row)
                return None
        except Exception as e:
            print(f"Errore nel recupero classificazione fornitore {codice_fornitore}: {e}")
            return None
    
    def get_classificazione_spesa(self, codice_spesa: str) -> Optional[Dict[str, Any]]:
        """
        Ottiene la classificazione di una spesa
        
        Args:
            codice_spesa: ID della spesa
            
        Returns:
            Dizionario con i dati della classificazione o None se non trovata
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute('''
                    SELECT * FROM classificazioni_costi 
                    WHERE codice_riferimento = ? AND tipo_entita = 'spesa'
                ''', (codice_spesa,))
                
                row = cursor.fetchone()
                if row:
                    return dict(row)
                return None
        except Exception as e:
            print(f"Errore nel recupero classificazione spesa {codice_spesa}: {e}")
            return None
    
    def get_fornitori_classificati(self) -> List[Dict[str, Any]]:
        """
        Ottiene tutti i fornitori classificati
        
        Returns:
            Lista di dizionari con le classificazioni dei fornitori
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute('''
                    SELECT * FROM classificazioni_costi 
                    WHERE tipo_entita = 'fornitore'
                    ORDER BY data_modifica DESC
                ''')
                
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            print(f"Errore nel recupero fornitori classificati: {e}")
            return []
    
    def get_spese_classificate(self) -> List[Dict[str, Any]]:
        """
        Ottiene tutte le spese classificate
        
        Returns:
            Lista di dizionari con le classificazioni delle spese
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute('''
                    SELECT * FROM classificazioni_costi 
                    WHERE tipo_entita = 'spesa'
                    ORDER BY data_modifica DESC
                ''')
                
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            print(f"Errore nel recupero spese classificate: {e}")
            return []
    
    def rimuovi_classificazione_fornitore(self, codice_fornitore: str) -> bool:
        """
        Rimuove la classificazione di un fornitore
        
        Args:
            codice_fornitore: Codice del fornitore
            
        Returns:
            True se l'operazione è riuscita
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('''
                    DELETE FROM classificazioni_costi 
                    WHERE codice_riferimento = ? AND tipo_entita = 'fornitore'
                ''', (codice_fornitore,))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Errore nella rimozione classificazione fornitore {codice_fornitore}: {e}")
            return False
    
    def rimuovi_classificazione_spesa(self, codice_spesa: str) -> bool:
        """
        Rimuove la classificazione di una spesa
        
        Args:
            codice_spesa: ID della spesa
            
        Returns:
            True se l'operazione è riuscita
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('''
                    DELETE FROM classificazioni_costi 
                    WHERE codice_riferimento = ? AND tipo_entita = 'spesa'
                ''', (codice_spesa,))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Errore nella rimozione classificazione spesa {codice_spesa}: {e}")
            return False
    
    def get_statistiche_classificazioni(self) -> Dict[str, Any]:
        """
        Ottiene statistiche sulle classificazioni
        
        Returns:
            Dizionario con le statistiche
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('''
                    SELECT 
                        tipo_entita,
                        tipo_di_costo,
                        COUNT(*) as count
                    FROM classificazioni_costi 
                    GROUP BY tipo_entita, tipo_di_costo
                    ORDER BY tipo_entita, tipo_di_costo
                ''')
                
                stats = {'fornitori': {}, 'spese': {}}
                tipo_labels = {1: 'diretti', 2: 'indiretti', 3: 'non_deducibili'}
                
                for row in cursor.fetchall():
                    tipo_entita, tipo_costo, count = row
                    if tipo_entita in stats:
                        stats[tipo_entita][tipo_labels[tipo_costo]] = count
                
                return stats
        except Exception as e:
            print(f"Errore nel calcolo statistiche: {e}")
            return {'fornitori': {}, 'spese': {}}

# Istanza globale del service
classificazione_service = ClassificazioneCostiService()