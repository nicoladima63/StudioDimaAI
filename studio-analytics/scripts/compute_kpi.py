"""
Compute KPI - Calcolo indicatori chiave di performance.
Wrapper CLI attorno a kpi_engine con aggiunta di chair utilization.

Usage:
    python studio-analytics/scripts/compute_kpi.py --anno 2025
    python studio-analytics/scripts/compute_kpi.py --anno 2025 --section current
    python studio-analytics/scripts/compute_kpi.py --anno 2025 --section monthly --output output/kpi.json
"""

import argparse
import sys
import os
from collections import defaultdict

# Import helper (configura anche sys.path per server_v2)
sys.path.insert(0, os.path.dirname(__file__))
from _utils import output_json, _safe


def compute_chair_utilization(anno):
    """
    Calcola la chair utilization (utilizzo poltrone) dall'agenda.
    Raggruppa per (data, studio), calcola ore occupate vs ore disponibili.
    Giornata lavorativa: 8 ore (480 minuti) - 9:00-13:00 + 14:00-18:00.
    """
    from services.economics.data_normalizer import get_df_appointments

    df_app = get_df_appointments(anno=anno)
    if df_app.empty:
        return {'ytd_pct': 0, 'monthly': [], 'per_studio': []}

    # Solo appuntamenti clinici
    df = df_app[~df_app['tipo'].isin({'F', 'A'})].copy()
    if df.empty:
        return {'ytd_pct': 0, 'monthly': [], 'per_studio': []}

    ore_per_giorno = 8.0  # 480 minuti
    minuti_per_giorno = 480

    # Raggruppa per (data, studio)
    df['data_str'] = df['data'].dt.strftime('%Y-%m-%d')
    grouped = df.groupby(['data_str', 'studio'])

    daily_stats = []
    for (data_str, studio), group in grouped:
        minuti_occupati = _safe(group['durata_minuti'].sum())
        minuti_occupati = min(minuti_occupati, minuti_per_giorno)  # Cap a max giornata
        mese = group['mese'].iloc[0]
        daily_stats.append({
            'data': data_str,
            'studio': int(studio),
            'mese': int(mese),
            'minuti_occupati': minuti_occupati,
        })

    if not daily_stats:
        return {'ytd_pct': 0, 'monthly': [], 'per_studio': []}

    # Totale YTD
    totale_minuti_occupati = sum(d['minuti_occupati'] for d in daily_stats)
    totale_minuti_disponibili = len(daily_stats) * minuti_per_giorno
    ytd_pct = round(totale_minuti_occupati / totale_minuti_disponibili * 100, 1) if totale_minuti_disponibili > 0 else 0

    # Per mese
    monthly_data = defaultdict(lambda: {'minuti_occupati': 0, 'giornate': 0})
    for d in daily_stats:
        monthly_data[d['mese']]['minuti_occupati'] += d['minuti_occupati']
        monthly_data[d['mese']]['giornate'] += 1

    monthly = []
    for mese in sorted(monthly_data.keys()):
        m = monthly_data[mese]
        ore_occ = round(m['minuti_occupati'] / 60, 1)
        ore_disp = round(m['giornate'] * ore_per_giorno, 1)
        monthly.append({
            'mese': mese,
            'utilization_pct': round(m['minuti_occupati'] / (m['giornate'] * minuti_per_giorno) * 100, 1) if m['giornate'] > 0 else 0,
            'ore_occupate': ore_occ,
            'ore_disponibili': ore_disp,
            'giornate_lavoro': m['giornate'],
        })

    # Per studio
    studio_data = defaultdict(lambda: {'minuti_occupati': 0, 'giornate': 0})
    for d in daily_stats:
        studio_data[d['studio']]['minuti_occupati'] += d['minuti_occupati']
        studio_data[d['studio']]['giornate'] += 1

    per_studio = []
    for studio_id in sorted(studio_data.keys()):
        s = studio_data[studio_id]
        per_studio.append({
            'studio': studio_id,
            'utilization_pct': round(s['minuti_occupati'] / (s['giornate'] * minuti_per_giorno) * 100, 1) if s['giornate'] > 0 else 0,
            'ore_occupate': round(s['minuti_occupati'] / 60, 1),
            'giornate_lavoro': s['giornate'],
        })

    return {
        'ytd_pct': ytd_pct,
        'monthly': monthly,
        'per_studio': per_studio,
    }


def main():
    parser = argparse.ArgumentParser(description='Calcola KPI dello studio')
    parser.add_argument('--anno', type=int, required=True, help='Anno di riferimento')
    parser.add_argument('--section', type=str, default='all',
                        choices=['all', 'current', 'monthly', 'category', 'operator'],
                        help='Sezione KPI da calcolare')
    parser.add_argument('--output', type=str, default=None, help='Path file JSON output')
    args = parser.parse_args()

    from services.economics.kpi_engine import (
        get_kpi_current, get_kpi_monthly, get_kpi_by_operator, get_kpi_by_category
    )

    result = {'anno': args.anno}

    if args.section in ('all', 'current'):
        print(f"Calcolo KPI current per anno {args.anno}...", file=sys.stderr)
        result['current'] = get_kpi_current(anno=args.anno)

    if args.section in ('all', 'monthly'):
        print(f"Calcolo KPI monthly per anno {args.anno}...", file=sys.stderr)
        result['monthly'] = get_kpi_monthly(anno=args.anno)

    if args.section in ('all', 'category'):
        print(f"Calcolo KPI by category per anno {args.anno}...", file=sys.stderr)
        result['by_category'] = get_kpi_by_category(anno=args.anno)

    if args.section in ('all', 'operator'):
        print(f"Calcolo KPI by operator per anno {args.anno}...", file=sys.stderr)
        result['by_operator'] = get_kpi_by_operator(anno=args.anno)

    if args.section == 'all':
        print(f"Calcolo chair utilization per anno {args.anno}...", file=sys.stderr)
        result['chair_utilization'] = compute_chair_utilization(args.anno)

    output_json(result, args.output)


if __name__ == '__main__':
    main()
