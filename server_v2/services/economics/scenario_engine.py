"""
Scenario Engine per il modulo Economics.
Simulatore decisionale con variabili modificabili.
"""

import logging
from datetime import datetime
from typing import Dict, Any

from services.economics.forecast_engine import get_forecast

logger = logging.getLogger(__name__)


def simulate(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simula l'impatto di decisioni economiche sul forecast.

    Input parametri:
    - aumento_tariffa_pct: 0-50 (aumento % delle tariffe)
    - aumento_saturazione_pct: 0-30 (aumento % della saturazione/ore cliniche)
    - nuovo_operatore: bool (aggiunta di un nuovo operatore)
    - costo_nuovo_operatore: float (costo annuale del nuovo operatore, default 40000)
    - riduzione_costi_pct: 0-30 (riduzione % dei costi)
    - aumento_ore_cliniche: 0-40 (ore/mese aggiuntive)

    Returns:
        Dict con scenario simulato vs scenario base.
    """
    anno = params.get('anno', datetime.now().year)

    # Recupera il forecast base (realistico)
    forecast_base = get_forecast(anno=anno)
    base = forecast_base.get('scenario_realistico', {})

    produzione_base = base.get('produzione', 0)
    costi_base = base.get('costi', 0)
    margine_base = base.get('margine', 0)

    # Parametri simulazione (con validazione)
    aumento_tariffa = _clamp(params.get('aumento_tariffa_pct', 0), 0, 50)
    aumento_saturazione = _clamp(params.get('aumento_saturazione_pct', 0), 0, 30)
    nuovo_operatore = bool(params.get('nuovo_operatore', False))
    costo_nuovo_operatore = max(0, params.get('costo_nuovo_operatore', 40000))
    riduzione_costi = _clamp(params.get('riduzione_costi_pct', 0), 0, 30)
    aumento_ore = _clamp(params.get('aumento_ore_cliniche', 0), 0, 40)

    # --- Calcolo impatto ---

    # 1. Aumento tariffa -> aumento proporzionale della produzione
    impatto_tariffa = produzione_base * (aumento_tariffa / 100)

    # 2. Aumento saturazione -> piu ore lavorate -> piu produzione
    #    Approssimazione: la produzione cresce proporzionalmente alle ore
    impatto_saturazione = produzione_base * (aumento_saturazione / 100)

    # 3. Nuovo operatore -> aumento produzione (stimiamo che un operatore
    #    produce circa 1/N della produzione totale, dove N = numero operatori attuali)
    impatto_nuovo_op_prod = 0
    impatto_nuovo_op_costi = 0
    if nuovo_operatore:
        # Stima: un nuovo operatore produce circa il 15-20% della produzione attuale
        impatto_nuovo_op_prod = produzione_base * 0.15
        impatto_nuovo_op_costi = costo_nuovo_operatore

    # 4. Riduzione costi -> diminuzione diretta dei costi
    impatto_riduzione_costi = costi_base * (riduzione_costi / 100)

    # 5. Aumento ore cliniche -> piu produzione
    #    Stima ricavo orario dalla base
    ore_ytd = forecast_base.get('parametri', {}).get('media_globale_mensile', 0)
    ricavo_orario_stimato = 0
    if ore_ytd > 0 and produzione_base > 0:
        # Ricavo orario = produzione annuale / (ore_medie_mese * 12)
        ricavo_orario_stimato = produzione_base / (160 * 12)  # Approssimazione
    impatto_ore = aumento_ore * 12 * ricavo_orario_stimato

    # --- Totali simulati ---
    nuova_produzione = (
        produzione_base
        + impatto_tariffa
        + impatto_saturazione
        + impatto_nuovo_op_prod
        + impatto_ore
    )

    nuovi_costi = (
        costi_base
        - impatto_riduzione_costi
        + impatto_nuovo_op_costi
    )

    nuovo_margine = nuova_produzione - nuovi_costi
    nuovo_margine_pct = (nuovo_margine / nuova_produzione * 100) if nuova_produzione > 0 else 0

    delta_produzione = nuova_produzione - produzione_base
    delta_margine = nuovo_margine - margine_base

    return {
        'anno': anno,
        'base': {
            'produzione': round(produzione_base, 2),
            'costi': round(costi_base, 2),
            'margine': round(margine_base, 2),
        },
        'simulato': {
            'produzione': round(nuova_produzione, 2),
            'costi': round(nuovi_costi, 2),
            'margine': round(nuovo_margine, 2),
            'margine_pct': round(nuovo_margine_pct, 2),
        },
        'delta': {
            'produzione': round(delta_produzione, 2),
            'margine': round(delta_margine, 2),
            'produzione_pct': round(delta_produzione / produzione_base * 100, 2) if produzione_base > 0 else 0,
        },
        'dettaglio_impatti': {
            'aumento_tariffa': round(impatto_tariffa, 2),
            'aumento_saturazione': round(impatto_saturazione, 2),
            'nuovo_operatore_prod': round(impatto_nuovo_op_prod, 2),
            'nuovo_operatore_costi': round(impatto_nuovo_op_costi, 2),
            'riduzione_costi': round(impatto_riduzione_costi, 2),
            'aumento_ore_cliniche': round(impatto_ore, 2),
        },
        'parametri_usati': {
            'aumento_tariffa_pct': aumento_tariffa,
            'aumento_saturazione_pct': aumento_saturazione,
            'nuovo_operatore': nuovo_operatore,
            'costo_nuovo_operatore': costo_nuovo_operatore,
            'riduzione_costi_pct': riduzione_costi,
            'aumento_ore_cliniche': aumento_ore,
        }
    }


def _clamp(value: float, min_val: float, max_val: float) -> float:
    """Limita un valore nel range [min_val, max_val]."""
    try:
        v = float(value)
        return max(min_val, min(max_val, v))
    except (TypeError, ValueError):
        return min_val
