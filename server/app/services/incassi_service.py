import logging

logger = logging.getLogger(__name__)

from dbfread import DBF
from datetime import datetime, date
from typing import List, Dict, Any
from server.app.utils.db_utils import get_dbf_path, estrai_dati
from server.app.config.constants import COLONNE
from server.app.core.mode_manager import get_mode

class IncassiService:
    def __init__(self):
        mode = get_mode('database')
        self.acconti_path = get_dbf_path('acconti', mode)
        self.pazienti_path = get_dbf_path('pazienti', mode)
        self.fatture_path = get_dbf_path('fatture', mode)
        
    def get_all_incassi(self) -> List[Dict[str, Any]]:
        return estrai_dati(self.fatture_path, 'fatture')

    def get_incassi_trend(self, date_from=None, date_to=None):
        incassi = []
        for record in DBF(self.acconti_path, encoding='latin-1'):
            if date_from and record.get('DB_ACDATA') < date_from:
                continue
            if date_to and record.get('DB_ACDATA') > date_to:
                continue
            incassi.append({
                'data': record.get('DB_ACDATA'),
                'importo': record.get('DB_ACLIRE', 0),
                'codice_paziente': record.get('DB_ACELCOD'),
                'medico': record.get('DB_ACMEDIC'),
                'numero_fattura': record.get('DB_ACFANUM')
            })
        return self._calcola_trend(incassi)
    
    def _calcola_trend(self, incassi):
        import pandas as pd
        df = pd.DataFrame(incassi)
        # Implementazione specifica...

    def get_incassi_by_date(self, anno: str, mese: str = None) -> dict:
        incassi = []
        try:
            anno = int(anno)
            if mese:
                mese = int(mese)
                data_inizio = date(anno, mese, 1)
                if mese == 12:
                    data_fine = date(anno + 1, 1, 1)
                else:
                    data_fine = date(anno, mese + 1, 1)
            else:
                data_inizio = date(anno, 1, 1)
                data_fine = date(anno + 1, 1, 1)
        except ValueError:
            raise ValueError("Invalid year or month format")
        for record in DBF(self.acconti_path, encoding='latin-1'):
            record_date = record.get('DB_ACDATA')
            if record_date:
                if isinstance(record_date, date):
                    pass
                elif isinstance(record_date, str):
                    try:
                        record_date = datetime.strptime(record_date, "%d/%m/%Y").date()
                    except ValueError:
                        print(f"Data non valida: {record_date}")
                        continue
                else:
                    print(f"Tipo di dato non valido per la data: {record_date} ({type(record_date)})")
                    continue
                if data_inizio <= record_date < data_fine:
                    incassi.append({
                        'data': record.get('DB_ACDATA'),
                        'importo': record.get('DB_ACLIRE', 0),
                        'codice_paziente': record.get('DB_ACELCOD'),
                        'medico': record.get('DB_ACMEDIC'),
                        'numero_fattura': record.get('DB_ACFANUM'),
                        'data_fattura': record.get('DB_ACFADAT')
                    })
        numero_fatture = len(incassi)
        importo_totale = sum([r.get('importo', 0) for r in incassi])
        return {
            'incassi': incassi,
            'numero_fatture': numero_fatture,
            'importo_totale': importo_totale
        }

    def get_incassi_by_periodo(self, anno: str, tipo: str, numero: int) -> dict:
        incassi = []
        try:
            anno = int(anno)
            numero = int(numero)
            if tipo == 'mese':
                data_inizio = date(anno, numero, 1)
                if numero == 12:
                    data_fine = date(anno + 1, 1, 1)
                else:
                    data_fine = date(anno, numero + 1, 1)
            elif tipo == 'trimestre':
                mese_inizio = (numero - 1) * 3 + 1
                data_inizio = date(anno, mese_inizio, 1)
                if mese_inizio + 3 > 12:
                    data_fine = date(anno + 1, (mese_inizio + 3) % 12, 1)
                else:
                    data_fine = date(anno, mese_inizio + 3, 1)
            elif tipo == 'quadrimestre':
                mese_inizio = (numero - 1) * 4 + 1
                data_inizio = date(anno, mese_inizio, 1)
                if mese_inizio + 4 > 12:
                    data_fine = date(anno + 1, (mese_inizio + 4) % 12, 1)
                else:
                    data_fine = date(anno, mese_inizio + 4, 1)
            elif tipo == 'semestre':
                if numero == 1:
                    data_inizio = date(anno, 1, 1)
                    data_fine = date(anno, 7, 1)
                elif numero == 2:
                    data_inizio = date(anno, 7, 1)
                    data_fine = date(anno + 1, 1, 1)
                else:
                    raise ValueError("Numero semestre non valido")
            else:
                raise ValueError("Tipo periodo non valido")
        except Exception as e:
            raise ValueError(f"Parametri non validi: {e}")
        for record in DBF(self.acconti_path, encoding='latin-1'):
            record_date = record.get('DB_ACDATA')
            if record_date:
                if isinstance(record_date, date):
                    pass
                elif isinstance(record_date, str):
                    try:
                        record_date = datetime.strptime(record_date, "%d/%m/%Y").date()
                    except ValueError:
                        continue
                else:
                    continue
                if data_inizio <= record_date < data_fine:
                    incassi.append({
                        'data': record.get('DB_ACDATA'),
                        'importo': record.get('DB_ACLIRE', 0),
                        'codice_paziente': record.get('DB_ACELCOD'),
                        'medico': record.get('DB_ACMEDIC'),
                        'numero_fattura': record.get('DB_ACFANUM'),
                        'data_fattura': record.get('DB_ACFADAT')
                    })
        numero_fatture = len(incassi)
        importo_totale = sum([r.get('importo', 0) for r in incassi])
        return {
            'incassi': incassi,
            'numero_fatture': numero_fatture,
            'importo_totale': importo_totale
        } 