import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from server.app.config.config import Config

class ClassificazioneCostiService:
    """Service per gestire le classificazioni dei costi nel database unificato studio_dima.db"""
    
    def __init__(self):
        self.db_path = os.path.join(Config.INSTANCE_FOLDER, 'studio_dima.db')
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
                
            # Migrazione: aggiungi sottoconto se non esiste
            try:
                conn.execute('ALTER TABLE classificazioni_costi ADD COLUMN sottoconto TEXT')
                conn.commit()
            except sqlite3.OperationalError:
                # La colonna esiste già, continua
                pass
                
            # Migrazione: aggiungi contoid, brancaid, sottocontoid per nuovo sistema gerarchico
            for column in ['contoid', 'brancaid', 'sottocontoid']:
                try:
                    conn.execute(f'ALTER TABLE classificazioni_costi ADD COLUMN {column} INTEGER')
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
                           sottoconto: Optional[str] = None, note: Optional[str] = None) -> bool:
        """
        Classifica un fornitore
        
        Args:
            codice_fornitore: Codice del fornitore (DB_CODE)
            tipo_di_costo: 1=diretto, 2=indiretto, 3=non_deducibile
            categoria: Categoria gestionale (opzionale)
            categoria_conto: Codice conto contabile (es: ZZZZZI per Collaboratori)
            sottoconto: Codice sottoconto (es: ZZZZUC per Jablonsky)
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
                    (codice_riferimento, tipo_entita, tipo_di_costo, categoria, categoria_conto, sottoconto, note, data_modifica)
                    VALUES (?, 'fornitore', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (codice_fornitore, tipo_di_costo, categoria, categoria_conto, sottoconto, note))
                conn.commit()
                return True
        except Exception as e:
            print(f"Errore nella classificazione fornitore {codice_fornitore}: {e}")
            return False
    
    def classifica_fornitore_completo(self, codice_fornitore: str, tipo_di_costo: int,
                                    contoid: int, brancaid: int, sottocontoid: int,
                                    note: Optional[str] = None) -> bool:
        """
        Classifica un fornitore con la gerarchia completa: conto -> branca -> sottoconto
        
        Args:
            codice_fornitore: Codice del fornitore (DB_CODE)
            tipo_di_costo: 1=diretto, 2=indiretto, 3=non_deducibile
            contoid: ID del conto dalla tabella conti
            brancaid: ID della branca dalla tabella branche
            sottocontoid: ID del sottoconto dalla tabella sottoconti
            note: Note aggiuntive (opzionale)
            
        Returns:
            True se l'operazione è riuscita
        """
        if tipo_di_costo not in [1, 2, 3]:
            raise ValueError("tipo_di_costo deve essere 1, 2 o 3")
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Per classificazioni parziali, salva brancaid=0 e sottocontoid=0 invece di None
                brancaid_value = brancaid if brancaid is not None else 0
                sottocontoid_value = sottocontoid if sottocontoid is not None else 0
                
                conn.execute('''
                    INSERT OR REPLACE INTO classificazioni_costi 
                    (codice_riferimento, tipo_entita, tipo_di_costo, contoid, brancaid, sottocontoid, note, data_modifica)
                    VALUES (?, 'fornitore', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (codice_fornitore, tipo_di_costo, contoid, brancaid_value, sottocontoid_value, note))
                conn.commit()
                return True
        except Exception as e:
            print(f"Errore nella classificazione completa fornitore {codice_fornitore}: {e}")
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
    
    def get_conti_contabili(self) -> List[Dict[str, Any]]:
        """
        Ottiene tutti i conti contabili dalla tabella CONTI.DBF
        
        Returns:
            Lista di conti con codice e descrizione
        """
        try:
            from dbfread import DBF
            import os
            
            dbf_path = os.path.join('server', 'windent', 'DATI', 'CONTI.DBF')
            if not os.path.exists(dbf_path):
                return []
                
            table = DBF(dbf_path, encoding='latin1')
            conti = []
            
            for record in table:
                if record.get('DB_CODE') and record.get('DB_CODESCR'):
                    conti.append({
                        'codice_conto': record.get('DB_CODE'),
                        'descrizione': record.get('DB_CODESCR'),
                        'tipo': record.get('DB_COTIPO', '')
                    })
            
            # Ordina per codice
            conti.sort(key=lambda x: x['codice_conto'])
            return conti
            
        except Exception as e:
            print(f"Errore nel recupero conti: {e}")
            return []
    
    def get_sottoconti_per_conto(self, codice_conto: str) -> List[Dict[str, Any]]:
        """
        Ottiene tutti i sottoconti per un conto specifico dalla tabella SOTTOCON.DBF
        
        Args:
            codice_conto: Codice del conto padre
            
        Returns:
            Lista di sottoconti per il conto specificato
        """
        try:
            from dbfread import DBF
            import os
            
            dbf_path = os.path.join('server', 'windent', 'DATI', 'SOTTOCON.DBF')
            if not os.path.exists(dbf_path):
                return []
                
            table = DBF(dbf_path, encoding='latin1')
            sottoconti = []
            
            for record in table:
                if (record.get('DB_SOCOCOD') == codice_conto and 
                    record.get('DB_CODE') and record.get('DB_SODESCR')):
                    sottoconti.append({
                        'codice_sottoconto': record.get('DB_CODE'),
                        'descrizione': record.get('DB_SODESCR'),
                        'conto_padre': record.get('DB_SOCOCOD')
                    })
            
            # Ordina per codice
            sottoconti.sort(key=lambda x: x['codice_sottoconto'])
            return sottoconti
            
        except Exception as e:
            print(f"Errore nel recupero sottoconti per {codice_conto}: {e}")
            return []
    
    def get_count_conti_sottoconti(self) -> Dict[str, int]:
        """
        Ottiene il conteggio di conti e sottoconti per il caching intelligente
        
        Returns:
            Dizionario con count di conti e sottoconti
        """
        try:
            from dbfread import DBF
            import os
            
            counts = {'conti': 0, 'sottoconti': 0}
            
            # Count conti
            conti_path = os.path.join('server', 'windent', 'DATI', 'CONTI.DBF')
            if os.path.exists(conti_path):
                table = DBF(conti_path, encoding='latin1')
                counts['conti'] = len([r for r in table if r.get('DB_CODE') and r.get('DB_CODESCR')])
            
            # Count sottoconti
            sottoconti_path = os.path.join('server', 'windent', 'DATI', 'SOTTOCON.DBF')
            if os.path.exists(sottoconti_path):
                table = DBF(sottoconti_path, encoding='latin1')
                counts['sottoconti'] = len([r for r in table if r.get('DB_CODE') and r.get('DB_SODESCR')])
            
            return counts
            
        except Exception as e:
            print(f"Errore nel conteggio conti/sottoconti: {e}")
            return {'conti': 0, 'sottoconti': 0}
    
    def analyze_fornitore_historical_patterns(self, fornitore_id: str) -> Dict[str, Any]:
        """
        Analizza i pattern storici delle spese per un fornitore per suggerire automaticamente una categoria
        
        PRIORITÀ:
        1. Classificazione completa fornitore (contoid+brancaid+sottocontoid) -> 95% confidence
        2. Pattern storici delle spese -> confidence variabile
        
        Args:
            fornitore_id: Codice del fornitore
            
        Returns:
            Dizionario con categoria suggerita, confidence e motivo
        """
        try:
            # PRIORITÀ MASSIMA: Controlla se il fornitore ha una classificazione completa o parziale
            with sqlite3.connect(self.db_path) as conn:
                # Prima controlla classificazione COMPLETA (confidence 95%)
                cursor = conn.execute('''
                    SELECT contoid, brancaid, sottocontoid, c.nome as conto_nome
                    FROM classificazioni_costi cc
                    LEFT JOIN conti c ON cc.contoid = c.id
                    WHERE cc.codice_riferimento = ? AND cc.tipo_entita = 'fornitore'
                      AND cc.contoid IS NOT NULL AND cc.brancaid IS NOT NULL AND cc.sottocontoid IS NOT NULL
                      AND cc.brancaid > 0 AND cc.sottocontoid > 0
                ''', (fornitore_id,))
                
                classificazione_completa = cursor.fetchone()
                
                if classificazione_completa:
                    contoid, brancaid, sottocontoid, conto_nome = classificazione_completa
                    return {
                        "categoria_suggerita": str(contoid),
                        "confidence": 0.95,
                        "motivo": f"Fornitore classificato completo: {conto_nome}",
                        "algoritmo": "fornitore_classificato_completo",
                        "contoid": contoid,
                        "brancaid": brancaid,
                        "sottocontoid": sottocontoid
                    }
                
                # Poi controlla classificazione PARZIALE (confidence 80%)
                cursor = conn.execute('''
                    SELECT contoid, brancaid, sottocontoid, c.nome as conto_nome
                    FROM classificazioni_costi cc
                    LEFT JOIN conti c ON cc.contoid = c.id
                    WHERE cc.codice_riferimento = ? AND cc.tipo_entita = 'fornitore'
                      AND cc.contoid IS NOT NULL 
                      AND (cc.brancaid = 0 OR cc.brancaid IS NULL) 
                      AND (cc.sottocontoid = 0 OR cc.sottocontoid IS NULL)
                ''', (fornitore_id,))
                
                classificazione_parziale = cursor.fetchone()
                
                if classificazione_parziale:
                    contoid, _, _, conto_nome = classificazione_parziale
                    return {
                        "categoria_suggerita": str(contoid),
                        "confidence": 0.80,
                        "motivo": f"Fornitore classificato parziale: {conto_nome} (solo conto)",
                        "algoritmo": "fornitore_classificato_parziale",
                        "contoid": contoid,
                        "brancaid": None,  # Indica classificazione parziale
                        "sottocontoid": None  # Indica classificazione parziale
                    }
            
            # FALLBACK: Pattern storici come prima
            from server.app.core.db_utils import get_dbf_path, estrai_dati
            from collections import Counter
            
            # Usa la funzione efficiente per leggere le spese
            spese_path = get_dbf_path('spese_fornitori')
            spese_data = estrai_dati(spese_path, 'spese_fornitori')
            
            if not spese_data:
                return {
                    "categoria_suggerita": None,
                    "confidence": 0.0,
                    "motivo": "Nessuna spesa storica trovata",
                    "algoritmo": "historical_analysis"
                }
            
            # Filtra per fornitore
            fornitore_spese = [spesa for spesa in spese_data if spesa.get('codice_fornitore') == fornitore_id]
            
            if not fornitore_spese:
                return {
                    "categoria_suggerita": None,
                    "confidence": 0.0,
                    "motivo": "Nessuna spesa trovata per questo fornitore",
                    "algoritmo": "historical_analysis"
                }
            
            # Analizza pattern dalle descrizioni delle spese esistenti
            descrizioni = [spesa.get('descrizione', '') for spesa in fornitore_spese if spesa.get('descrizione')]
            
            # Pattern matching basato su keywords
            pattern_categories = {
                'ZZZZZI': {  # Materiali Dentali
                    'keywords': ['dental', 'implant', 'materiali', 'protesi', 'dentsply', 'zimmer', 'straumann', 'nobel', 'bludental'],
                    'description': 'Materiali Dentali'
                },
                'ZZZZZU': {  # Energia/Utenze
                    'keywords': ['energia', 'elettrica', 'gas', 'enel', 'edison', 'bolletta', 'utenze', 'kwh', 'mc gas'],
                    'description': 'Energia e Utenze'
                },
                'ZZZZZN': {  # Telecomunicazioni
                    'keywords': ['telefono', 'internet', 'adsl', 'fibra', 'vodafone', 'tim', 'wind', 'fastweb', 'canone'],
                    'description': 'Telecomunicazioni'
                },
                'ZZZZXR': {  # Consulenze
                    'keywords': ['consulenza', 'honorari', 'parcella', 'commercialista', 'avvocato', 'consulente', 'prestazione'],
                    'description': 'Consulenze Professionali'
                },
                'ZZZZZK': {  # Farmaci
                    'keywords': ['farmacia', 'medicinali', 'farmaco', 'farmaceutico', 'medical devices'],
                    'description': 'Farmaci e Prodotti Farmaceutici'
                },
                'ZZZZXO': {  # Collaboratori Chirurgia
                    'keywords': ['chirurgia', 'chirurgico', 'intervento', 'operatorio'],
                    'description': 'Collaboratori Chirurgia'
                },
                'ZZZZXP': {  # Collaboratori Ortodonzia
                    'keywords': ['ortodonzia', 'ortodontico', 'apparecchio', 'brackets'],
                    'description': 'Collaboratori Ortodonzia'
                },
                'ZZZZYB': {  # Collaboratori Igienista
                    'keywords': ['igienista', 'pulizia', 'igiene', 'detartrasi'],
                    'description': 'Collaboratori Igienista'
                },
                'ZZZZYL': {  # Leasing
                    'keywords': ['leasing', 'locazione finanziaria', 'canone leasing', 'bnp paribas'],
                    'description': 'Leasing Finanziario'
                }
            }
            
            # Analizza tutte le descrizioni
            all_text = ' '.join(descrizioni).lower()
            
            # Calcola score per ogni categoria
            category_scores = {}
            for categoria, data in pattern_categories.items():
                score = 0
                matched_keywords = []
                
                for keyword in data['keywords']:
                    if keyword in all_text:
                        score += all_text.count(keyword)
                        matched_keywords.append(keyword)
                
                if score > 0:
                    category_scores[categoria] = {
                        'score': score,
                        'keywords': matched_keywords,
                        'description': data['description']
                    }
            
            if not category_scores:
                return {
                    "categoria_suggerita": None,
                    "confidence": 0.0,
                    "motivo": "Nessun pattern riconosciuto nelle descrizioni storiche",
                    "algoritmo": "historical_analysis"
                }
            
            # Trova categoria con score maggiore
            best_category = max(category_scores.items(), key=lambda x: x[1]['score'])
            categoria_id = best_category[0]
            categoria_data = best_category[1]
            
            # Calcola confidence basato su:
            # - Numero di spese analizzate
            # - Score delle keywords
            # - Frequenza pattern
            num_spese = len(fornitore_spese)
            confidence = min(0.95, (categoria_data['score'] / max(1, num_spese)) * 0.8 + 0.1)
            
            return {
                "categoria_suggerita": categoria_id,
                "confidence": round(confidence, 2),
                "motivo": f"Pattern identificato: {categoria_data['description']} (keywords: {', '.join(categoria_data['keywords'][:3])})",
                "algoritmo": "historical_analysis",
                "spese_analizzate": num_spese,
                "keywords_trovate": categoria_data['keywords']
            }
            
        except Exception as e:
            print(f"Errore nell'analisi pattern storici per {fornitore_id}: {e}")
            return {
                "categoria_suggerita": None,
                "confidence": 0.0,
                "motivo": f"Errore nell'analisi: {str(e)}",
                "algoritmo": "historical_analysis"
            }
    
    def get_fornitori_analytics(self) -> Dict[str, Any]:
        """
        Ottiene analytics sui fornitori per dashboard
        
        Returns:
            Statistiche complete sui fornitori
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                # Statistiche base
                stats = {}
                
                # Fornitori classificati per tipo
                cursor = conn.execute('''
                    SELECT tipo_di_costo, COUNT(*) as count 
                    FROM classificazioni_costi 
                    WHERE tipo_entita = 'fornitore' 
                    GROUP BY tipo_di_costo
                ''')
                
                tipo_labels = {1: 'Diretti', 2: 'Indiretti', 3: 'Non Deducibili'}
                stats['fornitori_per_tipo'] = {}
                for row in cursor.fetchall():
                    stats['fornitori_per_tipo'][tipo_labels[row['tipo_di_costo']]] = row['count']
                
                # Fornitori con categoria assegnata (solo nuovi dati con contoid)
                cursor = conn.execute('''
                    SELECT COUNT(*) as count 
                    FROM classificazioni_costi 
                    WHERE tipo_entita = 'fornitore' AND contoid IS NOT NULL
                ''')
                stats['fornitori_categorizzati'] = cursor.fetchone()['count']
                
                # Totale fornitori classificati
                cursor = conn.execute('''
                    SELECT COUNT(*) as count 
                    FROM classificazioni_costi 
                    WHERE tipo_entita = 'fornitore'
                ''')
                stats['totale_fornitori_classificati'] = cursor.fetchone()['count']
                
                # Top categorie utilizzate (con nomi leggibili dalla tabella conti)
                cursor = conn.execute('''
                    SELECT c.nome as categoria_nome, COUNT(*) as count 
                    FROM classificazioni_costi cc
                    JOIN conti c ON cc.contoid = c.id
                    WHERE cc.tipo_entita = 'fornitore' AND cc.contoid IS NOT NULL 
                    GROUP BY cc.contoid, c.nome 
                    ORDER BY count DESC 
                    LIMIT 10
                ''')
                stats['top_categorie'] = [dict(row) for row in cursor.fetchall()]
                
                return stats
                
        except Exception as e:
            print(f"Errore nel calcolo analytics fornitori: {e}")
            return {}
    
    def get_fornitori_non_categorizzati(self) -> List[Dict[str, Any]]:
        """
        Ottiene la lista dei fornitori che hanno classificazione ma nessuna categoria assegnata
        
        Returns:
            Lista fornitori senza categoria (con nomi leggibili)
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute('''
                    SELECT codice_riferimento, tipo_di_costo, data_classificazione, data_modifica
                    FROM classificazioni_costi 
                    WHERE tipo_entita = 'fornitore' 
                      AND (contoid IS NULL)
                    ORDER BY data_modifica DESC
                ''')
                
                fornitori_data = [dict(row) for row in cursor.fetchall()]
                
                # Arricchisci con nomi fornitori dall'API
                # Per ora restituisci solo i dati base, il nome sarà recuperato nel frontend
                return fornitori_data
                
        except Exception as e:
            print(f"Errore nel recupero fornitori non categorizzati: {e}")
            return []

    def update_fornitore_pattern_learning(self, fornitore_id: str, categoria_confermata: str) -> bool:
        """
        Aggiorna il sistema di learning quando un utente conferma/corregge una categorizzazione
        
        Args:
            fornitore_id: Codice del fornitore
            categoria_confermata: Categoria confermata dall'utente
            
        Returns:
            True se l'operazione è riuscita
        """
        try:
            # Per ora salva nella tabella di classificazione
            # In futuro si può espandere con una tabella dedicata al learning
            return self.classifica_fornitore(
                codice_fornitore=fornitore_id,
                tipo_di_costo=1,  # Default diretto
                categoria_conto=categoria_confermata,
                note="Auto-learning da conferma utente"
            )
        except Exception as e:
            print(f"Errore nell'aggiornamento pattern learning per {fornitore_id}: {e}")
            return False

    def auto_classify_spesa_sottoconto(self, descrizione: str, contoid: int, brancaid: int) -> Dict[str, Any]:
        """
        Auto-classifica una spesa per assegnare automaticamente il sottoconto
        basandosi sulla descrizione per fornitori STUDIO/SERVIZI MISTI
        
        Args:
            descrizione: Descrizione della spesa
            contoid: ID del conto (deve essere STUDIO)
            brancaid: ID della branca (deve essere SERVIZI MISTI)
            
        Returns:
            Dict con sottoconto suggerito e confidence
        """
        
        # Pattern per STUDIO/SERVIZI MISTI - sottoconti
        studio_patterns = {
            # GESTIONE CONTABILE
            'gestione_contabile': {
                'sottoconto_nome': 'GESTIONE CONTABILE',
                'keywords': [
                    'contabilità', 'contabile', 'tenuta contabilità',
                    'bilancio', 'dichiarazione', 'dichiarazioni fiscali', 'modello unico',
                    'iva', 'fiscale', 'imposte', 'f24', 'tributi', 'tasse',
                    'consulenza fiscale', 'consulenza contabile', 'parere fiscale'
                ],
                'confidence': 0.9
            },
            # GESTIONE DIPENDENTI  
            'gestione_dipendenti': {
                'sottoconto_nome': 'GESTIONE DIPENDENTI',
                'keywords': [
                    'buste paga', 'stipendi', 'elaborazione paghe', 'cedolini',
                    'contributi', 'inps', 'inail', 'previdenziali', 'contributivi',
                    'consulenza del lavoro', 'diritto del lavoro', 'rapporti di lavoro',
                    'tfr', 'liquidazione', 'fine rapporto', 'trattamento di fine rapporto',
                    'contratto', 'assunzione', 'dipendenti', 'personale', 'ccnl'
                ],
                'confidence': 0.95
            },
            # SPESE GENERALI
            'spese_generali': {
                'sottoconto_nome': 'SPESE GENERALI',
                'keywords': [
                    'affitto', 'sublocazione', 'locazione', 'canone', 'immobile',
                    'software', 'licenze', 'programma', 'gestionale', 'teamsystem',
                    'consulenza', 'esperto qualificato', 'sicurezza', 'privacy', 'gdpr',
                    'sicurezza sul lavoro', 'rspp', 'rls', 'documento valutazione rischi', 'dvr',
                    'commissioni', 'spese bancarie', 'conto corrente', 'bonifico',
                    'utenze', 'telefono', 'internet', 'energia elettrica', 'gas', 'acqua'
                ],
                'confidence': 0.8
            }
        }
        
        if not descrizione:
            return {
                'sottoconto_nome': 'SPESE GENERALI',
                'confidence': 0.3,
                'motivo': 'Nessuna descrizione disponibile - assegnato a spese generali',
                'algoritmo': 'studio_auto_classification'
            }
        
        descrizione_lower = descrizione.lower().strip()
        
        # Trova il pattern migliore
        best_match = None
        best_confidence = 0
        best_motivo = ""
        
        for pattern_key, pattern_data in studio_patterns.items():
            for keyword in pattern_data['keywords']:
                if keyword.lower() in descrizione_lower:
                    if pattern_data['confidence'] > best_confidence:
                        best_match = pattern_data
                        best_confidence = pattern_data['confidence']
                        best_motivo = f"Trovata keyword '{keyword}' nella descrizione"
                    break
        
        if best_match:
            return {
                'sottoconto_nome': best_match['sottoconto_nome'],
                'confidence': best_confidence,
                'motivo': best_motivo,
                'algoritmo': 'studio_auto_classification'
            }
        
        # Fallback euristico
        if any(word in descrizione_lower for word in ['paga', 'stipend', 'dipendent']):
            return {
                'sottoconto_nome': 'GESTIONE DIPENDENTI',
                'confidence': 0.6,
                'motivo': 'Analisi euristica: parole chiave relative ai dipendenti',
                'algoritmo': 'studio_auto_classification_fallback'
            }
        
        if any(word in descrizione_lower for word in ['contab', 'fiscal', 'dichiar']):
            return {
                'sottoconto_nome': 'GESTIONE CONTABILE',
                'confidence': 0.6,
                'motivo': 'Analisi euristica: parole chiave relative alla contabilità',
                'algoritmo': 'studio_auto_classification_fallback'
            }
        
        # Default
        return {
            'sottoconto_nome': 'SPESE GENERALI',
            'confidence': 0.4,
            'motivo': 'Nessun pattern riconosciuto - classificata come spesa generale',
            'algoritmo': 'studio_auto_classification_default'
        }

    def is_fornitore_utenze(self, nome_fornitore: str, codice_fornitore: str = None) -> Dict[str, Any]:
        """
        Determina se un fornitore è un fornitore di utenze (energia, acqua, gas, etc.)
        
        Args:
            nome_fornitore: Nome del fornitore
            codice_fornitore: Codice del fornitore (opzionale)
            
        Returns:
            Dict con informazioni su tipo utenza e classificazione suggerita
        """
        
        # Pattern per fornitori di utenze
        utenze_patterns = {
            'energia_elettrica': {
                'keywords': [
                    'enel energia', 'enel', 'edison energia', 'edison',
                    'eni plenitude', 'eni gas e luce', 'acea energia',
                    'a2a energia', 'hera comm', 'iren mercato',
                    'sorgenia', 'green network energy', 'wekiwi'
                ],
                'tipo_utenza': 'ENERGIA',
                'conto': 'UTENZE',
                'branca': 'ENERGIA',
                'sottoconto': 'BOLLETTA'
            },
            'gas_metano': {
                'keywords': [
                    'italgas', 'snam rete gas', 'eni gas',
                    'hera gas', 'iren gas', 'a2a gas',
                    'acea gas', 'edison gas'
                ],
                'tipo_utenza': 'GAS',
                'conto': 'UTENZE',
                'branca': 'GAS',
                'sottoconto': 'BOLLETTA'
            },
            'acqua_fognatura': {
                'keywords': [
                    'publiacqua', 'acea ato', 'hera acqua',
                    'cap holding', 'metropolitana milanese',
                    'gruppo hera', 'acque veronesi',
                    'azienda acqua', 'consorzio acqua'
                ],
                'tipo_utenza': 'ACQUA',
                'conto': 'UTENZE', 
                'branca': 'ACQUA',
                'sottoconto': 'BOLLETTA'
            },
            'telecomunicazioni': {
                'keywords': [
                    'wind tre', 'vodafone', 'tim ', 'telecom italia',
                    'fastweb', 'infostrada', 'tiscali',
                    'linkem', 'eolo', 'open fiber'
                ],
                'tipo_utenza': 'TELECOMUNICAZIONI',
                'conto': 'UTENZE',
                'branca': 'TELECOMUNICAZIONI', 
                'sottoconto': 'BOLLETTA'
            }
        }
        
        if not nome_fornitore:
            return {
                'is_utenza': False,
                'tipo_utenza': None,
                'confidence': 0.0
            }
        
        nome_lower = nome_fornitore.lower().strip()
        
        # Cerca pattern di utenze
        for categoria, pattern_data in utenze_patterns.items():
            for keyword in pattern_data['keywords']:
                if keyword.lower() in nome_lower:
                    return {
                        'is_utenza': True,
                        'tipo_utenza': pattern_data['tipo_utenza'],
                        'confidence': 0.95,
                        'classificazione_suggerita': {
                            'conto': pattern_data['conto'],
                            'branca': pattern_data['branca'], 
                            'sottoconto': pattern_data['sottoconto']
                        },
                        'motivo': f"Riconosciuto come fornitore {pattern_data['tipo_utenza'].lower()} tramite keyword '{keyword}'"
                    }
        
        return {
            'is_utenza': False,
            'tipo_utenza': None,
            'confidence': 0.0
        }

    def aggregate_utenze_spese(self, spese_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Aggrega le spese di utenze per fornitore/periodo nascondendo i dettagli
        
        Args:
            spese_list: Lista delle spese da processare
            
        Returns:
            Dict con spese aggregate e voci nascoste
        """
        
        spese_aggregate = []
        voci_nascoste = []
        spese_normali = []
        
        # Raggruppa per fornitore
        fornitori_utenze = {}
        
        for spesa in spese_list:
            nome_fornitore = spesa.get('nome_fornitore', '')
            codice_fornitore = spesa.get('codice_fornitore', '')
            
            # Verifica se è fornitore utenze
            utenza_info = self.is_fornitore_utenze(nome_fornitore, codice_fornitore)
            
            if utenza_info['is_utenza']:
                # Raggruppa per fornitore + mese
                data_documento = spesa.get('data_documento', '')
                periodo = data_documento[:7] if len(data_documento) >= 7 else 'sconosciuto'  # YYYY-MM
                
                gruppo_key = f"{codice_fornitore}_{periodo}"
                
                if gruppo_key not in fornitori_utenze:
                    fornitori_utenze[gruppo_key] = {
                        'fornitore_info': utenza_info,
                        'nome_fornitore': nome_fornitore,
                        'codice_fornitore': codice_fornitore,
                        'periodo': periodo,
                        'voci_originali': [],
                        'importo_totale': 0,
                        'count_voci': 0,
                        'prima_data': data_documento,
                        'numero_documento_base': spesa.get('numero_documento', '')
                    }
                
                fornitori_utenze[gruppo_key]['voci_originali'].append(spesa)
                fornitori_utenze[gruppo_key]['importo_totale'] += float(spesa.get('importo', 0) or 0)
                fornitori_utenze[gruppo_key]['count_voci'] += 1
                
                # Aggiungi alle voci nascoste
                voci_nascoste.append(spesa)
                
            else:
                # Spesa normale - passa attraverso
                spese_normali.append(spesa)
        
        # Crea voci aggregate
        for gruppo_key, gruppo_data in fornitori_utenze.items():
            tipo_utenza = gruppo_data['fornitore_info']['tipo_utenza']
            nome_fornitore = gruppo_data['nome_fornitore']
            periodo_readable = gruppo_data['periodo']
            
            # Crea descrizione aggregata
            if periodo_readable != 'sconosciuto':
                try:
                    from datetime import datetime
                    anno, mese = periodo_readable.split('-')
                    mese_nome = datetime(int(anno), int(mese), 1).strftime('%B %Y')
                    descrizione = f"Bolletta {tipo_utenza.title()} {nome_fornitore} - {mese_nome}"
                except:
                    descrizione = f"Bolletta {tipo_utenza.title()} {nome_fornitore} - {periodo_readable}"
            else:
                descrizione = f"Bolletta {tipo_utenza.title()} {nome_fornitore}"
            
            # Crea voce aggregata
            voce_aggregata = {
                'id': f"AGG_{gruppo_key}",
                'tipo': 'utenza_aggregata',
                'codice_fornitore': gruppo_data['codice_fornitore'],
                'nome_fornitore': nome_fornitore,
                'descrizione': descrizione,
                'importo': gruppo_data['importo_totale'],
                'data_documento': gruppo_data['prima_data'],
                'numero_documento': f"BOLLETTA-{gruppo_data['numero_documento_base']}",
                'count_voci_originali': gruppo_data['count_voci'],
                'voci_originali_ids': [v.get('id') for v in gruppo_data['voci_originali']],
                'classificazione_suggerita': gruppo_data['fornitore_info']['classificazione_suggerita'],
                'utenza_info': gruppo_data['fornitore_info'],
                'status': 'da_confermare',
                'azioni_disponibili': ['conferma_filtrati']
            }
            
            spese_aggregate.append(voce_aggregata)
        
        return {
            'spese_aggregate': spese_aggregate,
            'spese_normali': spese_normali,
            'voci_nascoste': voci_nascoste,
            'statistiche': {
                'totale_fornitori_utenze': len(fornitori_utenze),
                'totale_voci_nascoste': len(voci_nascoste),
                'totale_voci_aggregate': len(spese_aggregate),
                'totale_spese_normali': len(spese_normali)
            }
        }

# Istanza globale del service
classificazione_service = ClassificazioneCostiService()