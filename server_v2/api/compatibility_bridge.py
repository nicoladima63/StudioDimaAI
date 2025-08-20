"""
API Compatibility Bridge for StudioDimaAI Server V2.

This module provides a compatibility layer that maintains exact API response formats
while using the new Service Layer architecture. It enables gradual migration from
the oversized API files to the modernized service-based architecture without
breaking changes to the frontend React components.

Key Features:
- Maintains exact API response formats for backward compatibility
- Bridges between old API endpoints and new service layer
- Supports gradual migration endpoint by endpoint
- Preserves all existing functionality during transition
- Comprehensive error handling with original error response formats
"""

import logging
import traceback
import math
from typing import Any, Dict, List, Optional, Tuple, Union
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..services.materiali_service import MaterialiService
from ..services.fornitori_service import FornitoriService
from ..services.classificazioni_service import ClassificazioniService
from ..services.statistiche_service import StatisticheService
from ..core.database_manager import get_database_manager
from ..core.exceptions import ServiceError, ValidationError, BusinessLogicError

logger = logging.getLogger(__name__)


class CompatibilityBridge:
    """
    Compatibility bridge that translates between old API contracts and new services.
    
    This class ensures that all existing API endpoints continue to work exactly
    as before while leveraging the new service layer architecture underneath.
    """
    
    def __init__(self):
        """Initialize the compatibility bridge with service instances."""
        self.db_manager = get_database_manager()
        self.materiali_service = MaterialiService(self.db_manager)
        self.fornitori_service = FornitoriService(self.db_manager)
        self.classificazioni_service = ClassificazioniService(self.db_manager)
        self.statistiche_service = StatisticheService(self.db_manager)
    
    def bridge_materiali_endpoints(self, blueprint: Blueprint) -> None:
        """Bridge materiali endpoints to maintain compatibility."""
        
        @blueprint.route('/save-classificazione', methods=['POST'])
        @jwt_required()
        def save_classificazione_materiale():
            """Maintain exact compatibility with original save-classificazione endpoint."""
            try:
                data = request.get_json() or {}
                
                # Extract data in original format
                material_data = {
                    'codicearticolo': data.get('codice_articolo', '').strip(),
                    'nome': data.get('descrizione', '').strip(),
                    'fornitoreid': data.get('codice_fornitore', '').strip(),
                    'fornitorenome': data.get('nome_fornitore', '').strip()
                }
                
                classification_data = {
                    'contoid': data.get('contoid'),
                    'contonome': data.get('conto_nome', '').strip(),
                    'brancaid': data.get('brancaid'),
                    'brancanome': data.get('branca_nome', '').strip(),
                    'sottocontoid': data.get('sottocontoid'),
                    'sottocontonome': data.get('sottoconto_codice', '').strip(),
                    'categoria_contabile': data.get('categoria_contabile', '').strip(),
                    'metodo_classificazione': data.get('metodo_classificazione', 'manuale'),
                    'confidence': int(data.get('confidence', 100))
                }
                
                # Validate required fields (original logic)
                if not (material_data['nome'] and material_data['fornitoreid']):
                    return jsonify({
                        'success': False, 
                        'error': 'descrizione e codice_fornitore sono obbligatori'
                    }), 400
                
                # Use service layer
                result = self.materiali_service.classify_material(
                    material_data, classification_data, force_update=True
                )
                
                # Return exact original format
                return jsonify({
                    'success': True,
                    'message': f'Classificazione {"aggiornata" if result.get("updated") else "salvata"} con successo',
                    'data': {
                        'id': result['id'],
                        'operazione': 'aggiornata' if result.get('updated') else 'salvata'
                    }
                })
                
            except ValidationError as e:
                return jsonify({'success': False, 'error': str(e)}), 400
            except Exception as e:
                logger.error(f"Errore save_classificazione_materiale: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @blueprint.route('/fornitori/<fornitore_id>/materiali-intelligenti', methods=['GET'])
        @jwt_required()
        def get_materiali_intelligenti(fornitore_id):
            """Maintain exact compatibility with materiali-intelligenti endpoint."""
            try:
                # Get query parameters (original format)
                show_classified = request.args.get('show_classified', 'false').lower() == 'true'
                
                # Use service layer
                result = self.materiali_service.get_intelligent_materials_for_supplier(
                    fornitore_id, 
                    show_classified=show_classified,
                    apply_smart_filters=True
                )
                
                # Transform to exact original response format
                materials_data = []
                for material in result['materials']:
                    material_dict = {
                        'codice_articolo': material.get('codicearticolo', ''),
                        'descrizione': material.get('nome', ''),
                        'prezzo_unitario': self._safe_float(material.get('costo_unitario')),
                        'quantita': self._safe_float(material.get('quantita', 0)),
                        'totale_riga': self._safe_float(material.get('totale_riga', 0)),
                        'fattura_id': material.get('fattura_id', ''),
                        'data_fattura': material.get('data_fattura'),
                        'riga_fattura_id': material.get('riga_fattura_id', ''),
                        'riga_originale_id': str(material.get('id', ''))
                    }
                    
                    # Add classification suggestions (original format)
                    if 'classification_suggestions' in material:
                        suggestions = material['classification_suggestions']
                        if suggestions:
                            best_suggestion = suggestions[0]
                            material_dict['classificazione_suggerita'] = {
                                'contoid': best_suggestion.get('contoid'),
                                'brancaid': best_suggestion.get('brancaid'),
                                'sottocontoid': best_suggestion.get('sottocontoid'),
                                'confidence': best_suggestion.get('confidence', 0),
                                'motivo': best_suggestion.get('motivo', 'Nessun suggerimento disponibile')
                            }
                    
                    materials_data.append(material_dict)
                
                # Return exact original format
                return jsonify({
                    'success': True,
                    'data': materials_data,
                    'count': len(materials_data),
                    'fornitore_id': fornitore_id,
                    'filtri_applicati': {
                        'esclusi_amministrativi': True,
                        'esclusi_valore_zero': True,
                        'mantenuti_ref': True,
                        'prezzo_minimo': 0
                    }
                })
                
            except Exception as e:
                logger.error(f"Errore get_materiali_intelligenti per fornitore {fornitore_id}: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @blueprint.route('/confirm-da-verificare', methods=['POST'])
        @jwt_required()
        def confirm_da_verificare():
            """Maintain exact compatibility with confirm-da-verificare endpoint."""
            try:
                # Use service to confirm auto-classifications
                result = self.materiali_service.confirm_auto_classifications(confidence_threshold=80)
                
                # Return exact original format
                return jsonify({
                    'success': True,
                    'message': 'Classificazioni confermate',
                    'materiali_confermati': result['confirmed_count']
                })
                
            except Exception as e:
                logger.error(f"Errore confirm_da_verificare: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @blueprint.route('/insert-bundle', methods=['POST'])
        @jwt_required()
        def insert_materiali_bundle():
            """Maintain exact compatibility with insert-bundle endpoint."""
            try:
                data = request.get_json() or {}
                materiali = data.get('materiali', [])
                
                if not materiali:
                    return jsonify({'success': False, 'error': 'Array materiali obbligatorio'}), 400
                
                # Use service layer
                result = self.materiali_service.bulk_save_materials(materiali)
                
                # Return exact original format
                return jsonify({
                    'success': True,
                    'message': f'Bundle processato: {result["inserted_count"]} salvati, {result["error_count"]} falliti',
                    'materiali_salvati': result['inserted_count'],
                    'materiali_falliti': result['error_count'],
                    'errori': result.get('errors')
                })
                
            except Exception as e:
                logger.error(f"Errore insert_materiali_bundle: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @blueprint.route('/salva-classificazione', methods=['POST'])
        @jwt_required()
        def salva_classificazione_materiale():
            """Maintain exact compatibility with salva-classificazione endpoint."""
            try:
                data = request.get_json()
                
                # Extract and validate data (original format)
                required_fields = ['descrizione', 'codice_fornitore', 'nome_fornitore', 'contoid']
                for field in required_fields:
                    if not data.get(field):
                        return jsonify({
                            'success': False,
                            'error': f'Campo obbligatorio mancante: {field}'
                        }), 400
                
                # Prepare data for service
                material_data = {
                    'codicearticolo': data.get('codice_articolo', '').strip(),
                    'nome': data.get('descrizione', '').strip(),
                    'fornitoreid': data.get('codice_fornitore', '').strip(),
                    'fornitorenome': data.get('nome_fornitore', '').strip()
                }
                
                classification_data = {
                    'contoid': int(data.get('contoid')),
                    'contonome': data.get('contonome', '').strip() if data.get('contonome') else None,
                    'brancaid': int(data.get('brancaid')) if data.get('brancaid') else None,
                    'brancanome': data.get('brancanome', '').strip() if data.get('brancanome') else None,
                    'sottocontoid': int(data.get('sottocontoid')) if data.get('sottocontoid') else None,
                    'sottocontonome': data.get('sottocontonome', '').strip() if data.get('sottocontonome') else None
                }
                
                # Use service layer
                result = self.materiali_service.classify_material(
                    material_data, classification_data, force_update=True
                )
                
                # Return exact original format
                return jsonify({
                    'success': True,
                    'message': f'Classificazione materiale {"aggiornata" if result.get("updated") else "salvata"} correttamente',
                    'data': {
                        'codicearticolo': material_data['codicearticolo'],
                        'nome': material_data['nome'],
                        'contoid': classification_data['contoid'],
                        'brancaid': classification_data['brancaid'],
                        'sottocontoid': classification_data['sottocontoid'],
                        'operazione': 'aggiornata' if result.get('updated') else 'salvata'
                    }
                })
                
            except Exception as e:
                logger.error(f"Errore salvataggio classificazione materiale: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
    
    def bridge_fornitori_endpoints(self, blueprint: Blueprint) -> None:
        """Bridge fornitori endpoints to maintain compatibility."""
        
        @blueprint.route('/fornitori/<fornitore_id>/classificazione', methods=['GET'])
        @jwt_required()
        def get_classificazione_fornitore(fornitore_id):
            """Maintain exact compatibility with classificazione endpoint."""
            try:
                # Use service layer
                classification = self.fornitori_service.get_supplier_classification(fornitore_id)
                
                if classification:
                    # Return exact original format
                    return jsonify({
                        'success': True,
                        'data': {
                            'contoid': classification.get('contoid'),
                            'brancaid': classification.get('brancaid') if classification.get('brancaid') != 0 else None,
                            'sottocontoid': classification.get('sottocontoid') if classification.get('sottocontoid') != 0 else None
                        }
                    })
                else:
                    return jsonify({
                        'success': True,
                        'data': {
                            'contoid': None,
                            'brancaid': None,
                            'sottocontoid': None
                        }
                    })
                    
            except Exception as e:
                logger.error(f"Errore nel recupero classificazione fornitore {fornitore_id}: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
    
    def bridge_classificazioni_endpoints(self, blueprint: Blueprint) -> None:
        """Bridge classificazioni endpoints to maintain compatibility."""
        
        @blueprint.route('/fornitore/<fornitore_id>/completa', methods=['PUT'])
        @jwt_required()
        def classifica_fornitore_completa(fornitore_id):
            """Maintain exact compatibility with completa classification endpoint."""
            try:
                data = request.get_json()
                
                if not data:
                    return jsonify({
                        "success": False,
                        "error": "Dati JSON richiesti"
                    }), 400
                
                # Validate required fields (original logic)
                contoid = data.get('contoid')
                if not contoid:
                    return jsonify({
                        "success": False,
                        "error": "contoid è richiesto"
                    }), 400
                
                # Prepare classification data
                classification_data = {
                    'contoid': contoid,
                    'brancaid': data.get('brancaid', 0),
                    'sottocontoid': data.get('sottocontoid', 0),
                    'fornitore_nome': data.get('fornitore_nome'),
                    'note': data.get('note'),
                    'metodo_classificazione': 'manuale'
                }
                
                # Use service layer
                result = self.classificazioni_service.classify_entity_complete(
                    fornitore_id, 'fornitore', classification_data
                )
                
                # Get updated classification for response
                updated_classification = self.fornitori_service.get_supplier_classification(fornitore_id)
                
                # Return exact original format
                return jsonify({
                    "success": True,
                    "message": "Fornitore classificato con successo",
                    "data": updated_classification
                }), 200
                
            except ValidationError as e:
                return jsonify({"success": False, "error": str(e)}), 400
            except Exception as e:
                logger.error(f"Errore classificazione fornitore {fornitore_id}: {e}")
                return jsonify({"success": False, "error": str(e)}), 500
        
        @blueprint.route('/fornitore/<fornitore_id>/suggest-categoria', methods=['GET'])
        @jwt_required()
        def suggest_categoria_fornitore(fornitore_id):
            """Maintain exact compatibility with suggest-categoria endpoint."""
            try:
                # Use service layer
                suggestions = self.classificazioni_service.suggest_classification(
                    fornitore_id, 'fornitore', include_explanations=True
                )
                
                # Transform to original format
                formatted_suggestions = []
                for suggestion in suggestions:
                    formatted_suggestions.append({
                        'contoid': suggestion.get('contoid'),
                        'contonome': suggestion.get('contonome', ''),
                        'brancaid': suggestion.get('brancaid'),
                        'brancanome': suggestion.get('brancanome', ''),
                        'sottocontoid': suggestion.get('sottocontoid'),
                        'sottocontonome': suggestion.get('sottocontonome', ''),
                        'confidence': suggestion.get('confidence', 0),
                        'motivo': suggestion.get('explanation', suggestion.get('motivo', '')),
                        'source': suggestion.get('source', 'pattern_analysis')
                    })
                
                # Return exact original format
                return jsonify({
                    'success': True,
                    'suggestions': formatted_suggestions,
                    'fornitore_id': fornitore_id
                })
                
            except Exception as e:
                logger.error(f"Errore suggest categoria per fornitore {fornitore_id}: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
    
    def bridge_statistiche_endpoints(self, blueprint: Blueprint) -> None:
        """Bridge statistiche endpoints to maintain compatibility."""
        
        @blueprint.route('/statistiche', methods=['GET'])
        @jwt_required()
        def get_statistiche_fornitori():
            """Maintain exact compatibility with statistiche endpoint."""
            try:
                # Extract query parameters (original format)
                filters = {}
                time_period = {}
                
                if request.args.get('contoid'):
                    filters['contoid'] = int(request.args.get('contoid'))
                if request.args.get('brancaid'):
                    filters['brancaid'] = int(request.args.get('brancaid'))
                if request.args.get('sottocontoid'):
                    filters['sottocontoid'] = int(request.args.get('sottocontoid'))
                
                # Time period parameters
                time_period['periodo'] = request.args.get('periodo', 'anno_corrente')
                
                if request.args.get('anni'):
                    anni_str = request.args.get('anni')
                    time_period['anni'] = [int(year.strip()) for year in anni_str.split(',')]
                
                if request.args.get('data_inizio'):
                    time_period['data_inizio'] = request.args.get('data_inizio')
                if request.args.get('data_fine'):
                    time_period['data_fine'] = request.args.get('data_fine')
                
                # Use service layer
                result = self.statistiche_service.get_comprehensive_supplier_statistics(
                    filters=filters,
                    time_period=time_period,
                    include_trends=True,
                    use_cache=True
                )
                
                # Transform to exact original response format
                suppliers_response = []
                for supplier in result.get('suppliers', []):
                    supplier_dict = {
                        'fornitore_id': supplier.get('fornitore_id'),
                        'fornitore_nome': supplier.get('fornitore_nome'),
                        'contoid': supplier.get('contoid'),
                        'conto_nome': supplier.get('conto_nome'),
                        'brancaid': supplier.get('brancaid'),
                        'branca_nome': supplier.get('branca_nome'),
                        'sottocontoid': supplier.get('sottocontoid'),
                        'sottoconto_nome': supplier.get('sottoconto_nome'),
                        'total_amount': self._safe_float(supplier.get('total_amount')),
                        'total_materials': self._safe_int(supplier.get('total_materials')),
                        'unique_invoices': self._safe_int(supplier.get('unique_invoices')),
                        'avg_amount': self._safe_float(supplier.get('avg_amount')),
                        'classification_confidence': self._safe_int(supplier.get('classification_confidence'))
                    }
                    suppliers_response.append(supplier_dict)
                
                # Return exact original format
                return jsonify({
                    'success': True,
                    'data': suppliers_response,
                    'summary': result.get('summary', {}),
                    'filtri_applicati': {
                        'contoid': filters.get('contoid'),
                        'brancaid': filters.get('brancaid'),
                        'sottocontoid': filters.get('sottocontoid'),
                        'periodo': time_period.get('periodo'),
                        'anni': time_period.get('anni'),
                        'data_inizio': time_period.get('data_inizio'),
                        'data_fine': time_period.get('data_fine')
                    },
                    'metadata': {
                        'generated_at': datetime.now().isoformat(),
                        'total_suppliers': len(suppliers_response)
                    }
                })
                
            except Exception as e:
                logger.error(f"Errore get_statistiche_fornitori: {e}")
                return jsonify({'success': False, 'error': str(e)}), 500
    
    def _safe_float(self, value: Any) -> float:
        """Safely convert value to float, handling NaN for JSON compatibility."""
        try:
            if value is None:
                return 0.0
            float_val = float(value)
            # Convert NaN to 0 for JSON compatibility (as per CLAUDE.md requirements)
            if math.isnan(float_val):
                return 0.0
            return float_val
        except (ValueError, TypeError):
            return 0.0
    
    def _safe_int(self, value: Any) -> int:
        """Safely convert value to int."""
        try:
            if value is None:
                return 0
            return int(float(value))  # Convert through float first to handle string numbers
        except (ValueError, TypeError):
            return 0
    
    def create_blueprint(self, name: str, url_prefix: str) -> Blueprint:
        """Create a blueprint with all compatibility bridges applied."""
        blueprint = Blueprint(name, __name__, url_prefix=url_prefix)
        
        # Apply all endpoint bridges
        if 'materiali' in name:
            self.bridge_materiali_endpoints(blueprint)
        elif 'fornitori' in name:
            self.bridge_fornitori_endpoints(blueprint)
        elif 'classificazioni' in name:
            self.bridge_classificazioni_endpoints(blueprint)
        elif 'statistiche' in name:
            self.bridge_statistiche_endpoints(blueprint)
        
        return blueprint
    
    def handle_error_compatibility(self, error: Exception) -> Tuple[Dict[str, Any], int]:
        """Handle errors in original API format for compatibility."""
        if isinstance(error, ValidationError):
            return {'success': False, 'error': str(error)}, 400
        elif isinstance(error, BusinessLogicError):
            return {
                'success': False, 
                'error': str(error),
                'details': getattr(error, 'details', None)
            }, 422
        elif isinstance(error, ServiceError):
            return {'success': False, 'error': str(error)}, 500
        else:
            # Log unexpected errors but return generic message
            logger.error(f"Unexpected error in compatibility bridge: {error}")
            logger.error(traceback.format_exc())
            return {'success': False, 'error': 'Internal server error'}, 500


# Global compatibility bridge instance
compatibility_bridge = CompatibilityBridge()


def create_compatible_blueprint(name: str, url_prefix: str) -> Blueprint:
    """
    Factory function to create compatible blueprints.
    
    This function creates Flask blueprints that maintain exact API compatibility
    while using the new service layer underneath.
    """
    return compatibility_bridge.create_blueprint(name, url_prefix)


def apply_error_handling(blueprint: Blueprint) -> None:
    """Apply standard error handling to blueprint for compatibility."""
    
    @blueprint.errorhandler(ValidationError)
    def handle_validation_error(error):
        response, status_code = compatibility_bridge.handle_error_compatibility(error)
        return jsonify(response), status_code
    
    @blueprint.errorhandler(BusinessLogicError)
    def handle_business_logic_error(error):
        response, status_code = compatibility_bridge.handle_error_compatibility(error)
        return jsonify(response), status_code
    
    @blueprint.errorhandler(ServiceError)
    def handle_service_error(error):
        response, status_code = compatibility_bridge.handle_error_compatibility(error)
        return jsonify(response), status_code
    
    @blueprint.errorhandler(Exception)
    def handle_general_error(error):
        response, status_code = compatibility_bridge.handle_error_compatibility(error)
        return jsonify(response), status_code