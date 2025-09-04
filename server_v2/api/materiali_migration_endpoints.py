"""
API endpoints for materials migration from VOCISPES.DBF to SQLite database.

This module provides endpoints to manage the migration process of dental materials
from the legacy DBF system to the modern SQLite database with intelligent filtering.
"""

import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from services.materiali_migration_service import MaterialiMigrationService
from core.database_manager import get_database_manager
from core.exceptions import ValidationError, DatabaseError, DbfProcessingError

logger = logging.getLogger(__name__)

# Create materials migration blueprint
materiali_migration_bp = Blueprint('materiali_migration', __name__, url_prefix='/api/materiali')


@materiali_migration_bp.route('/migrate/preview', methods=['GET'])
@jwt_required()
def preview_migration():
    """
    Preview materials migration without actually migrating.
    Shows what materials would be migrated and their classification.
    """
    try:
        db_manager = get_database_manager()
        migration_service = MaterialiMigrationService(db_manager)
        
        # Read and filter materials without saving to database
        materials_data = migration_service.read_vocispes_data()
        dental_materials = migration_service.filter_dental_materials(materials_data)
        
        # Create preview statistics
        stats = {
            'total_records': len(materials_data),
            'dental_materials': len(dental_materials),
            'excluded_materials': len(materials_data) - len(dental_materials),
            'filter_efficiency': round((len(dental_materials) / len(materials_data)) * 100, 2) if materials_data else 0
        }
        
        # Group by material type for overview
        type_counts = {}
        for material in dental_materials:
            material_type = material.get('material_type', 'unknown')
            type_counts[material_type] = type_counts.get(material_type, 0) + 1
        
        # Sample of materials that would be migrated (first 20)
        sample_materials = dental_materials[:20]
        
        return jsonify({
            'success': True,
            'data': {
                'statistics': stats,
                'material_types': type_counts,
                'sample_materials': sample_materials,
                'preview_generated_at': datetime.now().isoformat()
            }
        })
        
    except DbfProcessingError as e:
        logger.error(f"DBF processing error in preview: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'dbf_error',
                'message': str(e),
                'code': 'DBF_READ_ERROR'
            }
        }), 500
    except Exception as e:
        logger.error(f"Error in preview_migration: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred during preview',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@materiali_migration_bp.route('/migrate/execute', methods=['POST'])
@jwt_required()
def execute_migration():
    """
    Execute the full materials migration from VOCISPES.DBF to SQLite database.
    """
    try:
        # Parse request options
        data = request.get_json() or {}
        options = {
            'confidence_threshold': data.get('confidence_threshold', 40),
            'overwrite_existing': data.get('overwrite_existing', True),
            'dry_run': data.get('dry_run', False)
        }
        
        logger.info(f"Starting materials migration with options: {options}")
        
        db_manager = get_database_manager()
        migration_service = MaterialiMigrationService(db_manager)
        
        if options['dry_run']:
            # Dry run: show what would happen without actually migrating
            materials_data = migration_service.read_vocispes_data()
            dental_materials = migration_service.filter_dental_materials(materials_data)
            
            result = {
                'success': True,
                'dry_run': True,
                'would_process': len(materials_data),
                'would_migrate': len(dental_materials),
                'message': 'Dry run completed - no data was actually migrated'
            }
        else:
            # Execute actual migration
            result = migration_service.run_full_migration()
        
        return jsonify({
            'success': result['success'],
            'data': result,
            'options_applied': options
        })
        
    except ValidationError as e:
        return jsonify({
            'success': False,
            'error': {
                'type': 'validation_error',
                'message': str(e),
                'code': 'VALIDATION_ERROR'
            }
        }), 400
    except DatabaseError as e:
        return jsonify({
            'success': False,
            'error': {
                'type': 'database_error',
                'message': str(e),
                'code': 'DATABASE_ERROR'
            }
        }), 500
    except Exception as e:
        logger.error(f"Error in execute_migration: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred during migration',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@materiali_migration_bp.route('/migrate/status', methods=['GET'])
@jwt_required()
def get_migration_status():
    """
    Get current status of materials in the database.
    """
    try:
        db_manager = get_database_manager()
        
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get basic statistics
            stats_queries = {
                'total_materials': "SELECT COUNT(*) FROM materiali",
                'dental_materials': "SELECT COUNT(*) FROM materiali WHERE is_dental_material = 1",
                'active_materials': "SELECT COUNT(*) FROM materiali WHERE is_active = 1",
                'by_source': """
                    SELECT source_file, COUNT(*) 
                    FROM materiali 
                    GROUP BY source_file
                """,
                'by_type': """
                    SELECT material_type, COUNT(*) 
                    FROM materiali 
                    WHERE is_dental_material = 1 
                    GROUP BY material_type 
                    ORDER BY COUNT(*) DESC
                """,
                'by_category': """
                    SELECT categoria_materiale, COUNT(*) 
                    FROM materiali 
                    WHERE is_dental_material = 1 
                    GROUP BY categoria_materiale 
                    ORDER BY COUNT(*) DESC
                """,
                'recent_migrations': """
                    SELECT DATE(migrated_at) as date, COUNT(*) 
                    FROM materiali 
                    WHERE migrated_at IS NOT NULL 
                    GROUP BY DATE(migrated_at) 
                    ORDER BY date DESC 
                    LIMIT 10
                """
            }
            
            results = {}
            
            # Execute simple count queries
            for key in ['total_materials', 'dental_materials', 'active_materials']:
                result = cursor.execute(stats_queries[key]).fetchone()
                results[key] = result[0] if result else 0
            
            # Execute grouped queries
            for key in ['by_source', 'by_type', 'by_category', 'recent_migrations']:
                result = cursor.execute(stats_queries[key]).fetchall()
                results[key] = [{'name': row[0], 'count': row[1]} for row in result] if result else []
            
            # Check if table exists and has data
            table_info = cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='materiali'
            """).fetchone()
            
            results['table_exists'] = table_info is not None
            results['has_vocispes_data'] = any(
                item['name'] == 'VOCISPES.DBF' for item in results['by_source']
            )
        
        return jsonify({
            'success': True,
            'data': {
                'statistics': results,
                'status_checked_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error in get_migration_status: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'internal_error',
                'message': 'An unexpected error occurred while checking status',
                'code': 'INTERNAL_ERROR'
            }
        }), 500


@materiali_migration_bp.route('/migrate/test-connection', methods=['GET'])
@jwt_required()
def test_vocispes_connection():
    """
    Test connection to VOCISPES.DBF file and return basic info.
    """
    try:
        db_manager = get_database_manager()
        migration_service = MaterialiMigrationService(db_manager)
        
        # Try to read just the first few records to test connection
        try:
            vocispes_path = migration_service.dbf_reader._get_dbf_path('VOCISPES.DBF')
            
            from dbfread import DBF
            
            # Read basic file info
            with DBF(vocispes_path, encoding='latin-1') as table:
                field_names = table.field_names
                record_count = len(table)
                
                # Read first 5 records as sample
                sample_records = []
                for i, record in enumerate(table):
                    if i >= 5:
                        break
                    if record:
                        sample_record = {
                            'codice': migration_service._clean_dbf_value(record.get('COD_MAT', '')),
                            'descrizione': migration_service._clean_dbf_value(record.get('DESCR', '')),
                            'fornitore': migration_service._clean_dbf_value(record.get('COD_FORN', '')),
                            'prezzo': migration_service._safe_float(record.get('PREZZO', 0))
                        }
                        sample_records.append(sample_record)
            
            return jsonify({
                'success': True,
                'data': {
                    'file_path': vocispes_path,
                    'field_names': field_names,
                    'record_count': record_count,
                    'sample_records': sample_records,
                    'connection_tested_at': datetime.now().isoformat()
                }
            })
            
        except FileNotFoundError:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'file_not_found',
                    'message': 'VOCISPES.DBF file not found. Check if the file exists and path is correct.',
                    'code': 'FILE_NOT_FOUND'
                }
            }), 404
            
    except Exception as e:
        logger.error(f"Error in test_vocispes_connection: {e}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'connection_error',
                'message': str(e),
                'code': 'CONNECTION_ERROR'
            }
        }), 500
