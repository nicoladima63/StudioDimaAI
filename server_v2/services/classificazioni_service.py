"""Classificazioni Service stub for StudioDimaAI Server V2."""

from typing import Dict, Any, Optional
from .base_service import BaseService

class ClassificazioniService(BaseService):
    def get_conti(self):
        return [{'id': 1, 'nome': 'Conto Demo 1'}, {'id': 2, 'nome': 'Conto Demo 2'}]
    
    def get_branche(self, conto_id):
        return [{'id': 1, 'nome': 'Branca Demo 1'}, {'id': 2, 'nome': 'Branca Demo 2'}]
    
    def get_sottoconti(self, branca_id):
        return [{'id': 1, 'nome': 'Sottoconto Demo 1'}]
    
    def auto_suggest_classification(self, text, context=''):
        return {
            'suggestions': [
                {'contoid': 1, 'confidence': 0.8, 'reason': 'Pattern match'},
                {'contoid': 2, 'confidence': 0.6, 'reason': 'Historical data'}
            ]
        }
    
    def learn_classification(self, text, contoid, brancaid=0, sottocontoid=0, confidence=1.0, learned_by=None):
        return {'success': True, 'learned': True}