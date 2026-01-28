
import logging
from flask import Blueprint, request, g
from flask_jwt_extended import jwt_required

from app_v2 import format_response
from services.provider_service import ProviderService
from core.exceptions import ValidationError, DatabaseError

logger = logging.getLogger(__name__)
providers_bp = Blueprint('providers_v2', __name__)

@providers_bp.route('/providers', methods=['GET'])
@jwt_required()
def get_providers():
    """Get all providers."""
    try:
        service = ProviderService(g.database_manager)
        providers = service.get_all_providers()
        return format_response(data=providers, message=f"Retrieved {len(providers)} providers")
    except Exception as e:
        logger.error(f"Error getting providers: {e}", exc_info=True)
        return format_response(success=False, error="Failed to retrieve providers"), 500

@providers_bp.route('/providers/<int:provider_id>', methods=['GET'])
@jwt_required()
def get_provider(provider_id):
    """Get provider details."""
    try:
        service = ProviderService(g.database_manager)
        provider = service.get_provider_by_id(provider_id)
        if not provider:
            return format_response(success=False, error="Provider not found"), 404
        return format_response(data=provider)
    except Exception as e:
        logger.error(f"Error getting provider {provider_id}: {e}", exc_info=True)
        return format_response(success=False, error="Failed to retrieve provider"), 500

@providers_bp.route('/providers', methods=['POST'])
@jwt_required()
def create_provider():
    """Create a new provider."""
    try:
        data = request.get_json()
        service = ProviderService(g.database_manager)
        new_provider = service.create_provider(data)
        return format_response(data=new_provider, message="Provider created successfully"), 201
    except ValidationError as e:
        return format_response(success=False, error=str(e)), 400
    except Exception as e:
        logger.error(f"Error creating provider: {e}", exc_info=True)
        return format_response(success=False, error="Failed to create provider"), 500

@providers_bp.route('/providers/<int:provider_id>', methods=['PUT'])
@jwt_required()
def update_provider(provider_id):
    """Update a provider."""
    try:
        data = request.get_json()
        service = ProviderService(g.database_manager)
        updated = service.update_provider(provider_id, data)
        if not updated:
            return format_response(success=False, error="Provider not found"), 404
        return format_response(data=updated, message="Provider updated successfully")
    except Exception as e:
        logger.error(f"Error updating provider {provider_id}: {e}", exc_info=True)
        return format_response(success=False, error="Failed to update provider"), 500

@providers_bp.route('/providers/<int:provider_id>', methods=['DELETE'])
@jwt_required()
def delete_provider(provider_id):
    """Delete (soft) a provider."""
    try:
        service = ProviderService(g.database_manager)
        result = service.delete_provider(provider_id)
        if not result:
            return format_response(success=False, error="Provider not found"), 404
        return format_response(message="Provider deleted successfully")
    except Exception as e:
        logger.error(f"Error deleting provider {provider_id}: {e}", exc_info=True)
        return format_response(success=False, error="Failed to delete provider"), 500
