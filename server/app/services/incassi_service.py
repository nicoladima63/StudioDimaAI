import logging

logger = logging.getLogger(__name__)

from dbfread import DBF
from datetime import datetime, date
from typing import List, Dict, Any
from server.app.core.db_utils import get_dbf_path, estrai_dati
from server.app.config.constants import COLONNE
from server.app.core.mode_manager import get_mode

class IncassiService:
    def __init__(self):
        self.acconti_path = get_dbf_path('acconti')
        self.pazienti_path = get_dbf_path('pazienti')
        self.fatture_path = get_dbf_path('fatture')
        
    def get_anni_disponibili(self) -> List[int]:
        anni = set()
        try:
            for record in DBF(self.fatture_path, encoding='latin-1'):
                data_fattura = record.get('DB_FADATA')
                if not data_fattura:
                    continue

                anno = None
                if isinstance(data_fattura, date):
                    anno = data_fattura.year
                elif isinstance(data_fattura, str):
                    # Tenta di parsare formati stringa comuni, per robustezza
                    try:
                        anno = datetime.strptime(data_fattura, '%Y-%m-%d').year
                    except ValueError:
                        try:
                            anno = int(data_fattura.split('/')[-1])
                        except (ValueError, IndexError):
                            continue  # Ignora formati non validi
                
                if anno and anno > 1990: # Aggiunge un controllo di validità
                    anni.add(anno)

        except Exception as e:
            logger.error(f"Errore critico durante la lettura degli anni dal file DBF: {e}")
            return [] # Ritorna vuoto in caso di errore grave
            
        return sorted(list(anni), reverse=True)

    def get_all_incassi(self, anno: int = None, mese: int = None) -> List[Dict[str, Any]]:
        """
        Estrae i dati delle fatture, con possibilità di filtrare per anno e mese.
        """
        all_records = estrai_dati(self.fatture_path, 'fatture')

        if not anno:
            return all_records

        filtered_records = []
        for record in all_records:
            data_fattura = record.get('fatturadata')
            if not isinstance(data_fattura, date):
                continue

            if data_fattura.year != anno:
                continue
            
            if mese and data_fattura.month != mese:
                continue
            
            filtered_records.append(record)
            
        return filtered_records

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