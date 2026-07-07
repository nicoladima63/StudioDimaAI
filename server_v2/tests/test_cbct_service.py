import os
from pathlib import Path

import pytest

from services.cbct_service import (
    parse_nome_paziente,
    build_cartella_nas,
    parse_lista_esami_html,
    merge_stato_esami,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "package_list_sample.html"


def test_parse_nome_paziente_divide_cognome_e_nome():
    cognome, nome = parse_nome_paziente("BOTTA^NICCOLO'")
    assert cognome == "BOTTA"
    assert nome == "NICCOLO'"


def test_parse_nome_paziente_senza_separatore_solleva_errore():
    with pytest.raises(ValueError):
        parse_nome_paziente("BOTTA NICCOLO")


def test_build_cartella_nas_formatta_cognome_nome_data():
    cartella = build_cartella_nas(nome="NICCOLO'", cognome="BOTTA", data_esame="03/07/2026")
    assert cartella == "BOTTA_NICCOLO__20260703"


def test_parse_lista_esami_html_estrae_tutte_le_righe():
    html = FIXTURE_PATH.read_text(encoding="utf-8")
    esami = parse_lista_esami_html(html)

    assert len(esami) == 2

    primo = esami[0]
    assert primo["portal_exam_id"] == "aaaaaaaa-11111111-bbbbbbbb-22222222-cccccccc"
    assert primo["paziente_raw"] == "ROSSI^MARIO"
    assert primo["data_esame"] == "03/07/2026"
    assert primo["descrizione"] == "TC DENTALE SETTORIALE (DENTALSCAN) CONE-BEAM"
    assert primo["download_count_portale"] == 1

    secondo = esami[1]
    assert secondo["portal_exam_id"] == "dddddddd-33333333-eeeeeeee-44444444-ffffffff"
    assert secondo["paziente_raw"] == "VERDI^ANNA"
    assert secondo["download_count_portale"] == 0


def test_merge_stato_esami_marca_gia_scaricato_e_cartella():
    esami = [
        {"portal_exam_id": "aaa"},
        {"portal_exam_id": "bbb"},
    ]
    risultato = merge_stato_esami(esami, download_di={"aaa": "BOTTA_NICCOLO__20260703"})

    assert risultato[0]["gia_scaricato"] is True
    assert risultato[0]["cartella_nas"] == "BOTTA_NICCOLO__20260703"
    assert risultato[1]["gia_scaricato"] is False
    assert risultato[1]["cartella_nas"] is None
