"""
Templates API V2 for StudioDimaAI.

Modern API endpoints for SMS template management with V1 functionality maintained.
Integrates with V2 environment system and follows V2 patterns.
"""

import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from typing import Dict, Any

from core.template_manager import template_manager
from app_v2 import format_response
from core.exceptions import ValidationError

logger = logging.getLogger(__name__)

# Create blueprint
templates_v2_bp = Blueprint('templates_v2', __name__)


@templates_v2_bp.route('/templates', methods=['GET'])
@jwt_required()
def get_all_templates():
    """
    Get all SMS templates.
    
    Returns:
        JSON response with all available templates
    """
    try:
        templates = template_manager.get_all_templates()
        stats = template_manager.get_template_stats()
        
        return format_response(
            success=True,
            data={
                'templates': templates,
                'stats': stats
            },
            message='Templates retrieved successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error in get_all_templates: {e}")
        return format_response(
            success=False,
            error='TEMPLATES_ERROR',
            message=f'Error retrieving templates: {str(e)}',
            state='error'
        ), 500


@templates_v2_bp.route('/templates/<tipo>', methods=['GET'])
@jwt_required()
def get_template(tipo: str):
    """
    Get specific template by type.
    
    Args:
        tipo: Template type ('richiamo' or 'promemoria')
        
    Returns:
        JSON response with requested template
    """
    try:
        if tipo not in ['richiamo', 'promemoria']:
            return format_response(
                success=False,
                error='INVALID_TEMPLATE_TYPE',
                message='Template type must be: richiamo, promemoria',
                state='error'
            ), 400
        
        template = template_manager.get_template(tipo)
        
        if not template:
            return format_response(
                success=False,
                error='TEMPLATE_NOT_FOUND',
                message=f'Template {tipo} not found',
                state='error'
            ), 404
        
        return format_response(
            success=True,
            data={
                'template': template,
                'tipo': tipo
            },
            message=f'Template {tipo} retrieved successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error in get_template {tipo}: {e}")
        return format_response(
            success=False,
            error='TEMPLATE_ERROR',
            message=f'Error retrieving template: {str(e)}',
            state='error'
        ), 500


@templates_v2_bp.route('/templates/<tipo>', methods=['PUT'])
@jwt_required()
def update_template(tipo: str):
    """
    Update template content.
    
    Args:
        tipo: Template type to update
        
    Request JSON:
    {
        "content": "New template content",
        "description": "New description (optional)"
    }
    
    Returns:
        JSON response with update result
    """
    try:
        if tipo not in ['richiamo', 'promemoria']:
            return format_response(
                success=False,
                error='INVALID_TEMPLATE_TYPE',
                message='Template type must be: richiamo, promemoria',
                state='error'
            ), 400
        
        data = request.get_json()
        
        if not data or 'content' not in data:
            return format_response(
                success=False,
                error='CONTENT_REQUIRED',
                message='Template content is required',
                state='error'
            ), 400
        
        content = data['content']
        description = data.get('description')
        
        # Validate template first
        validation = template_manager.validate_template(content)
        
        if not validation['valid'] and validation['errors']:
            return format_response(
                success=False,
                error='TEMPLATE_INVALID',
                message='Template validation failed',
                data={
                    'validation_errors': validation['errors'],
                    'validation': validation
                },
                state='error'
            ), 400
        
        # Update template
        success = template_manager.update_template(tipo, content, description)
        
        if not success:
            return format_response(
                success=False,
                error='UPDATE_FAILED',
                message='Failed to update template',
                state='error'
            ), 500
        
        # Get updated template
        updated_template = template_manager.get_template(tipo)
        
        return format_response(
            success=True,
            data={
                'template': updated_template,
                'validation': validation
            },
            message=f'Template {tipo} updated successfully',
            state='success' if not validation['warnings'] else 'warning'
        ), 200
        
    except Exception as e:
        logger.error(f"Error updating template {tipo}: {e}")
        return format_response(
            success=False,
            error='UPDATE_ERROR',
            message=f'Error updating template: {str(e)}',
            state='error'
        ), 500


@templates_v2_bp.route('/templates/<tipo>/reset', methods=['POST'])
@jwt_required()
def reset_template(tipo: str):
    """
    Reset template to default values.
    
    Args:
        tipo: Template type to reset
        
    Returns:
        JSON response with reset result
    """
    try:
        if tipo not in ['richiamo', 'promemoria']:
            return format_response(
                success=False,
                error='INVALID_TEMPLATE_TYPE',
                message='Template type must be: richiamo, promemoria',
                state='error'
            ), 400
        
        success = template_manager.reset_template(tipo)
        
        if not success:
            return format_response(
                success=False,
                error='RESET_FAILED',
                message=f'Failed to reset template {tipo}',
                state='error'
            ), 500
        
        # Get reset template
        reset_template = template_manager.get_template(tipo)
        
        return format_response(
            success=True,
            data={
                'template': reset_template
            },
            message=f'Template {tipo} reset to default values',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error resetting template {tipo}: {e}")
        return format_response(
            success=False,
            error='RESET_ERROR',
            message=f'Error resetting template: {str(e)}',
            state='error'
        ), 500


@templates_v2_bp.route('/templates/<tipo>/preview', methods=['POST'])
@jwt_required()
def preview_template(tipo: str):
    """
    Generate template preview with sample data.
    
    Args:
        tipo: Template type
        
    Request JSON:
    {
        "content": "Custom template content (optional)",
        "data": {
            "nome_completo": "Mario Rossi",
            ...
        }
    }
    
    Returns:
        JSON response with preview
    """
    try:
        if tipo not in ['richiamo', 'promemoria']:
            return format_response(
                success=False,
                error='INVALID_TEMPLATE_TYPE',
                message='Template type must be: richiamo, promemoria',
                state='error'
            ), 400
        
        request_data = request.get_json() or {}
        custom_content = request_data.get('content')
        preview_data = request_data.get('data')
        
        # Generate preview
        preview_result = template_manager.preview_template(
            tipo=tipo,
            data=preview_data,
            custom_content=custom_content
        )
        
        if preview_result['success']:
            return format_response(
                success=True,
                data=preview_result,
                message='Template preview generated successfully',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=preview_result.get('error', 'PREVIEW_FAILED'),
                message=preview_result.get('message', 'Failed to generate preview'),
                state='error'
            ), 400
            
    except Exception as e:
        logger.error(f"Error generating preview for {tipo}: {e}")
        return format_response(
            success=False,
            error='PREVIEW_ERROR',
            message=f'Error generating preview: {str(e)}',
            state='error'
        ), 500


@templates_v2_bp.route('/templates/validate', methods=['POST'])
@jwt_required()
def validate_template():
    """
    Validate template content without saving.
    
    Request JSON:
    {
        "content": "Template content to validate"
    }
    
    Returns:
        JSON response with validation result
    """
    try:
        data = request.get_json()
        
        if not data or 'content' not in data:
            return format_response(
                success=False,
                error='CONTENT_REQUIRED',
                message='Template content is required for validation',
                state='error'
            ), 400
        
        content = data['content']
        validation = template_manager.validate_template(content)
        
        return format_response(
            success=True,
            data={
                'validation': validation,
                'content_length': len(content)
            },
            message='Template validation completed',
            state='success' if validation['valid'] and not validation['errors'] else 'warning'
        ), 200
        
    except Exception as e:
        logger.error(f"Error validating template: {e}")
        return format_response(
            success=False,
            error='VALIDATION_ERROR',
            message=f'Error validating template: {str(e)}',
            state='error'
        ), 500


@templates_v2_bp.route('/templates/stats', methods=['GET'])
@jwt_required()
def get_template_stats():
    """
    Get templates statistics.
    
    Returns:
        JSON response with statistics
    """
    try:
        stats = template_manager.get_template_stats()
        
        return format_response(
            success=True,
            data=stats,
            message='Template statistics retrieved successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error getting template stats: {e}")
        return format_response(
            success=False,
            error='STATS_ERROR',
            message=f'Error retrieving statistics: {str(e)}',
            state='error'
        ), 500


@templates_v2_bp.route('/templates/backup', methods=['POST'])
@jwt_required()
def backup_templates():
    """
    Create templates backup.
    
    Returns:
        JSON response with backup result
    """
    try:
        result = template_manager.backup_templates()
        
        if result['success']:
            return format_response(
                success=True,
                data={
                    'backup_file': result['backup_file']
                },
                message='Templates backup created successfully',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=result.get('error', 'BACKUP_FAILED'),
                message=result.get('message', 'Failed to create backup'),
                state='error'
            ), 500
            
    except Exception as e:
        logger.error(f"Error creating templates backup: {e}")
        return format_response(
            success=False,
            error='BACKUP_ERROR',
            message=f'Error creating backup: {str(e)}',
            state='error'
        ), 500


@templates_v2_bp.route('/templates/restore', methods=['POST'])
@jwt_required()
def restore_templates():
    """
    Restore templates from backup.
    
    Request JSON:
    {
        "backup_file": "/path/to/backup/file.json"
    }
    
    Returns:
        JSON response with restore result
    """
    try:
        data = request.get_json()
        
        if not data or 'backup_file' not in data:
            return format_response(
                success=False,
                error='BACKUP_FILE_REQUIRED',
                message='Backup file path is required',
                state='error'
            ), 400
        
        backup_file = data['backup_file']
        result = template_manager.restore_templates(backup_file)
        
        if result['success']:
            return format_response(
                success=True,
                data={
                    'current_backup': result.get('current_backup')
                },
                message='Templates restored successfully',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=result.get('error', 'RESTORE_FAILED'),
                message=result.get('message', 'Failed to restore templates'),
                state='error'
            ), 400
            
    except Exception as e:
        logger.error(f"Error restoring templates: {e}")
        return format_response(
            success=False,
            error='RESTORE_ERROR',
            message=f'Error restoring templates: {str(e)}',
            state='error'
        ), 500


# Error handlers
@templates_v2_bp.errorhandler(ValidationError)
def handle_validation_error(e):
    return format_response(
        success=False,
        error='VALIDATION_ERROR',
        message=str(e),
        state='error'
    ), 400




@templates_v2_bp.errorhandler(404)
def handle_not_found(e):
    return format_response(
        success=False,
        error='NOT_FOUND',
        message='Template endpoint not found',
        state='error'
    ), 404


@templates_v2_bp.errorhandler(500)
def handle_internal_error(e):
    logger.error(f"Internal error: {e}")
    return format_response(
        success=False,
        error='INTERNAL_ERROR',
        message='Internal server error',
        state='error'
    ), 500