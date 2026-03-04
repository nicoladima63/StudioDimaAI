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
    },
    'elenco': {
        # Identificativi Piano di Cura
        'id': 'DB_CODE',                  # ID univoco del Piano (6 char) - usato come chiave per linkare PREVENT.db_prelcod
        'id_paziente': 'DB_ELPACOD',      # ID Paziente a cui appartiene il piano (6 char)
        
        # Dettagli Piano
        'descrizione': 'DB_ELDESCR',      # Descrizione del piano (es: "altri impla", "cure nuove")
        'data': 'DB_ELDATA',              # Data creazione/modifica piano
        'totale': 'DB_ELTOTAL',           # Totale previsto del piano (Decimal)
        'stato': 'DB_ELSTATO',            # Stato: 'S' = Stampato/Storico, '' = Bozza/Preventivo
        'medico': 'DB_ELMEDIC',           # Medico responsabile
        
        # Campi tecnici
        'codice_prestazione': 'DB_ELPRCOD', # Codice prestazione associata (se applicabile)
        'note': 'DB_NOTE'                 # Note del piano
    },
    'preventivi': {
        # Identificativi - IMPORTANTE: db_prelcod può contenere sia ID Paziente che ID Piano (da ELENCO)
        'id_piano': 'DB_PRELCOD',         # Link al Piano di Cura (ELENCO.db_code) - campo principale per raggruppare prestazioni
        'id_prestazione': 'DB_PRONCOD',   # Codice prestazione (6 char)
        'data_prestazione': 'DB_PRDATA',  # Data prestazione (DateTime)
        
        # Dettagli prestazione
        'codice_prestazione': 'DB_PRLAVOR',      # (5 char) sigla associata alla prestazione: prima visite= pv, ricostruzione II classe= rc2
        'spesa': 'DB_PRSPESA',            # costo della prestazione
        'dente': 'DB_PRDENTE',            # Dente (1 char)
        'medico': 'DB_PRMEDIC',           # Medico (Decimal 4,0) che esegue la prestazione
        #'prontuario_lyd': 'DB_PRONLYD',     # non so a cosa serve
        'stato_prestazione': 'DB_GUARDIA',          # Guardia (Decimal 1,0) eseguito=1, da eseguire=3, incorso=2
        #'settore': 'DB_PRSETTO',          # Settore (1 char)
        
        # Codici collegati
        'codice_fattura': 'DB_PRFACOD',   # Codice fattura (6 char)
        'codice_anagrafica': 'DB_PRANCOD', # Codice anagrafica/secondario (6 char) - NON usato per linking principale
        
        # Spese e costi
        #'spesa_anagrafica': 'DB_PRSPEAS', # Spesa anagrafica (Decimal 10,2)
        #'diagnosi': 'DB_PRADIAC',         # Diagnosi (1 char)
        #'spesa_elaborazione': 'DB_PRSPELI', # Spesa elaborazione (Decimal 10,2)
        #'costo_lavoro': 'DB_PRCOSLI',     # Costo lavoro (Decimal 10,2)
        #'costo_lavoro_anagrafica': 'DB_PRCOSLA', # Costo lavoro anagrafica (Decimal 10,2)
        
        # Durata e tempi
        #'durata': 'DB_PRDURAT',           # Durata (Decimal 4,2)
        #'tempo_esposizione': 'DB_PRXESP', # Tempo esposizione (Decimal 4,2)
        #'tempo_integrazione': 'DB_PRXINT', # Tempo integrazione (Decimal 6,2)
        #'tempo_tensione': 'DB_PRXTEN',    # Tempo tensione (Decimal 6,2)
        #'tempo_radiazione': 'DB_PMXRAD',  # Tempo radiazione (Decimal 7,2)
        
        # Codici prodotto
        #'codice_prodotto': 'DB_PRPRCOD',  # Codice prodotto (6 char)
        #'id_prodotto': 'DB_PRPRIDE',      # ID prodotto (4 char)
        #'comprensivo': 'DB_PRCOMPR',      # Comprensivo (1 char)
        
        # Costi finali
        #'costo_comprensivo': 'DB_PRCOSCO', # Costo comprensivo (Decimal 10,2)
        #'costo_prodotto': 'DB_PRCOSPR',   # Costo prodotto (Decimal 10,2)
        
        # Codici aggiuntivi
        #'codice_applicazione': 'DB_PRAPXXC', # Codice applicazione (9 char)
        #'codice_planimetria': 'DB_PRPLXXC',  # Codice planimetria (9 char)
        #'codice_xx': 'DB_XXCODE'          # Codice XX (9 char)
    },
    'diario': {
        'id_paziente': 'DB_DIPACOD',
        'data': 'DB_DIDATA',            #data della nota messa nel diario
        'descrizione': 'DB_DIDESCR',    #contenuto vero e proprio della nota messa nel diario
        'identificativo': 'DB_DIDENTI', #non usato
        'note': 'DB_NOTE',              #non usato
        'durata': 'DB_DIDURAT',        #durata della nota messa nel diario
        'medico': 'DB_DIMEDIC',        #medico che ha esguito la prestazione
        'assistente': 'DB_DIASSIS',    #assistente che ha messo la nota nel diario
        'evidenza': 'DB_DIEVIDE'       #non usato
    },
    'onorario': {
        'id_prestazione': 'DB_CODE',        # ID prestazione (es: ZZZZEC)
        'categoria': 'DB_ONTIPO',           # Categoria (es: 1, 9, 8, 2)
        'nome_prestazione': 'DB_ONDESCR',   # Nome prestazione (es: Visita di controllo)
        'costo': 'DB_ONCOSTO',             # Costo (es: 30,00)
        'codice_breve': 'DB_ONCODIC'        # Codice breve (es: cont, bott, nylo)
    },
    'fornitori': {
        'id': 'DB_CODE',
        'nome': 'DB_FONOME',
        'codice_fiscale': 'DB_FOCODFI',
        'partita_iva': 'DB_FOPAIVA',
        'indirizzo': 'DB_FOINDIR',
        'comune': 'DB_FORCITTA',
        'cap': 'DB_FOCAP',
        'provincia': 'DB_FOPROVI',
        'telefono': 'DB_FOTELEF',
        'cellulare': 'DB_FOCELLU',
        'email': 'DB_FOEMAIL',
        'note': 'DB_NOTE'
    },
    'spese_fornitori': {
        'id': 'DB_CODE',
        'codice_fornitore': 'DB_SPFOCOD',
        'descrizione': 'DB_SPDESCR',
        'costo_netto': 'DB_SPCOSTO',
        'costo_iva': 'DB_SPCOIVA',
        'data_spesa': 'DB_SPDATA',
        'data_registrazione': 'DB_SPDATAR',
        'numero_documento': 'DB_SPNUMER',
        'note': 'DB_NOTE'
    },
    'dettagli_spese_fornitori': {
        'id_fattura': 'DB_VOSPCOD',
        'codice_articolo': 'DB_VOSOCOD',    #da verificare non è sicuro
        'descrizione': 'DB_VODESCR',
        'quantita': 'DB_VOQUANT',
        'prezzo_unitario': 'DB_VOPREZZ',
        'sconto': 'DB_VOSCONT',
        'ritenuta': 'DB_VORITEN',
        'aliquota_iva': 'DB_VOIVA',
        'codice_iva': 'DB_VOIVCOD'
    },
    'elenco': {
        'id': 'DB_CODE',              # ID univoco del Piano
        'id_paziente': 'DB_ELPACOD',  # ID Paziente (campo essenziale!)
        'descrizione': 'DB_ELDESCR',  # Descrizione piano
        'data': 'DB_ELDATA',          # Data piano
        'totale': 'DB_ELTOTAL',       # Totale previsto
        'stato': 'DB_ELSTATO'         # Stato: 'S' = Stampato, '' = Bozza
    }
}

# =============================================================================
# MAPPATURA TABELLE DBF - Per path resolution e processing
# =============================================================================

DBF_TABLES = {
    'APPUNTA': {
        'file': 'APPUNTA.DBF',
        'categoria': 'USER',
        'descrizione': 'Appuntamenti agenda'
    },
    'pazienti': {
        'file': 'PAZIENTI.DBF',
        'categoria': 'DATI',
        'descrizione': 'Anagrafica pazienti'
    },
    'preventivi': {
        'file': 'PREVENT.DBF',
        'categoria': 'DATI',
        'descrizione': 'Preventivi pazienti'
    },
    'elenco': {
        'file': 'ELENCO.DBF',
        'categoria': 'DATI',
        'descrizione': 'Tabella Piani di Cura'
    },
    'diario': {
        'file': 'DIARIO.DBF',
        'categoria': 'DATI',
        'descrizione': 'Diario clinico'
    },
    'onorario': {
        'file': 'ONORARIO.DBF',
        'categoria': 'DATI',
        'descrizione': 'Tariffario prestazioni'
    },
    'fornitori': {
        'file': 'FORNITOR.DBF',
        'categoria': 'DATI',
        'descrizione': 'Anagrafica fornitori'
    },
    'spese': {
        'file': 'SPESAFOR.DBF',
        'categoria': 'DATI',
        'descrizione': 'Spese fornitori'
    },
    'voci_spese': {
        'file': 'VOCISPES.DBF',
        'categoria': 'DATI',
    },
    'fatture': {
        'file': 'FATTURE.DBF',
        'categoria': 'DATI',
        'descrizione': 'Fatture clienti'
    },

}

# =============================================================================
# CATEGORIE PRESTAZIONI - Per raggruppamento e monitoraggio
# =============================================================================

CATEGORIE_PRESTAZIONI = {
    1: 'Parte generale',
    2: 'Conservativa',
    3: 'Endodonzia',
    4: 'Parodontologia',
    5: 'Chirurgia',
    6: 'Implantologia',
    7: 'Protesi Fissa',
    8: 'Protesi Mobile',
    9: 'Ortodonzia',
    10: 'Pedodonzia',
    11: 'Igiene orale',
    12: 'Chirurgia implantare'
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
# MAPPING NUMERICO DB_GUARDIA IN PREVENT.DBF- Per decodifica campo DB_GUARDIA
# =============================================================================

GUARDIA_MAP = {
    # Stati di esecuzione prestazioni
    1: 'Da Eseguire',
    2: 'In Corso',
    3: 'Eseguito',
    }

# =============================================================================
# REGOLE DI VALIDAZIONE
# =============================================================================

# Tipi di appuntamento che sono validi anche senza ID paziente (Prima Visita, ecc.)
# Inizialmente includiamo tutti i tipi conosciuti
VALID_NO_PATIENT_TYPES = list(TIPI_APPUNTAMENTO.keys())


# =============================================================================
# MEDICI - Essenziale per identificazione dottori
# =============================================================================

MEDICI = {
    1: 'Dr. Nicola Di Martino',
    2: 'Dr.ssa Lara ',
    4: 'Dr. Giacomo D Orlandi',
    3: 'Dr. Roberto Calvisi',
    5: 'Dr.ssa Anet Jablonvsky',
    6: 'Dr.ssa Rossella Pisante'
}

# =============================================================================
# COMPENSI COLLABORATORI - Regole di compenso per analisi redditivita
# tipo: 'titolare' | 'percentuale' | 'per_intervento'
# percentuale: quota della produzione (0.45 = 45%)
# tariffa: EUR per intervento
# categorie_intervento: ID categorie prestazioni contate come intervento
# =============================================================================

COMPENSI_COLLABORATORI = {
    1: {
        'tipo': 'titolare',
    },
    2: {
        'tipo': 'percentuale',
        'percentuale': 0.45,
    },
    3: {
        'tipo': 'per_intervento',
        'tariffa': 300,
        'categorie_intervento': [5, 6, 12],  # Chirurgia, Implantologia, Chirurgia implantare
    },
    4: {
        'tipo': 'percentuale',
        'percentuale': 0.70,
    },
    5: {
        'tipo': 'percentuale',
        'percentuale': 0.45,
    },
    6: {
        'tipo': 'percentuale',
        'percentuale': 0.45,
    },
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
    """Converte codice tipo appuntamento in nome leggibile. """
    return TIPI_APPUNTAMENTO.get(tipo_code, f'Tipo sconosciuto ({tipo_code})')

def get_appointment_color(tipo_code: str) -> str:
    """Recupera colore esadecimale per tipo appuntamento. 
    Returns:Colore esadecimale (es. '#FFA500')"""
    return COLORI_APPUNTAMENTO.get(tipo_code, '#808080')  # Default grigio

def get_google_color_id(tipo_code: str) -> str:
    """Recupera Google Calendar color ID per tipo appuntamento.
    Returns:Google color ID (es. '6', '1', '3')"""
    return GOOGLE_COLOR_MAP.get(tipo_code, '8')  # Default grigio

def get_medico_name(medico_id: int) -> str:
    """Converte ID medico in nome.
    Returns:Nome medico (es. 'Dr. Nicola')"""
    return MEDICI.get(medico_id, f'Medico {medico_id}')

def get_campo_dbf(tabella: str, campo_logico: str) -> str:
    """Recupera nome campo DBF fisico da nome logico.
    Returns:Nome campo DBF fisico (es. 'DB_APDATA', 'DB_PANOME')
    Raises:KeyError: Se tabella o campo non esistono"""
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
        # Se tabella non è in DBF_TABLES, crea configurazione di default
        return {
            'file': f'{table_name.upper()}.DBF',
            'categoria': 'DATI',
            'descrizione': f'Tabella {table_name}'
        }
    
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

def get_guardia_type_name(guardia_code: int) -> str:
    """Converte codice DB_GUARDIA in nome leggibile."""
    return GUARDIA_MAP.get(guardia_code, f'Tipo sconosciuto ({guardia_code})')

def get_all_guardia_types() -> dict:
    """Recupera tutti i tipi guardia disponibili."""
    return GUARDIA_MAP.copy()

# =============================================================================
# EXPORT - Per backward compatibility
# =============================================================================

__all__ = [
    'COLONNE', 'DBF_TABLES', 'TIPI_APPUNTAMENTO', 'TIPO_RICHIAMI', 'GUARDIA_MAP',
    'MEDICI', 'COLORI_APPUNTAMENTO', 'GOOGLE_COLOR_MAP',
    'get_appointment_type_name', 'get_appointment_color', 'get_google_color_id',
    'get_medico_name', 'get_campo_dbf', 'get_dbf_table_info',
    'is_valid_appointment_type', 'is_valid_medico_id',
    'get_all_appointment_types', 'get_all_medici',
    'get_guardia_type_name', 'get_all_guardia_types',
    'VALID_NO_PATIENT_TYPES'
]