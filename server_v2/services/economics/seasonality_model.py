"""
Seasonality Model per il modulo Economics.
Calcola l'indice di stagionalita mensile basato sui dati storici.
"""

import logging
from datetime import datetime
from typing import Dict, Any

from services.economics.monthly_aggregator import get_monthly_summary

logger = logging.getLogger(__name__)

# Anni minimi di dati per un calcolo significativo
MIN_ANNI_STORICO = 2


def get_seasonality_index() -> Dict[str, Any]:
    """
    Calcola l'indice di stagionalita per ogni mese.

    L'indice viene calcolato come: media produzione del mese / media produzione mensile globale.
    Un valore > 1 indica un mese sopra la media, < 1 sotto la media.

    Returns:
        Dict con indici mensili e statistiche.
    """
    anno_corrente = datetime.now().year

    # Carica dati degli ultimi 5 anni (o quanti disponibili)
    anno_inizio = anno_corrente - 5
    monthly = get_monthly_summary(anno_inizio=anno_inizio, anno_fine=anno_corrente - 1)

    if not monthly:
        logger.warning("Nessun dato storico disponibile per calcolo stagionalita")
        return _empty_result()

    # Raggruppa per mese e calcola media
    mesi_data = {}  # {mese: [produzione_anno1, produzione_anno2, ...]}
    for m in monthly:
        mese = m['mese']
        if mese not in mesi_data:
            mesi_data[mese] = []
        if m['produzione'] > 0:
            mesi_data[mese].append(m['produzione'])

    if not mesi_data:
        return _empty_result()

    # Media per mese
    media_per_mese = {}
    for mese in range(1, 13):
        valori = mesi_data.get(mese, [])
        media_per_mese[mese] = sum(valori) / len(valori) if valori else 0

    # Media globale mensile
    tutti_valori = [v for vals in mesi_data.values() for v in vals]
    media_globale = sum(tutti_valori) / len(tutti_valori) if tutti_valori else 0

    # Calcola indici
    indici = {}
    for mese in range(1, 13):
        if media_globale > 0 and media_per_mese[mese] > 0:
            indici[mese] = round(media_per_mese[mese] / media_globale, 3)
        else:
            indici[mese] = 1.0  # Default neutro

    # Identifica mesi migliori e peggiori
    mese_migliore = max(indici, key=indici.get)
    mese_peggiore = min(indici, key=indici.get)

    anni_disponibili = len(set(m['anno'] for m in monthly if m['produzione'] > 0))

    return {
        'indici': indici,
        'media_globale_mensile': round(media_globale, 2),
        'medie_per_mese': {k: round(v, 2) for k, v in media_per_mese.items()},
        'mese_migliore': {'mese': mese_migliore, 'indice': indici[mese_migliore]},
        'mese_peggiore': {'mese': mese_peggiore, 'indice': indici[mese_peggiore]},
        'anni_analizzati': anni_disponibili,
        'range_anni': f"{anno_inizio}-{anno_corrente - 1}",
        'affidabilita': 'alta' if anni_disponibili >= MIN_ANNI_STORICO else 'bassa',
    }


def _empty_result() -> Dict[str, Any]:
    """Risultato vuoto quando non ci sono dati."""
    return {
        'indici': {m: 1.0 for m in range(1, 13)},
        'media_globale_mensile': 0,
        'medie_per_mese': {m: 0 for m in range(1, 13)},
        'mese_migliore': {'mese': 1, 'indice': 1.0},
        'mese_peggiore': {'mese': 1, 'indice': 1.0},
        'anni_analizzati': 0,
        'range_anni': 'N/A',
        'affidabilita': 'nessun dato',
    }
