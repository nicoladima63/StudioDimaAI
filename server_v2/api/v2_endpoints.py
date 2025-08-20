"""
New V2 API Endpoints for StudioDimaAI Server V2.

This module provides the new, modern API endpoints that showcase the full
power of the service layer architecture. These endpoints can coexist with
the compatibility bridge during migration.

Features:
- Modern REST API design with proper HTTP status codes
- Comprehensive error handling and validation
- OpenAPI-compliant response structures
- Advanced features not available in legacy endpoints
- Performance optimizations through service layer
- Rich metadata and analytics capabilities
"""

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from .compatibility_bridge import compatibility_bridge

logger = logging.getLogger(__name__)

# Create V2 API blueprint
api_v2 = Blueprint('api_v2', __name__, url_prefix='/api/v2')


@api_v2.route('/health', methods=['GET'])
def health_check():
    """V2 API health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'version': '2.0.0',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'materiali_service': 'active',
            'fornitori_service': 'active',
            'classificazioni_service': 'active',
            'statistiche_service': 'active'
        }
    })


@api_v2.route('/materials', methods=['GET'])
@jwt_required()
def get_materials():
    """
    Get materials with advanced filtering and pagination.
    
    Query parameters:
    - search: Search term for material description
    - supplier_id: Filter by supplier ID
    - classification_level: Filter by classification completeness
    - page: Page number (default: 1)
    - page_size: Items per page (default: 20)
    - include_suggestions: Include classification suggestions for unclassified items
    """
    try:
        # Parse query parameters
        search_query = request.args.get('search')
        supplier_id = request.args.get('supplier_id')
        classification_level = request.args.get('classification_level')
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 20))
        include_suggestions = request.args.get('include_suggestions', 'false').lower() == 'true'
        
        # Build classification filters
        classification_filters = {}
        if request.args.get('contoid'):
            classification_filters['contoid'] = int(request.args.get('contoid'))
        if request.args.get('brancaid'):
            classification_filters['brancaid'] = int(request.args.get('brancaid'))
        if request.args.get('sottocontoid'):
            classification_filters['sottocontoid'] = int(request.args.get('sottocontoid'))
        
        # Use service layer
        result = compatibility_bridge.materiali_service.search_materials(
            search_query=search_query,
            supplier_id=supplier_id,
            classification_filters=classification_filters if classification_filters else None,
            page=page,
            page_size=page_size
        )
        
        # Add suggestions if requested
        if include_suggestions:
            for material in result['materials']:
                if material.get('classification_status') == 'unclassified':
                    suggestions = compatibility_bridge.materiali_service.get_classification_suggestions(material)
                    material['suggestions'] = suggestions[:3]  # Top 3 suggestions
        
        # Return modern API format
        return jsonify({
            'success': True,
            'data': {
                'materials': result['materials'],
                'pagination': result['pagination'],
                'filters_applied': {
                    'search_query': search_query,
                    'supplier_id': supplier_id,
                    'classification_filters': classification_filters,
                    'include_suggestions': include_suggestions
                },
                'metadata': {
                    'total_count': result['pagination']['total_count'],
                    'has_more': result['pagination']['has_more'],
                    'generated_at': datetime.now().isoformat()
                }
            }
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': {
                'type': 'validation_error',
                'message': f'Invalid parameter: {str(e)}',
                'code': 'INVALID_PARAMETER'
            }
        }), 400
    except Exception as e:
        logger.error(f"Error in V2 get_materials: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@api_v2.route('/materials/<int:material_id>/analytics', methods=['GET'])
@jwt_required()
def get_material_analytics(material_id):
    """Get comprehensive analytics for a specific material."""
    try:
        analytics = compatibility_bridge.materiali_service.get_material_analytics(material_id)
        
        return jsonify({
            'success': True,
            'data': {
                'material_id': material_id,
                'analytics': analytics,
                'generated_at': datetime.now().isoformat()
            }
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': {
                'type': 'not_found',
                'message': f'Material {material_id} not found',
                'code': 'MATERIAL_NOT_FOUND'
            }
        }), 404
    except Exception as e:
        logger.error(f"Error in V2 get_material_analytics: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@api_v2.route('/suppliers', methods=['GET'])
@jwt_required()
def get_suppliers():
    """
    Get suppliers with advanced filtering and analytics.
    
    Query parameters:
    - classification_status: Filter by classification status (classified/unclassified/partial)
    - performance_tier: Filter by performance tier (premium/standard/basic)
    - include_analytics: Include analytics data for each supplier
    - page: Page number (default: 1)
    - page_size: Items per page (default: 20)
    """
    try:
        # Parse query parameters
        classification_status = request.args.get('classification_status')
        performance_tier = request.args.get('performance_tier')
        include_analytics = request.args.get('include_analytics', 'false').lower() == 'true'
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 20))
        
        # Get unclassified suppliers if requested
        if classification_status == 'unclassified':
            result = compatibility_bridge.fornitori_service.get_unclassified_suppliers(
                limit=page_size if page == 1 else None,
                priority_scoring=True
            )
            suppliers_data = result['unclassified_suppliers']
            
            # Add analytics if requested
            if include_analytics:
                for supplier in suppliers_data:
                    supplier_id = supplier['codice_fornitore']
                    analytics = compatibility_bridge.fornitori_service.get_supplier_analytics(supplier_id)
                    supplier['analytics'] = analytics
            
            return jsonify({
                'success': True,
                'data': {
                    'suppliers': suppliers_data,
                    'total_count': len(suppliers_data),
                    'classification_status': classification_status,
                    'metadata': result['metadata']
                }
            })
        
        # For other cases, use comprehensive statistics
        filters = {}
        time_period = {'periodo': 'anno_corrente'}
        
        result = compatibility_bridge.statistiche_service.get_comprehensive_supplier_statistics(
            filters=filters,
            time_period=time_period,
            include_trends=True,
            use_cache=True
        )
        
        suppliers_data = result['suppliers']
        
        # Apply performance tier filter
        if performance_tier:
            suppliers_data = [s for s in suppliers_data if s.get('performance_tier') == performance_tier]
        
        # Pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_suppliers = suppliers_data[start_idx:end_idx]
        
        return jsonify({
            'success': True,
            'data': {
                'suppliers': paginated_suppliers,
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total_count': len(suppliers_data),
                    'has_more': end_idx < len(suppliers_data)
                },
                'summary': result.get('summary', {}),
                'filters_applied': {
                    'classification_status': classification_status,
                    'performance_tier': performance_tier,
                    'include_analytics': include_analytics
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Error in V2 get_suppliers: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@api_v2.route('/suppliers/<supplier_id>/analytics', methods=['GET'])
@jwt_required()
def get_supplier_analytics(supplier_id):
    """Get comprehensive analytics for a specific supplier."""
    try:
        analytics = compatibility_bridge.fornitori_service.get_supplier_analytics(supplier_id)
        
        return jsonify({
            'success': True,
            'data': {
                'supplier_id': supplier_id,
                'analytics': analytics,
                'generated_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error in V2 get_supplier_analytics: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@api_v2.route('/classification/suggestions', methods=['POST'])
@jwt_required()
def get_classification_suggestions():
    """
    Get intelligent classification suggestions for entities.
    
    Request body:
    {
        "entity_type": "fornitore" | "materiale",
        "entity_id": "string",
        "entity_data": {}, // Optional additional data
        "include_explanations": bool,
        "max_suggestions": int
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'validation_error',
                    'message': 'Request body is required',
                    'code': 'MISSING_REQUEST_BODY'
                }
            }), 400
        
        entity_type = data.get('entity_type')
        entity_id = data.get('entity_id')
        entity_data = data.get('entity_data', {})
        include_explanations = data.get('include_explanations', True)
        max_suggestions = data.get('max_suggestions', 5)
        
        if not entity_type or not entity_id:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'validation_error',
                    'message': 'entity_type and entity_id are required',
                    'code': 'MISSING_REQUIRED_FIELDS'
                }
            }), 400
        
        # Use service layer
        suggestions = compatibility_bridge.classificazioni_service.suggest_classification(
            entity_id=entity_id,
            entity_type=entity_type,
            entity_data=entity_data,
            include_explanations=include_explanations
        )
        
        # Limit suggestions
        limited_suggestions = suggestions[:max_suggestions]
        
        return jsonify({
            'success': True,
            'data': {
                'entity_id': entity_id,
                'entity_type': entity_type,
                'suggestions': limited_suggestions,
                'suggestion_count': len(limited_suggestions),
                'total_available': len(suggestions),
                'generated_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error in V2 get_classification_suggestions: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@api_v2.route('/classification/bulk', methods=['POST'])
@jwt_required()
def bulk_classify():
    """
    Perform bulk classification with advanced options.
    
    Request body:
    {
        "entity_type": "fornitore" | "materiale",
        "classifications": [
            {
                "entity_id": "string",
                "contoid": int,
                "brancaid": int,
                "sottocontoid": int,
                "confidence": int
            }
        ],
        "options": {
            "confidence_threshold": int,
            "auto_confirm": bool,
            "validate_hierarchy": bool
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'validation_error',
                    'message': 'Request body is required',
                    'code': 'MISSING_REQUEST_BODY'
                }
            }), 400
        
        entity_type = data.get('entity_type')
        classifications = data.get('classifications', [])
        options = data.get('options', {})
        
        if not entity_type or not classifications:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'validation_error',
                    'message': 'entity_type and classifications are required',
                    'code': 'MISSING_REQUIRED_FIELDS'
                }
            }), 400
        
        # Use service layer based on entity type
        if entity_type == 'fornitore':
            result = compatibility_bridge.fornitori_service.bulk_classify_suppliers(
                classifications=classifications,
                confidence_threshold=options.get('confidence_threshold', 80),
                auto_confirm=options.get('auto_confirm', False)
            )
        elif entity_type == 'materiale':
            # Material bulk classification would be implemented
            result = {'success': False, 'error': 'Material bulk classification not yet implemented'}
        else:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'validation_error',
                    'message': f'Unsupported entity_type: {entity_type}',
                    'code': 'INVALID_ENTITY_TYPE'
                }
            }), 400
        
        return jsonify({
            'success': True,
            'data': {
                'entity_type': entity_type,
                'results': result,
                'options_applied': options,
                'processed_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error in V2 bulk_classify: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@api_v2.route('/analytics/dashboard', methods=['GET'])
@jwt_required()
def get_analytics_dashboard():
    """
    Get comprehensive analytics dashboard.
    
    Query parameters:
    - dashboard_type: Type of dashboard (executive/operational/detailed)
    - time_period: Time period for analysis
    - refresh_cache: Force refresh of cached data
    """
    try:
        dashboard_type = request.args.get('dashboard_type', 'executive')
        refresh_cache = request.args.get('refresh_cache', 'false').lower() == 'true'
        
        # Parse time period
        time_period = {}
        if request.args.get('periodo'):
            time_period['periodo'] = request.args.get('periodo')
        if request.args.get('anni'):
            time_period['anni'] = [int(year.strip()) for year in request.args.get('anni').split(',')]
        
        # Use service layer
        dashboard_data = compatibility_bridge.statistiche_service.get_performance_dashboard(
            dashboard_type=dashboard_type,
            time_period=time_period,
            refresh_cache=refresh_cache
        )
        
        return jsonify({
            'success': True,
            'data': dashboard_data
        })
        
    except Exception as e:
        logger.error(f"Error in V2 get_analytics_dashboard: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@api_v2.route('/analytics/advanced-metrics', methods=['POST'])
@jwt_required()
def calculate_advanced_metrics():
    """
    Calculate advanced business metrics.
    
    Request body:
    {
        "metric_type": "roi_analysis" | "cost_efficiency" | "supplier_performance" | ...,
        "entity_ids": ["string"],
        "time_period": {},
        "calculation_options": {}
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'validation_error',
                    'message': 'Request body is required',
                    'code': 'MISSING_REQUEST_BODY'
                }
            }), 400
        
        metric_type = data.get('metric_type')
        entity_ids = data.get('entity_ids', [])
        time_period = data.get('time_period', {})
        calculation_options = data.get('calculation_options', {})
        
        if not metric_type or not entity_ids:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'validation_error',
                    'message': 'metric_type and entity_ids are required',
                    'code': 'MISSING_REQUIRED_FIELDS'
                }
            }), 400
        
        # Use service layer
        result = compatibility_bridge.statistiche_service.calculate_advanced_metrics(
            metric_type=metric_type,
            entity_ids=entity_ids,
            time_period=time_period,
            calculation_options=calculation_options
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Error in V2 calculate_advanced_metrics: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@api_v2.route('/system/performance', methods=['GET'])
@jwt_required()
def get_system_performance():
    """Get system performance metrics and health status."""
    try:
        # Get performance metrics from repository
        performance_metrics = compatibility_bridge.statistiche_repo.get_performance_metrics()
        
        return jsonify({
            'success': True,
            'data': {
                'performance_metrics': performance_metrics,
                'system_status': 'healthy',
                'version': '2.0.0',
                'generated_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error in V2 get_system_performance: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


# Error handlers for V2 API
@api_v2.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': {
            'type': 'not_found',
            'message': 'The requested resource was not found',
            'code': 'RESOURCE_NOT_FOUND'
        }
    }), 404


@api_v2.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'success': False,
        'error': {
            'type': 'method_not_allowed',
            'message': 'The requested method is not allowed for this resource',
            'code': 'METHOD_NOT_ALLOWED'
        }
    }), 405


@api_v2.errorhandler(500)
def internal_server_error(error):
    return jsonify({
        'success': False,
        'error': {
            'type': 'internal_error',
            'message': 'An internal server error occurred',
            'code': 'INTERNAL_ERROR'
        }
    }), 500