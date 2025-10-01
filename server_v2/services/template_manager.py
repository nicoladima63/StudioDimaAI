import re
import os
from typing import Dict, Any

class TemplateManager:
    def __init__(self, base_path="templates"):
        self.base_path = base_path

    def _get_template_path(self, template_name: str) -> str:
        return os.path.join(self.base_path, f"{template_name}.html")

    def _get_template_content(self, template_path: str) -> str:
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()

    def _replace_placeholders(self, content: str, data: Dict[str, Any]) -> str:
        def replace_match(match):
            key = match.group(1)
            return str(data.get(key, f"{{{{{key}}}}}}")) # Keep placeholder if key not found
        return re.sub(r'\{\{(\w+)\}\}', replace_match, content)

    def get_available_templates(self) -> list[str]:
        templates = []
        if os.path.exists(self.base_path):
            for filename in os.listdir(self.base_path):
                if filename.endswith(".html"):
                    templates.append(os.path.splitext(filename)[0])
        return templates

    def preview_template(self, template_name: str, data: Dict[str, Any]) -> str:
        template_path = self._get_template_path(template_name)
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template '{template_name}' not found at {template_path}")
        
        content = self._get_template_content(template_path)
        processed_content = self._replace_placeholders(content, data)
        return processed_content

    def render_template(self, template_name: str, data: Dict[str, Any]) -> str:
        # This might be a more final rendering, potentially with more complex logic
        # For now, it can just call preview_template
        return self.preview_template(template_name, data)
