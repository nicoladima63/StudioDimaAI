"""
Detect Inefficiencies - Rileva inefficienze nello scheduling dello studio.
Logica NUOVA costruita su data_normalizer esistente.

4 moduli di detection:
1. Unused chair time: gap >= soglia tra appuntamenti sullo stesso studio/giorno
2. Frammentazione: gap 5-20 min (troppo corti per essere utili)
3. Prime slot analysis: procedure low-revenue in slot mattutini 9-12
4. No-show detection: appuntamenti senza prestazione eseguita corrispondente

Usage:
    python studio-analytics/scripts/detect_inefficiencies.py --anno 2025
    python studio-analytics/scripts/detect_inefficiencies.py --anno 2025 --mese 3 --soglia-gap 30
"""

import argparse
import sys
import os
from collections import defaultdict
from datetime import datetime

# Import helper (configura anche sys.path per server_v2)
sys.path.insert(0, os.path.dirname(__file__))
from _utils import output_json, _safe


# Classificazione revenue per tipo appuntamento
HIGH_REVENUE_TYPES = {'H', 'L', 'P', 'E'}    # Chirurgia, Implantologia, Protesi, Endodonzia
MEDIUM_REVENUE_TYPES = {'C', 'R', 'O'}        # Conservativa, Parodontologia, Ortodonzia
LOW_REVENUE_TYPES = {'S', 'I', 'V', 'U', 'M'} # Controllo, Igiene, Prima visita, Gnatologia, Privato

# Prime slot (formato DBF: ore.minuti)
PRIME_START = 9.00  # 9:00
PRIME_END = 12.00   # 12:00

# Soglia frammentazione (minuti)
FRAG_MIN = 5
FRAG_MAX = 20


def _dbf_time_to_minutes(val):
    """Converte orario formato DBF (es. 17.25 = 17:25) in minuti totali."""
    val = _safe(val)
    ore = int(val)
    minuti = round((val - ore) * 100)
    return ore * 60 + minuti


# Pausa pranzo: gap che inizia tra 12:30-13:30 e finisce tra 13:30-15:30
# viene riconosciuto come pranzo e NON contato come tempo perso
LUNCH_GAP_START_MIN = _dbf_time_to_minutes(12.30)  # 750 min
LUNCH_GAP_START_MAX = _dbf_time_to_minutes(13.30)  # 810 min
LUNCH_GAP_END_MIN = _dbf_time_to_minutes(13.30)    # 810 min
LUNCH_GAP_END_MAX = _dbf_time_to_minutes(15.30)    # 930 min


def _is_lunch_gap(gap_start_min, gap_end_min):
    """
    Verifica se un gap e' la pausa pranzo.
    Un gap che inizia tra 12:30-13:30 e finisce tra 13:30-15:30
    viene considerato pausa pranzo e non contato come inefficienza.
    """
    return (LUNCH_GAP_START_MIN <= gap_start_min <= LUNCH_GAP_START_MAX and
            LUNCH_GAP_END_MIN <= gap_end_min <= LUNCH_GAP_END_MAX)


def detect_unused_chair_time(df_app, soglia_gap=30):
    """
    Rileva gap >= soglia_gap minuti tra appuntamenti sullo stesso studio/giorno.

    Range dinamico: usa il primo e ultimo appuntamento per definire la giornata,
    senza hardcodare orario inizio/fine.
    Esclude automaticamente la pausa pranzo (gap nella fascia 12:30-15:30).
    """
    empty_result = {'total_gaps': 0, 'total_unused_minutes': 0, 'total_unused_hours': 0,
                    'avg_gap_minutes': 0, 'worst_days': [], 'monthly_summary': [],
                    'lunch_gaps_excluded': 0}

    if df_app.empty:
        return empty_result

    df = df_app[~df_app['tipo'].isin({'F', 'A'})].copy()
    if df.empty:
        return empty_result

    df['data_str'] = df['data'].dt.strftime('%Y-%m-%d')
    df['min_inizio'] = df['ora_inizio'].apply(_dbf_time_to_minutes)
    df['min_fine'] = df['ora_fine'].apply(_dbf_time_to_minutes)

    all_gaps = []
    day_unused = []
    lunch_excluded = 0

    for (data_str, studio), group in df.groupby(['data_str', 'studio']):
        sorted_app = group.sort_values('min_inizio')
        gaps_today = []
        mese = int(sorted_app['mese'].iloc[0])

        # Solo gap TRA appuntamenti consecutivi (no pre/post giornata)
        rows = sorted_app[['min_inizio', 'min_fine']].values
        for i in range(len(rows) - 1):
            fine_corrente = rows[i][1]
            inizio_prossimo = rows[i + 1][0]
            gap = inizio_prossimo - fine_corrente

            if gap < soglia_gap:
                continue

            # Escludi pausa pranzo
            if _is_lunch_gap(fine_corrente, inizio_prossimo):
                lunch_excluded += 1
                continue

            gaps_today.append({'tipo': 'inter_appuntamento', 'minuti': int(gap)})

        if gaps_today:
            total_gap_min = sum(g['minuti'] for g in gaps_today)
            all_gaps.extend(gaps_today)
            day_unused.append({
                'data': data_str,
                'studio': int(studio),
                'mese': mese,
                'unused_minutes': total_gap_min,
                'num_gaps': len(gaps_today),
            })

    total_unused = sum(g['minuti'] for g in all_gaps)

    # Monthly summary
    monthly = defaultdict(lambda: {'unused_minutes': 0, 'working_days': set(), 'gaps': 0})
    for d in day_unused:
        monthly[d['mese']]['unused_minutes'] += d['unused_minutes']
        monthly[d['mese']]['working_days'].add(d['data'])
        monthly[d['mese']]['gaps'] += d['num_gaps']

    monthly_summary = []
    for mese in sorted(monthly.keys()):
        m = monthly[mese]
        wd = len(m['working_days'])
        monthly_summary.append({
            'mese': mese,
            'unused_hours': round(m['unused_minutes'] / 60, 1),
            'working_days': wd,
            'avg_daily_unused_min': round(m['unused_minutes'] / wd, 1) if wd > 0 else 0,
            'gaps': m['gaps'],
        })

    # Top 10 giorni peggiori
    worst_days = sorted(day_unused, key=lambda x: x['unused_minutes'], reverse=True)[:10]

    return {
        'total_gaps': len(all_gaps),
        'total_unused_minutes': total_unused,
        'total_unused_hours': round(total_unused / 60, 1),
        'avg_gap_minutes': round(total_unused / len(all_gaps), 1) if all_gaps else 0,
        'worst_days': worst_days,
        'monthly_summary': monthly_summary,
        'lunch_gaps_excluded': lunch_excluded,
    }


def detect_fragmentation(df_app):
    """
    Rileva frammentazione: gap 5-20 minuti tra appuntamenti.
    Troppo corti per prenotare un paziente, ma tempo perso.
    """
    if df_app.empty:
        return {'total_fragments': 0, 'total_wasted_minutes': 0, 'avg_fragment_minutes': 0, 'by_month': []}

    df = df_app[~df_app['tipo'].isin({'F', 'A'})].copy()
    if df.empty:
        return {'total_fragments': 0, 'total_wasted_minutes': 0, 'avg_fragment_minutes': 0, 'by_month': []}

    df['data_str'] = df['data'].dt.strftime('%Y-%m-%d')
    df['min_inizio'] = df['ora_inizio'].apply(_dbf_time_to_minutes)
    df['min_fine'] = df['ora_fine'].apply(_dbf_time_to_minutes)

    fragments = []

    for (data_str, studio), group in df.groupby(['data_str', 'studio']):
        sorted_app = group.sort_values('min_inizio')
        mese = int(sorted_app['mese'].iloc[0])
        rows = sorted_app[['min_inizio', 'min_fine']].values

        for i in range(len(rows) - 1):
            fine_corrente = rows[i][1]
            inizio_prossimo = rows[i + 1][0]
            gap = inizio_prossimo - fine_corrente

            # Escludi pausa pranzo anche dalla frammentazione
            if _is_lunch_gap(fine_corrente, inizio_prossimo):
                continue

            if FRAG_MIN <= gap <= FRAG_MAX:
                fragments.append({'mese': mese, 'minuti': int(gap)})

    total_wasted = sum(f['minuti'] for f in fragments)

    # Per mese
    by_month_data = defaultdict(lambda: {'count': 0, 'minuti': 0})
    for f in fragments:
        by_month_data[f['mese']]['count'] += 1
        by_month_data[f['mese']]['minuti'] += f['minuti']

    by_month = [
        {'mese': m, 'fragments': d['count'], 'wasted_minutes': d['minuti']}
        for m, d in sorted(by_month_data.items())
    ]

    return {
        'total_fragments': len(fragments),
        'total_wasted_minutes': total_wasted,
        'avg_fragment_minutes': round(total_wasted / len(fragments), 1) if fragments else 0,
        'by_month': by_month,
    }


def detect_prime_slot_waste(df_app):
    """
    Analizza l'uso degli slot mattutini (9-12) per procedure low-revenue.
    Suggerisce di spostare igiene e controlli al pomeriggio.
    """
    from core.constants_v2 import TIPI_APPUNTAMENTO

    if df_app.empty:
        return {'prime_total_appointments': 0, 'prime_low_revenue_count': 0,
                'prime_low_revenue_pct': 0, 'prime_slot_types': [], 'recommendation': ''}

    df = df_app[~df_app['tipo'].isin({'F', 'A'})].copy()
    if df.empty:
        return {'prime_total_appointments': 0, 'prime_low_revenue_count': 0,
                'prime_low_revenue_pct': 0, 'prime_slot_types': [], 'recommendation': ''}

    prime_start_min = _dbf_time_to_minutes(PRIME_START)
    prime_end_min = _dbf_time_to_minutes(PRIME_END)

    df['min_inizio'] = df['ora_inizio'].apply(_dbf_time_to_minutes)

    # Appuntamenti in slot prime (inizio tra 9:00 e 12:00)
    df_prime = df[(df['min_inizio'] >= prime_start_min) & (df['min_inizio'] < prime_end_min)]
    prime_total = len(df_prime)

    if prime_total == 0:
        return {'prime_total_appointments': 0, 'prime_low_revenue_count': 0,
                'prime_low_revenue_pct': 0, 'prime_slot_types': [], 'recommendation': ''}

    # Appuntamenti low-revenue in prime
    df_prime_low = df_prime[df_prime['tipo'].isin(LOW_REVENUE_TYPES)]
    low_count = len(df_prime_low)
    low_pct = round(low_count / prime_total * 100, 1)

    # Dettaglio per tipo
    prime_slot_types = []
    for tipo, group in df_prime_low.groupby('tipo'):
        tipo_nome = TIPI_APPUNTAMENTO.get(tipo, f'Tipo {tipo}')
        prime_slot_types.append({
            'tipo': tipo,
            'tipo_nome': tipo_nome,
            'count': len(group),
            'pct_of_prime': round(len(group) / prime_total * 100, 1),
        })
    prime_slot_types.sort(key=lambda x: x['count'], reverse=True)

    recommendation = ''
    if low_pct > 25:
        recommendation = (
            f"{low_pct}% degli slot mattutini (9-12) sono usati per procedure a basso ricavo. "
            "Valutare lo spostamento di igiene e controlli agli slot pomeridiani per "
            "liberare le fasce orarie premium per procedure ad alto valore."
        )

    return {
        'prime_total_appointments': prime_total,
        'prime_low_revenue_count': low_count,
        'prime_low_revenue_pct': low_pct,
        'prime_slot_types': prime_slot_types,
        'recommendation': recommendation,
    }


def detect_no_shows(df_app, df_estimates):
    """
    Detection euristica di no-show: appuntamenti clinici senza prestazione
    eseguita corrispondente (stessa data + stesso medico).

    CAVEAT: Non tutti gli appuntamenti generano record in PREVENT.
    Consultazioni e follow-up possono risultare come falsi positivi.
    """
    if df_app.empty:
        return {
            'total_potential_no_shows': 0, 'total_clinical_appointments': 0,
            'no_show_rate_pct': 0, 'by_month': [], 'by_tipo': [],
            'caveat': 'Nessun dato disponibile.'
        }

    from core.constants_v2 import TIPI_APPUNTAMENTO

    df = df_app[~df_app['tipo'].isin({'F', 'A'})].copy()
    clinical_total = len(df)

    if clinical_total == 0 or df_estimates.empty:
        return {
            'total_potential_no_shows': 0, 'total_clinical_appointments': clinical_total,
            'no_show_rate_pct': 0, 'by_month': [], 'by_tipo': [],
            'caveat': 'Dati insufficienti per la detection.'
        }

    # Prestazioni eseguite (stato=3) raggruppate per (data, medico)
    eseguiti = df_estimates[df_estimates['stato'] == 3].copy()
    if eseguiti.empty:
        return {
            'total_potential_no_shows': 0, 'total_clinical_appointments': clinical_total,
            'no_show_rate_pct': 0, 'by_month': [], 'by_tipo': [],
            'caveat': 'Nessuna prestazione eseguita trovata per il confronto.'
        }

    # Crea set di (data_str, medico) per lookup veloce
    eseguiti['data_str'] = eseguiti['data'].dt.strftime('%Y-%m-%d')
    executed_keys = set(zip(eseguiti['data_str'], eseguiti['medico']))

    # Confronta con appuntamenti
    df['data_str'] = df['data'].dt.strftime('%Y-%m-%d')
    df['has_treatment'] = df.apply(
        lambda row: (row['data_str'], row['medico']) in executed_keys, axis=1
    )

    # No-show potenziali: appuntamenti senza prestazione eseguita
    no_shows = df[~df['has_treatment']]
    ns_count = len(no_shows)
    ns_rate = round(ns_count / clinical_total * 100, 1) if clinical_total > 0 else 0

    # Per mese
    by_month = []
    for mese, group in no_shows.groupby('mese'):
        total_mese = len(df[df['mese'] == mese])
        by_month.append({
            'mese': int(mese),
            'no_shows': len(group),
            'appointments': total_mese,
            'rate_pct': round(len(group) / total_mese * 100, 1) if total_mese > 0 else 0,
        })
    by_month.sort(key=lambda x: x['mese'])

    # Per tipo
    by_tipo = []
    for tipo, group in no_shows.groupby('tipo'):
        total_tipo = len(df[df['tipo'] == tipo])
        tipo_nome = TIPI_APPUNTAMENTO.get(tipo, f'Tipo {tipo}')
        by_tipo.append({
            'tipo': tipo,
            'tipo_nome': tipo_nome,
            'no_shows': len(group),
            'appointments': total_tipo,
            'rate_pct': round(len(group) / total_tipo * 100, 1) if total_tipo > 0 else 0,
        })
    by_tipo.sort(key=lambda x: x['no_shows'], reverse=True)

    return {
        'total_potential_no_shows': ns_count,
        'total_clinical_appointments': clinical_total,
        'no_show_rate_pct': ns_rate,
        'by_month': by_month,
        'by_tipo': by_tipo,
        'caveat': (
            "Detection euristica basata su assenza di prestazioni eseguite corrispondenti. "
            "Consultazioni, follow-up e visite di controllo possono risultare come falsi positivi "
            "perche' non generano record in PREVENT.DBF."
        ),
    }


def main():
    parser = argparse.ArgumentParser(description='Rileva inefficienze nello scheduling')
    parser.add_argument('--anno', type=int, required=True, help='Anno di riferimento')
    parser.add_argument('--mese', type=int, default=None, help='Filtro mese (1-12)')
    parser.add_argument('--soglia-gap', type=int, default=30, help='Gap minimo in minuti da segnalare (default: 30)')
    parser.add_argument('--output', type=str, default=None, help='Path file JSON output')
    args = parser.parse_args()

    from services.economics.data_normalizer import get_df_appointments, get_df_estimates

    print(f"Caricamento dati anno {args.anno}...", file=sys.stderr)
    df_app = get_df_appointments(anno=args.anno)
    df_est = get_df_estimates(anno=args.anno)

    # Filtro mese opzionale
    if args.mese is not None and not df_app.empty:
        df_app = df_app[df_app['mese'] == args.mese]
    if args.mese is not None and not df_est.empty:
        df_est = df_est[df_est['mese'] == args.mese]

    print("Analisi gap poltrone...", file=sys.stderr)
    unused = detect_unused_chair_time(df_app, soglia_gap=args.soglia_gap)

    print("Analisi frammentazione...", file=sys.stderr)
    fragmentation = detect_fragmentation(df_app)

    print("Analisi slot mattutini...", file=sys.stderr)
    prime_slots = detect_prime_slot_waste(df_app)

    print("Detection no-show...", file=sys.stderr)
    no_shows = detect_no_shows(df_app, df_est)

    # Stima perdita ricavi
    # Usa una stima conservativa di ricavo/ora (calcolata se possibile)
    from services.economics.data_normalizer import get_df_production
    df_prod = get_df_production(anno=args.anno)
    total_prod = _safe(df_prod['importo'].sum()) if not df_prod.empty else 0
    total_clinical_hours = _safe(df_app[~df_app['tipo'].isin({'F', 'A'})]['durata_minuti'].sum() / 60) if not df_app.empty else 0
    rev_per_hour = total_prod / total_clinical_hours if total_clinical_hours > 0 else 0

    total_inefficiency_hours = unused['total_unused_hours'] + (fragmentation['total_wasted_minutes'] / 60)
    estimated_loss = round(total_inefficiency_hours * rev_per_hour, 2)

    # Raccomandazioni
    recommendations = []
    if unused['total_unused_hours'] > 10:
        recommendations.append(
            f"Ridurre i gap tra appuntamenti ({unused['total_unused_hours']} ore inutilizzate, "
            f"{unused['total_gaps']} gap rilevati)"
        )
    if fragmentation['total_fragments'] > 20:
        recommendations.append(
            f"Ridurre la frammentazione ({fragmentation['total_fragments']} micro-gap "
            f"per {fragmentation['total_wasted_minutes']} minuti persi)"
        )
    if prime_slots['prime_low_revenue_pct'] > 25:
        recommendations.append(
            f"Spostare procedure a basso ricavo dal mattino ({prime_slots['prime_low_revenue_pct']}% "
            f"degli slot 9-12 usati per igiene/controlli)"
        )
    if no_shows['no_show_rate_pct'] > 5:
        recommendations.append(
            f"Gestire tasso no-show ({no_shows['no_show_rate_pct']}% stimato)"
        )

    result = {
        'anno': args.anno,
        'mese_filtro': args.mese,
        'soglia_gap_minuti': args.soglia_gap,
        'generated_at': datetime.now().isoformat(),
        'unused_chair_time': unused,
        'fragmentation': fragmentation,
        'prime_slot_analysis': prime_slots,
        'potential_no_shows': no_shows,
        'summary': {
            'total_inefficiency_hours': round(total_inefficiency_hours, 1),
            'estimated_revenue_loss': estimated_loss,
            'revenue_per_hour_used': round(rev_per_hour, 2),
            'top_recommendations': recommendations,
        }
    }

    output_json(result, args.output)
    print(f"Analisi completata: {len(recommendations)} raccomandazioni generate", file=sys.stderr)


if __name__ == '__main__':
    main()
