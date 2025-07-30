import logging
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from dbfread import DBF
from server.app.core.db_utils import get_dbf_path
from server.app.config.constants import COLONNE, TIPO_RICHIAMI, TIPI_APPUNTAMENTO
from server.app.core.utils import (
    costruisci_messaggio_richiamo,
    formatta_richiamo_per_frontend,
    calcola_data_richiamo
)

logger = logging.getLogger(__name__)

PAZIENTI_FIELDS = [
    'DB_CODE', 'DB_PANOME', 'DB_PAINDIR', 'DB_PACITTA', 'DB_PACAP', 'DB_PAPROVI',
    'DB_PATELEF', 'DB_PACELLU', 'DB_PADANAS', 'DB_PAULTVI', 'DB_PARICHI',
    'DB_PARITAR', 'DB_PARIMOT', 'DB_PANONCU', 'DB_PAEMAIL', 'DB_PACODFI'
]

class PazientiService:
    """Servizio unificato per la gestione di pazienti e richiami"""
    
    def __init__(self):
        self.dbf_path = get_dbf_path('pazienti')
        self.logger = logging.getLogger(__name__)
    
    def get_pazienti_all(self) -> List[Dict[str, Any]]:
        """
        Restituisce tutti i pazienti con dati completi inclusi stato richiami
        """
        try:
            pazienti = []
            cols_paz = COLONNE['pazienti']
            cols_rich = COLONNE['richiami']
            
            for record in DBF(self.dbf_path, encoding='latin-1'):
                # Dati base paziente
                paziente = {field: record.get(field, '') for field in PAZIENTI_FIELDS}
                
                # Aggiungi nome completo formattato
                paziente['nome_completo'] = str(record.get(cols_paz['nome'], '')).strip().title()
                
                # Gestione contatti (priorità cellulare > telefono)
                cellulare = str(record.get(cols_paz['cellulare'], '')).strip()
                telefono = str(record.get(cols_paz['telefono'], '')).strip()
                paziente['numero_contatto'] = cellulare if cellulare else telefono
                
                # Aggiungi dati geografici puliti
                paziente['citta_clean'] = str(record.get(cols_paz['comune'], '')).strip().title()
                paziente['cap_clean'] = str(record.get(cols_paz['cap'], '')).strip()
                paziente['provincia_clean'] = str(record.get(cols_paz['provincia'], '')).strip().upper()
                
                # Calcola stato richiami
                richiamo_info = self._calcola_stato_richiamo(record)
                paziente.update(richiamo_info)
                
                pazienti.append(paziente)
            
            # self.logger.info(f"Caricati {len(pazienti)} pazienti con dati completi")
            return pazienti
            
        except Exception as e:
            self.logger.error(f"Errore in get_pazienti_all: {str(e)}")
            raise
    
    def _calcola_stato_richiamo(self, record) -> Dict[str, Any]:
        """Calcola lo stato del richiamo per un paziente"""
        try:
            cols_rich = COLONNE['richiami']
            
            # Flags richiamo
            da_richiamare = str(record.get(cols_rich['da_richiamare'], '')).strip().upper()
            tipo_richiamo = str(record.get(cols_rich['tipo'], '')).strip()
            mesi_richiamo = record.get(cols_rich['mesi'], 0)
            
            # Date
            data_richiamo = record.get(cols_rich['data1'])
            ultima_visita = record.get(cols_rich['ultima_visita'])
            
            # Calcola data richiamo se mancante
            if not data_richiamo or not isinstance(data_richiamo, date):
                if ultima_visita and isinstance(ultima_visita, date) and mesi_richiamo > 0:
                    data_richiamo = calcola_data_richiamo(ultima_visita, mesi_richiamo)
            
            # Calcola giorni dall'ultima visita
            giorni_ultima_visita = None
            if ultima_visita and isinstance(ultima_visita, date):
                giorni_ultima_visita = (date.today() - ultima_visita).days
            
            # Determina priorità richiamo
            priorita = self._calcola_priorita_richiamo(
                da_richiamare, data_richiamo, giorni_ultima_visita
            )
            
            # Determina stato richiamo
            stato = self._calcola_stato_richiamo_data(data_richiamo)
            
            return {
                'needs_recall': da_richiamare == 'S',
                'data_richiamo': data_richiamo,
                'tipo_richiamo': tipo_richiamo,
                'tipo_richiamo_desc': TIPO_RICHIAMI.get(tipo_richiamo, 'Sconosciuto'),
                'mesi_richiamo': mesi_richiamo,
                'ultima_visita': ultima_visita,
                'giorni_ultima_visita': giorni_ultima_visita,
                'recall_priority': priorita,
                'recall_status': stato
            }
            
        except Exception as e:
            self.logger.error(f"Errore calcolo stato richiamo: {str(e)}")
            return {
                'needs_recall': False,
                'data_richiamo': None,
                'tipo_richiamo': '',
                'tipo_richiamo_desc': '',
                'mesi_richiamo': 0,
                'ultima_visita': None,
                'giorni_ultima_visita': None,
                'recall_priority': 'none',
                'recall_status': 'none'
            }
    
    def _calcola_priorita_richiamo(self, da_richiamare: str, data_richiamo: date, giorni_ultima_visita: int) -> str:
        """Calcola la priorità del richiamo"""
        if da_richiamare != 'S':
            return 'none'
        
        oggi = date.today()
        
        # Priorità basata su data richiamo
        if data_richiamo and isinstance(data_richiamo, date):
            giorni_scadenza = (data_richiamo - oggi).days
            if giorni_scadenza < -60:  # Scaduto da più di 2 mesi
                return 'high'
            elif giorni_scadenza < -30:  # Scaduto da più di 1 mese
                return 'medium'
            elif giorni_scadenza < 0:  # Scaduto
                return 'low'
        
        # Priorità basata su ultima visita
        if giorni_ultima_visita:
            if giorni_ultima_visita > 365:  # Più di 1 anno
                return 'high'
            elif giorni_ultima_visita > 180:  # Più di 6 mesi
                return 'medium'
            elif giorni_ultima_visita > 90:  # Più di 3 mesi
                return 'low'
        
        return 'none'
    
    def _calcola_stato_richiamo_data(self, data_richiamo: date) -> str:
        """Calcola lo stato del richiamo basato sulla data"""
        if not data_richiamo or not isinstance(data_richiamo, date):
            return 'none'
        
        oggi = date.today()
        giorni_diff = (data_richiamo - oggi).days
        
        if giorni_diff < 0:
            return 'scaduto'
        elif giorni_diff <= 7:
            return 'in_scadenza'
        else:
            return 'futuro'
    
    def get_pazienti_statistics(self) -> Dict[str, Any]:
        """Calcola statistiche complete sui pazienti"""
        try:
            pazienti = self.get_pazienti_all()
            
            # Statistiche base
            totale = len(pazienti)
            in_cura = len([p for p in pazienti if str(p.get('DB_PANONCU', '')).strip().upper() != 'S'])
            non_in_cura = totale - in_cura
            con_cellulare = len([p for p in pazienti if p.get('DB_PACELLU', '').strip()])
            con_email = len([p for p in pazienti if p.get('DB_PAEMAIL', '').strip()])
            
            # Statistiche richiami
            richiami_stats = self._calcola_statistiche_richiami(pazienti)
            
            # Statistiche geografiche
            geo_stats = self._calcola_statistiche_geografiche(pazienti)
            
            return {
                'totale_pazienti': totale,
                'in_cura': in_cura,
                'non_in_cura': non_in_cura,
                'con_cellulare': con_cellulare,
                'con_email': con_email,
                'richiami': richiami_stats,
                'geografia': geo_stats,
                'aggiornato_il': date.today().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Errore calcolo statistiche: {str(e)}")
            raise
    
    def _calcola_statistiche_richiami(self, pazienti: List[Dict]) -> Dict[str, Any]:
        """Calcola statistiche specifiche per i richiami"""
        richiami_necessari = [p for p in pazienti if p.get('needs_recall', False)]
        
        return {
            'totale_da_richiamare': len(richiami_necessari),
            'priorita_alta': len([p for p in richiami_necessari if p.get('recall_priority') == 'high']),
            'priorita_media': len([p for p in richiami_necessari if p.get('recall_priority') == 'medium']),
            'priorita_bassa': len([p for p in richiami_necessari if p.get('recall_priority') == 'low']),
            'scaduti': len([p for p in richiami_necessari if p.get('recall_status') == 'scaduto']),
            'in_scadenza': len([p for p in richiami_necessari if p.get('recall_status') == 'in_scadenza']),
            'futuri': len([p for p in richiami_necessari if p.get('recall_status') == 'futuro']),
            'per_tipo': self._raggruppa_per_tipo_richiamo(richiami_necessari)
        }
    
    def _raggruppa_per_tipo_richiamo(self, richiami: List[Dict]) -> Dict[str, int]:
        """Raggruppa richiami per tipo"""
        conteggio = {}
        for richiamo in richiami:
            tipo_desc = richiamo.get('tipo_richiamo_desc', 'Sconosciuto')
            conteggio[tipo_desc] = conteggio.get(tipo_desc, 0) + 1
        return conteggio
    
    def _calcola_statistiche_geografiche(self, pazienti: List[Dict]) -> Dict[str, Any]:
        """Calcola statistiche geografiche"""
        # Conta per città
        citta_count = {}
        provincia_count = {}
        
        for paziente in pazienti:
            citta = paziente.get('citta_clean', 'Sconosciuta')
            provincia = paziente.get('provincia_clean', 'Sconosciuta')
            
            citta_count[citta] = citta_count.get(citta, 0) + 1
            provincia_count[provincia] = provincia_count.get(provincia, 0) + 1
        
        # Top 5 città
        top_citta = dict(sorted(citta_count.items(), key=lambda x: x[1], reverse=True)[:5])
        
        return {
            'totale_citta': len(citta_count),
            'totale_province': len(provincia_count),
            'top_citta': top_citta,
            'distribuzione_citta': citta_count,
            'distribuzione_province': provincia_count
        }
    
    def get_recalls_data(self, priority: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Restituisce dati specifici per i richiami con filtri"""
        try:
            pazienti = self.get_pazienti_all()
            
            # Filtra solo pazienti che necessitano richiamo
            richiami = [p for p in pazienti if p.get('needs_recall', False)]
            
            # Applica filtri
            if priority:
                richiami = [r for r in richiami if r.get('recall_priority') == priority]
            
            if status:
                richiami = [r for r in richiami if r.get('recall_status') == status]
            
            # Ordina per priorità e giorni dall'ultima visita
            def sort_key(r):
                priority_order = {'high': 3, 'medium': 2, 'low': 1, 'none': 0}
                return (
                    priority_order.get(r.get('recall_priority', 'none'), 0),
                    r.get('giorni_ultima_visita', 0) or 0
                )
            
            richiami.sort(key=sort_key, reverse=True)
            
            self.logger.info(f"Trovati {len(richiami)} richiami con filtri: priority={priority}, status={status}")
            return richiami
            
        except Exception as e:
            self.logger.error(f"Errore in get_recalls_data: {str(e)}")
            raise
    
    def get_cities_data(self) -> List[Dict[str, Any]]:
        """Restituisce dati raggruppati per città"""
        try:
            pazienti = self.get_pazienti_all()
            
            # Raggruppa per città
            citta_data = {}
            for paziente in pazienti:
                citta = paziente.get('citta_clean', 'Sconosciuta')
                if citta not in citta_data:
                    citta_data[citta] = {
                        'citta': citta,
                        'totale_pazienti': 0,
                        'richiami_necessari': 0,
                        'con_cellulare': 0,
                        'con_email': 0,
                        'in_cura': 0
                    }
                
                citta_data[citta]['totale_pazienti'] += 1
                
                if paziente.get('needs_recall', False):
                    citta_data[citta]['richiami_necessari'] += 1
                
                if paziente.get('DB_PACELLU', '').strip():
                    citta_data[citta]['con_cellulare'] += 1
                
                if paziente.get('DB_PAEMAIL', '').strip():
                    citta_data[citta]['con_email'] += 1
                
                if str(paziente.get('DB_PANONCU', '')).strip().upper() != 'S':
                    citta_data[citta]['in_cura'] += 1
            
            # Converti in lista e ordina
            cities_list = list(citta_data.values())
            cities_list.sort(key=lambda x: x['totale_pazienti'], reverse=True)
            
            return cities_list
            
        except Exception as e:
            self.logger.error(f"Errore in get_cities_data: {str(e)}")
            raise
    
    def prepare_recall_message(self, paziente_id: str) -> Optional[Dict[str, Any]]:
        """Prepara messaggio per richiamo specifico"""
        try:
            pazienti = self.get_pazienti_all()
            paziente = next((p for p in pazienti if str(p.get('DB_CODE', '')).strip() == str(paziente_id).strip()), None)
            
            if not paziente or not paziente.get('needs_recall', False):
                return None
            
            # Usa la logica esistente per costruire il messaggio
            messaggio = costruisci_messaggio_richiamo(paziente)
            
            return {
                'paziente': paziente,
                'messaggio': messaggio,
                'telefono': paziente.get('numero_contatto', ''),
                'tipo_richiamo': paziente.get('tipo_richiamo_desc', ''),
                'data_richiamo': paziente.get('data_richiamo')
            }
            
        except Exception as e:
            self.logger.error(f"Errore prepare_recall_message: {str(e)}")
            return None
    
    # Metodi legacy per compatibilità
    def get_all_pazienti(self) -> List[Dict[str, Any]]:
        """Metodo legacy - usa get_pazienti_all"""
        return self.get_pazienti_all()
    
    def get_stats(self) -> Dict[str, int]:
        """Metodo legacy per compatibilità"""
        try:
            stats_complete = self.get_pazienti_statistics()
            return {
                'totale': stats_complete['totale_pazienti'],
                'in_cura': stats_complete['in_cura'],
                'non_in_cura': stats_complete['non_in_cura']
            }
        except Exception as e:
            self.logger.error(f"Errore in get_stats legacy: {str(e)}")
            return {'totale': 0, 'in_cura': 0, 'non_in_cura': 0}