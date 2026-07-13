"""
Motore di dispatch reminder - gestisce logica continuos/split basata su config DB.
"""

import logging
import sqlite3
from datetime import date, timedelta
from typing import Optional, Dict, Any

from core.paths import STUDIO_DIMA_DB_PATH
from core.reminder_db import ensure_reminder_tables

logger = logging.getLogger(__name__)


class ReminderDispatchEngine:
    """
    Legge configurazione studio_opening_hours e decide:
    - Se mandare reminder oggi per domani
    - Se modalità è 'continuous' (tutto insieme) o 'split' (mattina/pomeriggio)
    - Soglia oraria mattina/pomeriggio
    """

    def get_config(self, day_of_week: int) -> Optional[Dict[str, Any]]:
        """
        Legge config per un giorno specifico (1=Lun, 2=Mar, ..., 7=Dom).
        Ritorna dict con tutti i campi della tabella, o None se errore.
        """
        ensure_reminder_tables()
        try:
            conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM studio_opening_hours WHERE day_of_week = ?", (day_of_week,))
            row = cur.fetchone()
            conn.close()
            return dict(row) if row else None
        except Exception as e:
            logger.error(f"Errore lettura config per giorno {day_of_week}: {e}")
            return None

    def should_send_today(self, today_weekday: int) -> bool:
        """
        Verifica se mandare reminder OGGI per gli appuntamenti di DOMANI.
        
        Args:
            today_weekday: 0=Lun, 1=Mar, ..., 6=Dom (datetime.weekday())
        
        Returns:
            True se domani è abilitato per i reminder, False altrimenti.
        """
        # Converti da datetime.weekday() (0=Mon) a nostro formato (1=Mon)
        tomorrow_weekday = ((today_weekday + 1) % 7) + 1
        config = self.get_config(tomorrow_weekday)
        
        if not config:
            return False
        
        return config['enabled'] == 1

    def dispatch_mode(self, day_of_week: int) -> Optional[str]:
        """
        Ritorna modalità dispatch per un giorno: 'continuous' o 'split'.
        
        Args:
            day_of_week: 1=Lun, 2=Mar, ..., 7=Dom (nostro formato)
        
        Returns:
            'continuous' se continuous_hours=1
            'split' se continuous_hours=0
            None se errore o giorno non trovato
        """
        config = self.get_config(day_of_week)
        
        if not config:
            return None
        
        return 'continuous' if config['continuous_hours'] == 1 else 'split'

    def get_morning_threshold_hour(self, day_of_week: int) -> Optional[int]:
        """
        Ritorna ora soglia tra mattina e pomeriggio (es 13 da "13:00").
        Usato solo se modalità è 'split'.
        
        Args:
            day_of_week: 1=Lun, ..., 7=Dom
        
        Returns:
            Ora come int (es 13), o None se errore
        """
        config = self.get_config(day_of_week)
        
        if not config or config['continuous_hours'] == 1:
            return None  # Non applicabile per continuous
        
        morning_end = config.get('morning_end')
        if not morning_end:
            return 13  # Default fallback
        
        try:
            return int(morning_end.split(':')[0])
        except Exception:
            return 13

    def get_all_config(self) -> Dict[int, Dict[str, Any]]:
        """Ritorna config per tutti i 7 giorni (key=day_of_week, value=config dict)."""
        ensure_reminder_tables()
        result = {}
        try:
            conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM studio_opening_hours ORDER BY day_of_week")
            for row in cur.fetchall():
                result[row['day_of_week']] = dict(row)
            conn.close()
        except Exception as e:
            logger.error(f"Errore lettura config completa: {e}")
        
        return result

    def update_config(self, day_of_week: int, config_update: Dict[str, Any]) -> bool:
        """
        Aggiorna configurazione per un giorno specifico.
        
        Args:
            day_of_week: 1-7
            config_update: dict con i campi da aggiornare
        
        Returns:
            True se successo, False altrimenti
        """
        ensure_reminder_tables()
        try:
            conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
            
            # Costruisci SET clause dinamicamente
            allowed_fields = {
                'enabled', 'continuous_hours',
                'morning_start', 'morning_end', 'afternoon_start', 'afternoon_end',
                'fascia_unica_start', 'fascia_unica_end'
            }
            
            update_fields = {k: v for k, v in config_update.items() if k in allowed_fields}
            
            if not update_fields:
                conn.close()
                return False
            
            set_clause = ', '.join([f"{k} = ?" for k in update_fields.keys()])
            values = list(update_fields.values()) + [day_of_week]
            
            cur = conn.cursor()
            cur.execute(
                f"UPDATE studio_opening_hours SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE day_of_week = ?",
                values
            )
            conn.commit()
            conn.close()
            
            logger.info(f"Config aggiornata per giorno {day_of_week}: {update_fields}")
            return True
        except Exception as e:
            logger.error(f"Errore aggiornamento config giorno {day_of_week}: {e}")
            return False


# Singleton
_dispatch_engine: Optional[ReminderDispatchEngine] = None


def get_dispatch_engine() -> ReminderDispatchEngine:
    """Singleton pattern per il dispatch engine."""
    global _dispatch_engine
    if _dispatch_engine is None:
        _dispatch_engine = ReminderDispatchEngine()
    return _dispatch_engine
