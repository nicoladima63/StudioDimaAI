"""
Forecast - Previsione di fine anno con tre scenari.
Wrapper CLI attorno a forecast_engine.get_forecast().

Usage:
    python studio-analytics/scripts/forecast.py --anno 2025
    python studio-analytics/scripts/forecast.py --anno 2025 --output output/forecast.json
"""

import argparse
import sys
import os

# Import helper (configura anche sys.path per server_v2)
sys.path.insert(0, os.path.dirname(__file__))
from _utils import output_json, _safe


def main():
    parser = argparse.ArgumentParser(description='Previsione di fine anno con tre scenari')
    parser.add_argument('--anno', type=int, required=True, help='Anno di previsione')
    parser.add_argument('--output', type=str, default=None, help='Path file JSON output')
    args = parser.parse_args()

    from services.economics.forecast_engine import get_forecast

    print(f"Calcolo forecast per anno {args.anno}...", file=sys.stderr)
    result = get_forecast(anno=args.anno)
    output_json(result, args.output)


if __name__ == '__main__':
    main()
