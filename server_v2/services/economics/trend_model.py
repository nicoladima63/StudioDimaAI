"""
Trend Model per il modulo Economics.
Analisi trend di produzione con regressione lineare.
"""

import logging
import math
from datetime import datetime
from typing import Dict, Any

import numpy as np

from services.economics.monthly_aggregator import get_monthly_summary

logger = logging.getLogger(__name__)


def _safe(val, default=0):
    """Converte NaN/Inf in un valore sicuro per JSON."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


def get_trend_analysis() -> Dict[str, Any]:
    """
    Analizza il trend di produzione su base storica.

    Usa regressione lineare per calcolare:
    - Crescita annuale percentuale
    - Direzione del trend
    - Proiezione per il mese corrente
    - R-squared (bonta del modello)

    Returns:
        Dict con analisi trend e metriche.
    """
    anno_corrente = datetime.now().year
    anno_inizio = anno_corrente - 5

    monthly = get_monthly_summary(anno_inizio=anno_inizio, anno_fine=anno_corrente)

    if not monthly:
        return _empty_result()

    # --- Trend annuale ---
    produzioni_annuali = {}
    for m in monthly:
        anno = m['anno']
        if anno not in produzioni_annuali:
            produzioni_annuali[anno] = 0
        produzioni_annuali[anno] += m['produzione']

    # Filtra anni con dati significativi
    anni_validi = {a: p for a, p in produzioni_annuali.items() if p > 0}

    crescita_annuale_pct = 0.0
    r_squared_annuale = 0.0
    trend_direction = 'stabile'

    if len(anni_validi) >= 2:
        x_anni = np.array(sorted(anni_validi.keys()), dtype=float)
        y_prod = np.array([anni_validi[a] for a in sorted(anni_validi.keys())], dtype=float)

        # Regressione lineare
        coeffs = np.polyfit(x_anni, y_prod, 1)
        slope = coeffs[0]

        # Calcola R-squared
        y_pred = np.polyval(coeffs, x_anni)
        ss_res = np.sum((y_prod - y_pred) ** 2)
        ss_tot = np.sum((y_prod - np.mean(y_prod)) ** 2)
        r_squared_annuale = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

        # Crescita percentuale media
        media_prod = np.mean(y_prod)
        crescita_annuale_pct = (slope / media_prod * 100) if media_prod > 0 else 0

        if crescita_annuale_pct > 2:
            trend_direction = 'crescita'
        elif crescita_annuale_pct < -2:
            trend_direction = 'calo'
        else:
            trend_direction = 'stabile'

    # --- Trend ultimi 12 mesi rolling ---
    mese_corrente = datetime.now().month
    # Prendi gli ultimi 12 mesi con dati
    mesi_recenti = sorted(monthly, key=lambda m: (m['anno'], m['mese']))
    mesi_con_prod = [m for m in mesi_recenti if m['produzione'] > 0]
    ultimi_12 = mesi_con_prod[-12:] if len(mesi_con_prod) >= 12 else mesi_con_prod

    trend_12m = 0.0
    proiezione_mese_corrente = 0.0

    if len(ultimi_12) >= 3:
        x_idx = np.arange(len(ultimi_12), dtype=float)
        y_vals = np.array([m['produzione'] for m in ultimi_12], dtype=float)

        coeffs_12 = np.polyfit(x_idx, y_vals, 1)
        slope_12 = coeffs_12[0]

        media_12 = np.mean(y_vals)
        trend_12m = (slope_12 / media_12 * 100) if media_12 > 0 else 0

        # Proiezione per il prossimo mese
        proiezione_mese_corrente = float(np.polyval(coeffs_12, len(ultimi_12)))

    # Dati annuali per il grafico
    anni_trend = []
    for anno in sorted(anni_validi.keys()):
        anni_trend.append({
            'anno': anno,
            'produzione': round(anni_validi[anno], 2),
        })

    return {
        'crescita_annuale_pct': round(_safe(crescita_annuale_pct), 2),
        'trend_direction': trend_direction,
        'r_squared_annuale': round(_safe(r_squared_annuale), 4),
        'trend_12_mesi_pct': round(_safe(trend_12m), 2),
        'proiezione_mese_corrente': round(max(0, _safe(proiezione_mese_corrente)), 2),
        'anni_analizzati': len(anni_validi),
        'range_anni': f"{min(anni_validi.keys())}-{max(anni_validi.keys())}" if anni_validi else 'N/A',
        'anni_trend': anni_trend,
        'ultimi_12_mesi': [{
            'anno': m['anno'],
            'mese': m['mese'],
            'produzione': m['produzione'],
        } for m in ultimi_12],
    }


def _empty_result() -> Dict[str, Any]:
    """Risultato vuoto quando non ci sono dati."""
    return {
        'crescita_annuale_pct': 0,
        'trend_direction': 'nessun dato',
        'r_squared_annuale': 0,
        'trend_12_mesi_pct': 0,
        'proiezione_mese_corrente': 0,
        'anni_analizzati': 0,
        'range_anni': 'N/A',
        'anni_trend': [],
        'ultimi_12_mesi': [],
    }
