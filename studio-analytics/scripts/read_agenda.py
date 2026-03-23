"""
Read Agenda - Estrazione appuntamenti con enrichment pazienti e stima ricavi.
Riusa data_normalizer.get_df_appointments() e get_df_production().

Usage:
    python studio-analytics/scripts/read_agenda.py --anno 2025
    python studio-analytics/scripts/read_agenda.py --anno 2025 --mese 3 --medico 1
    python studio-analytics/scripts/read_agenda.py --anno 2025 --output output/agenda.json
"""

import argparse
import sys
import os

# Import helper (configura anche sys.path per server_v2)
sys.path.insert(0, os.path.dirname(__file__))
from _utils import output_json, _safe


def main():
    parser = argparse.ArgumentParser(description='Estrai appuntamenti con stima ricavi')
    parser.add_argument('--anno', type=int, required=True, help='Anno di riferimento')
    parser.add_argument('--mese', type=int, default=None, help='Filtro mese (1-12)')
    parser.add_argument('--medico', type=int, default=None, help='Filtro ID medico')
    parser.add_argument('--output', type=str, default=None, help='Path file JSON output')
    args = parser.parse_args()

    from services.economics.data_normalizer import get_df_appointments, get_df_production

    print(f"Caricamento appuntamenti anno {args.anno}...", file=sys.stderr)
    df_app = get_df_appointments(anno=args.anno)
    df_prod = get_df_production(anno=args.anno)

    if df_app.empty:
        output_json({
            'anno': args.anno,
            'filtri': {'mese': args.mese, 'medico': args.medico},
            'totale_appuntamenti': 0,
            'ore_cliniche_totali': 0,
            'revenue_per_hour_estimate': 0,
            'appuntamenti': []
        }, args.output)
        return

    # Filtra tipi non clinici
    df_clinici = df_app[~df_app['tipo'].isin({'F', 'A'})].copy()

    # Filtri opzionali
    if args.mese is not None:
        df_clinici = df_clinici[df_clinici['mese'] == args.mese]
    if args.medico is not None:
        df_clinici = df_clinici[df_clinici['medico'] == args.medico]

    # Calcolo stima ricavo per ora
    totale_produzione = _safe(df_prod['importo'].sum()) if not df_prod.empty else 0
    ore_cliniche = _safe(df_clinici['durata_minuti'].sum() / 60.0)
    revenue_per_hour = round(totale_produzione / ore_cliniche, 2) if ore_cliniche > 0 else 0

    # Converti in lista di record
    appuntamenti = []
    for _, row in df_clinici.iterrows():
        durata = _safe(row.get('durata_minuti', 0))
        appuntamenti.append({
            'data': row['data'].strftime('%Y-%m-%d') if hasattr(row['data'], 'strftime') else str(row['data']),
            'pazienteid': str(row.get('pazienteid', '')),
            'tipo': row.get('tipo', ''),
            'tipo_nome': row.get('tipo_nome', ''),
            'medico': int(row.get('medico', 0)),
            'medico_nome': row.get('medico_nome', ''),
            'studio': int(row.get('studio', 1)),
            'ora_inizio': _safe(row.get('ora_inizio', 0)),
            'ora_fine': _safe(row.get('ora_fine', 0)),
            'durata_minuti': int(durata),
            'estimated_revenue': round(revenue_per_hour * durata / 60, 2) if durata > 0 else 0,
        })

    result = {
        'anno': args.anno,
        'filtri': {'mese': args.mese, 'medico': args.medico},
        'totale_appuntamenti': len(appuntamenti),
        'ore_cliniche_totali': round(ore_cliniche, 2),
        'revenue_per_hour_estimate': revenue_per_hour,
        'appuntamenti': appuntamenti,
    }

    output_json(result, args.output)
    print(f"Estratti {len(appuntamenti)} appuntamenti, {round(ore_cliniche, 1)} ore cliniche", file=sys.stderr)


if __name__ == '__main__':
    main()
