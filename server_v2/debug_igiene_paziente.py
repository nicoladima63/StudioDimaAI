"""
Debug: traccia catena ELENCO -> PREVENT per un paziente specifico.
Esegui dalla directory server_v2:
  python debug_igiene_paziente.py ZZZXNZ
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import dbf

DB_CODE = sys.argv[1] if len(sys.argv) > 1 else 'ZZZXNZ'

from core.config_manager import get_config
cfg = get_config()

elenco_path  = cfg.get_dbf_path('elenco')
prevent_path = cfg.get_dbf_path('preventivi')

print(f"\n=== PAZIENTE: {DB_CODE} ===")
print(f"ELENCO path : {elenco_path}")
print(f"PREVENT path: {prevent_path}")

# 1. ELENCO: trova tutti i piani del paziente
print(f"\n--- ELENCO.DBF: piani per {DB_CODE} ---")
piano_ids = set()
with dbf.Table(elenco_path, codepage='cp1252') as t:
    print(f"Campi disponibili: {t.field_names}")
    for rec in t:
        try:
            paz = str(getattr(rec, 'db_elpacod', '') or '').strip()
            if paz == DB_CODE.strip():
                pid  = str(getattr(rec, 'db_code',    '') or '').strip()
                desc = str(getattr(rec, 'db_eldescr', '') or '').strip()
                data = getattr(rec, 'db_eldata', None)
                stato = str(getattr(rec, 'db_elstato', '') or '').strip()
                print(f"  piano_id={pid!r:12s}  desc={desc!r:30s}  data={data}  stato={stato!r}")
                if pid:
                    piano_ids.add(pid)
        except Exception as e:
            print(f"  [ERR record]: {e}")

print(f"\nPiano IDs trovati: {piano_ids}")

# 2. PREVENT: cerca prestazioni per quei piani
print(f"\n--- PREVENT.DBF: prestazioni per piani {piano_ids} ---")
with dbf.Table(prevent_path, codepage='cp1252') as t:
    print(f"Campi disponibili: {t.field_names}")
    found = 0
    for i, rec in enumerate(t):
        try:
            prelcod = str(getattr(rec, 'db_prelcod', '') or '').strip()
            if prelcod not in piano_ids and prelcod != DB_CODE.strip():
                continue
            stato   = getattr(rec, 'db_guardia', None)
            medico  = getattr(rec, 'db_prmedic', None)
            data    = getattr(rec, 'db_prdata',  None)
            lavor   = str(getattr(rec, 'db_prlavor', '') or '').strip()
            proncod = str(getattr(rec, 'db_proncod', '') or '').strip()
            print(f"  rec#{i+1:5d}  prelcod={prelcod!r:12s}  stato={stato!r}  medico={medico!r}  data={data}  lavor={lavor!r}  proncod={proncod!r}")
            found += 1
        except Exception as e:
            print(f"  [ERR record #{i+1}]: {e}")
    if found == 0:
        print("  Nessuna prestazione trovata per questi piani.")
        # Cerca anche per db_code diretto
        print(f"\n--- PREVENT.DBF: cerca DB_PRELCOD == {DB_CODE!r} direttamente ---")
        with dbf.Table(prevent_path, codepage='cp1252') as t2:
            for i, rec in enumerate(t2):
                try:
                    prelcod = str(getattr(rec, 'db_prelcod', '') or '').strip()
                    if prelcod == DB_CODE.strip():
                        stato  = getattr(rec, 'db_guardia', None)
                        medico = getattr(rec, 'db_prmedic', None)
                        data   = getattr(rec, 'db_prdata',  None)
                        lavor  = str(getattr(rec, 'db_prlavor', '') or '').strip()
                        print(f"  rec#{i+1:5d}  stato={stato!r}  medico={medico!r}  data={data}  lavor={lavor!r}")
                except Exception:
                    continue
