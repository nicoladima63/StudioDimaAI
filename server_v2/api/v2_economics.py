"""
Economics API V2 for StudioDimaAI.
Endpoint per analisi economica, KPI, forecast e simulazioni.
"""

import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app_v2 import require_auth

logger = logging.getLogger(__name__)

economics_bp = Blueprint('economics', __name__)


# =============================================================================
# KPI ENDPOINTS
# =============================================================================

@economics_bp.route('/economics/kpi/current', methods=['GET'])
@jwt_required()
def get_kpi_current():
    """KPI stato attuale Year-To-Date."""
    try:
        require_auth()
        anno = request.args.get('anno', type=int)

        from services.economics.kpi_engine import get_kpi_current as kpi_current
        data = kpi_current(anno=anno)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_kpi_current: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


@economics_bp.route('/economics/kpi/monthly', methods=['GET'])
@jwt_required()
def get_kpi_monthly():
    """KPI mensili per un anno."""
    try:
        require_auth()
        anno = request.args.get('anno', type=int)

        from services.economics.kpi_engine import get_kpi_monthly as kpi_monthly
        data = kpi_monthly(anno=anno)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_kpi_monthly: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


@economics_bp.route('/economics/kpi/by-operator', methods=['GET'])
@jwt_required()
def get_kpi_by_operator():
    """KPI raggruppati per operatore/medico."""
    try:
        require_auth()
        anno = request.args.get('anno', type=int)

        from services.economics.kpi_engine import get_kpi_by_operator as kpi_by_op
        data = kpi_by_op(anno=anno)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_kpi_by_operator: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


@economics_bp.route('/economics/kpi/by-category', methods=['GET'])
@jwt_required()
def get_kpi_by_category():
    """KPI raggruppati per tipo prestazione."""
    try:
        require_auth()
        anno = request.args.get('anno', type=int)

        from services.economics.kpi_engine import get_kpi_by_category as kpi_by_cat
        data = kpi_by_cat(anno=anno)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_kpi_by_category: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


@economics_bp.route('/economics/kpi/comparison', methods=['GET'])
@jwt_required()
def get_kpi_comparison():
    """Confronto KPI anno corrente vs precedente."""
    try:
        require_auth()
        anno = request.args.get('anno', type=int)

        from services.economics.kpi_engine import get_kpi_comparison as kpi_comp
        data = kpi_comp(anno=anno)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_kpi_comparison: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


# =============================================================================
# SEASONALITY & TREND ENDPOINTS
# =============================================================================

@economics_bp.route('/economics/seasonality', methods=['GET'])
@jwt_required()
def get_seasonality():
    """Indice di stagionalita mensile."""
    try:
        require_auth()

        from services.economics.seasonality_model import get_seasonality_index
        data = get_seasonality_index()

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_seasonality: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


@economics_bp.route('/economics/trend', methods=['GET'])
@jwt_required()
def get_trend():
    """Analisi trend produzione."""
    try:
        require_auth()

        from services.economics.trend_model import get_trend_analysis
        data = get_trend_analysis()

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_trend: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


# =============================================================================
# FORECAST ENDPOINT
# =============================================================================

@economics_bp.route('/economics/forecast', methods=['GET'])
@jwt_required()
def get_forecast():
    """Previsione fine anno con scenari."""
    try:
        require_auth()
        anno = request.args.get('anno', type=int)

        from services.economics.forecast_engine import get_forecast as forecast
        data = forecast(anno=anno)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_forecast: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


# =============================================================================
# SCENARIO SIMULATOR ENDPOINT
# =============================================================================

@economics_bp.route('/economics/scenario/simulate', methods=['POST'])
@jwt_required()
def simulate_scenario():
    """Simulazione scenario decisionale."""
    try:
        require_auth()
        params = request.get_json()
        if not params:
            return jsonify({'state': 'error', 'error': 'Nessun parametro fornito'}), 400

        from services.economics.scenario_engine import simulate
        data = simulate(params)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore simulate_scenario: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


# =============================================================================
# MULTI-YEAR COMPARISON & TRIMESTER FORECAST
# =============================================================================

@economics_bp.route('/economics/comparison/multi-year', methods=['GET'])
@jwt_required()
def get_multi_year_comparison():
    """Confronto multi-anno con forecast."""
    try:
        require_auth()
        anni_param = request.args.get('anni', '')
        anni = []
        if anni_param:
            try:
                anni = [int(a.strip()) for a in anni_param.split(',') if a.strip()]
            except ValueError:
                return jsonify({'state': 'error', 'error': 'Formato anni non valido. Usa: anni=2023,2024,2025'}), 400

        from services.economics.comparison_engine import get_multi_year_comparison as multi_comp
        data = multi_comp(anni=anni)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_multi_year_comparison: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


@economics_bp.route('/economics/comparison/trimester-forecast', methods=['GET'])
@jwt_required()
def get_trimester_forecast():
    """Previsione trimestrale dettagliata."""
    try:
        require_auth()
        anno = request.args.get('anno', type=int)

        from services.economics.comparison_engine import get_trimester_forecast as trim_fc
        data = trim_fc(anno=anno)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_trimester_forecast: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


# =============================================================================
# COLLABORATORI REDDITIVITA
# =============================================================================

@economics_bp.route('/economics/collaboratori/redditivita', methods=['GET'])
@jwt_required()
def get_collaboratori_redditivita():
    """Analisi redditivita per collaboratore."""
    try:
        require_auth()
        anno = request.args.get('anno', type=int)

        from services.economics.collaboratori_engine import get_collaboratori_redditivita as collab_redd
        data = collab_redd(anno=anno)

        return jsonify({'state': 'success', 'data': data})
    except Exception as e:
        logger.error(f"Errore get_collaboratori_redditivita: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


# =============================================================================
# COLLABORATORI LISTA (per calcolatore centro di costo)
# =============================================================================

@economics_bp.route('/economics/collaboratori/lista', methods=['GET'])
@jwt_required()
def get_collaboratori_lista():
    """Lista collaboratori dello studio."""
    try:
        require_auth()
        from core.constants_v2 import MEDICI, COMPENSI_COLLABORATORI

        collaboratori = []
        for medico_id, nome in MEDICI.items():
            compenso_info = COMPENSI_COLLABORATORI.get(medico_id, {})
            collaboratori.append({
                'id': medico_id,
                'nome': nome,
                'tipo': compenso_info.get('tipo', 'sconosciuto'),
            })

        collaboratori.sort(key=lambda x: (0 if x['tipo'] == 'titolare' else 1, x['nome']))

        return jsonify({'state': 'success', 'data': collaboratori})
    except Exception as e:
        logger.error(f"Errore get_collaboratori_lista: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500


# =============================================================================
# CACHE MANAGEMENT
# =============================================================================

@economics_bp.route('/economics/cache/invalidate', methods=['POST'])
@jwt_required()
def invalidate_cache():
    """Invalida la cache dei dati mensili."""
    try:
        require_auth()
        anno = request.args.get('anno', type=int)

        from services.economics.monthly_aggregator import invalidate_cache as inv_cache
        inv_cache(anno=anno)

        return jsonify({'state': 'success', 'data': {'message': 'Cache invalidata'}})
    except Exception as e:
        logger.error(f"Errore invalidate_cache: {e}")
        return jsonify({'state': 'error', 'error': str(e)}), 500
