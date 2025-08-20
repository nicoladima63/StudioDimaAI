"""Fornitori Service stub for StudioDimaAI Server V2."""

from typing import Dict, Any, Optional
from .base_service import BaseService

class FornitoriService(BaseService):
    def get_fornitori_paginated(self, page=1, per_page=50, filters=None):
        return {'fornitori': [], 'total': 0, 'pages': 0, 'has_next': False, 'has_prev': False}
    
    def get_fornitore_by_id(self, fornitore_id):
        return {'id': fornitore_id, 'nome': 'Demo Fornitore'}
    
    def update_classificazione(self, fornitore_id, contoid, brancaid=0, sottocontoid=0, updated_by=None):
        return {'success': True, 'data': {'classificazione': 'updated'}}
    
    def suggest_categoria(self, fornitore_id):
        return {'suggestions': [{'categoria': 'Demo Category', 'confidence': 0.8}]}