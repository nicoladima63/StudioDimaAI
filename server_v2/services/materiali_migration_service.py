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
        if any(keyword in descrizione_lower for keyword in ['iva', 'imposta', 'sconto', 'trasporto', 'spedizione', 'spese', 'imballo']):
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
    
    def read_spesafo_data(self) -> List[Dict[str, Any]]:
        """
        Legge i dati dalla tabella SPESAFOR.DBF e li arricchisce con i dettagli da VOCISPES.DBF.
        
        Returns:
            Lista di dizionari con i dati delle spese per fornitori e i loro dettagli
        """
        try:
            from dbfread import DBF
            
            # Percorsi dei file DBF
            spesafo_path = os.path.join('..', 'windent', 'DATI', 'SPESAFOR.DBF')
            fornitor_path = os.path.join('..', 'windent', 'DATI', 'FORNITOR.DBF')
            vocispes_path = os.path.join('..', 'windent', 'DATI', 'VOCISPES.DBF')
            
            logger.info(f"Reading SPESAFOR.DBF from: {spesafo_path}")
            
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
            
            # Leggi dettagli da VOCISPES.DBF
            dettagli_dict = {}
            with DBF(vocispes_path, encoding='latin-1') as vocispes_table:
                for record in vocispes_table:
                    if record is None:
                        continue
                    
                    codice_fattura = self._clean_dbf_value(record.get('DB_VOSPCOD', ''))
                    if not codice_fattura:
                        continue
                    
                    # Estrai dettagli usando il mapping corretto
                    codice_articolo = self._clean_dbf_value(record.get('DB_VOSOCOD', ''))
                    descrizione = self._clean_dbf_value(record.get('DB_VODESCR', ''))
                    quantita = self._safe_float(record.get('DB_VOQUANT', 0))
                    prezzo_unitario = self._safe_float(record.get('DB_VOPREZZ', 0))
                    sconto = self._safe_float(record.get('DB_VOSCONT', 0))
                    aliquota_iva = self._safe_float(record.get('DB_VOIVA', 0))
                    
                    # Filtra solo i materiali utili (come fa la V1)
                    if not self._is_material_useful(descrizione, quantita, prezzo_unitario):
                        continue
                    
                    if codice_fattura not in dettagli_dict:
                        dettagli_dict[codice_fattura] = []
                    
                    dettaglio = {
                        'codice_articolo': codice_articolo,
                        'descrizione': descrizione,
                        'quantita': quantita,
                        'prezzo_unitario': prezzo_unitario,
                        'sconto': sconto,
                        'aliquota_iva': aliquota_iva,
                        'totale_riga': quantita * prezzo_unitario * (1 - sconto / 100) if quantita and prezzo_unitario else 0.0
                    }
                    
                    dettagli_dict[codice_fattura].append(dettaglio)
            
            logger.info(f"Loaded details for {len(dettagli_dict)} invoices from VOCISPES.DBF")
            
            # Leggi SPESAFOR e arricchisci con i dettagli
            materials_data = []
            with DBF(spesafo_path, encoding='latin-1') as table:
                for record in table:
                    if record is None:
                        continue
                    
                    # Estrai dati da SPESAFOR usando il mapping corretto
                    id_fattura = self._clean_dbf_value(record.get('DB_CODE', ''))  # ID fattura
                    fornitoreid = self._clean_dbf_value(record.get('DB_SPFOCOD', ''))  # codice fornitore
                    descrizione = self._clean_dbf_value(record.get('DB_SPDESCR', ''))  # descrizione
                    costo_netto = self._safe_float(record.get('DB_SPCOSTO', 0))  # costo netto
                    costo_iva = self._safe_float(record.get('DB_SPCOIVA', 0))  # costo con IVA
                    numero_documento = self._clean_dbf_value(record.get('DB_SPNUMER', ''))  # numero documento
                    data_spesa = self._clean_dbf_value(record.get('DB_SPDATA', ''))  # data spesa
                    
                    # Salta record senza dati essenziali
                    if not id_fattura or not fornitoreid:
                        continue
                    
                    # Trova nome fornitore tramite FORNITOR
                    fornitorenome = fornitor_map.get(fornitoreid, '')
                    
                    # Ottieni dettagli per questa fattura
                    dettagli_fattura = dettagli_dict.get(id_fattura, [])
                    
                    if not dettagli_fattura:
                        # Se non ci sono dettagli utili, salta questa fattura
                        continue
                    
                    # Crea un record per ogni dettaglio
                    for dettaglio in dettagli_fattura:
                        material = {
                            'id_fattura': id_fattura,
                            'codicearticolo': dettaglio['codice_articolo'] or '',
                            'nome': dettaglio['descrizione'],  # Usa descrizione dal dettaglio
                            'fornitoreid': fornitoreid,
                            'fornitorenome': fornitorenome,
                            'costo_unitario': dettaglio['prezzo_unitario'],  # Usa prezzo dal dettaglio
                            'costo_netto': costo_netto,
                            'costo_iva': costo_iva,
                            'data_spesa': data_spesa,
                            'numero_documento': numero_documento,
                            'quantita': dettaglio['quantita'],
                            'sconto': dettaglio['sconto'],
                            'aliquota_iva': dettaglio['aliquota_iva'],
                            'totale_riga': dettaglio['totale_riga']
                        }
                        materials_data.append(material)
            
            logger.info(f"Read {len(materials_data)} valid records from SPESAFOR.DBF with joins")
            
            # Log fornitori presenti nel DBF
            suppliers_in_dbf = set()
            for material in materials_data:
                suppliers_in_dbf.add(f"{material.get('fornitoreid')} - {material.get('fornitorenome')}")
            
            logger.info(f"DEBUG - Suppliers in DBF: {len(suppliers_in_dbf)}")
            for supplier in sorted(suppliers_in_dbf):
                logger.info(f"DEBUG - DBF Supplier: {supplier}")
            
            return materials_data
            
        except Exception as e:
            logger.error(f"Error reading SPESAFOR.DBF: {e}")
            raise DbfProcessingError(f"Failed to read SPESAFOR.DBF: {str(e)}")
    
    def _is_material_useful(self, descrizione: str, quantita: float, prezzo_unitario: float) -> bool:
        """
        Determina se un materiale è utile per la migrazione (filtra come fa la V1).
        
        Args:
            descrizione: Descrizione del materiale
            quantita: Quantità
            prezzo_unitario: Prezzo unitario
            
        Returns:
            True se il materiale è utile, False altrimenti
        """
        if not descrizione:
            return False
        
        descrizione = str(descrizione).strip().upper()
        
        # Escludi righe con quantità 0 o prezzo 0
        if quantita == 0 or prezzo_unitario == 0:
            return False
        
        # Escludi righe che iniziano con pattern non utili
        exclude_patterns = [
            'DDT N°',
            'SKU ',
            'RIGA AUSILIARIA',
            'A5 CONTRIBUTO',
            'CONTRIBUTO SPESE',
            'SPESE TRASP',
            'IMBALLO'
        ]
        
        for pattern in exclude_patterns:
            if descrizione.startswith(pattern):
                return False
        
        # Escludi righe troppo corte (probabilmente non materiali)
        if len(descrizione) < 5:
            return False
        
        return True
    
    def filter_materials_by_classification(self, materials_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Filtra i materiali per fornitori classificati e applica pattern recognition.
        ESCLUDE i materiali già importati nella tabella materiali.
        
        Args:
            materials_data: Lista di materiali da VOCISPES.DBF
            
        Returns:
            Lista di materiali con classificazione e pattern recognition (solo NON importati)
        """
        classified_materials = []
        stats = {
            'total': len(materials_data),
            'classified': 0,
            'excluded': 0,
            'no_classification': 0,
            'pattern_matched': 0,
            'supplier_classification': 0,
            'already_imported': 0
        }
        
        # Carica pattern esistenti per il matching
        existing_patterns = self._load_existing_patterns()
        
        for material in materials_data:
            descrizione = material.get('nome', '')
            fornitore_nome = material.get('fornitorenome', '')
            
            # Skip materiali senza descrizione
            if not descrizione or len(descrizione.strip()) < 3:
                stats['excluded'] += 1
                continue
            
            # Filtro materiali dentali - escludi materiali non dentali
            is_dental, confidence = self.is_dental_material(descrizione)
            if not is_dental:
                stats['excluded'] += 1
                continue
            
            # Verifica se il fornitore è classificato
            fornitore_id = material.get('fornitoreid', '')
            fattura_id = material.get('id_fattura', '')
            
            # PRIMA: Controlla se il materiale esiste già nella tabella materiali
            existing_material_classification = self._get_existing_material_classification(
                descrizione, fornitore_id, fattura_id
            )
            
            if existing_material_classification:
                # Materiale già importato - ESCLUDILO dalla migrazione
                stats['already_imported'] += 1
                logger.info(f"Materiale già importato - escluso: {descrizione}")
                continue
            
            # SECONDA: Prova pattern matching per classificazione specifica
            pattern_match = self._find_pattern_match(descrizione, existing_patterns)
            if pattern_match:
                # Usa classificazione specifica dal pattern
                classification_data = pattern_match['classification']
                confidence = pattern_match['confidence']
                stats['pattern_matched'] += 1
            else:
                # TERZA: Usa classificazione del fornitore
                fornitore_classification = self._get_classification_data(fornitore_id)
                if fornitore_classification:
                    classification_data = {
                        'contoid': fornitore_classification['contoid'],
                        'brancaid': fornitore_classification['brancaid'],
                        'sottocontoid': fornitore_classification['sottocontoid'],
                        'contonome': fornitore_classification['contonome'],
                        'brancanome': fornitore_classification['brancanome'],
                        'sottocontonome': fornitore_classification['sottocontonome']
                    }
                    confidence = 30  # Bassa confidenza per classificazione fornitore
                    stats['supplier_classification'] += 1
                else:
                    # Nessuna classificazione disponibile
                    stats['no_classification'] += 1
                    continue
            
            # Aggiungi il materiale con classificazione
            enriched_material = material.copy()
            enriched_material.update({
                'id': '',  # ID sarà generato dal database
                'codice_prodotto': material.get('codicearticolo', ''),
                'confidence': confidence,
                'confermato': confidence >= 80,  # Auto-conferma se confidence alta
                'occorrenze': 1,
                'categoria_contabile': 'Materiali Classificati',
                'fornitore_normalizzato': self.normalize_supplier_name(fornitore_nome),
                'data_fattura': material.get('data_spesa', ''),
                'fattura_id': material.get('id_fattura', ''),
                # Aggiungi dati di classificazione
                'contoid': classification_data['contoid'],
                'brancaid': classification_data['brancaid'],
                'sottocontoid': classification_data['sottocontoid'],
                'contonome': classification_data['contonome'],
                'brancanome': classification_data['brancanome'],
                'sottocontonome': classification_data['sottocontonome'],
            })
            
            classified_materials.append(enriched_material)
            stats['classified'] += 1
        
        logger.info(f"Filtering results: {stats['total']} total, {stats['classified']} classified, {stats['excluded']} excluded, {stats['no_classification']} no classification, {stats['pattern_matched']} pattern matched, {stats['already_imported']} already imported (excluded)")
        
        return classified_materials
    
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
                                categoria_contabile = ?, contoid = ?, brancaid = ?, sottocontoid = ?,
                                contonome = ?, brancanome = ?, sottocontonome = ?
                            WHERE id = ?
                        """
                        cursor.execute(update_query, (
                            material['nome'], material['fornitorenome'], material['costo_unitario'],
                            material['confidence'], material['confermato'], material['occorrenze'],
                            material['categoria_contabile'], material['contoid'], 
                            material['brancaid'], material['sottocontoid'],
                            material['contonome'], material['brancanome'], material['sottocontonome'],
                            existing[0]
                        ))
                        stats['updated'] += 1
                    else:
                        # Inserisci nuovo materiale usando la struttura esistente
                        insert_query = """
                            INSERT INTO materiali (
                                codicearticolo, nome, fornitoreid, fornitorenome, costo_unitario,
                                confidence, confermato, occorrenze, categoria_contabile,
                                contoid, brancaid, sottocontoid, contonome, brancanome, sottocontonome
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """
                        cursor.execute(insert_query, (
                            material['codicearticolo'], material['nome'],
                            material['fornitoreid'], material['fornitorenome'], material['costo_unitario'],
                            material['confidence'], material['confermato'], material['occorrenze'],
                            material['categoria_contabile'], material['contoid'], 
                            material['brancaid'], material['sottocontoid'],
                            material['contonome'], material['brancanome'], material['sottocontonome']
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
            materials_data = self.read_spesafo_data()
            
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
    
    def _get_existing_material_classification(self, nome: str, fornitore_id: str, fattura_id: str = None) -> dict:
        """Recupera la classificazione di un materiale già esistente nella tabella materiali."""
        try:
            import sqlite3
            conn = sqlite3.connect('instance/studio_dima.db')
            cursor = conn.cursor()
            
            # Cerca il materiale esistente con la sua classificazione
            if fattura_id:
                cursor.execute("""
                    SELECT 
                        contoid, brancaid, sottocontoid,
                        contonome, brancanome, sottocontonome
                    FROM materiali 
                    WHERE nome = ? AND fornitoreid = ? AND fattura_id = ?
                    AND contoid IS NOT NULL AND contonome IS NOT NULL
                """, (nome, fornitore_id, fattura_id))
            else:
                cursor.execute("""
                    SELECT 
                        contoid, brancaid, sottocontoid,
                        contonome, brancanome, sottocontonome
                    FROM materiali 
                    WHERE nome = ? AND fornitoreid = ?
                    AND contoid IS NOT NULL AND contonome IS NOT NULL
                    ORDER BY id DESC LIMIT 1
                """, (nome, fornitore_id))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return {
                    'contoid': result[0],
                    'brancaid': result[1],
                    'sottocontoid': result[2],
                    'contonome': result[3] or '',
                    'brancanome': result[4] or '',
                    'sottocontonome': result[5] or ''
                }
            return None
            
        except Exception as e:
            logger.error(f"Errore nel recupero classificazione materiale esistente {nome}: {e}")
            return None

    def _get_classification_data(self, fornitore_id: str) -> dict:
        """Recupera i dati di classificazione per un fornitore dalla tabella classificazioni_costi."""
        try:
            import sqlite3
            conn = sqlite3.connect('instance/studio_dima.db')
            cursor = conn.cursor()
            
            # Cerca per fornitore_id (codice_riferimento) con JOIN per recuperare i nomi
            cursor.execute("""
                SELECT 
                    cc.contoid, cc.brancaid, cc.sottocontoid,
                    c.nome as contonome,
                    b.nome as brancanome,
                    s.nome as sottocontonome
                FROM classificazioni_costi cc
                LEFT JOIN conti c ON cc.contoid = c.id
                LEFT JOIN branche b ON cc.brancaid = b.id
                LEFT JOIN sottoconti s ON cc.sottocontoid = s.id
                WHERE cc.codice_riferimento = ? AND cc.tipo_entita = 'fornitore'
            """, (fornitore_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return {
                    'contoid': result[0],
                    'brancaid': result[1],
                    'sottocontoid': result[2],
                    'contonome': result[3] or '',
                    'brancanome': result[4] or '',
                    'sottocontonome': result[5] or ''
                }
            return None
            
        except Exception as e:
            logger.error(f"Errore nel recupero classificazione per fornitore ID {fornitore_id}: {e}")
            return None
    
    def _load_existing_patterns(self) -> List[Dict[str, Any]]:
        """
        Carica i pattern esistenti dai materiali già classificati nel database.
        
        Returns:
            Lista di pattern con classificazione
        """
        try:
            import sqlite3
            conn = sqlite3.connect('instance/studio_dima.db')
            cursor = conn.cursor()
            
            # Carica materiali già classificati con i loro nomi e classificazioni
            cursor.execute("""
                SELECT 
                    m.nome,
                    m.fornitoreid,
                    m.contoid, m.brancaid, m.sottocontoid,
                    m.contonome,
                    m.brancanome,
                    m.sottocontonome
                FROM materiali m
                WHERE m.nome IS NOT NULL AND m.nome != ''
                AND m.contonome IS NOT NULL AND m.contonome != ''
            """)
            
            patterns = []
            for row in cursor.fetchall():
                patterns.append({
                    'nome': row[0],
                    'fornitoreid': row[1],
                    'classification': {
                        'contoid': row[2],
                        'brancaid': row[3],
                        'sottocontoid': row[4],
                        'contonome': row[5] or '',
                        'brancanome': row[6] or '',
                        'sottocontonome': row[7] or ''
                    }
                })
            
            conn.close()
            logger.info(f"Caricati {len(patterns)} pattern esistenti")
            return patterns
            
        except Exception as e:
            logger.error(f"Errore nel caricamento pattern esistenti: {e}")
            return []
    
    def _find_pattern_match(self, descrizione: str, existing_patterns: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Trova un pattern match per la descrizione del materiale.
        
        Args:
            descrizione: Descrizione del materiale da classificare
            existing_patterns: Lista di pattern esistenti
            
        Returns:
            Dizionario con classificazione e confidence, o None se non trovato
        """
        if not existing_patterns:
            return None
        
        descrizione_clean = self._clean_material_name(descrizione)
        desc_lower = descrizione_clean.lower()
        
        # Regole specifiche per RECIPROC
        if 'reciproc' in desc_lower:
            if any(word in desc_lower for word in ['carta', 'paper', 'points']):
                # Cerca pattern RECIPROC + carta/paper
                for pattern in existing_patterns:
                    pattern_clean = self._clean_material_name(pattern['nome']).lower()
                    if 'reciproc' in pattern_clean and any(word in pattern_clean for word in ['carta', 'paper', 'points']):
                        return {
                            'classification': pattern['classification'],
                            'confidence': 95,
                            'matched_pattern': pattern['nome']
                        }
            
            elif 'gutta' in desc_lower:
                # Cerca pattern RECIPROC + gutta
                for pattern in existing_patterns:
                    pattern_clean = self._clean_material_name(pattern['nome']).lower()
                    if 'reciproc' in pattern_clean and 'gutta' in pattern_clean:
                        return {
                            'classification': pattern['classification'],
                            'confidence': 95,
                            'matched_pattern': pattern['nome']
                        }
            
            elif 'files' in desc_lower:
                # Cerca pattern RECIPROC + files
                for pattern in existing_patterns:
                    pattern_clean = self._clean_material_name(pattern['nome']).lower()
                    if 'reciproc' in pattern_clean and 'files' in pattern_clean:
                        return {
                            'classification': pattern['classification'],
                            'confidence': 95,
                            'matched_pattern': pattern['nome']
                        }
        
        # Regola per FILES senza RECIPROC = ENDODONZIA-STRUMENTI MANUALI
        elif 'files' in desc_lower and 'reciproc' not in desc_lower:
            # Cerca pattern FILES senza RECIPROC
            for pattern in existing_patterns:
                pattern_clean = self._clean_material_name(pattern['nome']).lower()
                if 'files' in pattern_clean and 'reciproc' not in pattern_clean:
                    return {
                        'classification': pattern['classification'],
                        'confidence': 95,
                        'matched_pattern': pattern['nome']
                    }
            
            # Se non trova pattern, usa classificazione hardcoded
            # Cerca un pattern di ENDODONZIA-STRUMENTI MANUALI come riferimento
            for pattern in existing_patterns:
                if (pattern['classification']['brancanome'] == 'ENDODONZIA' and 
                    pattern['classification']['sottocontonome'] == 'STRUMENTI MANUALI'):
                    return {
                        'classification': pattern['classification'],
                        'confidence': 90,
                        'matched_pattern': f"Regola hardcoded: FILES senza RECIPROC"
                    }
        
        # Algoritmo generale per altri materiali
        best_match = None
        best_score = 0
        
        for pattern in existing_patterns:
            pattern_name_clean = self._clean_material_name(pattern['nome'])
            
            # Calcola similarità
            similarity = self._calculate_similarity(descrizione_clean, pattern_name_clean)
            
            if similarity > best_score and similarity >= 0.5:
                best_score = similarity
                best_match = {
                    'classification': pattern['classification'],
                    'confidence': int(similarity * 100),
                    'matched_pattern': pattern['nome']
                }
        
        return best_match
    
    def _clean_material_name(self, name: str) -> str:
        """
        Pulisce il nome del materiale per il matching, rimuovendo varianti e codici.
        
        Args:
            name: Nome originale del materiale
            
        Returns:
            Nome pulito per il matching
        """
        if not name:
            return ""
        
        # Converti in lowercase e rimuovi spazi extra
        cleaned = str(name).lower().strip()
        
        # Rimuovi caratteri speciali comuni
        import re
        cleaned = re.sub(r'[^\w\s]', ' ', cleaned)
        
        # Rimuovi pattern comuni che non influenzano la classificazione
        # Misure e dimensioni
        cleaned = re.sub(r'\b\d+[x×]\d+\b', '', cleaned)  # 6X, 3X, etc.
        cleaned = re.sub(r'\b[a-z]\d+\b', '', cleaned)    # A3, C14, etc.
        cleaned = re.sub(r'\b\d+st\b', '', cleaned)       # 4ST, 6ST, etc.
        cleaned = re.sub(r'\b\d+%\b', '', cleaned)        # Percentuali
        cleaned = re.sub(r'\b\d+ml\b', '', cleaned)       # 10ml, 5ml, etc.
        cleaned = re.sub(r'\b\d+cc\b', '', cleaned)       # 10cc, 5cc, etc.
        cleaned = re.sub(r'\b\d+gr\b', '', cleaned)       # 10gr, 5gr, etc.
        cleaned = re.sub(r'\b\d+mg\b', '', cleaned)       # 10mg, 5mg, etc.
        
        # Rimuovi suffissi comuni
        cleaned = re.sub(r'\b(lt|refill|sterile|steril|r\d+|6x|sterile)\b', '', cleaned)
        
        # Rimuovi spazi multipli
        cleaned = re.sub(r'\s+', ' ', cleaned)
        
        return cleaned.strip()
    
    def _calculate_similarity(self, name1: str, name2: str) -> float:
        """
        Calcola la similarità tra due nomi di materiali.
        
        Args:
            name1: Primo nome
            name2: Secondo nome
            
        Returns:
            Score di similarità tra 0 e 1
        """
        if not name1 or not name2:
            return 0.0
        
        # Match esatto
        if name1 == name2:
            return 1.0
        
        # Match parziale - controlla se uno contiene l'altro
        if name1 in name2 or name2 in name1:
            return 0.9
        
        # Similarità per parole chiave
        words1 = set(name1.split())
        words2 = set(name2.split())
        
        if not words1 or not words2:
            return 0.0
        
        # Calcola Jaccard similarity
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        
        jaccard_score = intersection / union if union > 0 else 0.0
        
        # Bonus per parole chiave dentali comuni
        dental_keywords = {'ml', 'cc', 'gr', 'mg', 'sterile', 'monouso', 'disposable', 'dental', 'dent'}
        common_dental = len(words1.intersection(words2).intersection(dental_keywords))
        
        if common_dental > 0:
            jaccard_score += 0.1 * common_dental
        
        # Bonus per pattern comuni (es. "RECIPROC BLUE" → endodonzia)
        pattern_bonus = 0
        if len(words1) >= 2 and len(words2) >= 2:
            # Controlla se le prime 2-3 parole sono simili
            words1_list = list(words1)
            words2_list = list(words2)
            
            # Conta parole comuni nelle prime posizioni
            min_words = min(len(words1_list), len(words2_list), 3)
            common_start = 0
            for i in range(min_words):
                if words1_list[i] in words2_list or words2_list[i] in words1_list:
                    common_start += 1
            
            if common_start >= 2:
                pattern_bonus = 0.2
        
        # Bonus per match di brand/famiglia (es. "CELTRA", "RECIPROC")
        brand_keywords = {'celtra', 'reciproc', 'sdr', 'flow', 'blue', 'paper', 'files'}
        common_brand = len(words1.intersection(words2).intersection(brand_keywords))
        
        if common_brand > 0:
            pattern_bonus += 0.15 * common_brand
        
        # Bonus per match specifici di categoria
        category_keywords = {'paper', 'points', 'files', 'gutta', 'guttapercha', 'compositi', 'blocchetti'}
        common_category = len(words1.intersection(words2).intersection(category_keywords))
        
        if common_category > 0:
            pattern_bonus += 0.25 * common_category  # Bonus maggiore per categorie specifiche
        
        final_score = jaccard_score + pattern_bonus
        return min(final_score, 1.0)

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
    
    def import_materials_for_supplier(self, supplier_name: str, materials: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Importa i materiali per un fornitore specifico.
        
        Args:
            supplier_name: Nome del fornitore
            materials: Lista di materiali da importare
            
        Returns:
            Dizionario con statistiche dell'importazione
        """
        try:
            stats = {
                'supplier_name': supplier_name,
                'materials_imported': 0,
                'materials_updated': 0,
                'materials_skipped': 0,
                'total_processed': len(materials),
                'errors': []
            }
            
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                for material in materials:
                    try:
                        # Verifica se il materiale esiste già
                        existing_query = """
                            SELECT id FROM materiali 
                            WHERE codicearticolo = ? AND fornitoreid = ?
                        """
                        existing = cursor.execute(existing_query, (
                            material.get('codicearticolo', ''),
                            material.get('fornitoreid', 0)
                        )).fetchone()
                        
                        if existing:
                            # Aggiorna materiale esistente
                            update_query = """
                                UPDATE materiali SET
                                    nome = ?, fornitorenome = ?, costo_unitario = ?,
                                    confidence = ?, confermato = ?, occorrenze = ?,
                                    categoria_contabile = ?, contoid = ?, brancaid = ?, sottocontoid = ?,
                                    contonome = ?, brancanome = ?, sottocontonome = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            """
                            cursor.execute(update_query, (
                                material.get('nome', ''),
                                material.get('fornitorenome', ''),
                                material.get('costo_unitario', 0.0),
                                material.get('confidence', 0),
                                material.get('confermato', False),
                                material.get('occorrenze', 1),
                                material.get('categoria_contabile', ''),
                                material.get('contoid'),
                                material.get('brancaid'),
                                material.get('sottocontoid'),
                                material.get('contonome'),
                                material.get('brancanome'),
                                material.get('sottocontonome'),
                                existing[0]
                            ))
                            stats['materials_updated'] += 1
                        else:
                            # Inserisci nuovo materiale
                            insert_query = """
                                INSERT INTO materiali (
                                    codicearticolo, nome, fornitoreid, fornitorenome,
                                    costo_unitario, confidence, confermato, occorrenze,
                                    categoria_contabile, contoid, brancaid, sottocontoid,
                                    contonome, brancanome, sottocontonome,
                                    source_file, migrated_at, created_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            """
                            cursor.execute(insert_query, (
                                material.get('codicearticolo', ''),
                                material.get('nome', ''),
                                material.get('fornitoreid', 0),
                                material.get('fornitorenome', ''),
                                material.get('costo_unitario', 0.0),
                                material.get('confidence', 0),
                                material.get('confermato', False),
                                material.get('occorrenze', 1),
                                material.get('categoria_contabile', ''),
                                material.get('contoid'),
                                material.get('brancaid'),
                                material.get('sottocontoid'),
                                material.get('contonome'),
                                material.get('brancanome'),
                                material.get('sottocontonome'),
                                'VOCISPES.DBF'
                            ))
                            stats['materials_imported'] += 1
                            
                    except Exception as e:
                        logger.error(f"Errore nell'importazione materiale {material.get('nome', '')}: {e}")
                        stats['errors'].append(f"Materiale {material.get('nome', '')}: {str(e)}")
                        stats['materials_skipped'] += 1
                
                conn.commit()
                
            logger.info(f"Importazione completata per {supplier_name}: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Errore nell'importazione per fornitore {supplier_name}: {e}")
            raise DatabaseError(f"Errore nell'importazione: {str(e)}")

    def search_articles_in_spesafo(self, query: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Cerca articoli nelle fatture fornitori (SPESAFOR.DBF) con dettagli da VOCISPES.DBF.
        
        Args:
            query: Termine di ricerca
            limit: Numero massimo di risultati
            
        Returns:
            Lista di articoli trovati con dettagli fattura
        """
        try:
            from dbfread import DBF
            
            # Percorsi dei file DBF
            spesafo_path = os.path.join('..', 'windent', 'DATI', 'SPESAFOR.DBF')
            fornitor_path = os.path.join('..', 'windent', 'DATI', 'FORNITOR.DBF')
            vocispes_path = os.path.join('..', 'windent', 'DATI', 'VOCISPES.DBF')
            
            logger.info(f"Searching articles in SPESAFOR.DBF with query: {query}")
            
            # Carica FORNITOR per i nomi fornitori
            fornitor_map = {}
            with DBF(fornitor_path, encoding='latin-1') as fornitor_table:
                for record in fornitor_table:
                    fornitor_map[record.get('CODICE', '')] = record.get('NOME', '')
            
            results = []
            query_lower = query.lower()
            
            # Cerca in SPESAFOR
            with DBF(spesafo_path, encoding='latin-1') as spesafo_table:
                for record in spesafo_table:
                    # Cerca nel codice articolo e descrizione
                    codice_articolo = record.get('CODICE', '')
                    descrizione = record.get('DESCRIZIONE', '')
                    
                    if (query_lower in codice_articolo.lower() or 
                        query_lower in descrizione.lower()):
                        
                        # Cerca i dettagli in VOCISPES
                        vocispes_details = []
                        with DBF(vocispes_path, encoding='latin-1') as vocispes_table:
                            for vocispes_record in vocispes_table:
                                if (vocispes_record.get('CODICE', '') == codice_articolo and
                                    vocispes_record.get('NUMERO', '') == record.get('NUMERO', '')):
                                    vocispes_details.append(vocispes_record)
                        
                        # Costruisci il risultato
                        for detail in vocispes_details:
                            result = {
                                'codice_articolo': codice_articolo,
                                'descrizione': descrizione,
                                'quantita': detail.get('QUANTITA', 0),
                                'prezzo_unitario': detail.get('PREZZO', 0),
                                'fattura': {
                                    'id': f"{record.get('CODICE_FORNITORE', '')}_{record.get('NUMERO', '')}",
                                    'numero_documento': record.get('NUMERO', ''),
                                    'codice_fornitore': record.get('CODICE_FORNITORE', ''),
                                    'nome_fornitore': fornitor_map.get(record.get('CODICE_FORNITORE', ''), ''),
                                    'data_spesa': record.get('DATA', ''),
                                    'costo_totale': record.get('TOTALE', 0)
                                }
                            }
                            results.append(result)
                            
                            if len(results) >= limit:
                                break
                    
                    if len(results) >= limit:
                        break
            
            logger.info(f"Found {len(results)} articles matching query: {query}")
            return results
            
        except Exception as e:
            logger.error(f"Errore nella ricerca articoli: {e}")
            raise DatabaseError(f"Errore nella ricerca: {str(e)}")
