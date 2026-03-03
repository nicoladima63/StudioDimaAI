"""
Comparison Engine per il modulo Economics.
Analisi comparativa multi-anno e previsione trimestrale.
"""

import logging
import math
from datetime import datetime
from typing import Optional, List, Dict, Any

import numpy as np

from services.economics.monthly_aggregator import get_monthly_summary
from services.economics.seasonality_model import get_seasonality_index
from services.economics.trend_model import get_trend_analysis

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


# Definizione trimestri
TRIMESTRI = {
    1: {'nome': 'Q1', 'label': 'Gen-Mar', 'mesi': [1, 2, 3]},
    2: {'nome': 'Q2', 'label': 'Apr-Giu', 'mesi': [4, 5, 6]},
    3: {'nome': 'Q3', 'label': 'Lug-Set', 'mesi': [7, 8, 9]},
    4: {'nome': 'Q4', 'label': 'Ott-Dic', 'mesi': [10, 11, 12]},
}


def get_multi_year_comparison(anni: List[int]) -> Dict[str, Any]:
    """
    Restituisce i dati mensili di produzione, costi e margine per piu anni,
    con forecast per l'anno corrente.

    Args:
        anni: Lista di anni da confrontare (es. [2023, 2024, 2025])

    Returns:
        Dict con dati mensili per ogni anno e forecast anno corrente.
    """
    if not anni:
        anni = [datetime.now().year]

    anni = sorted(set(anni))
    anno_corrente = datetime.now().year
    mese_corrente = datetime.now().month

    # Carica dati mensili per tutti gli anni richiesti
    anno_min = min(anni)
    anno_max = max(anni)
    monthly = get_monthly_summary(anno_inizio=anno_min, anno_fine=anno_max)

    # Organizza dati per anno
    dati_per_anno = {}
    for anno in anni:
        mesi_anno = [m for m in monthly if m['anno'] == anno]
        mesi_output = []
        for mese in range(1, 13):
            mese_data = next((m for m in mesi_anno if m['mese'] == mese), None)
            if mese_data:
                mesi_output.append({
                    'mese': mese,
                    'produzione': round(_safe(mese_data['produzione']), 2),
                    'costi': round(_safe(mese_data['costi_totali']), 2),
                    'margine': round(_safe(mese_data['margine']), 2),
                    'ore_cliniche': round(_safe(mese_data['ore_cliniche']), 2),
                })
            else:
                mesi_output.append({
                    'mese': mese,
                    'produzione': 0,
                    'costi': 0,
                    'margine': 0,
                    'ore_cliniche': 0,
                })

        totale = sum(m['produzione'] for m in mesi_output)
        totale_costi = sum(m['costi'] for m in mesi_output)

        dati_per_anno[str(anno)] = {
            'anno': anno,
            'mesi': mesi_output,
            'totale_produzione': round(totale, 2),
            'totale_costi': round(totale_costi, 2),
            'totale_margine': round(totale - totale_costi, 2),
        }

    # Calcola forecast per l'anno corrente
    forecast = _calcola_forecast_mensile(anni, monthly)

    # Calcola statistiche comparative
    statistiche = _calcola_statistiche(dati_per_anno, anni)

    return {
        'anni': anni,
        'anno_corrente': anno_corrente,
        'mese_corrente': mese_corrente,
        'dati_per_anno': dati_per_anno,
        'forecast': forecast,
        'statistiche': statistiche,
    }


def get_trimester_forecast(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Calcola previsioni trimestrali dettagliate per l'anno corrente.

    Usa stagionalita, trend e dati reali gia disponibili per generare
    previsioni per ciascun trimestre con intervalli di confidenza.

    Args:
        anno: Anno di previsione (default: corrente)

    Returns:
        Dict con previsioni trimestrali e metriche.
    """
    if anno is None:
        anno = datetime.now().year

    mese_corrente = datetime.now().month if anno == datetime.now().year else 12

    # Dati reali anno corrente
    monthly = get_monthly_summary(anno_inizio=anno, anno_fine=anno)
    mesi_lookup = {m['mese']: m for m in monthly}

    # Stagionalita e trend
    stagionalita = get_seasonality_index()
    trend = get_trend_analysis()

    indici = stagionalita.get('indici', {m: 1.0 for m in range(1, 13)})
    media_globale = stagionalita.get('media_globale_mensile', 0)
    fattore_trend = 1 + (trend.get('crescita_annuale_pct', 0) / 100)

    # Dati storici per calcolo varianza (ultimi 3 anni)
    anni_storici = list(range(anno - 3, anno))
    storico = get_monthly_summary(anno_inizio=anno - 3, anno_fine=anno - 1)

    # Calcola deviazione standard per mese (per intervalli di confidenza)
    dev_per_mese = _calcola_deviazione_mensile(storico)

    # Calcola costo medio mensile dai dati reali
    mesi_reali_con_dati = [m for m in monthly if m['mese'] <= mese_corrente and m['produzione'] > 0]
    costo_medio_mensile = 0
    if mesi_reali_con_dati:
        costo_medio_mensile = sum(m['costi_totali'] for m in mesi_reali_con_dati) / len(mesi_reali_con_dati)

    trimestri_output = []

    for q_num, q_def in TRIMESTRI.items():
        mesi_q = q_def['mesi']

        # Dati reali e previsti per ogni mese del trimestre
        produzione_reale = 0
        produzione_prevista = 0
        costi_reali = 0
        costi_previsti = 0
        mesi_reali_count = 0
        mesi_previsti_count = 0
        deviazione_accum = 0

        dettaglio_mesi = []

        for mese in mesi_q:
            mese_data = mesi_lookup.get(mese)
            is_reale = (mese <= mese_corrente and mese_data and mese_data['produzione'] > 0)

            if is_reale:
                prod = _safe(mese_data['produzione'])
                costo = _safe(mese_data['costi_totali'])
                produzione_reale += prod
                costi_reali += costo
                mesi_reali_count += 1
                dettaglio_mesi.append({
                    'mese': mese,
                    'tipo': 'reale',
                    'produzione': round(prod, 2),
                    'costi': round(costo, 2),
                })
            else:
                indice_mese = indici.get(mese, indici.get(str(mese), 1.0))
                prev = max(0, media_globale * indice_mese * fattore_trend)
                produzione_prevista += prev
                costi_previsti += costo_medio_mensile
                mesi_previsti_count += 1
                deviazione_accum += dev_per_mese.get(mese, 0)
                dettaglio_mesi.append({
                    'mese': mese,
                    'tipo': 'previsto',
                    'produzione': round(prev, 2),
                    'costi': round(costo_medio_mensile, 2),
                })

        totale_produzione = produzione_reale + produzione_prevista
        totale_costi = costi_reali + costi_previsti
        margine = totale_produzione - totale_costi

        # Intervallo di confidenza (basato su deviazione storica)
        if mesi_previsti_count > 0 and deviazione_accum > 0:
            intervallo = deviazione_accum * 1.0  # ~68% confidence
            prod_min = max(0, totale_produzione - intervallo)
            prod_max = totale_produzione + intervallo
        else:
            prod_min = totale_produzione
            prod_max = totale_produzione

        # Stato del trimestre
        if mesi_reali_count == 3:
            stato = 'completato'
        elif mesi_reali_count > 0:
            stato = 'parziale'
        else:
            stato = 'previsto'

        trimestri_output.append({
            'trimestre': q_num,
            'nome': q_def['nome'],
            'label': q_def['label'],
            'stato': stato,
            'mesi_reali': mesi_reali_count,
            'mesi_previsti': mesi_previsti_count,
            'produzione': round(_safe(totale_produzione), 2),
            'produzione_min': round(_safe(prod_min), 2),
            'produzione_max': round(_safe(prod_max), 2),
            'costi': round(_safe(totale_costi), 2),
            'margine': round(_safe(margine), 2),
            'margine_pct': round(_safe(margine / totale_produzione * 100), 2) if totale_produzione > 0 else 0,
            'dettaglio_mesi': dettaglio_mesi,
        })

    # Totale annuale
    totale_anno_prod = sum(t['produzione'] for t in trimestri_output)
    totale_anno_costi = sum(t['costi'] for t in trimestri_output)
    totale_anno_margine = totale_anno_prod - totale_anno_costi

    return {
        'anno': anno,
        'mese_corrente': mese_corrente,
        'trimestri': trimestri_output,
        'totale_annuale': {
            'produzione': round(_safe(totale_anno_prod), 2),
            'costi': round(_safe(totale_anno_costi), 2),
            'margine': round(_safe(totale_anno_margine), 2),
            'margine_pct': round(_safe(totale_anno_margine / totale_anno_prod * 100), 2) if totale_anno_prod > 0 else 0,
        },
        'parametri': {
            'fattore_trend': round(fattore_trend, 4),
            'media_globale_mensile': round(media_globale, 2),
            'crescita_annuale_pct': trend.get('crescita_annuale_pct', 0),
            'anni_storico': stagionalita.get('anni_analizzati', 0),
        }
    }


def _calcola_forecast_mensile(
    anni: List[int],
    monthly: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Calcola il forecast mensile per l'anno corrente basato su stagionalita e trend.
    """
    anno_corrente = datetime.now().year
    mese_corrente = datetime.now().month

    stagionalita = get_seasonality_index()
    trend = get_trend_analysis()

    indici = stagionalita.get('indici', {m: 1.0 for m in range(1, 13)})
    media_globale = stagionalita.get('media_globale_mensile', 0)
    fattore_trend = 1 + (trend.get('crescita_annuale_pct', 0) / 100)

    # Dati reali anno corrente
    mesi_corrente = [m for m in monthly if m['anno'] == anno_corrente]
    mesi_lookup = {m['mese']: m for m in mesi_corrente}

    mesi_forecast = []
    for mese in range(1, 13):
        mese_data = mesi_lookup.get(mese)
        is_reale = (mese <= mese_corrente and mese_data and mese_data['produzione'] > 0)

        if is_reale:
            mesi_forecast.append({
                'mese': mese,
                'tipo': 'reale',
                'produzione': round(_safe(mese_data['produzione']), 2),
            })
        else:
            indice_mese = indici.get(mese, indici.get(str(mese), 1.0))
            previsto = max(0, media_globale * indice_mese * fattore_trend)
            mesi_forecast.append({
                'mese': mese,
                'tipo': 'previsto',
                'produzione': round(previsto, 2),
            })

    totale = sum(m['produzione'] for m in mesi_forecast)

    return {
        'anno': anno_corrente,
        'mesi': mesi_forecast,
        'totale_previsto': round(totale, 2),
    }


def _calcola_deviazione_mensile(storico: List[Dict[str, Any]]) -> Dict[int, float]:
    """
    Calcola la deviazione standard della produzione per ogni mese
    basandosi sui dati storici.
    """
    dev = {}
    for mese in range(1, 13):
        valori = [m['produzione'] for m in storico if m['mese'] == mese and m['produzione'] > 0]
        if len(valori) >= 2:
            dev[mese] = float(np.std(valori))
        elif valori:
            dev[mese] = valori[0] * 0.15  # 15% di variazione se solo un dato
        else:
            dev[mese] = 0
    return dev


def _calcola_statistiche(
    dati_per_anno: Dict[str, Any],
    anni: List[int]
) -> Dict[str, Any]:
    """
    Calcola statistiche comparative tra gli anni.
    """
    if len(anni) < 2:
        return {'crescita_media': 0, 'anno_migliore': anni[0] if anni else 0}

    produzioni = []
    for anno in sorted(anni):
        key = str(anno)
        if key in dati_per_anno:
            produzioni.append({
                'anno': anno,
                'totale': dati_per_anno[key]['totale_produzione'],
            })

    # Crescita anno su anno
    crescite = []
    for i in range(1, len(produzioni)):
        prev = produzioni[i - 1]['totale']
        curr = produzioni[i]['totale']
        if prev > 0:
            crescite.append({
                'da': produzioni[i - 1]['anno'],
                'a': produzioni[i]['anno'],
                'delta': round(curr - prev, 2),
                'delta_pct': round((curr - prev) / prev * 100, 2),
            })

    crescita_media = 0
    if crescite:
        crescita_media = round(sum(c['delta_pct'] for c in crescite) / len(crescite), 2)

    anno_migliore = max(produzioni, key=lambda p: p['totale'])['anno'] if produzioni else 0

    # Media mensile globale (tutti gli anni)
    totale_globale = sum(p['totale'] for p in produzioni)
    mesi_totali = len(produzioni) * 12
    media_mensile_globale = round(totale_globale / mesi_totali, 2) if mesi_totali > 0 else 0

    return {
        'crescita_media_pct': crescita_media,
        'anno_migliore': anno_migliore,
        'crescite_annuali': crescite,
        'media_mensile_globale': media_mensile_globale,
    }
