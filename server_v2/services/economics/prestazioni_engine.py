"""
Prestazioni Engine per il modulo Economics.
Report distribuzione appuntamenti e prestazioni eseguite.
"""

import logging
import math
import dbf
from datetime import datetime
from typing import Optional, Dict, Any, List

from core.config_manager import get_config
from core.constants_v2 import COLONNE, MEDICI, TIPI_APPUNTAMENTO, CATEGORIE_PRESTAZIONI
from utils.dbf_utils import clean_dbf_value
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


def _safe_float(value, default=0.0):
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _build_onorario_full_map() -> Dict[str, Dict[str, Any]]:
    """
    Costruisce mappa completa codice_prestazione -> info da ONORARIO.DBF.
    Restituisce: {code: {categoria_id, categoria_nome, descrizione, prezzo_tariffario, codice_breve}}
    """
    config = get_config()
    onorario_path = config.get_dbf_path('onorario')
    col = COLONNE['onorario']
    onorario_map = {}

    try:
        with dbf.Table(onorario_path, codepage='cp1252') as table:
            for record in table:
                code = clean_dbf_value(getattr(record, col['id_prestazione'].lower(), None))
                if not code:
                    continue
                code = str(code).strip()

                cat_id = None
                try:
                    raw_cat = clean_dbf_value(getattr(record, col['categoria'].lower(), None))
                    cat_id = int(raw_cat) if raw_cat is not None else None
                except (ValueError, TypeError):
                    pass

                descrizione = clean_dbf_value(getattr(record, col['nome_prestazione'].lower(), '')) or ''
                prezzo = _safe_float(getattr(record, col['costo'].lower(), 0))
                codice_breve = clean_dbf_value(getattr(record, col['codice_breve'].lower(), '')) or ''

                onorario_map[code] = {
                    'categoria_id': cat_id,
                    'categoria_nome': CATEGORIE_PRESTAZIONI.get(cat_id, 'Non Definito') if cat_id else 'Non Definito',
                    'descrizione': str(descrizione).strip(),
                    'prezzo_tariffario': prezzo,
                    'codice_breve': str(codice_breve).strip(),
                }
    except Exception as e:
        logger.error(f"Errore lettura ONORARIO.DBF: {e}")

    return onorario_map


# =========================================================================
# REPORT 1: DISTRIBUZIONE APPUNTAMENTI
# =========================================================================

def _calcola_distribuzione_appuntamenti_anno(anno: int) -> Dict[str, Any]:
    """Calcola distribuzione appuntamenti per un singolo anno."""
    df = get_df_appointments(anno=anno)

    result = {
        'anno': anno,
        'totale_appuntamenti': 0,
        'totale_ore_cliniche': 0.0,
        'per_tipo': [],
        'per_medico': [],
        'per_studio': [],
        'trend_mensile': [],
    }

    if df.empty:
        return result

    # Escludi tipi non clinici
    df_clinici = df[~df['tipo'].isin({'F', 'A'})]
    result['totale_appuntamenti'] = len(df_clinici)
    result['totale_ore_cliniche'] = round(_safe(df_clinici['durata_minuti'].sum() / 60.0), 2)

    # --- Per tipo ---
    totale = len(df_clinici)
    for tipo, group in df_clinici.groupby('tipo'):
        tipo_nome = group['tipo_nome'].iloc[0] if not group.empty else f'Tipo {tipo}'
        count = len(group)
        ore = round(_safe(group['durata_minuti'].sum() / 60.0), 2)
        durata_media = round(_safe(group['durata_minuti'].mean()), 0)
        result['per_tipo'].append({
            'tipo': tipo,
            'tipo_nome': tipo_nome,
            'num_appuntamenti': count,
            'percentuale': round(count / totale * 100, 2) if totale > 0 else 0.0,
            'ore_cliniche': ore,
            'durata_media_minuti': durata_media,
        })
    result['per_tipo'].sort(key=lambda x: x['num_appuntamenti'], reverse=True)

    # --- Per medico ---
    for medico_id, group in df_clinici.groupby('medico'):
        medico_nome = group['medico_nome'].iloc[0] if not group.empty else f'Medico {medico_id}'
        count = len(group)
        ore = round(_safe(group['durata_minuti'].sum() / 60.0), 2)

        # Sotto-distribuzione per tipo per questo medico
        tipi_medico = []
        for tipo, sub in group.groupby('tipo'):
            tipi_medico.append({
                'tipo': tipo,
                'tipo_nome': sub['tipo_nome'].iloc[0],
                'count': len(sub),
            })
        tipi_medico.sort(key=lambda x: x['count'], reverse=True)

        result['per_medico'].append({
            'medico_id': int(medico_id),
            'medico_nome': medico_nome,
            'num_appuntamenti': count,
            'percentuale': round(count / totale * 100, 2) if totale > 0 else 0.0,
            'ore_cliniche': ore,
            'tipi': tipi_medico,
        })
    result['per_medico'].sort(key=lambda x: x['num_appuntamenti'], reverse=True)

    # --- Per studio ---
    for studio_id, group in df_clinici.groupby('studio'):
        count = len(group)
        ore = round(_safe(group['durata_minuti'].sum() / 60.0), 2)
        result['per_studio'].append({
            'studio': int(studio_id),
            'num_appuntamenti': count,
            'percentuale': round(count / totale * 100, 2) if totale > 0 else 0.0,
            'ore_cliniche': ore,
        })
    result['per_studio'].sort(key=lambda x: x['studio'])

    # --- Trend mensile ---
    for mese, group in df_clinici.groupby('mese'):
        mese_data = {
            'mese': int(mese),
            'num_appuntamenti': len(group),
            'ore_cliniche': round(_safe(group['durata_minuti'].sum() / 60.0), 2),
            'tipi': [],
        }
        for tipo, sub in group.groupby('tipo'):
            mese_data['tipi'].append({
                'tipo': tipo,
                'tipo_nome': sub['tipo_nome'].iloc[0],
                'count': len(sub),
            })
        mese_data['tipi'].sort(key=lambda x: x['count'], reverse=True)
        result['trend_mensile'].append(mese_data)
    result['trend_mensile'].sort(key=lambda x: x['mese'])

    return result


def get_distribuzione_appuntamenti(anno: Optional[int] = None, anni: Optional[List[int]] = None) -> Dict[str, Any]:
    """
    Report distribuzione appuntamenti in agenda.
    Supporta anno singolo o confronto multi-anno.
    """
    if anni and len(anni) > 0:
        risultati = [_calcola_distribuzione_appuntamenti_anno(a) for a in sorted(anni)]

        # Confronto tra anni (delta per tipo)
        confronto = None
        if len(risultati) >= 2:
            primo = risultati[0]
            ultimo = risultati[-1]
            primo_map = {t['tipo']: t for t in primo['per_tipo']}
            ultimo_map = {t['tipo']: t for t in ultimo['per_tipo']}
            tutti_tipi = set(primo_map.keys()) | set(ultimo_map.keys())

            delta_tipi = []
            for tipo in tutti_tipi:
                p = primo_map.get(tipo, {})
                u = ultimo_map.get(tipo, {})
                count_p = p.get('num_appuntamenti', 0)
                count_u = u.get('num_appuntamenti', 0)
                pct_p = p.get('percentuale', 0)
                pct_u = u.get('percentuale', 0)
                delta_tipi.append({
                    'tipo': tipo,
                    'tipo_nome': u.get('tipo_nome', p.get('tipo_nome', f'Tipo {tipo}')),
                    'count_primo': count_p,
                    'count_ultimo': count_u,
                    'delta_count': count_u - count_p,
                    'delta_pct': round(pct_u - pct_p, 2),
                })
            delta_tipi.sort(key=lambda x: abs(x['delta_count']), reverse=True)

            confronto = {
                'anno_base': primo['anno'],
                'anno_confronto': ultimo['anno'],
                'delta_totale_appuntamenti': ultimo['totale_appuntamenti'] - primo['totale_appuntamenti'],
                'delta_totale_ore': round(ultimo['totale_ore_cliniche'] - primo['totale_ore_cliniche'], 2),
                'delta_per_tipo': delta_tipi,
            }

        return {
            'anni': risultati,
            'confronto': confronto,
        }
    else:
        if anno is None:
            anno = datetime.now().year
        return {
            'anni': [_calcola_distribuzione_appuntamenti_anno(anno)],
            'confronto': None,
        }


# =========================================================================
# REPORT 2: DISTRIBUZIONE PRESTAZIONI
# =========================================================================

def _calcola_distribuzione_prestazioni_anno(anno: int, onorario_map: Dict) -> Dict[str, Any]:
    """Calcola distribuzione prestazioni eseguite per un singolo anno."""
    df = get_df_estimates(anno=anno)

    result = {
        'anno': anno,
        'totale_prestazioni': 0,
        'totale_fatturato': 0.0,
        'per_prestazione': [],
        'per_categoria': [],
        'top_frequenza': [],
        'bottom_frequenza': [],
        'top_fatturato': [],
        'bottom_fatturato': [],
    }

    if df.empty:
        return result

    # Filtra solo eseguiti (stato=3)
    df_eseguiti = df[df['stato'] == 3].copy()
    if df_eseguiti.empty:
        return result

    result['totale_prestazioni'] = len(df_eseguiti)
    result['totale_fatturato'] = round(_safe(df_eseguiti['spesa'].sum()), 2)

    # Join PREVENT -> ONORARIO tramite id_prestazione (DB_PRONCOD -> DB_CODE)
    # onorario_map e' indicizzato per DB_CODE (id prestazione univoco)

    # --- Per singola prestazione (raggruppata per id_prestazione = DB_PRONCOD) ---
    prestazioni_list = []
    totale = len(df_eseguiti)
    totale_fatt = _safe(df_eseguiti['spesa'].sum())

    for id_prest, group in df_eseguiti.groupby('id_prestazione'):
        id_prest_str = str(id_prest).strip() if id_prest else 'N/D'
        info_onor = onorario_map.get(id_prest_str, {})

        count = len(group)
        fatturato = round(_safe(group['spesa'].sum()), 2)
        ricavo_medio = round(fatturato / count, 2) if count > 0 else 0.0
        prezzo_tariffario = info_onor.get('prezzo_tariffario', 0)
        codice_breve = info_onor.get('codice_breve', '')

        prestazioni_list.append({
            'id_prestazione': id_prest_str,
            'codice_prestazione': codice_breve if codice_breve else str(group['codice_prestazione'].iloc[0]).strip(),
            'descrizione': info_onor.get('descrizione', id_prest_str),
            'categoria_id': info_onor.get('categoria_id'),
            'categoria_nome': info_onor.get('categoria_nome', 'Non Definito'),
            'count': count,
            'percentuale_count': round(count / totale * 100, 2) if totale > 0 else 0.0,
            'fatturato': fatturato,
            'percentuale_fatturato': round(fatturato / totale_fatt * 100, 2) if totale_fatt > 0 else 0.0,
            'ricavo_medio': ricavo_medio,
            'prezzo_tariffario': prezzo_tariffario,
        })

    # Ordina per frequenza
    prestazioni_list.sort(key=lambda x: x['count'], reverse=True)
    result['per_prestazione'] = prestazioni_list
    result['top_frequenza'] = prestazioni_list[:10]
    result['bottom_frequenza'] = [p for p in prestazioni_list if p['count'] > 0][-5:]

    # Ordina per fatturato
    by_fatt = sorted(prestazioni_list, key=lambda x: x['fatturato'], reverse=True)
    result['top_fatturato'] = by_fatt[:10]
    result['bottom_fatturato'] = [p for p in by_fatt if p['fatturato'] > 0][-5:]

    # --- Per categoria ONORARIO ---
    # Raggruppa per categoria tramite id_prestazione -> ONORARIO.DB_ONTIPO
    categorie_agg = {}
    for _, row in df_eseguiti.iterrows():
        id_prest_str = str(row['id_prestazione']).strip() if row['id_prestazione'] else ''
        info_onor = onorario_map.get(id_prest_str, {})
        cat_id = info_onor.get('categoria_id')
        cat_nome = info_onor.get('categoria_nome', 'Non Definito')

        key = cat_id if cat_id else 0
        if key not in categorie_agg:
            categorie_agg[key] = {
                'categoria_id': cat_id,
                'categoria_nome': cat_nome,
                'count': 0,
                'fatturato': 0.0,
            }
        categorie_agg[key]['count'] += 1
        categorie_agg[key]['fatturato'] += _safe(row['spesa'])

    categorie_list = []
    for cat_data in categorie_agg.values():
        cat_data['fatturato'] = round(cat_data['fatturato'], 2)
        cat_data['percentuale_count'] = round(cat_data['count'] / totale * 100, 2) if totale > 0 else 0.0
        cat_data['percentuale_fatturato'] = round(cat_data['fatturato'] / totale_fatt * 100, 2) if totale_fatt > 0 else 0.0
        cat_data['ricavo_medio'] = round(cat_data['fatturato'] / cat_data['count'], 2) if cat_data['count'] > 0 else 0.0
        categorie_list.append(cat_data)

    categorie_list.sort(key=lambda x: x['fatturato'], reverse=True)
    result['per_categoria'] = categorie_list

    return result


def get_distribuzione_prestazioni(anno: Optional[int] = None, anni: Optional[List[int]] = None) -> Dict[str, Any]:
    """
    Report distribuzione prestazioni eseguite.
    Supporta anno singolo o confronto multi-anno.
    """
    onorario_map = _build_onorario_full_map()

    if anni and len(anni) > 0:
        risultati = [_calcola_distribuzione_prestazioni_anno(a, onorario_map) for a in sorted(anni)]

        confronto = None
        if len(risultati) >= 2:
            primo = risultati[0]
            ultimo = risultati[-1]

            # Delta per categoria
            primo_cat = {c['categoria_nome']: c for c in primo['per_categoria']}
            ultimo_cat = {c['categoria_nome']: c for c in ultimo['per_categoria']}
            tutte_cat = set(primo_cat.keys()) | set(ultimo_cat.keys())

            delta_categorie = []
            for cat in tutte_cat:
                p = primo_cat.get(cat, {})
                u = ultimo_cat.get(cat, {})
                count_p = p.get('count', 0)
                count_u = u.get('count', 0)
                fatt_p = p.get('fatturato', 0)
                fatt_u = u.get('fatturato', 0)
                delta_categorie.append({
                    'categoria_nome': cat,
                    'count_primo': count_p,
                    'count_ultimo': count_u,
                    'delta_count': count_u - count_p,
                    'fatturato_primo': fatt_p,
                    'fatturato_ultimo': fatt_u,
                    'delta_fatturato': round(fatt_u - fatt_p, 2),
                    'variazione_pct': round((fatt_u - fatt_p) / fatt_p * 100, 2) if fatt_p > 0 else None,
                })
            delta_categorie.sort(key=lambda x: abs(x.get('delta_fatturato', 0)), reverse=True)

            confronto = {
                'anno_base': primo['anno'],
                'anno_confronto': ultimo['anno'],
                'delta_totale_prestazioni': ultimo['totale_prestazioni'] - primo['totale_prestazioni'],
                'delta_totale_fatturato': round(ultimo['totale_fatturato'] - primo['totale_fatturato'], 2),
                'delta_per_categoria': delta_categorie,
            }

        return {
            'anni': risultati,
            'confronto': confronto,
        }
    else:
        if anno is None:
            anno = datetime.now().year
        return {
            'anni': [_calcola_distribuzione_prestazioni_anno(anno, onorario_map)],
            'confronto': None,
        }
