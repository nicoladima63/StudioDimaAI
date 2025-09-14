"""
Template Manager V2 for StudioDimaAI.

Manages SMS templates for recalls and appointment reminders with modern architecture.
Migrated from V1 maintaining all functionality and adding environment support.
"""

import os
import json
import logging
import re
from typing import Dict, Optional, List, Any
from datetime import datetime
from .environment_manager import environment_manager

logger = logging.getLogger(__name__)

# Default templates (migrated from V1)
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
    """
    Template manager with modern architecture and environment support.
    Maintains V1 functionality while adding V2 enhancements.
    """
    
    def __init__(self):
        self.instance_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            'instance'
        )
        self.template_file = os.path.join(self.instance_dir, 'sms_templates.json')
        self._ensure_directories()
        self._load_templates()
    
    def _ensure_directories(self):
        """Create necessary directories if they don't exist."""
        os.makedirs(self.instance_dir, exist_ok=True)
    
    def _load_templates(self):
        """Load templates from file or create defaults."""
        try:
            if os.path.exists(self.template_file):
                with open(self.template_file, 'r', encoding='utf-8') as f:
                    self.templates = json.load(f)
                    # SMS templates loaded
            else:
                self.templates = DEFAULT_TEMPLATES.copy()
                self._save_templates()
                logger.info("Default SMS templates created")
        except Exception as e:
            logger.error(f"Error loading templates: {e}")
            self.templates = DEFAULT_TEMPLATES.copy()
    
    def _save_templates(self):
        """Save templates to file."""
        try:
            with open(self.template_file, 'w', encoding='utf-8') as f:
                json.dump(self.templates, f, ensure_ascii=False, indent=2)
            logger.info("SMS templates saved")
        except Exception as e:
            logger.error(f"Error saving templates: {e}")
            raise
    
    def get_template(self, tipo: str) -> Optional[Dict[str, Any]]:
        """
        Get template by type.
        
        Args:
            tipo: Template type ('richiamo' or 'promemoria')
            
        Returns:
            Template dict or None if not found
        """
        return self.templates.get(tipo)
    
    def get_all_templates(self) -> Dict[str, Any]:
        """Get all templates."""
        return self.templates.copy()
    
    def update_template(self, tipo: str, content: str, description: str = None) -> bool:
        """
        Update template with V1 logic maintained.
        
        Args:
            tipo: Template type
            content: New template content
            description: Optional description
            
        Returns:
            True if successful
        """
        if tipo not in self.templates:
            return False
        
        try:
            # Extract variables from new template
            variables = self._extract_variables(content)
            
            self.templates[tipo]['content'] = content
            self.templates[tipo]['variables'] = variables
            
            if description is not None:
                self.templates[tipo]['description'] = description
            
            # Add modification timestamp
            self.templates[tipo]['last_modified'] = datetime.now().isoformat()
            
            self._save_templates()
            logger.info(f"Template {tipo} updated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error updating template {tipo}: {e}")
            return False
    
    def reset_template(self, tipo: str) -> bool:
        """
        Reset template to defaults (V1 logic).
        
        Args:
            tipo: Template type to reset
            
        Returns:
            True if successful
        """
        if tipo not in DEFAULT_TEMPLATES:
            return False
        
        try:
            self.templates[tipo] = DEFAULT_TEMPLATES[tipo].copy()
            self.templates[tipo]['last_modified'] = datetime.now().isoformat()
            self._save_templates()
            logger.info(f"Template {tipo} reset to default")
            return True
        except Exception as e:
            logger.error(f"Error resetting template {tipo}: {e}")
            return False
    
    def render_template(self, tipo: str, data: Dict[str, Any]) -> str:
        """
        Render template with data (V1 logic maintained).
        
        Args:
            tipo: Template type
            data: Data for variable substitution
            
        Returns:
            Rendered template
            
        Raises:
            ValueError: If template not found
        """
        template = self.get_template(tipo)
        if not template:
            raise ValueError(f"Template {tipo} not found")
        
        content = template['content']
        
        # Replace variables (V1 logic)
        for var in template['variables']:
            placeholder = f"{{{var}}}"
            value = data.get(var, f"[{var}]")  # Use placeholder if value missing
            content = content.replace(placeholder, str(value))
        
        return content
    
    def _extract_variables(self, content: str) -> List[str]:
        """
        Extract variables from template content (V1 logic).
        
        Args:
            content: Template content
            
        Returns:
            List of variable names found
        """
        variables = re.findall(r'\{([^}]+)\}', content)
        return list(set(variables))  # Remove duplicates
    
    def validate_template(self, content: str) -> Dict[str, Any]:
        """
        Validate template content (V1 logic maintained).
        
        Args:
            content: Template content to validate
            
        Returns:
            Validation result dict
        """
        result = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'stats': {}
        }
        
        # Length check (SMS limit)
        if len(content) > 160:
            result['warnings'].append(
                f"Template is {len(content)} characters. SMS may be split into multiple parts."
            )
        
        # Variable extraction
        variables = self._extract_variables(content)
        result['stats']['variables_count'] = len(variables)
        result['stats']['variables'] = variables
        result['stats']['length'] = len(content)
        result['stats']['estimated_sms_parts'] = (len(content) // 160) + 1
        
        # Problematic characters check
        problematic_chars = ['"', '"', ''', ''']
        for char in problematic_chars:
            if char in content:
                result['warnings'].append(
                    f"Potentially problematic character found: {char}"
                )
        
        return result
    
    def preview_template(self, tipo: str, data: Dict[str, Any] = None, 
                        custom_content: str = None) -> Dict[str, Any]:
        """
        Generate template preview (V1 logic + V2 enhancements).
        
        Args:
            tipo: Template type
            data: Optional custom data
            custom_content: Optional custom content to preview
            
        Returns:
            Preview result dict
        """
        try:
            # Use custom content or saved template
            if custom_content:
                content = custom_content
                variables = self._extract_variables(content)
            else:
                template = self.get_template(tipo)
                if not template:
                    return {
                        'success': False,
                        'error': 'TEMPLATE_NOT_FOUND',
                        'message': f'Template {tipo} not found'
                    }
                content = template['content']
                variables = template['variables']
            
            # Default sample data (V1 logic)
            sample_data = {
                'richiamo': {
                    'nome_completo': 'Mario Rossi',
                    'tipo_richiamo': 'Controllo periodico',
                    'data_richiamo': '15/08/2025'
                },
                'promemoria': {
                    'nome_completo': 'Lucia Bianchi',
                    'data_appuntamento': '20/07/2025',
                    'ora_appuntamento': '10:30',
                    'tipo_appuntamento': 'Visita di controllo',
                    'medico': 'Dr. Rossi'
                }
            }
            
            # Use provided data or defaults
            preview_data = data or {}
            final_data = {**sample_data.get(tipo, {}), **preview_data}
            
            # Render template
            if custom_content:
                # Manual rendering for custom content
                rendered = content
                for var, value in final_data.items():
                    placeholder = f"{{{var}}}"
                    rendered = rendered.replace(placeholder, str(value))
            else:
                rendered = self.render_template(tipo, final_data)
            
            # Validation
            validation = self.validate_template(content)
            
            return {
                'success': True,
                'preview': rendered,
                'sample_data': final_data,
                'validation': validation,
                'stats': {
                    'length': len(rendered),
                    'estimated_sms_parts': (len(rendered) // 160) + 1,
                    'variables_count': len(variables),
                    'variables': variables
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating preview for {tipo}: {e}")
            return {
                'success': False,
                'error': 'PREVIEW_ERROR',
                'message': f'Error generating preview: {str(e)}'
            }
    
    def get_template_stats(self) -> Dict[str, Any]:
        """Get templates statistics."""
        stats = {
            'total_templates': len(self.templates),
            'templates': {}
        }
        
        for tipo, template in self.templates.items():
            content = template.get('content', '')
            stats['templates'][tipo] = {
                'length': len(content),
                'variables_count': len(template.get('variables', [])),
                'estimated_sms_parts': (len(content) // 160) + 1,
                'last_modified': template.get('last_modified', 'N/A')
            }
        
        return stats
    
    def backup_templates(self) -> Dict[str, Any]:
        """Create templates backup."""
        try:
            backup_file = os.path.join(
                self.instance_dir, 
                f'sms_templates_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            )
            
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(self.templates, f, ensure_ascii=False, indent=2)
            
            return {
                'success': True,
                'backup_file': backup_file,
                'message': 'Templates backed up successfully'
            }
            
        except Exception as e:
            logger.error(f"Error creating templates backup: {e}")
            return {
                'success': False,
                'error': 'BACKUP_ERROR',
                'message': f'Error creating backup: {str(e)}'
            }
    
    def restore_templates(self, backup_file: str) -> Dict[str, Any]:
        """Restore templates from backup."""
        try:
            if not os.path.exists(backup_file):
                return {
                    'success': False,
                    'error': 'FILE_NOT_FOUND',
                    'message': 'Backup file not found'
                }
            
            with open(backup_file, 'r', encoding='utf-8') as f:
                backup_templates = json.load(f)
            
            # Validate backup
            for tipo in ['richiamo', 'promemoria']:
                if tipo not in backup_templates:
                    return {
                        'success': False,
                        'error': 'INVALID_BACKUP',
                        'message': f'Invalid backup: missing {tipo} template'
                    }
            
            # Create current backup before restore
            current_backup = self.backup_templates()
            
            # Restore templates
            self.templates = backup_templates
            self._save_templates()
            
            return {
                'success': True,
                'message': 'Templates restored successfully',
                'current_backup': current_backup.get('backup_file', 'N/A')
            }
            
        except Exception as e:
            logger.error(f"Error restoring templates: {e}")
            return {
                'success': False,
                'error': 'RESTORE_ERROR',
                'message': f'Error restoring templates: {str(e)}'
            }


# Global instance (singleton pattern like V1)
template_manager = TemplateManager()