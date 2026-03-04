"""
Collaboratori Engine per il modulo Economics.
Calcola la redditivita per collaboratore basandosi su prestazioni eseguite
e regole di compenso configurate in COMPENSI_COLLABORATORI.
"""

import logging
import math
import dbf
from datetime import datetime, date
from typing import Optional, Dict, Any

from core.config_manager import get_config
from core.constants_v2 import COLONNE, MEDICI, CATEGORIE_PRESTAZIONI, COMPENSI_COLLABORATORI
from utils.dbf_utils import clean_dbf_value

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


def _build_onorario_map():
    """Costruisce mappa codice_prestazione -> categoria_id da ONORARIO.DBF."""
    config = get_config()
    onorario_path = config.get_dbf_path('onorario')

    col = COLONNE['onorario']
    onorario_map = {}

    try:
        with dbf.Table(onorario_path, codepage='cp1252') as table:
            for record in table:
                code = clean_dbf_value(getattr(record, col['id_prestazione'].lower(), None))
                cat_id = clean_dbf_value(getattr(record, col['categoria'].lower(), None))
                if code:
                    try:
                        onorario_map[str(code).strip()] = int(cat_id) if cat_id is not None else None
                    except (ValueError, TypeError):
                        onorario_map[str(code).strip()] = None
    except Exception as e:
        logger.error(f"Errore lettura ONORARIO.DBF: {e}")

    return onorario_map


def get_collaboratori_redditivita(anno: Optional[int] = None) -> Dict[str, Any]:
    """
    Calcola la redditivita per ogni collaboratore.

    Per ogni medico restituisce:
    - produzione: totale prestazioni eseguite
    - compenso: costo del collaboratore (% o per intervento)
    - margine_studio: quanto resta allo studio
    - margine_pct: margine % su produzione
    - dettaglio branche con importi e conteggi

    Args:
        anno: Anno di riferimento (default: anno corrente)

    Returns:
        Dict con collaboratori e totali
    """
    if anno is None:
        anno = datetime.now().year

    config = get_config()
    preventivi_path = config.get_dbf_path('preventivi')

    # 1. Mappa onorario per categorie
    onorario_map = _build_onorario_map()

    # 2. Leggi preventivi eseguiti nell'anno
    start_date = date(anno, 1, 1)
    end_date = date(anno, 12, 31)

    col = COLONNE['preventivi']
    f_stato = col['stato_prestazione'].lower()
    f_data = col['data_prestazione'].lower()
    f_medico = col['medico'].lower()
    f_spesa = col['spesa'].lower()
    f_codice = col['id_prestazione'].lower()

    # Stats: {medico_id: {produzione, num_prestazioni, branche: {nome: {importo, count, cat_id}}}}
    stats = {}

    try:
        with dbf.Table(preventivi_path, codepage='cp1252') as table:
            for record in table:
                try:
                    status = clean_dbf_value(getattr(record, f_stato, None))
                    if status != 3:
                        continue

                    data_prest = getattr(record, f_data, None)
                    if not data_prest:
                        continue
                    if isinstance(data_prest, datetime):
                        data_prest = data_prest.date()
                    if not (start_date <= data_prest <= end_date):
                        continue

                    medico_id = clean_dbf_value(getattr(record, f_medico, None))
                    if medico_id is None:
                        continue
                    try:
                        medico_id = int(medico_id)
                    except (ValueError, TypeError):
                        continue

                    importo = _safe_float(clean_dbf_value(getattr(record, f_spesa, 0)))
                    if importo == 0:
                        continue

                    # Categoria prestazione
                    prest_code = str(clean_dbf_value(getattr(record, f_codice, '')) or '').strip()
                    cat_id = onorario_map.get(prest_code)
                    cat_nome = CATEGORIE_PRESTAZIONI.get(cat_id, 'Non Definito') if cat_id else 'Non Definito'

                    if medico_id not in stats:
                        stats[medico_id] = {
                            'produzione': 0,
                            'num_prestazioni': 0,
                            'branche': {},
                        }

                    stats[medico_id]['produzione'] += importo
                    stats[medico_id]['num_prestazioni'] += 1

                    if cat_nome not in stats[medico_id]['branche']:
                        stats[medico_id]['branche'][cat_nome] = {'importo': 0, 'count': 0, 'cat_id': cat_id}
                    stats[medico_id]['branche'][cat_nome]['importo'] += importo
                    stats[medico_id]['branche'][cat_nome]['count'] += 1

                except Exception:
                    continue

    except Exception as e:
        logger.error(f"Errore lettura PREVENT.DBF: {e}")
        return {'anno': anno, 'collaboratori': [], 'totali': {}}

    # 3. Calcola redditivita per collaboratore
    # Includi TUTTI i collaboratori configurati, anche quelli senza dati
    risultati = []
    all_medici_ids = set(stats.keys()) | set(COMPENSI_COLLABORATORI.keys())

    for medico_id in all_medici_ids:
        data = stats.get(medico_id, {'produzione': 0, 'num_prestazioni': 0, 'branche': {}})
        compenso_config = COMPENSI_COLLABORATORI.get(medico_id, {})
        tipo = compenso_config.get('tipo', 'sconosciuto')
        medico_nome = MEDICI.get(medico_id, f'Medico {medico_id}')

        produzione = round(_safe(data['produzione']), 2)
        compenso = 0
        dettaglio_compenso = ''

        if tipo == 'titolare':
            compenso = 0
            dettaglio_compenso = 'Titolare'
        elif tipo == 'percentuale':
            pct = compenso_config['percentuale']
            compenso = round(produzione * pct, 2)
            dettaglio_compenso = f"{int(pct * 100)}% della produzione"
        elif tipo == 'per_intervento':
            tariffa = compenso_config['tariffa']
            categorie = compenso_config.get('categorie_intervento', [])
            num_interventi = sum(
                br['count'] for br in data['branche'].values()
                if br.get('cat_id') in categorie
            )
            compenso = round(num_interventi * tariffa, 2)
            dettaglio_compenso = f"{num_interventi} interventi x {int(tariffa)} EUR"

        margine_studio = round(produzione - compenso, 2)
        margine_pct = round((margine_studio / produzione * 100), 1) if produzione > 0 else 0

        # Dettaglio branche
        branche = []
        for br_nome, br_data in sorted(data['branche'].items(), key=lambda x: x[1]['importo'], reverse=True):
            branche.append({
                'branca': br_nome,
                'importo': round(br_data['importo'], 2),
                'count': br_data['count'],
                'percentuale': round(br_data['importo'] / produzione * 100, 1) if produzione > 0 else 0,
            })

        risultati.append({
            'medico_id': medico_id,
            'medico_nome': medico_nome,
            'tipo_compenso': tipo,
            'dettaglio_compenso': dettaglio_compenso,
            'produzione': produzione,
            'compenso': compenso,
            'margine_studio': margine_studio,
            'margine_pct': margine_pct,
            'num_prestazioni': data['num_prestazioni'],
            'branche': branche,
        })

    risultati.sort(key=lambda x: x['produzione'], reverse=True)

    # 4. Totali
    totale_produzione = round(sum(r['produzione'] for r in risultati), 2)
    totale_compensi = round(sum(r['compenso'] for r in risultati), 2)
    totale_margine = round(totale_produzione - totale_compensi, 2)

    return {
        'anno': anno,
        'collaboratori': risultati,
        'totali': {
            'produzione': totale_produzione,
            'compensi': totale_compensi,
            'margine_studio': totale_margine,
            'margine_pct': round(totale_margine / totale_produzione * 100, 1) if totale_produzione > 0 else 0,
        }
    }
