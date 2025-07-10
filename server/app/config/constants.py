# --- Mapping logico per tipi di appuntamento ---
TIPI_APPUNTAMENTO = {
    'V': 'Prima visita', 'I': 'Igiene', 'C': 'Conservativa', 'E': 'Endodonzia',
    'H': 'Chirurgia', 'P': 'Protesi', 'O': 'Ortodonzia', 'L': 'Implantologia',
    'R': 'Parodontologia', 'S': 'Controllo', 'U': 'Gnatologia',
    'F': 'Ferie/Assenza', 'A': 'Attività/Manuten', 'M': 'privato'
}

TIPO_RICHIAMI = {
    '1': 'Generico',
    '2': 'Igiene',
    '3': 'Rx Impianto',
    '4': 'Controllo',
    '5': 'Impianto',
    '6': 'Ortodonzia'
}

COLORI_APPUNTAMENTO = {
    'V': '#FFA500', 'I': '#800080', 'C': '#00BFFF', 'E': '#808080',
    'H': '#FF0000', 'P': '#008000', 'O': '#FFC0CB', 'L': '#FF00FF',
    'R': '#FFFF00', 'S': '#ADD8E6', 'U': '#C8A2C8', 'F': '#A9A9A9',
    'A': '#808080', 'M': '#00FF00'
}

GOOGLE_COLOR_MAP = {
    'V': '6', 'U': '1', 'I': '3', 'C': '9', 'H': '11', 'P': '10', 'M': '2',
    'O': '4', 'E': '7', 'F': '8', 'A': '8', 'L': '3', 'R': '5', 'S': '8'
}

MEDICI = {
    1: 'Dr. Nicola', 2: 'Dr.ssa Lara', 3: 'Dr. Giacomo',
    4: 'Dr. Roberto', 5: 'Dr.ssa Anet', 6: 'Dr.ssa Rossella'
}

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
    'fatture' : {
        'fatturaid':'DB_CODE',
        'fatturapazienteid':'DB_FAPACOD',
        'fatturanumero':'DB_FANUMER',
        'fatturadata':'DB_FADATA',
        'fatturatipopagamento':'DB_FABANCA',
        'fatturamodopagamento':'DB_FAPAGAM',
        'fatturaimporto':'DB_FAIMPON',
        'fatturabollo':'DB_FAIVA',
        'fatturatitolopaziente':'DB_FASUFFI',
        'fatturanomepaziente':'DB_FANOME',
        'fatturacodicefiscale':'DB_FACODFI',
        'fatturaindirizzo':'DB_FAINDIR',
        'fatturacitta':'DB_FACITTA',
        'fatturacap':'DB_FACAP',
        'fatturaprovincia':'DB_FAPROVI'
    }
}

DBF_TABLES = {
    "agenda":     {"file": "APPUNTA.DBF",    "categoria": "USER"},
    "promemoria": {"file": "APPUNTA.DBF",    "categoria": "USER"},
    "pazienti":   {"file": "PAZIENTI.DBF",   "categoria": "DATI"},
    "fatture":    {"file": "FATTURE.DBF",    "categoria": "DATI"},
    "richiami":   {"file": "PAZIENTI.DBF",   "categoria": "DATI"},
    "acconti":    {"file": "ACCONTI.DBF",    "categoria":"DATI"},
    # AGGIUNGERE QUI EVENTUALI TABELLE MANCANTI
}
