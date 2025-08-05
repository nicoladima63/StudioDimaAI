"""
Servizio per l'analisi delle fatture XML SDI per migliorare la categorizzazione automatica
"""

import os
import xml.etree.ElementTree as ET
import logging
from typing import Dict, List, Optional, Tuple, Set
from collections import defaultdict, Counter
import re

logger = logging.getLogger(__name__)

class XMLParserService:
    """Servizio per l'estrazione di pattern dalle fatture XML SDI"""
    
    def __init__(self, xml_folder_path: str = None):
        if xml_folder_path is None:
            # Path di default alle fatture di esempio - va alla root del progetto
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            self.xml_folder_path = os.path.join(project_root, 'sample_fatture_xml')
        else:
            self.xml_folder_path = xml_folder_path
        
        self.fornitori_patterns = {}
        self.categorie_patterns = defaultdict(list)
        self.codici_articolo = defaultdict(list)
        
        logger.info(f"XMLParserService inizializzato con path: {self.xml_folder_path}")
        
    def analyze_xml_files(self) -> Dict:
        """
        Analizza tutti i file XML nella cartella e estrae pattern utili
        
        Returns:
            Dict con pattern estratti per categoria
        """
        if not os.path.exists(self.xml_folder_path):
            logger.error(f"Cartella XML non trovata: {self.xml_folder_path}")
            return {}
            
        xml_files = [f for f in os.listdir(self.xml_folder_path) if f.endswith('.xml')]
        logger.info(f"Analizzando {len(xml_files)} fatture XML...")
        
        analysis_results = {
            'fornitori_identificati': {},
            'pattern_per_categoria': {},
            'codici_articolo_per_categoria': {},
            'aliquote_iva': {},
            'statistiche': {}
        }
        
        for xml_file in xml_files:
            try:
                file_path = os.path.join(self.xml_folder_path, xml_file)
                patterns = self._analyze_single_xml(file_path)
                
                if patterns:
                    # Accumula i risultati
                    fornitore = patterns.get('fornitore', {})
                    if fornitore.get('piva'):
                        analysis_results['fornitori_identificati'][fornitore['piva']] = {
                            'denominazione': fornitore.get('denominazione', ''),
                            'categoria_suggerita': patterns.get('categoria_suggerita', ''),
                            'confidence': patterns.get('confidence', 0.0),
                            'pattern_chiave': patterns.get('pattern_chiave', []),
                            'descrizioni_prodotti': patterns.get('descrizioni', []),
                            'codici_articolo': patterns.get('codici_articolo', []),
                            'aliquote_iva': patterns.get('aliquote_iva', [])
                        }
                        
            except Exception as e:
                logger.error(f"Errore nell'analisi di {xml_file}: {e}")
                continue
        
        # Genera pattern aggregati per categoria
        analysis_results['pattern_per_categoria'] = self._generate_category_patterns(analysis_results['fornitori_identificati'])
        analysis_results['statistiche'] = self._generate_statistics(analysis_results['fornitori_identificati'])
        
        return analysis_results
    
    def _analyze_single_xml(self, file_path: str) -> Optional[Dict]:
        """
        Analizza una singola fattura XML
        
        Args:
            file_path: Path al file XML
            
        Returns:
            Dict con i pattern estratti dalla fattura
        """
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Gestisce i namespace
            namespaces = {
                'p': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2',
                'P': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2'
            }
            
            # Estrai dati fornitore
            fornitore_data = self._extract_fornitore_data(root, namespaces)
            if not fornitore_data:
                return None
                
            # Estrai righe di dettaglio
            dettaglio_data = self._extract_dettaglio_data(root, namespaces)
            
            # Determina categoria basandosi sui dati estratti
            categoria, confidence, pattern_chiave = self._determine_categoria(fornitore_data, dettaglio_data)
            
            return {
                'fornitore': fornitore_data,
                'descrizioni': dettaglio_data.get('descrizioni', []),
                'codici_articolo': dettaglio_data.get('codici_articolo', []),
                'aliquote_iva': dettaglio_data.get('aliquote_iva', []),
                'categoria_suggerita': categoria,
                'confidence': confidence,
                'pattern_chiave': pattern_chiave
            }
            
        except Exception as e:
            logger.error(f"Errore nel parsing di {file_path}: {e}")
            return None
    
    def _extract_fornitore_data(self, root, namespaces) -> Dict:
        """Estrae dati del fornitore dalla fattura"""
        fornitore_data = {}
        
        # Cerca in entrambi i namespace possibili
        for ns_prefix in ['p', 'P', '']:
            ns = {ns_prefix: namespaces.get(ns_prefix, '')} if ns_prefix else {}
            
            # P.IVA Cedente
            piva_elem = root.find(f'.//{ns_prefix}:IdFiscaleIVA/{ns_prefix}:IdCodice' if ns_prefix else './/IdFiscaleIVA/IdCodice', ns)
            if piva_elem is not None:
                fornitore_data['piva'] = piva_elem.text
                
            # Denominazione
            denom_elem = root.find(f'.//{ns_prefix}:CedentePrestatore/{ns_prefix}:DatiAnagrafici/{ns_prefix}:Anagrafica/{ns_prefix}:Denominazione' if ns_prefix else './/CedentePrestatore/DatiAnagrafici/Anagrafica/Denominazione', ns)
            if denom_elem is not None:
                fornitore_data['denominazione'] = denom_elem.text
                
            if fornitore_data.get('piva') and fornitore_data.get('denominazione'):
                break
        
        return fornitore_data
    
    def _extract_dettaglio_data(self, root, namespaces) -> Dict:
        """Estrae i dettagli delle righe dalla fattura"""
        dettaglio_data = {
            'descrizioni': [],
            'codici_articolo': [],
            'aliquote_iva': []
        }
        
        # Cerca in entrambi i namespace possibili
        for ns_prefix in ['p', 'P', '']:
            ns = {ns_prefix: namespaces.get(ns_prefix, '')} if ns_prefix else {}
            
            # Trova tutte le righe di dettaglio
            dettaglio_xpath = f'.//{ns_prefix}:DettaglioLinee' if ns_prefix else './/DettaglioLinee'
            dettaglio_linee = root.findall(dettaglio_xpath, ns)
            
            for linea in dettaglio_linee:
                # Descrizione
                desc_elem = linea.find(f'{ns_prefix}:Descrizione' if ns_prefix else 'Descrizione', ns)
                if desc_elem is not None and desc_elem.text:
                    dettaglio_data['descrizioni'].append(desc_elem.text)
                
                # Codice Articolo
                codice_elem = linea.find(f'{ns_prefix}:CodiceArticolo/{ns_prefix}:CodiceValore' if ns_prefix else 'CodiceArticolo/CodiceValore', ns)
                if codice_elem is not None and codice_elem.text:
                    dettaglio_data['codici_articolo'].append(codice_elem.text)
                
                # Aliquota IVA
                iva_elem = linea.find(f'{ns_prefix}:AliquotaIVA' if ns_prefix else 'AliquotaIVA', ns)
                if iva_elem is not None and iva_elem.text:
                    try:
                        aliquota = float(iva_elem.text)
                        dettaglio_data['aliquote_iva'].append(aliquota)
                    except ValueError:
                        pass
            
            if dettaglio_data['descrizioni']:  # Se ha trovato dati, esci dal loop
                break
        
        return dettaglio_data
    
    def _determine_categoria(self, fornitore_data: Dict, dettaglio_data: Dict) -> Tuple[str, float, List[str]]:
        """
        Determina la categoria basandosi sui dati estratti
        
        Returns:
            Tuple (categoria, confidence, pattern_chiave)
        """
        denominazione = fornitore_data.get('denominazione', '').lower()
        descrizioni = [d.lower() for d in dettaglio_data.get('descrizioni', [])]
        pattern_chiave = []
        
        # Pattern per fornitori noti
        if 'dentsply' in denominazione or 'sirona' in denominazione:
            return 'Materiali Dentali', 0.95, ['dentsply sirona - fornitore dentale leader']
            
        if 'fastweb' in denominazione:
            return 'Telecomunicazioni', 0.90, ['fastweb - provider internet']
            
        if 'tim' in denominazione or 'telecom' in denominazione:
            return 'Telecomunicazioni', 0.90, ['tim - operatore telefonico']
            
        if 'enel' in denominazione or 'forini' in denominazione:
            return 'Utenze', 0.85, ['fornitore energia elettrica']
        
        # Pattern basati su descrizioni prodotti
        desc_text = ' '.join(descrizioni)
        
        # Materiali dentali - pattern specifici
        dental_patterns = [
            'implant', 'hex', 'seven', 'abutment', 'crown', 'bridge',
            'endodontic', 'composite', 'resin', 'drill', 'bur'
        ]
        dental_matches = [p for p in dental_patterns if p in desc_text]
        if dental_matches:
            return 'Materiali Dentali', 0.80, dental_matches
        
        # Telecomunicazioni - pattern
        telecom_patterns = [
            'nexxt business', 'seconda linea', 'contributo attivazione',
            'canone', 'fibra', 'adsl', 'internet'
        ]
        telecom_matches = [p for p in telecom_patterns if p in desc_text]
        if telecom_matches:
            return 'Telecomunicazioni', 0.75, telecom_matches
        
        # Utenze - pattern
        utility_patterns = [
            'pod:', 'quota per consumi', 'quota fissa', 'quota potenza',
            'kwh', 'energia elettrica', 'bolletta'
        ]
        utility_matches = [p for p in utility_patterns if p in desc_text]
        if utility_matches:
            return 'Utenze', 0.80, utility_matches
            
        return 'Varie', 0.1, ['pattern non riconosciuto']
    
    def _generate_category_patterns(self, fornitori_data: Dict) -> Dict:
        """Genera pattern aggregati per categoria"""
        category_patterns = defaultdict(lambda: {
            'keywords': set(),
            'denominazioni': set(),
            'codici_articolo': set(),
            'confidence_media': 0.0
        })
        
        for piva, data in fornitori_data.items():
            categoria = data.get('categoria_suggerita', 'Varie')
            
            # Aggiungi keywords
            for pattern in data.get('pattern_chiave', []):
                category_patterns[categoria]['keywords'].add(pattern)
            
            # Aggiungi denominazione fornitore
            if data.get('denominazione'):
                category_patterns[categoria]['denominazioni'].add(data['denominazione'].lower())
            
            # Aggiungi codici articolo
            for codice in data.get('codici_articolo', []):
                category_patterns[categoria]['codici_articolo'].add(codice)
        
        # Converti set in liste per JSON serialization
        result = {}
        for categoria, patterns in category_patterns.items():
            result[categoria] = {
                'keywords': list(patterns['keywords']),
                'denominazioni': list(patterns['denominazioni']),
                'codici_articolo': list(patterns['codici_articolo'])
            }
        
        return result
    
    def _generate_statistics(self, fornitori_data: Dict) -> Dict:
        """Genera statistiche sull'analisi"""
        stats = {
            'totale_fornitori': len(fornitori_data),
            'fornitori_per_categoria': defaultdict(int),
            'confidence_media_per_categoria': defaultdict(list)
        }
        
        for data in fornitori_data.values():
            categoria = data.get('categoria_suggerita', 'Varie')
            confidence = data.get('confidence', 0.0)
            
            stats['fornitori_per_categoria'][categoria] += 1
            stats['confidence_media_per_categoria'][categoria].append(confidence)
        
        # Calcola confidence media
        for categoria, confidences in stats['confidence_media_per_categoria'].items():
            if confidences:
                stats['confidence_media_per_categoria'][categoria] = sum(confidences) / len(confidences)
        
        return dict(stats)

# Istanza globale del service
xml_parser_service = XMLParserService()