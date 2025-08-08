"""
Servizio per estrazione intelligence dal gestionale Windent
Analizza CONTI.DBF e VOCISPES.DBF per categorizzazione automatica spese
"""

import logging
from typing import Dict, List, Optional, Tuple
from dbfread import DBF
from server.app.core.db_utils import get_dbf_path
import re
from collections import Counter, defaultdict
from server.services.collaboratori_service import init_collaboratori_service

logger = logging.getLogger(__name__)

class GestionaleIntelligenceService:
    """Servizio per estrazione pattern di categorizzazione dal gestionale"""
    
    def __init__(self):
        self.conti_cache = None
        self.vocispes_patterns = None
        
    def clear_cache(self):
        """Pulisce la cache per ricaricare i pattern aggiornati"""
        self.conti_cache = None
        self.vocispes_patterns = None
        
    def integrate_xml_patterns(self, xml_patterns: Dict) -> Dict:
        """
        Integra i pattern estratti dalle fatture XML con quelli esistenti
        
        Args:
            xml_patterns: Pattern estratti dalle fatture XML
            
        Returns:
            Pattern integrati
        """
        try:
            # Ottieni pattern esistenti
            existing_patterns = self.extract_vocispes_patterns()
            
            # Integra con pattern XML
            integrated_patterns = existing_patterns.copy()
            
            xml_category_patterns = xml_patterns.get('pattern_per_categoria', {})
            
            for categoria, xml_data in xml_category_patterns.items():
                if categoria not in integrated_patterns:
                    integrated_patterns[categoria] = []
                
                # Aggiungi keywords XML
                xml_keywords = xml_data.get('keywords', [])
                for keyword in xml_keywords:
                    if keyword not in integrated_patterns[categoria]:
                        integrated_patterns[categoria].append(keyword)
                
                # Aggiungi denominazioni fornitori come pattern
                xml_denominazioni = xml_data.get('denominazioni', [])
                for denom in xml_denominazioni:
                    # Estrai parole chiave dalla denominazione
                    words = [w for w in denom.lower().split() if len(w) > 3]
                    for word in words:
                        if word not in integrated_patterns[categoria]:
                            integrated_patterns[categoria].append(word)
            
            # Aggiorna cache con pattern integrati
            self.vocispes_patterns = integrated_patterns
            
            logger.info(f"Pattern XML integrati: {len(xml_category_patterns)} categorie")
            return integrated_patterns
            
        except Exception as e:
            logger.error(f"Errore nell'integrazione pattern XML: {e}")
            return self.extract_vocispes_patterns()
        
    def get_piano_conti(self) -> Dict[str, Dict]:
        """
        Legge la tabella CONTI.DBF e restituisce il piano dei conti
        
        Returns:
            Dict con codice -> info categoria
        """
        if self.conti_cache is not None:
            return self.conti_cache
            
        try:
            path_conti = get_dbf_path('conti')
            conti = {}
            
            for record in DBF(path_conti, encoding='latin-1'):
                codice = str(record.get('DB_CODE', '')).strip()
                tipo = str(record.get('DB_COTIPO', '')).strip()
                descrizione = str(record.get('DB_CODESCR', '')).strip()
                
                # Pulisci descrizioni troncate
                if descrizione.startswith('ntali'):
                    descrizione = 'Materiali Dentali'
                elif descrizione.startswith('Stipendi dipendenti'):
                    descrizione = 'Stipendi dipendenti'
                elif len(descrizione) < 3:  # Descrizioni troppo corte
                    continue
                    
                if codice and descrizione and tipo == 'A':  # Solo conti Attivi (spese)
                    importo_totale = float(record.get('DB_COTOTAC', 0) or 0)
                    iva_totale = float(record.get('DB_COIVAAC', 0) or 0)
                    
                    conti[codice] = {
                        'codice': codice,
                        'descrizione': descrizione,
                        'tipo': tipo,
                        'importo_totale': importo_totale,
                        'iva_totale': iva_totale,
                        'peso': importo_totale  # Per priorità nell'algoritmo
                    }
            
            self.conti_cache = conti
            logger.info(f"Piano conti caricato: {len(conti)} categorie")
            return conti
            
        except Exception as e:
            logger.error(f"Errore lettura CONTI.DBF: {e}")
            return {}
    
    def extract_vocispes_patterns(self) -> Dict[str, List[str]]:
        """
        Analizza VOCISPES.DBF per estrarre pattern testuali per categoria
        
        Returns:
            Dict con categoria -> lista keywords/patterns
        """
        if self.vocispes_patterns is not None:
            return self.vocispes_patterns
            
        try:
            path_vocispes = get_dbf_path('vocispes')
            
            # Contatori per keywords per categoria
            patterns_by_category = defaultdict(list)
            keyword_frequency = defaultdict(Counter)
            
            # Mappa per associare descrizioni a categorie (basata su analisi manuale + esempi reali)
            category_keywords = {
                'Materiali Dentali': [
                    # Keywords esistenti
                    'punte', 'guanti', 'composito', 'resina', 'anestesia', 'fresa', 'diga',
                    # Nuovi pattern dai test
                    'punte verdi', 'gl001', 'aloe', 'confezione', '5pz', 'dental supply',
                    'mcal store', 'materiali', 'dispositivi', 'strumenti', 'chirurgici',
                    # Pattern codici prodotto
                    '671/204/060', 'gl001as', 'codici numerici con slash'
                ],
                'Laboratorio': [
                    'protesi', 'corona', 'ponte', 'impronta', 'gesso', 'ceramica', 'laboratorio',
                    # Nuovi pattern specifici
                    'gancio', 'aggiunta gancio', '17d0nnlc', 'laboratorio odonto', 'odontotecnico',
                    'lab', 'protesi mobile', 'protesi fissa', 'riparazione protesi'
                ],
                'Utenze': [
                    'energia', 'acqua', 'gas', 'utenze', 'enel', 'acquedotto', 'fognatura', 'oneri',
                    # Pattern più specifici
                    'energia elettrica', 'marzo', 'consumo', 'fattura energia', 'bolletta',
                    'ricalcolo', 'conguaglio', 'lettura contatore', 'kw', 'kwh'
                ],
                'Telecomunicazioni': [
                    # Nuova categoria specifica
                    'canone telefono', 'telefono fisso', 'tim', 'vodafone', 'wind', 'fastweb',
                    'telecom', 'adsl', 'fibra', 'internet', 'chiamate', 'traffico',
                    'canone mensile', 'abbonamento', 'ricarica'
                ],
                'Rifiuti speciali': ['rifiuti', 'smaltimento', 'speciali', 'sanitari'],
                'Farmacia': ['farmaci', 'medicinali', 'farmaceutici', 'antibiotici'],
                'Ortodonzia': ['ortodonzia', 'brackets', 'arco', 'attacchi', 'allineatori'],
                'Collaboratori': ['stipendi', 'collaboratori', 'dipendenti', 'buste paga'],
                'Assicurazioni': ['assicurazione', 'polizza', 'rcr', 'responsabilità civile'],
                'Studio': ['affitto', 'locazione', 'studio', 'ufficio'],
                'Autostrada': ['autostrada', 'pedaggio', 'telepedaggio', 'casello'],
                'Banca': ['banca', 'commissioni', 'bonifico', 'carta credito'],
                'Marche da bollo': ['bollo', 'marca', 'imposta'],
                'Varie': ['varie', 'diverse', 'altro']
            }
            
            # Leggi tutti i record VOCISPES
            record_count = 0
            for record in DBF(path_vocispes, encoding='latin-1'):
                descrizione = str(record.get('DB_VODESCR', '')).strip()
                if not descrizione or len(descrizione) < 3:
                    continue
                    
                record_count += 1
                if record_count % 5000 == 0:
                    logger.debug(f"Processati {record_count} record VOCISPES...")
                
                # Normalizza descrizione
                desc_lower = descrizione.lower()
                desc_clean = re.sub(r'[^\w\s]', ' ', desc_lower)
                words = [w for w in desc_clean.split() if len(w) > 2]
                
                # Associa a categoria basandosi su keywords
                for categoria, keywords in category_keywords.items():
                    for keyword in keywords:
                        if keyword in desc_lower:
                            patterns_by_category[categoria].append(descrizione)
                            # Conta frequency delle parole per questa categoria
                            for word in words:
                                keyword_frequency[categoria][word] += 1
                            break
            
            # Genera pattern finali con top keywords per categoria
            final_patterns = {}
            for categoria in category_keywords.keys():
                if categoria in keyword_frequency:
                    # Top 20 keywords più frequenti per categoria
                    top_keywords = [word for word, count in keyword_frequency[categoria].most_common(20)]
                    final_patterns[categoria] = top_keywords
                else:
                    # Fallback con keywords manuali
                    final_patterns[categoria] = category_keywords[categoria]
            
            self.vocispes_patterns = final_patterns
            logger.info(f"Pattern VOCISPES estratti per {len(final_patterns)} categorie")
            logger.debug(f"Processati {record_count} record totali")
            
            return final_patterns
            
        except Exception as e:
            logger.error(f"Errore lettura VOCISPES.DBF: {e}")
            return {}
    
    def categorize_spesa(self, descrizione: str, fornitore: str = "", codice_fornitore: str = "") -> dict:
        """
        Categorizza una spesa basandosi sui pattern del gestionale
        
        Args:
            descrizione: Descrizione della spesa
            fornitore: Nome fornitore (opzionale)
            codice_fornitore: Codice fornitore per controllo collaboratori (opzionale)
            
        Returns:
            Dict con categoria_nome, confidence, conto_suggerito, branca_suggerita, sottoconto_suggerito
        """
        if not descrizione:
            return {
                "categoria_nome": "Varie", 
                "confidence": 0.1,
                "conto_suggerito": None,
                "branca_suggerita": None, 
                "sottoconto_suggerito": None,
                "motivo": "Descrizione vuota"
            }
            
        # PRIORITA' 1: Controllo collaboratori (massima priorità)
        if codice_fornitore:
            try:
                collaboratori_service = init_collaboratori_service()
                collaboratori_attivi = collaboratori_service.get_collaboratori_confermati()
                
                # Verifica se il codice fornitore è di un collaboratore attivo
                for collab in collaboratori_attivi:
                    if collab['codice_fornitore'] == codice_fornitore:
                        # Mappa il collaboratore alla struttura conto->branca->sottoconto
                        conto_id, branca_id, sottoconto_id = self._map_collaboratore_to_struttura(collab)
                        return {
                            "categoria_nome": "Collaboratori",
                            "confidence": 1.0,
                            "conto_suggerito": conto_id,
                            "branca_suggerita": branca_id,
                            "sottoconto_suggerito": sottoconto_id,
                            "motivo": f"Collaboratore identificato - {collab.get('tipo', 'Generico')}"
                        }
                        
            except Exception as e:
                logger.warning(f"Errore controllo collaboratori: {e}")
            
        # Carica pattern se non ancora fatto
        patterns = self.extract_vocispes_patterns()
        conti = self.get_piano_conti()
        
        desc_lower = (descrizione + " " + fornitore).lower()
        desc_clean = re.sub(r'[^\w\s]', ' ', desc_lower)
        
        # Pattern specifici per riconoscimento avanzato
        def has_product_code_pattern(text: str) -> bool:
            """Riconosce pattern di codici prodotto dentali"""
            patterns = [
                r'\b\d{3}/\d{3}/\d{3}\b',  # 671/204/060
                r'\b[a-z]{2}\d{3}[a-z]{0,2}\b',  # gl001as
                r'\b\d{2}[a-z]\d[a-z]{2}[a-z]{2}-\b',  # 17d0nnlc-
            ]
            return any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns)
        
        def has_utility_pattern(text: str) -> bool:
            """Riconosce pattern di bollette utenze"""
            patterns = [
                r'energia elettrica.*\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b',
                r'ricalcolo.*acque?',
                r'canone.*fisso'
            ]
            return any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns)
        
        # Score per categoria
        category_scores = {}
        
        for categoria, keywords in patterns.items():
            score = 0.0
            matched_keywords = 0
            total_weight = 0
            
            for keyword in keywords:
                # Peso keyword: più lunghe = più specifiche = peso maggiore
                weight = max(1.0, len(keyword.split()) * 0.8)
                total_weight += weight
                
                if keyword in desc_lower:
                    # Match esatto: peso pieno
                    score += weight * 2.0
                    matched_keywords += weight
                elif any(kw in desc_lower for kw in keyword.split()):
                    # Match parziale: peso ridotto
                    score += weight * 0.8
                    matched_keywords += weight * 0.5
                    
                # Bonus per fornitori specifici
                if categoria == 'Materiali Dentali' and any(f in fornitore.lower() for f in ['dental', 'mcal']):
                    score += weight * 0.5
                elif categoria == 'Telecomunicazioni' and any(f in fornitore.lower() for f in ['tim', 'vodafone', 'wind']):
                    score += weight * 0.5
                elif categoria == 'Utenze' and any(f in fornitore.lower() for f in ['enel', 'acquedotto']):
                    score += weight * 0.5
                elif categoria == 'Laboratorio' and 'lab' in fornitore.lower():
                    score += weight * 0.5
            
            if matched_keywords > 0:
                # Normalizza score con peso totale
                confidence = min(score / (total_weight * 1.5), 1.0)
                
                # Bonus per pattern specifici
                if categoria == 'Materiali Dentali' and has_product_code_pattern(desc_lower):
                    confidence = min(confidence * 1.5, 1.0)
                elif categoria == 'Utenze' and has_utility_pattern(desc_lower):
                    confidence = min(confidence * 1.4, 1.0)
                elif categoria == 'Telecomunicazioni' and 'canone' in desc_lower:
                    confidence = min(confidence * 1.3, 1.0)
                
                # Bonus finale per match multipli
                if matched_keywords > total_weight * 0.3:
                    confidence = min(confidence * 1.2, 1.0)
                    
                category_scores[categoria] = confidence
        
        if not category_scores:
            conto_id, branca_id, sottoconto_id = self._map_categoria_to_struttura("Varie", descrizione, fornitore)
            return {
                "categoria_nome": "Varie",
                "confidence": 0.1,
                "conto_suggerito": conto_id,
                "branca_suggerita": branca_id,
                "sottoconto_suggerito": sottoconto_id,
                "motivo": "Nessun pattern riconosciuto"
            }
        
        # Trova categoria con score più alto
        best_category = max(category_scores.items(), key=lambda x: x[1])
        categoria_nome, confidence = best_category[0], best_category[1]
        
        # Mappa la categoria alla struttura conto->branca->sottoconto
        conto_id, branca_id, sottoconto_id = self._map_categoria_to_struttura(categoria_nome, descrizione, fornitore)
        
        return {
            "categoria_nome": categoria_nome,
            "confidence": confidence,
            "conto_suggerito": conto_id,
            "branca_suggerita": branca_id,
            "sottoconto_suggerito": sottoconto_id,
            "motivo": f"Pattern matching - {confidence*100:.1f}% confidenza"
        }
    
    def _map_categoria_to_struttura(self, categoria_nome: str, descrizione: str = "", fornitore: str = "") -> tuple:
        """
        Mappa una categoria ai dati della struttura conto->branca->sottoconto
        
        Returns:
            Tuple (conto_id, branca_id, sottoconto_id)
        """
        try:
            import sqlite3
            conn = sqlite3.connect('server/instance/studio_dima.db')
            cursor = conn.cursor()
            
            # Mapping delle categorie ai nomi conti nel database
            categoria_to_conto_mapping = {
                "Materiali Dentali": "Materiali",
                "Farmaci": "Farmaci", 
                "Laboratorio": "Laboratori",
                "Utenze": "Utenze",
                "Telecomunicazioni": "Telecomunicazioni",
                "Collaboratori": "Collaboratori",
                "Varie": "Varie"
            }
            
            conto_nome = categoria_to_conto_mapping.get(categoria_nome, "Varie")
            
            # Trova il conto nel database SQLite
            cursor.execute("SELECT id FROM conti WHERE nome LIKE ? LIMIT 1", (f"%{conto_nome}%",))
            conto_row = cursor.fetchone()
            if not conto_row:
                conn.close()
                return None, None, None
                
            conto_id = conto_row[0]
            
            # Logica più intelligente per mappare branca e sottoconto
            branca_id, sottoconto_id = self._map_categoria_specifica_to_branca_sottoconto(
                cursor, conto_id, categoria_nome, descrizione, fornitore
            )
            
            conn.close()
            return conto_id, branca_id, sottoconto_id
            
        except Exception as e:
            logger.error(f"Errore mapping categoria to struttura: {e}")
            return None, None, None
    
    def _map_collaboratore_to_struttura(self, collab: dict) -> tuple:
        """
        Gestisce il mapping specifico per i collaboratori
        """
        try:
            import sqlite3
            conn = sqlite3.connect('server/instance/studio_dima.db')
            cursor = conn.cursor()
            
            # Trova il conto "Collaboratori"
            cursor.execute("SELECT id FROM conti WHERE nome LIKE '%collaborator%' LIMIT 1")
            conto_row = cursor.fetchone()
            if not conto_row:
                conn.close()
                return None, None, None
                
            conto_id = conto_row[0]
            tipo_collaboratore = collab.get('tipo', 'Generici')
            
            # Trova la branca appropriata per il tipo di collaboratore
            cursor.execute("""
                SELECT id FROM branche 
                WHERE contoid = ? AND (nome LIKE ? OR nome LIKE '%generic%' OR nome LIKE '%general%')
                ORDER BY 
                    CASE 
                        WHEN nome LIKE ? THEN 1 
                        ELSE 2 
                    END
                LIMIT 1
            """, (conto_id, f"%{tipo_collaboratore}%", f"%{tipo_collaboratore}%"))
            branca_row = cursor.fetchone()
            branca_id = branca_row[0] if branca_row else None
            
            # Trova il sottoconto più appropriato
            cursor.execute("SELECT id FROM sottoconti ORDER BY nome LIMIT 1")
            sottoconto_row = cursor.fetchone()
            sottoconto_id = sottoconto_row[0] if sottoconto_row else None
            
            conn.close()
            return conto_id, branca_id, sottoconto_id
            
        except Exception as e:
            logger.error(f"Errore mapping collaboratori: {e}")
            return None, None, None
    
    def _map_categoria_specifica_to_branca_sottoconto(self, cursor, conto_id: int, categoria_nome: str, descrizione: str = "", fornitore: str = "") -> tuple:
        """
        Mappa in modo specifico una categoria a branca e sottoconto basandosi sulla descrizione
        """
        try:
            desc_lower = (descrizione + " " + fornitore).lower()
            
            # Mapping specifico per Materiali Dentali
            if categoria_nome == "Materiali Dentali":
                # Pattern per identificare la branca specifica
                branca_patterns = {
                    "endodonzia": ["endodonzia", "endo", "canale", "root", "lima", "ipoclorito", "edt"],
                    "ortodonzia": ["ortodonzia", "ortho", "bracket", "filo", "arco", "allineatore", "apparecchio", "attacco"],
                    "conservativa": ["conservativa", "composito", "resina", "adesivo", "flow", "bulk", "bonding"],
                    "implantologia": ["implanto", "impianto", "implant", "fixture", "abutment", "protesi"],
                    "anestesia": ["anestesia", "anestetico", "mepivacaina", "articaina", "lidocaina"],
                    "igiene e profilassi": ["profilassi", "ablatore", "pasta", "igiene", "polish", "fluoro"],
                    "protesi": ["protesi", "corona", "ponte", "maryland", "capsula", "zirconia", "ceramica"],
                    "impronte": ["impronta", "alginato", "silicone", "polyvinyl", "massa", "cucchiai"],
                    "apparecchiature": ["manipolo", "testina", "turbina", "micromotore", "ablatore", "siringhe"],
                    "strumentario": ["strumento", "pinza", "specillo", "sonda", "elevator", "leva", "forbice"],
                    "disinfezione e sterilizzazione": ["sterilizzazione", "disinfezione", "autoclave", "cidex", "sporox"]
                }
                
                best_match = None
                best_score = 0
                
                for branca_key, keywords in branca_patterns.items():
                    score = sum(1 for kw in keywords if kw in desc_lower)
                    if score > best_score:
                        best_score = score
                        best_match = branca_key
                
                if best_match:
                    # Trova la branca nel database
                    cursor.execute("""
                        SELECT id FROM branche 
                        WHERE contoid = ? AND nome LIKE ?
                        LIMIT 1
                    """, (conto_id, f"%{best_match.upper()}%"))
                    branca_row = cursor.fetchone()
                    if branca_row:
                        branca_id = branca_row[0]
                        
                        # Trova il sottoconto più appropriato per questa branca
                        sottoconto_id = self._find_best_sottoconto_for_branca(cursor, branca_id, desc_lower)
                        return branca_id, sottoconto_id
            
            # Mapping per Collaboratori
            elif categoria_nome == "Collaboratori":
                # Trova branca collaboratori generica
                cursor.execute("""
                    SELECT id FROM branche 
                    WHERE contoid = ? AND (nome LIKE '%IGIENE%' OR nome LIKE '%CHIRURGIA%' OR nome LIKE '%ORTODONZIA%')
                    LIMIT 1
                """, (conto_id,))
                branca_row = cursor.fetchone()
                if branca_row:
                    return branca_row[0], None
            
            # Mapping per Utenze
            elif categoria_nome == "Utenze":
                utenze_patterns = {
                    "energia": ["energia", "elettr", "enel", "kwh", "oneri", "sistema", "attiva"],
                    "acqua": ["acqua", "idric", "acea", "mc", "metri cubi", "quota", "fissa", "acquedott", "publiacqua"],
                    "telefonia": ["telefon", "tim", "vodafone", "wind", "canone", "adsl", "fibra"]
                }
                
                best_match = None
                best_score = 0
                
                for utenza_key, keywords in utenze_patterns.items():
                    score = sum(1 for kw in keywords if kw in desc_lower)
                    if score > best_score:
                        best_score = score
                        best_match = utenza_key
                
                if best_match:
                    cursor.execute("""
                        SELECT id FROM branche 
                        WHERE contoid = ? AND nome LIKE ?
                        LIMIT 1
                    """, (conto_id, f"%{best_match.upper()}%"))
                    branca_row = cursor.fetchone()
                    if branca_row:
                        branca_id = branca_row[0]
                        
                        # Trova il sottoconto più appropriato per questa branca utenze
                        sottoconto_id = self._find_best_sottoconto_for_branca(cursor, branca_id, desc_lower)
                        
                        return branca_id, sottoconto_id
            
            # Fallback: prima branca disponibile
            cursor.execute("SELECT id FROM branche WHERE contoid = ? ORDER BY nome LIMIT 1", (conto_id,))
            branca_row = cursor.fetchone()
            branca_id = branca_row[0] if branca_row else None
            
            return branca_id, None
            
        except Exception as e:
            logger.error(f"Errore mapping specifico branca/sottoconto: {e}")
            return None, None
    
    def _find_best_sottoconto_for_branca(self, cursor, branca_id: int, desc_lower: str) -> int:
        """
        Trova il sottoconto più appropriato per una branca basandosi sulla descrizione
        """
        try:
            # Ottieni il nome della branca per capire il contesto
            cursor.execute("SELECT nome FROM branche WHERE id = ?", (branca_id,))
            branca_row = cursor.fetchone()
            if not branca_row:
                return None
                
            branca_nome = branca_row[0].lower()
            
            # Pattern per mapping sottoconto basato su branca e descrizione
            sottoconto_patterns = {
                # ENDODONZIA
                "endodonzia": {
                    "lima": ["LIME"],
                    "ipoclorito": ["IPOCLORITO", "NAOCL"],
                    "otturazione": ["GUTTAPERCA", "CEMENTO"],
                    "strumenti": ["STRUMENTI"]
                },
                # ORTODONZIA  
                "ortodonzia": {
                    "allineatori": ["ALLINEATORI", "INVISALIGN"],
                    "attacchi": ["ATTACCHI", "BRACKET"], 
                    "fili": ["FILO", "ARCO"],
                    "apparecchi": ["APPARECCHIO"]
                },
                # CONSERVATIVA
                "conservativa": {
                    "compositi": ["COMPOSITI", "COMPOSITO", "RESINA"],
                    "adesivi": ["ADESIVO", "BONDING"],
                    "flow": ["FLOW"]
                },
                # IMPLANTOLOGIA
                "implantologia": {
                    "impianti": ["IMPIANTO", "FIXTURE"],
                    "abutment": ["ABUTMENT", "MONCONE"]
                },
                # UTENZE - ENERGIA
                "energia": {
                    "bolletta": ["BOLLETTA", "FATTURA", "CONSUMO", "UTENZA"]
                },
                # UTENZE - ACQUA  
                "acqua": {
                    "bolletta": ["BOLLETTA", "FATTURA", "CONSUMO", "UTENZA"]
                },
                # UTENZE - TELEFONIA
                "telefonia": {
                    "fisso": ["FISSO", "CANONE", "ABBONAMENTO"],
                    "mobile": ["MOBILE", "CELLULARE", "GSM"],
                    "internet": ["INTERNET", "ADSL", "FIBRA", "WEB"]
                }
            }
            
            # Trova il pattern migliore per questa branca
            if any(key in branca_nome for key in sottoconto_patterns.keys()):
                branca_key = next((key for key in sottoconto_patterns.keys() if key in branca_nome), None)
                
                if branca_key and branca_key in sottoconto_patterns:
                    patterns = sottoconto_patterns[branca_key]
                    
                    # Cerca il sottoconto più appropriato
                    for sottoconto_key, keywords in patterns.items():
                        for keyword in keywords:
                            if any(kw.lower() in desc_lower for kw in keyword.split()):
                                # Cerca il sottoconto nel database
                                cursor.execute("SELECT id FROM sottoconti WHERE nome LIKE ? LIMIT 1", (f"%{keyword}%",))
                                sottoconto_row = cursor.fetchone()
                                if sottoconto_row:
                                    return sottoconto_row[0]
            
            # Fallback intelligente: cerca sottoconti per questa branca specifica
            try:
                cursor.execute("SELECT id, nome FROM sottoconti WHERE brancaid = ? ORDER BY nome LIMIT 1", (branca_id,))
                sottoconto_row = cursor.fetchone()
                if sottoconto_row:
                    return sottoconto_row[0]
            except Exception:
                pass
            
            # Fallback finale: primo sottoconto disponibile in assoluto
            cursor.execute("SELECT id FROM sottoconti ORDER BY nome LIMIT 1")
            sottoconto_row = cursor.fetchone()
            return sottoconto_row[0] if sottoconto_row else None
            
        except Exception as e:
            logger.error(f"Errore ricerca sottoconto: {e}")
            return None
    
    def get_statistics(self) -> Dict:
        """
        Restituisce statistiche sui dati del gestionale
        """
        conti = self.get_piano_conti()
        patterns = self.extract_vocispes_patterns()
        
        # Ordina categorie per importo totale
        sorted_categories = sorted(
            conti.items(),
            key=lambda x: x[1]['importo_totale'],
            reverse=True
        )
        
        return {
            'totale_categorie': len(conti),
            'totale_patterns': sum(len(p) for p in patterns.values()),
            'top_categorie_per_importo': [
                {
                    'categoria': item[1]['descrizione'],
                    'importo': item[1]['importo_totale'],
                    'iva': item[1]['iva_totale']
                }
                for item in sorted_categories[:10]
            ],
            'pattern_counts': {
                categoria: len(keywords) 
                for categoria, keywords in patterns.items()
            }
        }

# Istanza singleton del service
gestionale_service = GestionaleIntelligenceService()