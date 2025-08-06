"""
Service per gestione collaboratori con apprendimento automatico
Combina identificazione dinamica + conferma manuale utente
"""
import sqlite3
from typing import List, Dict, Optional
from .fatture_classifier import identify_collaboratori_dinamico
from dbfread import DBF
import os

class CollaboratoriService:
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Inizializza database con tabella collaboratori se non esiste"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS collaboratori (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    codice_fornitore VARCHAR(10) NOT NULL UNIQUE,
                    nome VARCHAR(255) NOT NULL,
                    tipo VARCHAR(50) NOT NULL,
                    attivo BOOLEAN DEFAULT TRUE,
                    confermato_da_utente BOOLEAN DEFAULT FALSE,
                    identificato_automaticamente BOOLEAN DEFAULT FALSE,
                    data_inserimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    data_ultima_modifica TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    note TEXT
                )
            """)
            
            # Inserisci collaboratori baseline se tabella vuota
            cursor = conn.execute("SELECT COUNT(*) FROM collaboratori")
            if cursor.fetchone()[0] == 0:
                baseline_collaboratori = [
                    ('ZZZZWB', 'Roberto Dott. Calvisi', 'Chirurgia', True, 'Collaboratore storico'),
                    ('ZZZZXP', 'Dr. Giacomo D\'Orlandi Odontoiatra', 'Ortodonzia', True, 'Collaboratore storico'),
                    ('ZZZZXJ', 'Armandi Lara', 'Igienista', True, 'Collaboratore storico - Dott.ssa'),
                    ('ZZZZUC', 'Jablonsky Anet', 'Igienista', True, 'Collaboratore storico - Dott.ssa'),
                    ('ZZZZRL', 'PISANTE ROSSELLA', 'Igienista', True, 'Collaboratore storico - Pesaro')
                ]
                
                for codice, nome, tipo, confermato, note in baseline_collaboratori:
                    conn.execute("""
                        INSERT OR IGNORE INTO collaboratori 
                        (codice_fornitore, nome, tipo, confermato_da_utente, note)
                        VALUES (?, ?, ?, ?, ?)
                    """, (codice, nome, tipo, confermato, note))
            
            conn.commit()
    
    def get_collaboratori_confermati(self) -> List[Dict]:
        """Restituisce collaboratori già confermati dall'utente"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT * FROM collaboratori 
                WHERE attivo = TRUE 
                ORDER BY tipo, nome
            """)
            
            return [dict(row) for row in cursor.fetchall()]
    
    def get_nuovi_candidati_automatici(self) -> List[Dict]:
        """Trova nuovi collaboratori candidati usando sistema dinamico"""
        try:
            # Percorsi tabelle DBF
            base_path = "server/windent/DATI"
            table_fornitori = DBF(os.path.join(base_path, "FORNITOR.DBF"), encoding='latin1')
            table_fatture = DBF(os.path.join(base_path, "FATTURE.DBF"), encoding='latin1')
            
            # Identifica candidati dinamici
            candidati_dinamici = identify_collaboratori_dinamico(table_fornitori, table_fatture)
            
            # Escludi quelli già confermati
            collaboratori_esistenti = set(
                c['codice_fornitore'] for c in self.get_collaboratori_confermati()
            )
            
            nuovi_candidati = []
            for candidato in candidati_dinamici:
                if candidato['code'] not in collaboratori_esistenti:
                    nuovi_candidati.append({
                        'codice_fornitore': candidato['code'],
                        'nome': candidato['nome'],
                        'score': candidato['score'],
                        'criteri': candidato['criteri'],
                        'is_nuovo_candidato': True,
                        'tipo': 'Da classificare'  # L'utente dovrà scegliere
                    })
            
            return nuovi_candidati
            
        except Exception as e:
            print(f"Errore identificazione automatica: {e}")
            return []
    
    def get_collaboratori_per_interfaccia(self) -> Dict:
        """
        Restituisce collaboratori per interfaccia select multi:
        - confermati (pre-selezionati)
        - nuovi candidati (pre-selezionati ma distinguibili)
        """
        confermati = self.get_collaboratori_confermati()
        nuovi_candidati = self.get_nuovi_candidati_automatici()
        
        # Formatta per interfaccia
        for c in confermati:
            c['pre_selezionato'] = True
            c['is_confermato'] = True
        
        for c in nuovi_candidati:
            c['pre_selezionato'] = True  # Pre-seleziona anche i nuovi
            c['is_confermato'] = False
        
        return {
            'collaboratori_confermati': confermati,
            'nuovi_candidati': nuovi_candidati,
            'tutti_collaboratori': confermati + nuovi_candidati,
            'totale_confermati': len(confermati),
            'totale_nuovi': len(nuovi_candidati)
        }
    
    def salva_selezione_utente(self, codici_selezionati: List[str], tipi_assegnati: Dict[str, str] = None) -> Dict:
        """
        Salva la selezione finale dell'utente:
        - Disattiva collaboratori deselezionati
        - Attiva/conferma collaboratori selezionati
        - Aggiunge nuovi collaboratori confermati
        """
        tipi_assegnati = tipi_assegnati or {}
        
        with sqlite3.connect(self.db_path) as conn:
            # 1. Disattiva tutti i collaboratori esistenti
            conn.execute("UPDATE collaboratori SET attivo = FALSE")
            
            # 2. Attiva solo quelli selezionati
            for codice in codici_selezionati:
                # Verifica se già esiste
                cursor = conn.execute(
                    "SELECT id FROM collaboratori WHERE codice_fornitore = ?", 
                    (codice,)
                )
                
                if cursor.fetchone():
                    # Aggiorna esistente
                    tipo = tipi_assegnati.get(codice, 'Da classificare')
                    conn.execute("""
                        UPDATE collaboratori 
                        SET attivo = TRUE, 
                            confermato_da_utente = TRUE,
                            tipo = ?,
                            data_ultima_modifica = CURRENT_TIMESTAMP
                        WHERE codice_fornitore = ?
                    """, (tipo, codice))
                else:
                    # Inserisci nuovo (da candidati automatici)
                    # Prendi dettagli da sistema dinamico
                    candidati = self.get_nuovi_candidati_automatici()
                    candidato = next((c for c in candidati if c['codice_fornitore'] == codice), None)
                    
                    if candidato:
                        tipo = tipi_assegnati.get(codice, 'Da classificare')
                        conn.execute("""
                            INSERT INTO collaboratori 
                            (codice_fornitore, nome, tipo, attivo, confermato_da_utente, identificato_automaticamente, note)
                            VALUES (?, ?, ?, TRUE, TRUE, TRUE, ?)
                        """, (
                            codice, 
                            candidato['nome'], 
                            tipo,
                            f"Score: {candidato['score']}, Criteri: {' + '.join(candidato['criteri'])}"
                        ))
            
            conn.commit()
        
        return {
            'successo': True,
            'collaboratori_salvati': len(codici_selezionati),
            'messaggio': f'Salvati {len(codici_selezionati)} collaboratori'
        }
    
    def get_statistiche_collaboratori(self) -> Dict:
        """Statistiche sui collaboratori per dashboard"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Conta per tipo
            cursor = conn.execute("""
                SELECT tipo, COUNT(*) as count 
                FROM collaboratori 
                WHERE attivo = TRUE 
                GROUP BY tipo
            """)
            per_tipo = dict(cursor.fetchall())
            
            # Totali
            cursor = conn.execute("SELECT COUNT(*) FROM collaboratori WHERE attivo = TRUE")
            totale_attivi = cursor.fetchone()[0]
            
            cursor = conn.execute("SELECT COUNT(*) FROM collaboratori WHERE confermato_da_utente = TRUE")
            totale_confermati = cursor.fetchone()[0]
            
            cursor = conn.execute("SELECT COUNT(*) FROM collaboratori WHERE identificato_automaticamente = TRUE")
            totale_automatici = cursor.fetchone()[0]
            
            return {
                'totale_attivi': totale_attivi,
                'totale_confermati': totale_confermati,
                'totale_automatici': totale_automatici,
                'per_tipo': per_tipo,
                'chirurgia': per_tipo.get('Chirurgia', 0),
                'ortodonzia': per_tipo.get('Ortodonzia', 0),
                'igienista': per_tipo.get('Igienista', 0)
            }


# Funzione di utilità per inizializzazione rapida
def init_collaboratori_service(db_path: str = "server/instance/studio_dima.db") -> CollaboratoriService:
    """Inizializza il service collaboratori con path database di default"""
    return CollaboratoriService(db_path)


if __name__ == "__main__":
    # Test del sistema
    print("=== TEST SISTEMA COLLABORATORI ===")
    
    service = init_collaboratori_service("test_collaboratori.db")
    
    print("1. Collaboratori confermati:")
    confermati = service.get_collaboratori_confermati()
    for c in confermati:
        print(f"  {c['codice_fornitore']}: {c['nome']} ({c['tipo']})")
    
    print(f"\n2. Nuovi candidati automatici:")
    nuovi = service.get_nuovi_candidati_automatici()
    for c in nuovi:
        print(f"  {c['codice_fornitore']}: {c['nome']} (score: {c['score']})")
    
    print(f"\n3. Statistiche:")
    stats = service.get_statistiche_collaboratori()
    print(f"  Totale attivi: {stats['totale_attivi']}")
    print(f"  Per tipo: {stats['per_tipo']}")