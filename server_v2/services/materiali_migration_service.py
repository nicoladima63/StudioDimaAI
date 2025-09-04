"""
Materiali Migration Service for StudioDimaAI Server V2.

This service handles the migration of dental materials from VOCISPES.DBF 
to the SQLite materiali table with intelligent filtering.
"""

import logging
import os
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from .base_service import BaseService
from utils.dbf_utils import DBFOptimizedReader, clean_materiali_data, normalize_dbf_data
from core.exceptions import ValidationError, DatabaseError, DbfProcessingError

logger = logging.getLogger(__name__)


class MaterialiMigrationService(BaseService):
    """Service for migrating materials from VOCISPES.DBF with intelligent filtering."""
    
    def __init__(self, db_manager):
        super().__init__(db_manager)
        self.dbf_reader = DBFOptimizedReader()
        
        # Parole chiave per identificare materiali dentali utili (migliorate)
        self.dental_keywords = {
            'conservativa': ['resina', 'composito', 'bonding', 'adhesive', 'etching', 'primer', 'liner', 'base', 'restorative', 'filling', 'flowable', 'bulk fill'],
            'endodonzia': ['lima', 'file', 'guttaperca', 'sealer', 'irrigante', 'paper point', 'paperpoint', 'endodontic', 'root canal', 'obturation', 'apex locator'],
            'protesi': ['corona', 'ponte', 'impianto', 'abutment', 'cemento', 'impression', 'bite', 'crown', 'bridge', 'prosthetic', 'denture', 'silicone', 'alginato'],
            'ortodonzia': ['bracket', 'filo', 'elastico', 'banda', 'attacco', 'chain', 'ligature', 'orthodontic', 'wire', 'archwire', 'retainer'],
            'chirurgia': ['bisturi', 'scalpel', 'sutura', 'anestesia', 'ago', 'siringa', 'dissezione', 'surgical', 'suture', 'anesthesia', 'elevator', 'sindesmotomo'],
            'radiologia': ['pellicola', 'film', 'sensore', 'digital', 'panoramica', 'endorale', 'x-ray', 'radiographic', 'sensor', 'bite wing'],
            'prevenzione': ['pasta', 'profilassi', 'fluoruro', 'sigillante', 'detartrasi', 'scaling', 'prophylaxis', 'fluoride', 'sealant', 'polish'],
            'strumenti': ['trapano', 'fresa', 'bur', 'scalpel', 'pinza', 'speculum', 'mirror', 'explorer', 'handpiece', 'drill', 'probe'],
            'materiali_base': ['gesso', 'cera', 'silicon', 'alginate', 'stone', 'die', 'articolatore', 'gypsum', 'wax', 'impression material'],
            'igiene': ['spazzolino', 'dentifricio', 'collutorio', 'floss', 'toothbrush', 'mouthwash', 'interdental', 'oral hygiene'],
            'anestesia': ['lidocaina', 'articaina', 'mepivacaina', 'lidocaine', 'anesthetic', 'local anesthesia', 'carpule', 'cartridge'],
            'antibiotici': ['amoxicillina', 'clindamicina', 'azitromicina', 'amoxicillin', 'clindamycin', 'antibiotic', 'prescription'],
            'disinfettanti': ['clorexidina', 'perossido', 'ipoclorito', 'disinfettante', 'chlorhexidine', 'peroxide', 'sterilizer'],
            'strisce': ['striscia', 'strip', 'matrice', 'matrix', 'wedge', 'cuneo', 'spessore'],
            'perni': ['perno', 'post', 'fiber', 'fibra', 'fiber post', 'metal post'],
            'fili': ['filo', 'retraction', 'retrazione', 'gengival', 'retraction cord', 'gingival']
        }
        
        # Parole da escludere (logica intelligente come backend v1)
        self.exclude_keywords = [
            # Voci secondarie fatture (come nel backend v1)
            'iva', 'imposta', 'sconto', 'trasporto', 'spedizione', 'shipping',
            'ritenuta', 'bollo', 'commissione', 'fee', 'tax', 'vat',
            
            # Materiali amministrativi/office
            'busta', 'envelope', 'timbro', 'stamp', 'cartolina', 'postcard',
            'penna', 'pen', 'matita', 'pencil', 'cancelleria', 'office supplies',
            'telefono', 'phone', 'computer', 'software', 'licenza', 'license',
            'stampante', 'printer', 'toner', 'cartuccia', 'ink',
            
            # Pulizia generale (non dentale)
            'pulizia ufficio', 'cleaning', 'detergente casa', 'sapone mani',
            'carta igienica', 'toilet paper', 'asciugamani', 'towels',
            
            # Consumabili generali
            'caffè', 'coffee', 'acqua', 'water', 'bibite', 'drinks', 'snack',
            'benzina', 'gasolio', 'carburante', 'fuel', 'auto', 'car', 'parcheggio',
            
            # Servizi amministrativi
            'assicurazione', 'insurance', 'tasse', 'tax', 'consulenza', 'consulting',
            'formazione', 'training', 'corso', 'course', 'abbonamento', 'subscription',
            'ddt', 'fattura', 'rimessa', 'versione', 'team', 'gestione', 'management',
            'contabilità', 'accounting', 'banca', 'bank', 'finanziario', 'financial'
        ]
        
        # Soglie intelligenti (come backend v1)
        self.min_price_threshold = 5.0  # Importo minimo significativo
        self.min_quantity_threshold = 0.1  # Quantità minima
        
        # Cache per performance
        self._classification_cache = {}
        self._supplier_cache = {}
        
        # Mappa fornitori simili per aggregazione intelligente
        self.similar_suppliers = {
            'dentsply': ['dentsply', 'sirona', 'dentsply sirona'],
            '3m': ['3m', 'espe', '3m espe'],
            'ivoclar': ['ivoclar', 'vivadent', 'ivoclar vivadent'],
            'kerr': ['kerr', 'sybron', 'kerr sybron'],
            'gc': ['gc', 'gc america', 'gc dental'],
            'ultradent': ['ultradent', 'ultra dent'],
            'coltene': ['coltene', 'whaledent', 'coltene whaledent'],
            'henry schein': ['henry schein', 'schein', 'henry'],
            'patterson': ['patterson', 'patterson dental'],
            'enel': ['enel', 'enel energia', 'enel energia spa'],
            'edison': ['edison', 'edison energia', 'edison energia spa']
        }
    
    def classify_material_type(self, descrizione: str) -> Tuple[str, int]:
        """
        Classifica il tipo di materiale basandosi sulla descrizione con confidence scoring avanzato.
        
        Args:
            descrizione: Descrizione del materiale
            
        Returns:
            Tupla (tipo_materiale, confidence_score)
        """
        if not descrizione:
            return 'unknown', 0
        
        # Cache per performance
        cache_key = descrizione.lower().strip()
        if cache_key in self._classification_cache:
            return self._classification_cache[cache_key]
        
        descrizione_lower = descrizione.lower().strip()
        
        # Verifica se è un materiale da escludere (logica intelligente come backend v1)
        for exclude_word in self.exclude_keywords:
            if exclude_word in descrizione_lower:
                result = ('non_dental', 0)
                self._classification_cache[cache_key] = result
                return result
        
        # Cerca corrispondenze con parole chiave dentali
        best_match = ('unknown', 0)
        category_scores = {}
        
        for categoria, keywords in self.dental_keywords.items():
            confidence = 0
            matches = 0
            exact_matches = 0
            partial_matches = 0
            
            for keyword in keywords:
                if keyword in descrizione_lower:
                    matches += 1
                    
                    # Peso maggiore per match esatti
                    if keyword == descrizione_lower:
                        confidence += 100
                        exact_matches += 1
                    # Match parziale con peso basato sulla lunghezza
                    else:
                        weight = min(80, len(keyword) * 5)  # Peso proporzionale alla lunghezza
                        confidence += weight
                        partial_matches += 1
                
                # Controllo aggiuntivo per frasi composte (es. "lidocaina 2%")
                elif ' ' in keyword:
                    words = keyword.split()
                    if all(word in descrizione_lower for word in words):
                        matches += 1
                        confidence += min(90, len(keyword) * 4)  # Peso leggermente inferiore per frasi
                        partial_matches += 1
            
            # Bonus per multiple matches nella stessa categoria
            if matches > 1:
                confidence += matches * 15
            
            # Bonus per match esatti
            if exact_matches > 0:
                confidence += exact_matches * 25
            
            # Penalità per descrizioni troppo generiche
            if len(descrizione_lower) < 5:
                confidence *= 0.5
            
            category_scores[categoria] = confidence
            
            if confidence > best_match[1]:
                best_match = (categoria, confidence)
        
        # Se la confidence è troppo bassa, classifica come unknown
        if best_match[1] < 30:
            best_match = ('unknown', best_match[1])
        
        # Cache del risultato
        self._classification_cache[cache_key] = best_match
        return best_match
    
    def is_dental_material(self, descrizione: str, prezzo: Optional[float] = None, quantita: Optional[float] = None) -> Tuple[bool, int]:
        """
        Determina se un materiale è dentale e utile con logica intelligente (come backend v1).
        
        Args:
            descrizione: Descrizione del materiale
            prezzo: Prezzo del materiale (opzionale)
            quantita: Quantità del materiale (opzionale)
            
        Returns:
            Tupla (is_dental, confidence_score)
        """
        if not descrizione:
            return False, 0
        
        material_type, confidence = self.classify_material_type(descrizione)
        
        # Se è classificato come non dentale
        if material_type == 'non_dental':
            return False, 0
        
        # Filtro intelligente come backend v1: escludi voci secondarie
        descrizione_lower = descrizione.lower()
        if any(keyword in descrizione_lower for keyword in ['iva', 'imposta', 'sconto', 'trasporto', 'spedizione']):
            return False, 0
        
        # Soglia prezzo minimo significativo (come backend v1)
        if prezzo is not None and prezzo < self.min_price_threshold:
            return False, confidence
        
        # Soglia quantità minima
        if quantita is not None and quantita < self.min_quantity_threshold:
            return False, confidence
        
        # Se ha una classificazione dentale specifica
        if material_type != 'unknown' and confidence >= 40:  # Soglia più bassa per catturare più materiali
            return True, confidence
        
        # Controlli aggiuntivi per materiali non classificati
        dental_patterns = [
            r'\b(ml|cc|gr|mg)\b',  # Unità di misura mediche
            r'\b\d+%\b',  # Percentuali (es. "2% lidocaina")
            r'\b(sterile|steril)\b',  # Materiali sterili
            r'\b(monouso|disposable)\b',  # Materiali monouso
            r'\b(dental|dent|tooth)\b',  # Riferimenti dentali espliciti
        ]
        
        pattern_matches = sum(1 for pattern in dental_patterns 
                            if re.search(pattern, descrizione_lower))
        
        if pattern_matches >= 2:
            return True, 60 + (pattern_matches * 10)
        
        # Se ha un prezzo ragionevole per materiali dentali (€0.10 - €500)
        if prezzo and 0.10 <= prezzo <= 500:
            return True, 40
        
        # Default: probabilmente non è un materiale dentale utile
        return False, 10
    
    def normalize_supplier_name(self, supplier_name: str) -> str:
        """
        Normalizza il nome del fornitore per aggregazione intelligente.
        
        Args:
            supplier_name: Nome originale del fornitore
            
        Returns:
            Nome normalizzato del fornitore
        """
        if not supplier_name:
            return supplier_name
        
        # Cache per performance
        cache_key = supplier_name.lower().strip()
        if cache_key in self._supplier_cache:
            return self._supplier_cache[cache_key]
        
        supplier_lower = supplier_name.lower().strip()
        
        # Cerca corrispondenze con fornitori simili
        for normalized_name, variations in self.similar_suppliers.items():
            for variation in variations:
                if variation in supplier_lower:
                    self._supplier_cache[cache_key] = normalized_name.title()
                    return normalized_name.title()
        
        # Se non trova corrispondenze, normalizza il nome originale
        normalized = supplier_name.strip().title()
        self._supplier_cache[cache_key] = normalized
        return normalized
    
    def read_vocispes_data(self) -> List[Dict[str, Any]]:
        """
        Legge tutti i dati da VOCISPES.DBF con join a SPESAFOR e FORNITOR.
        
        Returns:
            Lista di dizionari con i dati dei materiali
        """
        try:
            from dbfread import DBF
            
            # Percorsi dei file DBF
            vocispes_path = os.path.join('..', 'windent', 'DATI', 'VOCISPES.DBF')
            spesafo_path = os.path.join('..', 'windent', 'DATI', 'SPESAFOR.DBF')
            fornitor_path = os.path.join('..', 'windent', 'DATI', 'FORNITOR.DBF')
            
            logger.info(f"Reading VOCISPES.DBF from: {vocispes_path}")
            
            # Carica SPESAFOR per il mapping fornitore
            spesafo_map = {}
            with DBF(spesafo_path, encoding='latin-1') as spesafo_table:
                for record in spesafo_table:
                    if record is None:
                        continue
                    spfocod = self._clean_dbf_value(record.get('DB_SPFOCOD', ''))
                    code = self._clean_dbf_value(record.get('DB_CODE', ''))
                    if spfocod and code:
                        spesafo_map[spfocod] = code
            
            logger.info(f"Loaded {len(spesafo_map)} mappings from SPESAFOR.DBF")
            
            # Carica FORNITOR per i nomi fornitori
            fornitor_map = {}
            with DBF(fornitor_path, encoding='latin-1') as fornitor_table:
                for record in fornitor_table:
                    if record is None:
                        continue
                    code = self._clean_dbf_value(record.get('DB_CODE', ''))
                    nome = self._clean_dbf_value(record.get('DB_FONOME', ''))
                    if code and nome:
                        fornitor_map[code] = nome
            
            logger.info(f"Loaded {len(fornitor_map)} fornitori from FORNITOR.DBF")
            
            # Leggi VOCISPES e fai il join
            materials_data = []
            with DBF(vocispes_path, encoding='latin-1') as table:
                for record in table:
                    if record is None:
                        continue
                    
                    # Estrai dati da VOCISPES
                    vospcod = self._clean_dbf_value(record.get('DB_VOSPCOD', ''))
                    descrizione = self._clean_dbf_value(record.get('DB_VODESCR', ''))
                    prezzo = self._safe_float(record.get('DB_VOPREZZ', 0))
                    
                    # Trova fornitoreid tramite SPESAFOR
                    fornitoreid = spesafo_map.get(vospcod, '')
                    
                    # Trova nome fornitore tramite FORNITOR
                    fornitorenome = fornitor_map.get(fornitoreid, '')
                    
                    # Crea materiale solo se ha tutti i dati necessari
                    if descrizione and fornitoreid and fornitorenome and prezzo > 0:
                        material = {
                            'codicearticolo': vospcod,  # Usa DB_VOSPCOD come codice articolo
                            'nome': descrizione,
                            'fornitoreid': fornitoreid,
                            'fornitorenome': fornitorenome,
                            'costo_unitario': prezzo,
                        }
                        materials_data.append(material)
            
            logger.info(f"Read {len(materials_data)} valid records from VOCISPES.DBF with joins")
            return materials_data
            
        except Exception as e:
            logger.error(f"Error reading VOCISPES.DBF: {e}")
            raise DbfProcessingError(f"Failed to read VOCISPES.DBF: {str(e)}")
    
    def filter_dental_materials(self, materials_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Filtra i materiali per identificare solo quelli dentali utili.
        Include solo materiali di fornitori classificati.
        
        Args:
            materials_data: Lista di materiali da filtrare
            
        Returns:
            Lista di materiali dentali filtrati e arricchiti
        """
        dental_materials = []
        stats = {'total': len(materials_data), 'dental': 0, 'excluded': 0, 'no_classification': 0}
        
        for material in materials_data:
            descrizione = material.get('nome', '')
            prezzo = material.get('costo_unitario', 0)
            fornitore_nome = material.get('fornitorenome', '')
            
            # Skip materiali senza descrizione
            if not descrizione or len(descrizione.strip()) < 3:
                stats['excluded'] += 1
                continue
            
            # Verifica se il fornitore è classificato
            classification_data = self._get_classification_data(fornitore_nome)
            if not classification_data:
                stats['no_classification'] += 1
                continue  # Esclude materiali di fornitori non classificati
            
            # Determina se è un materiale dentale (con logica intelligente)
            quantita = material.get('quantita', 0)
            is_dental, confidence = self.is_dental_material(descrizione, prezzo, quantita)
            
            if is_dental and confidence >= 30:  # Soglia più bassa per catturare più materiali
                # Classifica il tipo di materiale
                material_type, type_confidence = self.classify_material_type(descrizione)
                
                # Arricchisci i dati del materiale con classificazione
                enriched_material = material.copy()
                enriched_material.update({
                    'confidence': confidence,
                    'confermato': confidence >= 80,  # Auto-conferma se alta confidenza
                    'occorrenze': 1,  # Prima occorrenza
                    'categoria_contabile': self._derive_category(material_type),
                    'fornitore_normalizzato': self.normalize_supplier_name(fornitore_nome),
                    # Aggiungi dati di classificazione
                    'contoid': classification_data['contoid'],
                    'brancaid': classification_data['brancaid'],
                    'sottocontoid': classification_data['sottocontoid'],
                })
                
                dental_materials.append(enriched_material)
                stats['dental'] += 1
            else:
                stats['excluded'] += 1
        
        logger.info(f"Filtering results: {stats['total']} total, {stats['dental']} dental, {stats['excluded']} excluded, {stats['no_classification']} no classification")
        return dental_materials
    
    def migrate_materials_to_db(self, dental_materials: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Migra i materiali dentali filtrati nel database SQLite usando la struttura esistente.
        
        Args:
            dental_materials: Lista di materiali dentali da migrare
            
        Returns:
            Dizionario con statistiche della migrazione
        """
        try:
            import sqlite3
            stats = {'inserted': 0, 'updated': 0, 'errors': 0, 'errors_list': []}
            
            conn = sqlite3.connect('instance/studio_dima.db')
            cursor = conn.cursor()
            
            for material in dental_materials:
                try:
                    # Verifica se il materiale esiste già usando la struttura esistente
                    existing_query = """
                        SELECT id FROM materiali 
                        WHERE codicearticolo = ? AND fornitoreid = ?
                    """
                    existing = cursor.execute(existing_query, (
                        material['codicearticolo'],
                        material['fornitoreid']
                    )).fetchone()
                    
                    if existing:
                        # Aggiorna materiale esistente
                        update_query = """
                            UPDATE materiali SET
                                nome = ?, fornitorenome = ?, costo_unitario = ?,
                                confidence = ?, confermato = ?, occorrenze = ?,
                                categoria_contabile = ?, contoid = ?, brancaid = ?, sottocontoid = ?
                            WHERE id = ?
                        """
                        cursor.execute(update_query, (
                            material['nome'], material['fornitorenome'], material['costo_unitario'],
                            material['confidence'], material['confermato'], material['occorrenze'],
                            material['categoria_contabile'], material['contoid'], 
                            material['brancaid'], material['sottocontoid'],
                            existing[0]
                        ))
                        stats['updated'] += 1
                    else:
                        # Inserisci nuovo materiale usando la struttura esistente
                        insert_query = """
                            INSERT INTO materiali (
                                codicearticolo, nome, fornitoreid, fornitorenome, costo_unitario,
                                confidence, confermato, occorrenze, categoria_contabile,
                                contoid, brancaid, sottocontoid
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """
                        cursor.execute(insert_query, (
                            material['codicearticolo'], material['nome'],
                            material['fornitoreid'], material['fornitorenome'], material['costo_unitario'],
                            material['confidence'], material['confermato'], material['occorrenze'],
                            material['categoria_contabile'], material['contoid'], 
                            material['brancaid'], material['sottocontoid']
                        ))
                        stats['inserted'] += 1
                        
                except Exception as e:
                    stats['errors'] += 1
                    error_msg = f"Error processing material {material.get('nome', 'Unknown')}: {str(e)}"
                    stats['errors_list'].append(error_msg)
                    logger.error(error_msg)
                    continue
            
            conn.commit()
            conn.close()
            
            logger.info(f"Migration completed: {stats['inserted']} inserted, {stats['updated']} updated, {stats['errors']} errors")
            return stats
            
        except Exception as e:
            logger.error(f"Error during migration: {e}")
            raise DatabaseError(f"Migration failed: {str(e)}")
    
    def run_full_migration(self) -> Dict[str, Any]:
        """
        Esegue la migrazione completa da VOCISPES.DBF alla tabella materiali.
        
        Returns:
            Dizionario con risultati della migrazione
        """
        try:
            logger.info("Starting full materials migration from VOCISPES.DBF")
            start_time = datetime.now()
            
            # Step 1: Leggi dati da VOCISPES.DBF
            materials_data = self.read_vocispes_data()
            
            # Step 2: Filtra materiali dentali
            dental_materials = self.filter_dental_materials(materials_data)
            
            # Step 3: Migra nel database
            migration_stats = self.migrate_materials_to_db(dental_materials)
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            result = {
                'success': True,
                'duration_seconds': duration,
                'total_records_processed': len(materials_data),
                'dental_materials_found': len(dental_materials),
                'migration_stats': migration_stats,
                'completed_at': end_time.isoformat()
            }
            
            logger.info(f"Migration completed successfully in {duration:.2f} seconds")
            return result
            
        except Exception as e:
            logger.error(f"Full migration failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'completed_at': datetime.now().isoformat()
            }
    
    def _clean_dbf_value(self, value: Any, default: str = '') -> str:
        """Clean DBF value to string."""
        if value is None:
            return default
        if isinstance(value, bytes):
            return value.decode('latin-1', errors='ignore').strip()
        return str(value).strip()
    
    def _safe_float(self, value: Any) -> float:
        """Safely convert value to float."""
        try:
            if value is None:
                return 0.0
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    def _get_classification_data(self, fornitore_nome: str) -> dict:
        """Recupera i dati di classificazione per un fornitore dalla tabella classificazioni_costi."""
        try:
            import sqlite3
            conn = sqlite3.connect('instance/studio_dima.db')
            cursor = conn.cursor()
            
            # Cerca nella tabella classificazioni_costi usando fornitore_nome
            cursor.execute("""
                SELECT contoid, brancaid, sottocontoid
                FROM classificazioni_costi 
                WHERE fornitore_nome = ?
            """, (fornitore_nome,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return {
                    'contoid': result[0],
                    'brancaid': result[1],
                    'sottocontoid': result[2]
                }
            return None
            
        except Exception as e:
            logger.error(f"Errore nel recupero classificazione per fornitore {fornitore_nome}: {e}")
            return None

    def _derive_category(self, material_type: str) -> str:
        """Deriva la categoria del materiale dal tipo."""
        category_mapping = {
            'resina': 'Materiali da Otturazione',
            'strisce': 'Materiali da Otturazione',
            'perni': 'Endodonzia',
            'cunei': 'Strumentario',
            'fili': 'Chirurgia',
            'cementi': 'Materiali da Cementazione',
            'anestesia': 'Farmaci',
            'suture': 'Chirurgia',
            'disinfettanti': 'Igiene e Disinfezione',
            'protesi': 'Protesi',
            'endodonzia': 'Endodonzia',
            'chirurgia': 'Chirurgia',
            'igiene': 'Igiene e Prevenzione',
            'radiologia': 'Radiologia',
            'laboratorio': 'Laboratorio'
        }
        
        return category_mapping.get(material_type, 'Varie')
