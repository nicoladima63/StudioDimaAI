import logging
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from services.simulation_service import simulation_service
from app_v2 import format_response

logger = logging.getLogger(__name__)

simulation_v2_bp = Blueprint('simulation_v2', __name__)

@simulation_v2_bp.route('/simulation/run', methods=['POST'])
@jwt_required()
def run_simulation():
    """Triggers a full simulation of all flows."""
    try:
        results = simulation_service.run_all_simulations()
        return format_response(results)
    except Exception as e:
        logger.error(f"Error running simulation: {e}")
        return format_response(success=False, error=str(e)), 500

@simulation_v2_bp.route('/simulation/results', methods=['GET'])
@jwt_required()
def get_simulation_results():
    """Gets the results of the last simulation."""
    try:
        results = simulation_service.get_last_results()
        return format_response(results)
    except Exception as e:
        logger.error(f"Error getting simulation results: {e}")
        return format_response(success=False, error=str(e)), 500
