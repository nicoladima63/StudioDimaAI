"""
Calcolo slot liberi per operatore leggendo APPUNTA.DBF direttamente.

Formato orario DBF: float decimale visuale
  9.5  = 9:50   (parte decimale * 10 = minuti)
  14.3 = 14:30
  9.0  = 9:00
"""

import dbf
import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

from core.constants_v2 import COLONNE, MEDICI
from core.config_manager import get_config

logger = logging.getLogger(__name__)

# Operatori che usano un appuntamento finto con "no" per segnalare assenza
# (es. Lara a settimane alterne mette "lara no" a inizio giornata)
OPERATORI_CON_ASSENZA_FINTA: set[int] = {2}

# Orari di lavoro per operatore: {weekday: [(inizio_min, fine_min), ...]}
# weekday: 0=Lun, 1=Mar, 2=Mer, 3=Gio, 4=Ven
# Valori in minuti dall'inizio della giornata
ORARI_OPERATORI: dict[int, dict[int, list[tuple[int, int]]]] = {
    1: {  # Dr. Nicola Di Martino
        0: [(9*60,    13*60), (15*60, 19*60)],
        1: [(9*60,    16*60)],
        2: [(9*60,    13*60), (15*60, 19*60)],
        3: [(9*60,    13*60), (15*60, 19*60)],
        4: [(9*60,    16*60)],
    },
    2: {  # Dr.ssa Lara
        2: [(9*60,    13*60), (14*60, 19*60)],
        3: [(15*60,   19*60)],
    },
    5: {  # Dr.ssa Anet Jablonvsky
        0: [(14*60,   19*60)],
    },
}


def _dbf_time_to_minutes(t: float) -> int:
    """Converte orario DBF (es. 9.5 = 9:50) in minuti dalla mezzanotte."""
    if not t:
        return 0
    ore = int(t)
    minuti = round((t - ore) * 10) * 10
    return ore * 60 + minuti


def _minutes_to_hhmm(m: int) -> str:
    """Converte minuti in stringa HH:MM."""
    return f"{m // 60:02d}:{m % 60:02d}"


def _is_festivo(giorno: date) -> bool:
    """Restituisce True se il giorno è un festivo fisso italiano."""
    festivi = {
        (1,  1),   # Capodanno
        (6,  1),   # Epifania
        (25, 4),   # Liberazione
        (1,  5),   # Festa del Lavoro
        (2,  6),   # Repubblica
        (15, 8),   # Ferragosto
        (1,  11),  # Ognissanti
        (8,  12),  # Immacolata
        (25, 12),  # Natale
        (26, 12),  # Santo Stefano
    }
    return (giorno.day, giorno.month) in festivi


def _get_appunta_path() -> str:
    config = get_config()
    return config.get_dbf_path('APPUNTA')


def _leggi_occupati_per_giorno(
    giorno: date,
    operatore_id: int,
    path: str,
) -> tuple[list[tuple[int, int]], bool]:
    """
    Legge APPUNTA.DBF e restituisce (occupati, giorno_bloccato).
    giorno_bloccato=True se esiste un appuntamento finto tipo "lara no"
    che segnala assenza dell'operatore per tutta la giornata.
    """
    occupati = []
    giorno_bloccato = False
    col = COLONNE['appuntamenti']
    f_data    = col['data'].lower()
    f_inizio  = col['ora_inizio'].lower()
    f_fine    = col['ora_fine'].lower()
    f_medico  = col['medico'].lower()
    f_note    = col['note'].lower()
    f_desc    = col['descrizione'].lower()
    # Stringa di assenza specifica per ogni operatore (es. "lara no")
    MARKER_ASSENZA = {2: 'lara no'}
    marker = MARKER_ASSENZA.get(operatore_id)

    try:
        with dbf.Table(path, codepage='cp1252') as table:
            for record in table:
                try:
                    rec_data = getattr(record, f_data, None)
                    if not rec_data or rec_data != giorno:
                        continue
                    rec_medico = int(getattr(record, f_medico, 0) or 0)
                    if rec_medico != operatore_id:
                        continue
                    if marker:
                        note = str(getattr(record, f_note, '') or '').lower()
                        desc = str(getattr(record, f_desc, '') or '').lower()
                        if marker in note or marker in desc:
                            giorno_bloccato = True
                            break
                    inizio = _dbf_time_to_minutes(float(getattr(record, f_inizio, 0) or 0))
                    fine   = _dbf_time_to_minutes(float(getattr(record, f_fine,   0) or 0))
                    if fine > inizio:
                        occupati.append((inizio, fine))
                except Exception:
                    continue
    except Exception as e:
        logger.error(f"Errore lettura APPUNTA.DBF: {e}")

    return sorted(occupati), giorno_bloccato


def _slot_liberi_in_finestra(
    finestra_inizio: int,
    finestra_fine: int,
    occupati: list[tuple[int, int]],
    durata: int,
    passo: int,
) -> list[tuple[int, int]]:
    """
    Trova slot di `durata` minuti dentro la finestra, escludendo gli occupati.
    Il cursore avanza di `passo` dopo ogni slot trovato — se passo < durata
    gli slot si sovrappongono, offrendo orari alternativi ravvicinati.
    Quando un occupato blocca il cursore, lo salta alla fine dell'occupato
    arrotondato al passo successivo.
    """
    slot = []
    cursore = finestra_inizio
    occ_index = 0

    while cursore + durata <= finestra_fine:
        # Avanza l'indice degli occupati già terminati
        while occ_index < len(occupati) and occupati[occ_index][1] <= cursore:
            occ_index += 1

        # Controlla se il prossimo occupato si sovrappone allo slot corrente
        if occ_index < len(occupati) and occupati[occ_index][0] < cursore + durata:
            # Salta oltre l'occupato, arrotondato al passo successivo
            fine_occ = occupati[occ_index][1]
            passi = (fine_occ - finestra_inizio + passo - 1) // passo
            cursore = finestra_inizio + passi * passo
            occ_index += 1
        else:
            slot.append((cursore, cursore + durata))
            cursore += passo

    return slot
    if cursore + durata <= finestra_fine:
        slot.append((cursore, cursore + durata))

    return slot


def trova_slot_liberi(
    operatore_id: int,
    durata_minuti: int = 60,
    passo_minuti: Optional[int] = None,
    giorni_avanti: int = 14,
    max_slot: int = 5,
    data_inizio: Optional[date] = None,
) -> list[dict]:
    """
    Restituisce i prossimi slot liberi per l'operatore indicato.

    Args:
        operatore_id:   ID operatore da MEDICI (1=Nicola, 2=Lara, 5=Anet)
        durata_minuti:  durata minima dello slot in minuti
        giorni_avanti:  quanti giorni futuri controllare
        max_slot:       numero massimo di slot da restituire
        data_inizio:    primo giorno da controllare (default: oggi)

    Returns:
        Lista di dict con chiavi: data, inizio, fine, operatore, operatore_id
    """
    orari = ORARI_OPERATORI.get(operatore_id)
    if not orari:
        logger.warning(f"Nessun orario configurato per operatore {operatore_id}")
        return []

    passo = passo_minuti if passo_minuti is not None else durata_minuti
    nome_operatore = MEDICI.get(operatore_id, f"Operatore {operatore_id}")
    path = _get_appunta_path()
    inizio = data_inizio or date.today()
    risultati = []

    for delta in range(giorni_avanti):
        giorno = inizio + timedelta(days=delta)
        weekday = giorno.weekday()  # 0=Lun ... 6=Dom

        if _is_festivo(giorno):
            continue

        finestre = orari.get(weekday)
        if not finestre:
            continue  # operatore non lavora questo giorno

        occupati, bloccato = _leggi_occupati_per_giorno(giorno, operatore_id, path)
        if bloccato:
            continue  # giorno di assenza (appuntamento finto "lara no" ecc.)

        for fin_inizio, fin_fine in finestre:
            # filtra occupati rilevanti per questa finestra
            occ_finestra = [
                (i, f) for i, f in occupati
                if f > fin_inizio and i < fin_fine
            ]
            slots = _slot_liberi_in_finestra(
                fin_inizio, fin_fine, occ_finestra, durata_minuti, passo
            )
            for s_inizio, s_fine in slots:
                risultati.append({
                    'data':          giorno.isoformat(),
                    'giorno_nome':   giorno.strftime('%A %d/%m/%Y'),
                    'inizio':        _minutes_to_hhmm(s_inizio),
                    'fine':          _minutes_to_hhmm(s_fine),
                    'operatore':     nome_operatore,
                    'operatore_id':  operatore_id,
                })
                if len(risultati) >= max_slot:
                    return risultati

    return risultati
