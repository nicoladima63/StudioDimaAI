# server/app/core/template_manager.py

import os
import json
import logging
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Directory per i template
TEMPLATE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../instance/templates'))

# Template di default
DEFAULT_TEMPLATES = {
    'richiamo': {
        'content': '''Ciao {nome_completo},

Ti ricordiamo che è tempo per il tuo richiamo ({tipo_richiamo}).
Ti proponiamo un appuntamento intorno al {data_richiamo}.

Contattaci per fissarlo.
Grazie!

Studio Dima''',
        'variables': ['nome_completo', 'tipo_richiamo', 'data_richiamo'],
        'description': 'Template per SMS di richiamo controlli'
    },
    'promemoria': {
        'content': '''Ciao {nome_completo},

Ti ricordiamo l\'appuntamento di domani {data_appuntamento} alle ore {ora_appuntamento}.

Tipo: {tipo_appuntamento}
Con: {medico}

Per necessità, contattaci.
Grazie!

Studio Dima''',
        'variables': ['nome_completo', 'data_appuntamento', 'ora_appuntamento', 'tipo_appuntamento', 'medico'],
        'description': 'Template per SMS promemoria appuntamenti'
    }
}

class TemplateManager:
    """Gestore dei template SMS"""
    
    def __init__(self):
        self.template_file = os.path.join(TEMPLATE_DIR, 'sms_templates.json')
        self._ensure_template_dir()
        self._load_templates()
    
    def _ensure_template_dir(self):
        """Crea la directory dei template se non esiste"""
        os.makedirs(TEMPLATE_DIR, exist_ok=True)
    
    def _load_templates(self):
        """Carica i template dal file o crea quelli di default"""
        try:
            if os.path.exists(self.template_file):
                with open(self.template_file, 'r', encoding='utf-8') as f:
                    self.templates = json.load(f)
                    logger.info("Template SMS caricati da file")
            else:
                self.templates = DEFAULT_TEMPLATES.copy()
                self._save_templates()
                logger.info("Template SMS default creati")
        except Exception as e:
            logger.error(f"Errore caricamento template: {e}")
            self.templates = DEFAULT_TEMPLATES.copy()
    
    def _save_templates(self):
        """Salva i template su file"""
        try:
            with open(self.template_file, 'w', encoding='utf-8') as f:
                json.dump(self.templates, f, ensure_ascii=False, indent=2)
            logger.info("Template SMS salvati")
        except Exception as e:
            logger.error(f"Errore salvataggio template: {e}")
            raise
    
    def get_template(self, tipo: str) -> Optional[Dict]:
        """
        Ottiene un template per tipo
        
        Args:
            tipo: 'richiamo' o 'promemoria'
            
        Returns:
            Dict con template o None se non trovato
        """
        return self.templates.get(tipo)
    
    def get_all_templates(self) -> Dict:
        """Ottiene tutti i template"""
        return self.templates.copy()
    
    def update_template(self, tipo: str, content: str, description: str = None) -> bool:
        """
        Aggiorna un template
        
        Args:
            tipo: Tipo di template ('richiamo' o 'promemoria')
            content: Nuovo contenuto del template
            description: Nuova descrizione (opzionale)
            
        Returns:
            True se aggiornato con successo
        """
        if tipo not in self.templates:
            return False
        
        try:
            # Estrai le variabili dal nuovo template
            variables = self._extract_variables(content)
            
            self.templates[tipo]['content'] = content
            self.templates[tipo]['variables'] = variables
            
            if description:
                self.templates[tipo]['description'] = description
            
            # Aggiungi timestamp di modifica
            self.templates[tipo]['last_modified'] = datetime.now().isoformat()
            
            self._save_templates()
            logger.info(f"Template {tipo} aggiornato")
            return True
            
        except Exception as e:
            logger.error(f"Errore aggiornamento template {tipo}: {e}")
            return False
    
    def reset_template(self, tipo: str) -> bool:
        """
        Resetta un template ai valori di default
        
        Args:
            tipo: Tipo di template da resettare
            
        Returns:
            True se resettato con successo
        """
        if tipo not in DEFAULT_TEMPLATES:
            return False
        
        try:
            self.templates[tipo] = DEFAULT_TEMPLATES[tipo].copy()
            self.templates[tipo]['last_modified'] = datetime.now().isoformat()
            self._save_templates()
            logger.info(f"Template {tipo} resettato")
            return True
        except Exception as e:
            logger.error(f"Errore reset template {tipo}: {e}")
            return False
    
    def render_template(self, tipo: str, data: Dict) -> str:
        """
        Renderizza un template sostituendo le variabili
        
        Args:
            tipo: Tipo di template
            data: Dati per sostituire le variabili
            
        Returns:
            Template renderizzato
        """
        template = self.get_template(tipo)
        if not template:
            raise ValueError(f"Template {tipo} non trovato")
        
        content = template['content']
        
        # Sostituisci le variabili
        for var in template['variables']:
            placeholder = f"{{{var}}}"
            value = data.get(var, f"[{var}]")  # Usa placeholder se valore mancante
            content = content.replace(placeholder, str(value))
        
        return content
    
    def _extract_variables(self, content: str) -> list:
        """
        Estrae le variabili dal template (formato {variabile})
        
        Args:
            content: Contenuto del template
            
        Returns:
            Lista delle variabili trovate
        """
        import re
        variables = re.findall(r'\{([^}]+)\}', content)
        return list(set(variables))  # Rimuove duplicati
    
    def validate_template(self, content: str) -> Dict:
        """
        Valida un template
        
        Args:
            content: Contenuto da validare
            
        Returns:
            Dict con risultato validazione
        """
        result = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'stats': {}
        }
        
        # Controllo lunghezza (SMS max 160 caratteri standard)
        if len(content) > 160:
            result['warnings'].append(f"Template lungo {len(content)} caratteri. SMS potrebbe essere diviso in più parti.")
        
        # Controllo variabili
        variables = self._extract_variables(content)
        result['stats']['variables_count'] = len(variables)
        result['stats']['variables'] = variables
        result['stats']['length'] = len(content)
        
        # Controllo caratteri problematici
        problematic_chars = ['"', '"', ''', ''']
        for char in problematic_chars:
            if char in content:
                result['warnings'].append(f"Carattere potenzialmente problematico trovato: {char}")
        
        return result

# Istanza globale del manager
template_manager = TemplateManager()