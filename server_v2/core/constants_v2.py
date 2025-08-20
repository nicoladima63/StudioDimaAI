"""
📋 Constants V2 - Configurazioni essenziali per StudioDimaAI Calendar System v2
==============================================================================

Versione ottimizzata delle costanti con solo quello che serve per il sistema v2:
- Mapping campi DBF (COLONNE)
- Tipi appuntamenti e colori
- Medici e richiami
- Mappatura tabelle DBF
- Google Calendar integration

Author: Claude Code Studio Architect
Version: 2.0.0
Based on: server/app/config/constants.py
"""

# =============================================================================
# MAPPING CAMPI DBF - Essenziale per accesso consistente
# =============================================================================

COLONNE = {
    'appuntamenti': {
        'data': 'DB_APDATA',
        'data_inserimento': 'DB_APDATAI',
        'ora_inizio': 'DB_APOREIN',
        'ora_fine': 'DB_APOREOU',
        'id_paziente': 'DB_APPACOD',
        'tipo': 'DB_GUARDIA',
        'medico': 'DB_APMEDIC',
        'studio': 'DB_APSTUDI',
        'note': 'DB_NOTE',
        'descrizione': 'DB_APDESCR',
    },
    'pazienti': {
        'id': 'DB_CODE',
        'nome': 'DB_PANOME',
        'indirizzo': 'DB_PAINDIR',
        'comune': 'DB_PACITTA',
        'cap': 'DB_PACAP',
        'provincia': 'DB_PAPROVI',
        'telefono': 'DB_PATELEF',
        'cellulare': 'DB_PACELLU',
        'data_nascita': 'DB_PADANAS',
        'ultima_visita': 'DB_PAULTVI',
        'richiamo': 'DB_PARICHI',
        'mesi_richiamo': 'DB_PARITAR',
        'tipo_richiamo': 'DB_PARIMOT',
        'non_in_cura': 'DB_PANONCU',
        'email': 'DB_PAEMAIL',
    },
    'richiami': {
        'id_paziente': 'DB_CODE',
        'da_richiamare': 'DB_PARICHI',
        'mesi': 'DB_PARITAR',
        'tipo': 'DB_PARIMOT',
        'data1': 'DB_PAMODA1',
        'data2': 'DB_PAMODA2',
        'ultima_visita': 'DB_PAULTVI'
    }
}

# =============================================================================
# MAPPATURA TABELLE DBF - Per path resolution e processing
# =============================================================================

DBF_TABLES = {
    'agenda': {
        'file': 'APPUNTA.DBF',
        'categoria': 'DATI',
        'descrizione': 'Appuntamenti calendario'
    },
    'pazienti': {
        'file': 'PAZIENTI.DBF',
        'categoria': 'DATI',
        'descrizione': 'Anagrafica pazienti'
    }
}

# =============================================================================
# TIPI APPUNTAMENTO - Essenziale per decodifica e display
# =============================================================================

TIPI_APPUNTAMENTO = {
    'V': 'Prima visita',
    'I': 'Igiene', 
    'C': 'Conservativa',
    'E': 'Endodonzia',
    'H': 'Chirurgia',
    'P': 'Protesi',
    'O': 'Ortodonzia',
    'L': 'Implantologia',
    'R': 'Parodontologia',
    'S': 'Controllo',
    'U': 'Gnatologia',
    'F': 'Ferie/Assenza',
    'A': 'Attività/Manuten',
    'M': 'privato'
}

TIPO_RICHIAMI = {
    '1': 'Generico',
    '2': 'Igiene',
    '3': 'Rx Impianto',
    '4': 'Controllo',
    '5': 'Impianto',
    '6': 'Ortodonzia'
}

# =============================================================================
# MEDICI - Essenziale per identificazione dottori
# =============================================================================

MEDICI = {
    1: 'Dr. Nicola',
    2: 'Dr.ssa Lara', 
    3: 'Dr. Giacomo',
    4: 'Dr. Roberto',
    5: 'Dr.ssa Anet',
    6: 'Dr.ssa Rossella'
}

# =============================================================================
# COLORI - Fondamentali per Google Calendar integration
# =============================================================================

COLORI_APPUNTAMENTO = {
    'V': '#FFA500',  # Arancione - Prima visita
    'I': '#800080',  # Viola - Igiene
    'C': '#00BFFF',  # Azzurro - Conservativa
    'E': '#808080',  # Grigio - Endodonzia
    'H': '#FF0000',  # Rosso - Chirurgia
    'P': '#008000',  # Verde - Protesi
    'O': '#FFC0CB',  # Rosa - Ortodonzia
    'L': '#FF00FF',  # Magenta - Implantologia
    'R': '#FFFF00',  # Giallo - Parodontologia
    'S': '#ADD8E6',  # Azzurro chiaro - Controllo
    'U': '#C8A2C8',  # Lilla - Gnatologia
    'F': '#A9A9A9',  # Grigio chiaro - Ferie/Assenza
    'A': '#808080',  # Grigio - Attività/Manuten
    'M': '#00FF00'   # Verde lime - Privato
}

# Mapping per Google Calendar API (color IDs)
GOOGLE_COLOR_MAP = {
    'V': '6',  # Arancione
    'U': '1',  # Lavanda
    'I': '3',  # Viola
    'C': '9',  # Blu
    'H': '11', # Rosso
    'P': '10', # Verde
    'M': '2',  # Salvia
    'O': '4',  # Rosa
    'E': '7',  # Azzurro
    'F': '8',  # Grigio
    'A': '8',  # Grigio
    'L': '3',  # Viola
    'R': '5',  # Giallo
    'S': '8'   # Grigio
}

# =============================================================================
# UTILITY FUNCTIONS - Helper per accesso dati
# =============================================================================

def get_appointment_type_name(tipo_code: str) -> str:
    """
    Converte codice tipo appuntamento in nome leggibile.
    
    Args:
        tipo_code: Codice tipo (es. 'V', 'I', 'C')
        
    Returns:
        Nome leggibile (es. 'Prima visita', 'Igiene', 'Conservativa')
    """
    return TIPI_APPUNTAMENTO.get(tipo_code, f'Tipo sconosciuto ({tipo_code})')

def get_appointment_color(tipo_code: str) -> str:
    """
    Recupera colore esadecimale per tipo appuntamento.
    
    Args:
        tipo_code: Codice tipo appuntamento
        
    Returns:
        Colore esadecimale (es. '#FFA500')
    """
    return COLORI_APPUNTAMENTO.get(tipo_code, '#808080')  # Default grigio

def get_google_color_id(tipo_code: str) -> str:
    """
    Recupera Google Calendar color ID per tipo appuntamento.
    
    Args:
        tipo_code: Codice tipo appuntamento
        
    Returns:
        Google color ID (es. '6', '1', '3')
    """
    return GOOGLE_COLOR_MAP.get(tipo_code, '8')  # Default grigio

def get_medico_name(medico_id: int) -> str:
    """
    Converte ID medico in nome.
    
    Args:
        medico_id: ID numerico medico
        
    Returns:
        Nome medico (es. 'Dr. Nicola')
    """
    return MEDICI.get(medico_id, f'Medico {medico_id}')

def get_campo_dbf(tabella: str, campo_logico: str) -> str:
    """
    Recupera nome campo DBF fisico da nome logico.
    
    Args:
        tabella: Nome tabella ('appuntamenti', 'pazienti', etc.)
        campo_logico: Nome campo logico ('data', 'nome', etc.)
        
    Returns:
        Nome campo DBF fisico (es. 'DB_APDATA', 'DB_PANOME')
        
    Raises:
        KeyError: Se tabella o campo non esistono
    """
    if tabella not in COLONNE:
        raise KeyError(f"Tabella '{tabella}' non trovata in COLONNE")
    
    if campo_logico not in COLONNE[tabella]:
        raise KeyError(f"Campo '{campo_logico}' non trovato in tabella '{tabella}'")
    
    return COLONNE[tabella][campo_logico]

def get_dbf_table_info(table_name: str) -> dict:
    """
    Recupera informazioni tabella DBF.
    
    Args:
        table_name: Nome tabella
        
    Returns:
        Dict con file, categoria, descrizione
        
    Raises:
        KeyError: Se tabella non esiste
    """
    if table_name not in DBF_TABLES:
        raise KeyError(f"Tabella '{table_name}' non trovata in DBF_TABLES")
    
    return DBF_TABLES[table_name]

# =============================================================================
# VALIDATION HELPERS
# =============================================================================

def is_valid_appointment_type(tipo_code: str) -> bool:
    """Verifica se codice tipo appuntamento è valido."""
    return tipo_code in TIPI_APPUNTAMENTO

def is_valid_medico_id(medico_id: int) -> bool:
    """Verifica se ID medico è valido."""
    return medico_id in MEDICI

def get_all_appointment_types() -> dict:
    """Recupera tutti i tipi appuntamento disponibili."""
    return TIPI_APPUNTAMENTO.copy()

def get_all_medici() -> dict:
    """Recupera tutti i medici disponibili."""
    return MEDICI.copy()

# =============================================================================
# EXPORT - Per backward compatibility
# =============================================================================

__all__ = [
    'COLONNE', 'DBF_TABLES', 'TIPI_APPUNTAMENTO', 'TIPO_RICHIAMI',
    'MEDICI', 'COLORI_APPUNTAMENTO', 'GOOGLE_COLOR_MAP',
    'get_appointment_type_name', 'get_appointment_color', 'get_google_color_id',
    'get_medico_name', 'get_campo_dbf', 'get_dbf_table_info',
    'is_valid_appointment_type', 'is_valid_medico_id',
    'get_all_appointment_types', 'get_all_medici'
]