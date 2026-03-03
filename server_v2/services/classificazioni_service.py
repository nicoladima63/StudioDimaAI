"""Classificazioni Service stub for StudioDimaAI Server V2."""
import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from .base_service import BaseService
from core.exceptions import ValidationError, DatabaseError
from core.config import Config

class ClassificazioniService(BaseService):
    def __init__(self, database_manager=None):
        self.db_path = os.path.join(os.path.dirname(__file__), '..', 'instance', 'studio_dima.db')
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
                    contoid INTEGER,
                    brancaid INTEGER,
                    sottocontoid INTEGER,
                    data_classificazione DATETIME DEFAULT CURRENT_TIMESTAMP,
                    data_modifica DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(codice_riferimento, tipo_entita)
                )
            ''')



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

    
    def learn_classification(self, text, contoid, brancaid=0, sottocontoid=0, confidence=1.0, learned_by=None):
        return {'success': True, 'learned': True}
    
    def classifica_fornitore(self, codice_fornitore: str, tipo_di_costo: int, categoria: int = None, note: str = None) -> bool:
        """
        Classifica un fornitore con il tipo di costo (legacy)
        
        Args:
            codice_fornitore: ID del fornitore
            tipo_di_costo: Tipo di costo (1=diretto, 2=indiretto, 3=non_deducibile)
            categoria: Categoria (opzionale)
            note: Note (opzionali)
            
        Returns:
            True se la classificazione è avvenuta con successo
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO classificazioni_costi 
                    (codice_riferimento, tipo_entita, tipo_di_costo, data_modifica)
                    VALUES (?, 'fornitore', ?, CURRENT_TIMESTAMP)
                ''', (codice_fornitore, tipo_di_costo))
                return True
        except Exception as e:
            print(f"Errore nella classificazione fornitore: {e}")
            return False
    
    def classifica_fornitore_completo(self, codice_fornitore: str, contoid: int, brancaid: int = 0,
                                    sottocontoid: int = 0, tipo_di_costo: int = 1, note: str = None, fornitore_nome: str = None) -> bool:
        """
        Classifica un fornitore con gerarchia completa conto->branca->sottoconto

        Args:
            codice_fornitore: ID del fornitore
            contoid: ID del conto
            brancaid: ID della branca (0 se non specificato)
            sottocontoid: ID del sottoconto (0 se non specificato)
            tipo_di_costo: Tipo di costo (1=diretto, 2=indiretto, 3=non_deducibile)
            note: Note (opzionali)
            fornitore_nome: Nome del fornitore (opzionale)

        Returns:
            True se la classificazione è avvenuta con successo
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO classificazioni_costi
                    (codice_riferimento, tipo_entita, tipo_di_costo, contoid, brancaid, sottocontoid, data_modifica, fornitore_nome)
                    VALUES (?, 'fornitore', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                ''', (codice_fornitore, tipo_di_costo, contoid, brancaid, sottocontoid, fornitore_nome))
                return True
        except Exception as e:
            print(f"Errore nella classificazione completa fornitore: {e}")
            return False
    
    def get_classificazione_fornitore(self, codice_fornitore: str) -> Optional[Dict[str, Any]]:
        """
        Ottiene la classificazione di un fornitore
        
        Args:
            codice_fornitore: ID del fornitore
            
        Returns:
            Dizionario con la classificazione del fornitore o None
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute('''
                    SELECT * FROM classificazioni_costi 
                    WHERE codice_riferimento = ? AND tipo_entita = 'fornitore'
                ''', (codice_fornitore,))
                
                row = cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            print(f"Errore nel recupero classificazione fornitore: {e}")
            return None
    
    def rimuovi_classificazione_fornitore(self, codice_fornitore: str) -> bool:
        """
        Rimuove la classificazione di un fornitore
        
        Args:
            codice_fornitore: ID del fornitore
            
        Returns:
            True se la rimozione è avvenuta con successo
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('''
                    DELETE FROM classificazioni_costi 
                    WHERE codice_riferimento = ? AND tipo_entita = 'fornitore'
                ''', (codice_fornitore,))
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Errore nella rimozione classificazione fornitore: {e}")
            return False

    def get_fornitori_by_conto(self, contoid: int) -> List[str]:
        """
        Wrapper to maintain backward compatibility.
        """
        return self.get_supplier_ids_by_classification(contoid)

    def get_supplier_ids_by_classification(self, contoid: int = None, brancaid: int = None, sottocontoid: int = None) -> List[str]:
        """
        Ottiene la lista dei codici fornitore filtrati per classificazione gerarchica.
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                query = "SELECT codice_riferimento FROM classificazioni_costi WHERE tipo_entita = 'fornitore'"
                params = []
                
                if contoid:
                    query += " AND contoid = ?"
                    params.append(contoid)
                
                if brancaid:
                    query += " AND brancaid = ?"
                    params.append(brancaid)
                    
                if sottocontoid:
                    query += " AND sottocontoid = ?"
                    params.append(sottocontoid)
                
                cursor = conn.execute(query, tuple(params))
                return [str(row[0]).strip() for row in cursor.fetchall()]
        except Exception as e:
            print(f"Errore nel recupero fornitori per classificazione: {e}")
            return []