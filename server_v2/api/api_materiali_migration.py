"""
API endpoints per la migrazione dei materiali dentali.
"""

from flask import Blueprint, jsonify, request
from services.materiali_migration_service import MaterialiMigrationService
from core.database_manager import DatabaseManager
import logging

logger = logging.getLogger(__name__)

# Blueprint per le API di migrazione materiali
materiali_migration_bp = Blueprint('materiali_migration', __name__, url_prefix='/api/materiali-migration')

@materiali_migration_bp.route('/preview', methods=['GET'])
def get_migration_preview():
    """
    Ottieni anteprima dei materiali da migrare raggruppati per fornitore.
    
    Returns:
        JSON con lista fornitori e materiali associati
    """
    try:
        db_manager = DatabaseManager()
        migration_service = MaterialiMigrationService(db_manager)
        
        # Leggi dati VOCISPES
        materials_data = migration_service.read_vocispes_data()
        
        # Filtra materiali dentali
        dental_materials = migration_service.filter_dental_materials(materials_data)
        
        # Raggruppa per fornitore
        suppliers_data = {}
        for material in dental_materials:
            supplier_name = material.get('fornitore_normalizzato', 'Sconosciuto')
            if supplier_name not in suppliers_data:
                suppliers_data[supplier_name] = {
                    'fornitore_nome': supplier_name,
                    'fornitore_originale': material.get('fornitorenome', ''),
                    'materiali_count': 0,
                    'materiali': []
                }
            
            suppliers_data[supplier_name]['materiali'].append({
                'id': material.get('id', ''),
                'nome': material.get('nome', ''),
                'costo_unitario': material.get('costo_unitario', 0),
                'quantita': material.get('quantita', 0),
                'confidence': material.get('confidence', 0),
                'categoria_contabile': material.get('categoria_contabile', 'unknown'),
                'confermato': material.get('confermato', False),
                'contoid': material.get('contoid'),
                'brancaid': material.get('brancaid'),
                'sottocontoid': material.get('sottocontoid')
            })
            suppliers_data[supplier_name]['materiali_count'] += 1
        
        # Converti in lista per il frontend
        suppliers_list = list(suppliers_data.values())
        
        return jsonify({
            'success': True,
            'data': {
                'suppliers': suppliers_list,
                'total_suppliers': len(suppliers_list),
                'total_materials': len(dental_materials),
                'stats': {
                    'total_valid_materials': len(materials_data),
                    'dental_materials': len(dental_materials),
                    'suppliers_with_materials': len(suppliers_list)
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Errore nel recupero anteprima migrazione: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@materiali_migration_bp.route('/import/<supplier_name>', methods=['POST'])
def import_supplier_materials(supplier_name):
    """
    Importa tutti i materiali di un fornitore specifico.
    
    Args:
        supplier_name: Nome del fornitore da importare
        
    Returns:
        JSON con risultato dell'importazione
    """
    try:
        db_manager = DatabaseManager()
        migration_service = MaterialiMigrationService(db_manager)
        
        # Leggi dati VOCISPES
        materials_data = migration_service.read_vocispes_data()
        
        # Filtra materiali dentali
        dental_materials = migration_service.filter_dental_materials(materials_data)
        
        # Filtra per fornitore specifico
        supplier_materials = [
            m for m in dental_materials 
            if m.get('fornitore_normalizzato', '') == supplier_name
        ]
        
        if not supplier_materials:
            return jsonify({
                'success': False,
                'error': f'Nessun materiale trovato per il fornitore {supplier_name}'
            }), 404
        
        # Esegui migrazione
        result = migration_service.migrate_materials_to_db(supplier_materials)
        
        return jsonify({
            'success': True,
            'data': {
                'supplier_name': supplier_name,
                'materials_imported': result.get('imported', 0),
                'materials_updated': result.get('updated', 0),
                'materials_skipped': result.get('skipped', 0),
                'total_processed': len(supplier_materials)
            }
        })
        
    except Exception as e:
        logger.error(f"Errore nell'importazione materiali per {supplier_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@materiali_migration_bp.route('/import-all', methods=['POST'])
def import_all_materials():
    """
    Importa tutti i materiali dentali disponibili.
    
    Returns:
        JSON con risultato dell'importazione completa
    """
    try:
        db_manager = DatabaseManager()
        migration_service = MaterialiMigrationService(db_manager)
        
        # Leggi dati VOCISPES
        materials_data = migration_service.read_vocispes_data()
        
        # Filtra materiali dentali
        dental_materials = migration_service.filter_dental_materials(materials_data)
        
        if not dental_materials:
            return jsonify({
                'success': False,
                'error': 'Nessun materiale dentale disponibile per l\'importazione'
            }), 404
        
        # Esegui migrazione completa
        result = migration_service.migrate_materials_to_db(dental_materials)
        
        return jsonify({
            'success': True,
            'data': {
                'materials_imported': result.get('imported', 0),
                'materials_updated': result.get('updated', 0),
                'materials_skipped': result.get('skipped', 0),
                'total_processed': len(dental_materials)
            }
        })
        
    except Exception as e:
        logger.error(f"Errore nell'importazione completa materiali: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
