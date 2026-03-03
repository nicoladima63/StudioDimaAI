"""
Forecast Engine per il modulo Economics.
Genera previsioni di fine anno con tre scenari.
"""

import logging
import math
from datetime import datetime
from typing import Optional, Dict, Any

from services.economics.monthly_aggregator import get_monthly_summary
from services.economics.seasonality_model import get_seasonality_index
from services.economics.trend_model import get_trend_analysis
from services.economics.data_normalizer import get_df_estimates

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


def get_forecast(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Genera previsione di fine anno con tre scenari.

    Pipeline:
    1. Produzione YTD (dati reali mesi passati)
    2. Per mesi futuri: media storica * indice stagionale * fattore trend
    3. Pipeline preventivi (conversione stimata)
    4. Tre scenari: conservativo, realistico, ottimistico

    Args:
        anno: Anno di previsione (default: corrente)

    Returns:
        Dict con forecast, scenari e dettaglio mensile.
    """
    if anno is None:
        anno = datetime.now().year

    mese_corrente = datetime.now().month if anno == datetime.now().year else 12

    # 1. Dati reali YTD
    monthly = get_monthly_summary(anno_inizio=anno, anno_fine=anno)
    mesi_reali = [m for m in monthly if m['mese'] <= mese_corrente and m['produzione'] > 0]

    # 2. Stagionalita e trend
    stagionalita = get_seasonality_index()
    trend = get_trend_analysis()

    indici = stagionalita.get('indici', {m: 1.0 for m in range(1, 13)})
    media_globale = stagionalita.get('media_globale_mensile', 0)
    fattore_trend = 1 + (trend.get('crescita_annuale_pct', 0) / 100)

    # 3. Pipeline preventivi pendenti
    pipeline_valore = _calcola_pipeline_preventivi(anno)

    # 4. Costruisci previsione mese per mese
    mesi_output = []
    produzione_reale_tot = 0
    costi_reali_tot = 0

    for mese in range(1, 13):
        mese_data = next((m for m in monthly if m['mese'] == mese), None)

        if mese <= mese_corrente and mese_data and mese_data['produzione'] > 0:
            # Mese reale
            mesi_output.append({
                'mese': mese,
                'reale': mese_data['produzione'],
                'previsto': None,
                'costi_reali': mese_data['costi_totali'],
                'tipo': 'reale',
            })
            produzione_reale_tot += mese_data['produzione']
            costi_reali_tot += mese_data['costi_totali']
        else:
            # Mese da prevedere
            indice_mese = indici.get(mese, indici.get(str(mese), 1.0))
            previsto = media_globale * indice_mese * fattore_trend
            mesi_output.append({
                'mese': mese,
                'reale': None,
                'previsto': round(max(0, previsto), 2),
                'costi_reali': None,
                'tipo': 'previsto',
            })

    # Calcola totali previsti per i 3 scenari
    mesi_futuri_val = sum(m['previsto'] for m in mesi_output if m['previsto'] is not None)

    # Costi stimati per mesi futuri (media dei costi reali)
    mesi_reali_count = len([m for m in mesi_output if m['tipo'] == 'reale'])
    costo_medio_mensile = (costi_reali_tot / mesi_reali_count) if mesi_reali_count > 0 else 0
    mesi_futuri_count = 12 - mesi_reali_count
    costi_stimati_futuri = costo_medio_mensile * mesi_futuri_count

    scenari = _calcola_scenari(
        produzione_reale_tot, mesi_futuri_val, pipeline_valore,
        costi_reali_tot, costi_stimati_futuri
    )

    return {
        'anno': anno,
        'mese_corrente': mese_corrente,
        'produzione_ytd': round(_safe(produzione_reale_tot), 2),
        'forecast_produzione': scenari['realistico']['produzione'],
        'forecast_margine': scenari['realistico']['margine'],
        'pipeline_preventivi': round(_safe(pipeline_valore), 2),
        'scenario_conservativo': scenari['conservativo'],
        'scenario_realistico': scenari['realistico'],
        'scenario_ottimistico': scenari['ottimistico'],
        'mesi': mesi_output,
        'parametri': {
            'fattore_trend': round(fattore_trend, 4),
            'media_globale_mensile': round(media_globale, 2),
            'crescita_annuale_pct': trend.get('crescita_annuale_pct', 0),
            'anni_storico': stagionalita.get('anni_analizzati', 0),
        }
    }


def _calcola_pipeline_preventivi(anno: int) -> float:
    """Calcola il valore totale dei preventivi pendenti per l'anno."""
    try:
        df_est = get_df_estimates(anno=anno)
        if df_est.empty:
            return 0.0

        # Stato 1 = Da Eseguire (pendenti)
        pendenti = df_est[df_est['stato'] == 1]
        return _safe(pendenti['spesa'].sum()) if not pendenti.empty else 0.0
    except Exception as e:
        logger.warning(f"Errore calcolo pipeline preventivi: {e}")
        return 0.0


def _calcola_scenari(
    prod_reale: float, prod_prevista_futura: float, pipeline: float,
    costi_reali: float, costi_stimati_futuri: float
) -> Dict[str, Dict[str, float]]:
    """Calcola i tre scenari di previsione."""

    def _scenario(trend_factor: float, conv_rate: float) -> Dict[str, float]:
        prod_futura = _safe(prod_prevista_futura * trend_factor)
        prod_pipeline = _safe(pipeline * conv_rate)
        produzione_totale = _safe(prod_reale + prod_futura + prod_pipeline)
        costi_totali = _safe(costi_reali + costi_stimati_futuri)
        margine = _safe(produzione_totale - costi_totali)
        margine_pct = _safe(margine / produzione_totale * 100) if produzione_totale > 0 else 0

        return {
            'produzione': round(produzione_totale, 2),
            'costi': round(costi_totali, 2),
            'margine': round(margine, 2),
            'margine_pct': round(margine_pct, 2),
            'pipeline_convertita': round(prod_pipeline, 2),
        }

    return {
        'conservativo': _scenario(0.9, 0.30),
        'realistico': _scenario(1.0, 0.50),
        'ottimistico': _scenario(1.1, 0.70),
    }
