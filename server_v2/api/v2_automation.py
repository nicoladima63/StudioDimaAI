"""
Automation API V2 for StudioDimaAI.

API endpoints for managing automation settings including SMS recalls and reminders.
"""

import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from typing import Dict, Any

from core.environment_manager import environment_manager
from app_v2 import format_response
from core.exceptions import ValidationError

logger = logging.getLogger(__name__)

# Create blueprint
automation_v2_bp = Blueprint('automation_v2', __name__)


@automation_v2_bp.route('/automation/settings', methods=['GET'])
@jwt_required()
def get_automation_settings():
    """
    Get all automation settings.
    
    Returns:
        JSON response with automation settings
    """
    try:
        settings = environment_manager.get_automation_settings()
        
        return format_response(
            success=True,
            data=settings,
            message='Automation settings retrieved successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error getting automation settings: {e}")
        return format_response(
            success=False,
            error='SETTINGS_ERROR',
            message=f'Error retrieving settings: {str(e)}',
            state='error'
        ), 500


@automation_v2_bp.route('/automation/settings', methods=['POST'])
@jwt_required()
def update_automation_settings():
    """
    Update automation settings.
    
    Request JSON:
    {
        "recall_enabled": true,
        "recall_hour": 16,
        "recall_minute": 0,
        "reminder_enabled": true,
        "reminder_hour": 15,
        "reminder_minute": 0,
        "sms_richiami_mode": "test",
        "sms_promemoria_mode": "prod"
    }
    
    Returns:
        JSON response with update result
    """
    try:
        data = request.get_json()
        
        if not data:
            return format_response(
                success=False,
                error='DATA_REQUIRED',
                message='Settings data is required',
                state='error'
            ), 400
        
        # Validate settings
        validation_errors = []
        
        # Validate hour values (0-23)
        for hour_key in ['recall_hour', 'reminder_hour', 'calendar_sync_hour']:
            if hour_key in data:
                hour = data[hour_key]
                if not isinstance(hour, int) or not (0 <= hour <= 23):
                    validation_errors.append(f'{hour_key} must be an integer between 0 and 23')
        
        # Validate minute values (0-59)
        for minute_key in ['recall_minute', 'reminder_minute', 'calendar_sync_minute']:
            if minute_key in data:
                minute = data[minute_key]
                if not isinstance(minute, int) or not (0 <= minute <= 59):
                    validation_errors.append(f'{minute_key} must be an integer between 0 and 59')
        
        # Validate mode values
        for mode_key in ['sms_richiami_mode', 'sms_promemoria_mode']:
            if mode_key in data:
                mode = data[mode_key]
                if mode not in ['test', 'prod']:
                    validation_errors.append(f'{mode_key} must be "test" or "prod"')
        
        # Validate boolean values
        for bool_key in ['recall_enabled', 'reminder_enabled', 'calendar_sync_enabled']:
            if bool_key in data:
                value = data[bool_key]
                if not isinstance(value, bool):
                    validation_errors.append(f'{bool_key} must be a boolean value')
        
        if validation_errors:
            return format_response(
                success=False,
                error='VALIDATION_ERROR',
                message='Settings validation failed',
                data={'validation_errors': validation_errors},
                state='error'
            ), 400
        
        # Update settings
        environment_manager.set_automation_settings(data)
        
        # Get updated settings
        updated_settings = environment_manager.get_automation_settings()
        
        return format_response(
            success=True,
            data=updated_settings,
            message='Automation settings updated successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error updating automation settings: {e}")
        return format_response(
            success=False,
            error='UPDATE_ERROR',
            message=f'Error updating settings: {str(e)}',
            state='error'
        ), 500


@automation_v2_bp.route('/automation/settings/<setting_key>', methods=['GET'])
@jwt_required()
def get_automation_setting(setting_key: str):
    """
    Get specific automation setting.
    
    Args:
        setting_key: Setting key to retrieve
        
    Returns:
        JSON response with setting value
    """
    try:
        settings = environment_manager.get_automation_settings()
        
        if setting_key not in settings:
            return format_response(
                success=False,
                error='SETTING_NOT_FOUND',
                message=f'Setting {setting_key} not found',
                state='error'
            ), 404
        
        return format_response(
            success=True,
            data={
                'key': setting_key,
                'value': settings[setting_key]
            },
            message=f'Setting {setting_key} retrieved successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error getting setting {setting_key}: {e}")
        return format_response(
            success=False,
            error='SETTING_ERROR',
            message=f'Error retrieving setting: {str(e)}',
            state='error'
        ), 500


@automation_v2_bp.route('/automation/settings/<setting_key>', methods=['PUT'])
@jwt_required()
def update_automation_setting(setting_key: str):
    """
    Update specific automation setting.
    
    Args:
        setting_key: Setting key to update
        
    Request JSON:
    {
        "value": <setting_value>
    }
    
    Returns:
        JSON response with update result
    """
    try:
        data = request.get_json()
        
        if not data or 'value' not in data:
            return format_response(
                success=False,
                error='VALUE_REQUIRED',
                message='Setting value is required',
                state='error'
            ), 400
        
        value = data['value']
        
        # Update single setting
        environment_manager.set_automation_settings({setting_key: value})
        
        # Get updated value
        updated_settings = environment_manager.get_automation_settings()
        
        return format_response(
            success=True,
            data={
                'key': setting_key,
                'value': updated_settings.get(setting_key),
                'previous_value': value
            },
            message=f'Setting {setting_key} updated successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error updating setting {setting_key}: {e}")
        return format_response(
            success=False,
            error='UPDATE_ERROR',
            message=f'Error updating setting: {str(e)}',
            state='error'
        ), 500


@automation_v2_bp.route('/automation/settings/recall', methods=['GET'])
@jwt_required()
def get_recall_settings():
    """
    Get recall automation settings.
    
    Returns:
        JSON response with recall settings
    """
    try:
        settings = environment_manager.get_automation_settings()
        
        recall_settings = {
            'recall_enabled': settings.get('recall_enabled', True),
            'recall_hour': settings.get('recall_hour', 16),
            'recall_minute': settings.get('recall_minute', 0),
            'sms_richiami_mode': settings.get('sms_richiami_mode', 'test')
        }
        
        return format_response(
            success=True,
            data=recall_settings,
            message='Recall settings retrieved successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error getting recall settings: {e}")
        return format_response(
            success=False,
            error='RECALL_SETTINGS_ERROR',
            message=f'Error retrieving recall settings: {str(e)}',
            state='error'
        ), 500


@automation_v2_bp.route('/automation/settings/recall', methods=['POST'])
@jwt_required()
def update_recall_settings():
    """
    Update recall automation settings.
    
    Request JSON:
    {
        "recall_enabled": true,
        "recall_hour": 16,
        "recall_minute": 0,
        "sms_richiami_mode": "test"
    }
    
    Returns:
        JSON response with update result
    """
    try:
        data = request.get_json()
        
        if not data:
            return format_response(
                success=False,
                error='DATA_REQUIRED',
                message='Recall settings data is required',
                state='error'
            ), 400
        
        # Filter only recall-related settings
        recall_keys = ['recall_enabled', 'recall_hour', 'recall_minute', 'sms_richiami_mode']
        recall_settings = {k: v for k, v in data.items() if k in recall_keys}
        
        if not recall_settings:
            return format_response(
                success=False,
                error='NO_RECALL_SETTINGS',
                message='No valid recall settings provided',
                state='error'
            ), 400
        
        # Update settings
        environment_manager.set_automation_settings(recall_settings)
        
        # Get updated settings
        updated_settings = environment_manager.get_automation_settings()
        updated_recall_settings = {k: updated_settings.get(k) for k in recall_keys}
        
        return format_response(
            success=True,
            data=updated_recall_settings,
            message='Recall settings updated successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error updating recall settings: {e}")
        return format_response(
            success=False,
            error='UPDATE_ERROR',
            message=f'Error updating recall settings: {str(e)}',
            state='error'
        ), 500


@automation_v2_bp.route('/automation/settings/reminder', methods=['GET'])
@jwt_required()
def get_reminder_settings():
    """
    Get reminder automation settings.
    
    Returns:
        JSON response with reminder settings
    """
    try:
        settings = environment_manager.get_automation_settings()
        
        reminder_settings = {
            'reminder_enabled': settings.get('reminder_enabled', True),
            'reminder_hour': settings.get('reminder_hour', 15),
            'reminder_minute': settings.get('reminder_minute', 0),
            'sms_promemoria_mode': settings.get('sms_promemoria_mode', 'prod')
        }
        
        return format_response(
            success=True,
            data=reminder_settings,
            message='Reminder settings retrieved successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error getting reminder settings: {e}")
        return format_response(
            success=False,
            error='REMINDER_SETTINGS_ERROR',
            message=f'Error retrieving reminder settings: {str(e)}',
            state='error'
        ), 500


@automation_v2_bp.route('/automation/settings/reminder', methods=['POST'])
@jwt_required()
def update_reminder_settings():
    """
    Update reminder automation settings.
    
    Request JSON:
    {
        "reminder_enabled": true,
        "reminder_hour": 15,
        "reminder_minute": 0,
        "sms_promemoria_mode": "prod"
    }
    
    Returns:
        JSON response with update result
    """
    try:
        data = request.get_json()
        
        if not data:
            return format_response(
                success=False,
                error='DATA_REQUIRED',
                message='Reminder settings data is required',
                state='error'
            ), 400
        
        # Filter only reminder-related settings
        reminder_keys = ['reminder_enabled', 'reminder_hour', 'reminder_minute', 'sms_promemoria_mode']
        reminder_settings = {k: v for k, v in data.items() if k in reminder_keys}
        
        if not reminder_settings:
            return format_response(
                success=False,
                error='NO_REMINDER_SETTINGS',
                message='No valid reminder settings provided',
                state='error'
            ), 400
        
        # Update settings
        environment_manager.set_automation_settings(reminder_settings)
        
        # Get updated settings
        updated_settings = environment_manager.get_automation_settings()
        updated_reminder_settings = {k: updated_settings.get(k) for k in reminder_keys}
        
        return format_response(
            success=True,
            data=updated_reminder_settings,
            message='Reminder settings updated successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error updating reminder settings: {e}")
        return format_response(
            success=False,
            error='UPDATE_ERROR',
            message=f'Error updating reminder settings: {str(e)}',
            state='error'
        ), 500


@automation_v2_bp.route('/settings/calendar', methods=['GET'])
@jwt_required()
def get_calendar_settings():
    """
    Get calendar automation settings.
    
    Returns:
        JSON response with calendar settings
    """
    try:
        settings = environment_manager.get_automation_settings()
        
        calendar_settings = {
            'calendar_sync_enabled': settings.get('calendar_sync_enabled', False),
            'calendar_sync_hour': settings.get('calendar_sync_hour', 13),
            'calendar_sync_minute': settings.get('calendar_sync_minute', 0),
            'calendar_studio_blu_id': settings.get('calendar_studio_blu_id', ''),
            'calendar_studio_giallo_id': settings.get('calendar_studio_giallo_id', '')
        }
        
        return format_response(
            success=True,
            data=calendar_settings,
            message='Calendar settings retrieved successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error getting calendar settings: {e}")
        return format_response(
            success=False,
            error='CALENDAR_SETTINGS_ERROR',
            message=f'Error retrieving calendar settings: {str(e)}',
            state='error'
        ), 500


@automation_v2_bp.route('/settings/calendar', methods=['POST'])
@jwt_required()
def update_calendar_settings():
    """
    Update calendar automation settings.
    
    Request JSON:
    {
        "calendar_sync_enabled": true,
        "calendar_sync_hour": 13,
        "calendar_sync_minute": 0,
        "calendar_studio_blu_id": "calendar-id-blu",
        "calendar_studio_giallo_id": "calendar-id-giallo"
    }
    
    Returns:
        JSON response with update result
    """
    try:
        data = request.get_json()
        
        if not data:
            return format_response(
                success=False,
                error='DATA_REQUIRED',
                message='Calendar settings data is required',
                state='error'
            ), 400
        
        # Filter only calendar-related settings
        calendar_keys = [
            'calendar_sync_enabled', 'calendar_sync_hour', 'calendar_sync_minute',
            'calendar_studio_blu_id', 'calendar_studio_giallo_id'
        ]
        calendar_settings = {k: v for k, v in data.items() if k in calendar_keys}
        
        if not calendar_settings:
            return format_response(
                success=False,
                error='NO_CALENDAR_SETTINGS',
                message='No valid calendar settings provided',
                state='error'
            ), 400
        
        # Validate hour/minute values
        if 'calendar_sync_hour' in calendar_settings:
            hour = calendar_settings['calendar_sync_hour']
            if not isinstance(hour, int) or not (0 <= hour <= 23):
                return format_response(
                    success=False,
                    error='INVALID_HOUR',
                    message='calendar_sync_hour must be integer between 0 and 23',
                    state='error'
                ), 400
        
        if 'calendar_sync_minute' in calendar_settings:
            minute = calendar_settings['calendar_sync_minute']
            if not isinstance(minute, int) or not (0 <= minute <= 59):
                return format_response(
                    success=False,
                    error='INVALID_MINUTE',
                    message='calendar_sync_minute must be integer between 0 and 59',
                    state='error'
                ), 400
        
        # Update settings
        environment_manager.set_automation_settings(calendar_settings)
        
        # Get updated settings
        updated_settings = environment_manager.get_automation_settings()
        updated_calendar_settings = {k: updated_settings.get(k) for k in calendar_keys}
        
        return format_response(
            success=True,
            data=updated_calendar_settings,
            message='Calendar settings updated successfully',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error updating calendar settings: {e}")
        return format_response(
            success=False,
            error='UPDATE_ERROR',
            message=f'Error updating calendar settings: {str(e)}',
            state='error'
        ), 500


# Error handlers
@automation_v2_bp.errorhandler(ValidationError)
def handle_validation_error(e):
    return format_response(
        success=False,
        error='VALIDATION_ERROR',
        message=str(e),
        state='error'
    ), 400



@automation_v2_bp.errorhandler(404)
def handle_not_found(e):
    return format_response(
        success=False,
        error='NOT_FOUND',
        message='Automation endpoint not found',
        state='error'
    ), 404


@automation_v2_bp.errorhandler(500)
def handle_internal_error(e):
    logger.error(f"Internal error: {e}")
    return format_response(
        success=False,
        error='INTERNAL_ERROR',
        message='Internal server error',
        state='error'
    ), 500