"""
KPI Engine per il modulo Economics.
Calcola indicatori chiave di performance dai dati mensili aggregati.
"""

import logging
import math
from datetime import datetime
from typing import Optional, Dict, Any, List

from services.economics.monthly_aggregator import get_monthly_summary
from services.economics.data_normalizer import get_df_appointments, get_df_estimates

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


def get_kpi_current(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Calcola i KPI dello stato attuale (Year-To-Date).

    Returns:
        Dict con produzione_ytd, incasso_ytd, ore_cliniche_ytd,
        ricavo_medio_ora, costo_orario_totale, margine_pct, break_even_mensile
    """
    if anno is None:
        anno = datetime.now().year

    mese_corrente = datetime.now().month if anno == datetime.now().year else 12
    monthly = get_monthly_summary(anno_inizio=anno, anno_fine=anno)

    # Filtra solo i mesi fino al corrente
    mesi_ytd = [m for m in monthly if m['mese'] <= mese_corrente]

    produzione_ytd = sum(m['produzione'] for m in mesi_ytd)
    incasso_ytd = sum(m['incasso'] for m in mesi_ytd)
    ore_cliniche_ytd = sum(m['ore_cliniche'] for m in mesi_ytd)
    costi_totali_ytd = sum(m['costi_totali'] for m in mesi_ytd)
    costi_diretti_ytd = sum(m.get('costi_diretti', 0) for m in mesi_ytd)
    costi_indiretti_ytd = sum(m.get('costi_indiretti', 0) for m in mesi_ytd)
    costi_non_deducibili_ytd = sum(m.get('costi_non_deducibili', 0) for m in mesi_ytd)
    costi_non_classificati_ytd = sum(m.get('costi_non_classificati', 0) for m in mesi_ytd)
    num_fatture_ytd = sum(m.get('num_fatture', 0) for m in mesi_ytd)
    num_appuntamenti_ytd = sum(m.get('num_appuntamenti', 0) for m in mesi_ytd)

    ricavo_medio_ora = (produzione_ytd / ore_cliniche_ytd) if ore_cliniche_ytd > 0 else 0
    costo_orario_totale = (costi_totali_ytd / ore_cliniche_ytd) if ore_cliniche_ytd > 0 else 0
    margine_ytd = produzione_ytd - costi_totali_ytd
    margine_pct = (margine_ytd / produzione_ytd * 100) if produzione_ytd > 0 else 0

    # Break-even mensile con costi classificati
    # Costi diretti = variabili (legati alla produzione)
    # Costi indiretti = fissi (struttura, dipendenti, oneri)
    mesi_con_dati = len([m for m in mesi_ytd if m['produzione'] > 0])
    produzione_media_mensile = (produzione_ytd / mesi_con_dati) if mesi_con_dati > 0 else 0

    # Costi fissi medi mensili (indiretti + non deducibili + non classificati come approssimazione)
    costi_fissi_ytd = costi_indiretti_ytd + costi_non_deducibili_ytd + costi_non_classificati_ytd
    costi_fissi_medi_mensili = (costi_fissi_ytd / mesi_con_dati) if mesi_con_dati > 0 else 0

    # Margine di contribuzione = 1 - (costi_diretti / produzione)
    margine_contribuzione = 1 - (costi_diretti_ytd / produzione_ytd) if produzione_ytd > 0 else 0

    # Break-even = costi_fissi_mensili / margine_contribuzione
    if margine_contribuzione > 0:
        break_even_mensile = costi_fissi_medi_mensili / margine_contribuzione
    else:
        # Fallback: se non ci sono costi diretti classificati, usa la formula semplice
        costi_medi_mensili = (costi_totali_ytd / mesi_con_dati) if mesi_con_dati > 0 else 0
        margine_ratio = (margine_ytd / produzione_ytd) if produzione_ytd > 0 else 0
        break_even_mensile = (costi_medi_mensili / margine_ratio) if margine_ratio > 0 else 0

    return {
        'anno': anno,
        'mese_corrente': mese_corrente,
        'produzione_ytd': round(_safe(produzione_ytd), 2),
        'incasso_ytd': round(_safe(incasso_ytd), 2),
        'ore_cliniche_ytd': round(_safe(ore_cliniche_ytd), 2),
        'costi_totali_ytd': round(_safe(costi_totali_ytd), 2),
        'costi_diretti_ytd': round(_safe(costi_diretti_ytd), 2),
        'costi_indiretti_ytd': round(_safe(costi_indiretti_ytd), 2),
        'costi_non_deducibili_ytd': round(_safe(costi_non_deducibili_ytd), 2),
        'costi_non_classificati_ytd': round(_safe(costi_non_classificati_ytd), 2),
        'margine_ytd': round(_safe(margine_ytd), 2),
        'ricavo_medio_ora': round(_safe(ricavo_medio_ora), 2),
        'costo_orario_totale': round(_safe(costo_orario_totale), 2),
        'margine_pct': round(_safe(margine_pct), 2),
        'break_even_mensile': round(_safe(break_even_mensile), 2),
        'produzione_media_mensile': round(_safe(produzione_media_mensile), 2),
        'margine_contribuzione': round(_safe(margine_contribuzione * 100), 2),
        'num_fatture_ytd': num_fatture_ytd,
        'num_appuntamenti_ytd': num_appuntamenti_ytd,
        'mesi_con_dati': mesi_con_dati,
    }


def get_kpi_monthly(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Restituisce i KPI mese per mese per un anno.

    Returns:
        Dict con anno e array mesi con tutti i KPI per ogni mese.
    """
    if anno is None:
        anno = datetime.now().year

    monthly = get_monthly_summary(anno_inizio=anno, anno_fine=anno)

    mesi = []
    for m in monthly:
        mesi.append({
            'mese': m['mese'],
            'produzione': _safe(m['produzione']),
            'incasso': _safe(m['incasso']),
            'ore_cliniche': _safe(m['ore_cliniche']),
            'ricavo_orario': _safe(m['ricavo_orario']),
            'costi_totali': _safe(m['costi_totali']),
            'costi_diretti': _safe(m.get('costi_diretti', 0)),
            'costi_indiretti': _safe(m.get('costi_indiretti', 0)),
            'costi_non_deducibili': _safe(m.get('costi_non_deducibili', 0)),
            'costi_non_classificati': _safe(m.get('costi_non_classificati', 0)),
            'margine': _safe(m['margine']),
            'saturazione': _safe(m['saturazione']),
            'num_fatture': m.get('num_fatture', 0),
            'num_appuntamenti': m.get('num_appuntamenti', 0),
        })

    return {
        'anno': anno,
        'mesi': mesi,
    }


def get_kpi_by_operator(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Calcola KPI raggruppati per medico/operatore.

    Produzione per medico calcolata da PREVENT.DBF (stato=3 "Eseguito")
    che e' l'unica fonte con attribuzione diretta medico-prestazione.
    Gli appuntamenti non sono affidabili per medico (il gestionale attribuisce
    tutti gli appuntamenti di uno studio al medico di riferimento dello studio).

    Returns:
        Dict con anno e array operatori con produzione, ore, num_prestazioni, ricavo/ora.
    """
    if anno is None:
        anno = datetime.now().year

    from core.constants_v2 import MEDICI

    df_estimates = get_df_estimates(anno=anno)

    operatori = {}

    if not df_estimates.empty:
        df_eseguiti = df_estimates[df_estimates['stato'] == 3]

        for medico_id, group in df_eseguiti.groupby('medico'):
            medico_id = int(medico_id)
            medico_nome = MEDICI.get(medico_id, f'Medico {medico_id}')
            produzione = round(_safe(group['spesa'].sum()), 2)
            num_prestazioni = len(group)

            operatori[medico_id] = {
                'medico_id': medico_id,
                'medico_nome': medico_nome,
                'produzione': produzione,
                'num_prestazioni': num_prestazioni,
                'ricavo_medio_prestazione': round(produzione / num_prestazioni, 2) if num_prestazioni > 0 else 0.0,
            }

    return {
        'anno': anno,
        'fonte': 'PREVENT.DBF (stato=3 Eseguito)',
        'operatori': sorted(operatori.values(), key=lambda x: x['produzione'], reverse=True),
    }


def get_kpi_by_category(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Calcola KPI raggruppati per tipo prestazione/categoria.

    Returns:
        Dict con anno e array categorie con ore e numero appuntamenti per ciascuna.
    """
    if anno is None:
        anno = datetime.now().year

    df_app = get_df_appointments(anno=anno)

    categorie = []
    if not df_app.empty:
        # Escludi tipi non clinici
        df_clinici = df_app[~df_app['tipo'].isin({'F', 'A'})]
        for tipo, group in df_clinici.groupby('tipo'):
            tipo_nome = group['tipo_nome'].iloc[0] if not group.empty else f'Tipo {tipo}'
            categorie.append({
                'tipo': tipo,
                'tipo_nome': tipo_nome,
                'ore_cliniche': round(_safe(group['durata_minuti'].sum() / 60.0), 2),
                'num_appuntamenti': len(group),
                'percentuale': 0.0,
            })

        # Calcola percentuali
        totale_app = sum(c['num_appuntamenti'] for c in categorie)
        for c in categorie:
            c['percentuale'] = round(c['num_appuntamenti'] / totale_app * 100, 2) if totale_app > 0 else 0.0

        # Ordina per numero appuntamenti decrescente
        categorie.sort(key=lambda x: x['num_appuntamenti'], reverse=True)

    return {
        'anno': anno,
        'categorie': categorie,
    }


def get_kpi_comparison(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Confronta KPI anno corrente vs anno precedente mese per mese.

    Returns:
        Dict con confronto mese per mese tra i due anni.
    """
    if anno is None:
        anno = datetime.now().year

    anno_precedente = anno - 1

    monthly_corrente = get_monthly_summary(anno_inizio=anno, anno_fine=anno)
    monthly_precedente = get_monthly_summary(anno_inizio=anno_precedente, anno_fine=anno_precedente)

    # Crea lookup per anno precedente
    prev_lookup = {m['mese']: m for m in monthly_precedente}

    confronto = []
    for m in monthly_corrente:
        mese = m['mese']
        prev = prev_lookup.get(mese, {})

        prev_prod = prev.get('produzione', 0)
        curr_prod = m['produzione']
        delta_prod = curr_prod - prev_prod
        delta_prod_pct = (delta_prod / prev_prod * 100) if prev_prod > 0 else 0

        prev_margine = prev.get('margine', 0)
        curr_margine = m['margine']

        confronto.append({
            'mese': mese,
            'produzione_corrente': _safe(curr_prod),
            'produzione_precedente': _safe(prev_prod),
            'delta_produzione': round(_safe(delta_prod), 2),
            'delta_produzione_pct': round(_safe(delta_prod_pct), 2),
            'margine_corrente': _safe(curr_margine),
            'margine_precedente': _safe(prev_margine),
            'ore_cliniche_corrente': _safe(m['ore_cliniche']),
            'ore_cliniche_precedente': _safe(prev.get('ore_cliniche', 0)),
            'ricavo_orario_corrente': _safe(m['ricavo_orario']),
            'ricavo_orario_precedente': _safe(prev.get('ricavo_orario', 0)),
        })

    # Totali
    tot_prod_corr = sum(c['produzione_corrente'] for c in confronto)
    tot_prod_prev = sum(c['produzione_precedente'] for c in confronto)
    delta_tot = _safe(tot_prod_corr - tot_prod_prev)

    return {
        'anno_corrente': anno,
        'anno_precedente': anno_precedente,
        'confronto': confronto,
        'totali': {
            'produzione_corrente': round(_safe(tot_prod_corr), 2),
            'produzione_precedente': round(_safe(tot_prod_prev), 2),
            'delta': round(delta_tot, 2),
            'delta_pct': round(_safe(delta_tot / tot_prod_prev * 100), 2) if tot_prod_prev > 0 else 0,
        }
    }
