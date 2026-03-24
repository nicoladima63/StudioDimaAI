"""
Export Dashboard JSON - Orchestratore che aggrega tutti gli engine analytics
in un unico file JSON pronto per il dashboard React.

Usage:
    python studio-analytics/scripts/export_dashboard_json.py --anno 2025
    python studio-analytics/scripts/export_dashboard_json.py --anno 2025 --output output/dashboard.json
"""

import argparse
import sys
import os
from datetime import datetime

# Import helper (configura anche sys.path per server_v2)
sys.path.insert(0, os.path.dirname(__file__))
from _utils import output_json, _safe


def _run_section(name, fn, **kwargs):
    """Esegue una sezione con error handling. Ritorna (data, error)."""
    try:
        print(f"  [{name}]...", file=sys.stderr)
        result = fn(**kwargs)
        return result, None
    except Exception as e:
        print(f"  [{name}] ERRORE: {e}", file=sys.stderr)
        return None, f"{name}: {str(e)}"


def main():
    parser = argparse.ArgumentParser(description='Esporta JSON completo per dashboard')
    parser.add_argument('--anno', type=int, required=True, help='Anno di riferimento')
    parser.add_argument('--output', type=str, default=None, help='Path file JSON output')
    parser.add_argument('--skip-inefficiencies', action='store_true',
                        help='Salta analisi inefficienze (piu veloce)')
    args = parser.parse_args()

    if args.output is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(script_dir, '..', 'output')
        args.output = os.path.join(output_dir, f'dashboard_{args.anno}.json')

    print(f"Export dashboard per anno {args.anno}", file=sys.stderr)
    errors = []
    sections = {}

    # KPI
    from services.economics.kpi_engine import (
        get_kpi_current, get_kpi_monthly, get_kpi_by_operator,
        get_kpi_by_category, get_kpi_comparison
    )
    data, err = _run_section('kpi_current', get_kpi_current, anno=args.anno)
    sections['kpi_current'] = data
    if err:
        errors.append(err)

    data, err = _run_section('kpi_monthly', get_kpi_monthly, anno=args.anno)
    sections['kpi_monthly'] = data
    if err:
        errors.append(err)

    data, err = _run_section('kpi_by_category', get_kpi_by_category, anno=args.anno)
    sections['kpi_by_category'] = data
    if err:
        errors.append(err)

    data, err = _run_section('kpi_by_operator', get_kpi_by_operator, anno=args.anno)
    sections['kpi_by_operator'] = data
    if err:
        errors.append(err)

    data, err = _run_section('kpi_comparison', get_kpi_comparison, anno=args.anno)
    sections['kpi_comparison'] = data
    if err:
        errors.append(err)

    # Forecast
    from services.economics.forecast_engine import get_forecast
    data, err = _run_section('forecast', get_forecast, anno=args.anno)
    sections['forecast'] = data
    if err:
        errors.append(err)

    # Collaboratori
    from services.economics.collaboratori_engine import get_collaboratori_redditivita
    data, err = _run_section('collaboratori', get_collaboratori_redditivita, anno=args.anno)
    sections['collaboratori'] = data
    if err:
        errors.append(err)

    # Seasonality
    from services.economics.seasonality_model import get_seasonality_index
    data, err = _run_section('seasonality', get_seasonality_index)
    sections['seasonality'] = data
    if err:
        errors.append(err)

    # Trend
    from services.economics.trend_model import get_trend_analysis
    data, err = _run_section('trend', get_trend_analysis)
    sections['trend'] = data
    if err:
        errors.append(err)

    # Chair utilization
    from compute_kpi import compute_chair_utilization
    data, err = _run_section('chair_utilization', compute_chair_utilization, anno=args.anno)
    sections['chair_utilization'] = data
    if err:
        errors.append(err)

    # Inefficienze (opzionale, puo' essere lento)
    if not args.skip_inefficiencies:
        try:
            from services.economics.data_normalizer import get_df_appointments, get_df_estimates
            from detect_inefficiencies import (
                detect_unused_chair_time, detect_fragmentation,
                detect_prime_slot_waste, detect_no_shows
            )

            print("  [inefficiencies]...", file=sys.stderr)
            df_app = get_df_appointments(anno=args.anno)
            df_est = get_df_estimates(anno=args.anno)

            sections['inefficiencies'] = {
                'unused_chair_time': detect_unused_chair_time(df_app),
                'fragmentation': detect_fragmentation(df_app),
                'prime_slot_analysis': detect_prime_slot_waste(df_app),
                'potential_no_shows': detect_no_shows(df_app, df_est),
            }
        except Exception as e:
            errors.append(f"inefficiencies: {str(e)}")
            sections['inefficiencies'] = None
    else:
        sections['inefficiencies'] = None

    result = {
        'generated_at': datetime.now().isoformat(),
        'anno': args.anno,
        'sections': sections,
        'errors': errors,
    }

    output_json(result, args.output)

    ok_count = sum(1 for v in sections.values() if v is not None)
    total_count = len(sections)
    print(f"\nExport completato: {ok_count}/{total_count} sezioni, {len(errors)} errori", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"  - {e}", file=sys.stderr)


if __name__ == '__main__':
    main()
