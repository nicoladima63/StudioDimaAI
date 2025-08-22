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
        'sesso': 'DB_PASESSO',
        'codice_fiscale': 'DB_PACODFI',
        'da_richiamare': 'DB_PARICHI',
        'note': 'DB_NOTE',  
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
        'note': 'DB_NOTE',
        'categoria': 'DB_SPCATEG',
        'importo_1': 'DB_SPIMPO1',
        'importo_2': 'DB_SPIMPO2', 
        'importo_3': 'DB_SPIMPO3',
        'importo_4': 'DB_SPIMPO4',
        'aliquota_iva_1': 'DB_SPIVA1',
        'aliquota_iva_2': 'DB_SPIVA2',
        'aliquota_iva_3': 'DB_SPIVA3',
        'aliquota_iva_4': 'DB_SPIVA4',
        'rate': 'DB_SPRATE'
    },
    'fornitori': {
        'id': 'DB_CODE',
        'nome': 'DB_FONOME',
        'codice_fiscale': 'DB_FOCODFI',
        'partita_iva': 'DB_FOPAIVA',
        'indirizzo': 'DB_FOINDIR',
        'citta': 'DB_FOCITTA',
        'provincia': 'DB_FOPROVI',
        'cap': 'DB_FOCAP',
        'telefono': 'DB_FOTELEF',
        'fax': 'DB_FOFAX',
        'cellulare': 'DB_FOCELLU',
        'rata': 'DB_FORATE',
        'banca': 'DB_FOBANCA',
        'note': 'DB_NOTE',
        'email': 'DB_FOEMAIL',
        'commessa': 'DB_FOCOMME',
        'sito': 'DB_FOSITO',
        'codice_iva': 'DB_FOIVCOD',
        'codice_societa': 'DB_FOSOCOD',
        'nazione': 'DB_FONAZIO',
        'prezzo_speciale': 'DB_FOPRESP',
        'tipo_fornitore': 'DB_FOTIPFO',
        'ritenuta_sostituto': 'DB_FORIPSO',
        'news_speciale': 'DB_FONEWSP',
        'contatto': 'DB_FOCONTA',
        'ufficio': 'DB_FOUFFIC',
        'nodo_escluso': 'DB_FONODES',
        'pagamento': 'DB_FOPAG',
        'suffisso': 'DB_FOSUFFI',
        'email_2': 'DB_FOEMAI2',
        'iban': 'DB_FOIBAN',
        'denominazione': 'DB_FODNOME',
        'indirizzo_diverso': 'DB_FODEIND',
        'citta_diversa': 'DB_FODECIT',
        'cap_diverso': 'DB_FODECAP',
        'provincia_diversa': 'DB_FODEPRO',
        'banca_2': 'DB_FOBANC2',
        'pagamento_alternativo': 'DB_FOPAGAM',
        'iva_deducibile': 'DB_FOIVADE',
        'commissione': 'DB_FOCOMMI',
    },
    'conti': {
        'codice': 'DB_CODE',
        'tipo': 'DB_COTIPO',
        'descrizione': 'DB_CODESCR',
        'totale_dare': 'DB_COTOTVE',
        'totale_avere': 'DB_COTOTAC',
        'iva_vendite': 'DB_COIVAVE',
        'iva_acquisti': 'DB_COIVAAC'
    },
    'vocispes': {
        'codice_fattura': 'DB_VOSPCOD',
        'codice_articolo': 'DB_VOSOCOD',
        'descrizione': 'DB_VODESCR',
        'quantita': 'DB_VOQUANT',
        'prezzo': 'DB_VOPREZZ',
        'iva': 'DB_VOIVA',
        'sconto': 'DB_VOSCONT'
    },
    'temp_continue': {
        'codice_destinazione': 'DB_FOCODES',
        'note_destinazione': 'DB_FONOTD',
        'regime': 'DB_FOREGIM',
        'iva_contribuente': 'DB_FOIVCON',
        'totale_dovuto': 'DB_FOTD',
        'categoria': 'DB_FOCATEG'
    },
    'dettagli_spese_fornitori': {
        'codice_fattura': 'DB_VOSPCOD',
        'codice_articolo': 'DB_VOSOCOD', 
        'descrizione': 'DB_VODESCR',
        'quantita': 'DB_VOQUANT',
        'prezzo_unitario': 'DB_VOPREZZ',
        'sconto': 'DB_VOSCONT',
        'ritenuta': 'DB_VORITEN',
        'aliquota_iva': 'DB_VOIVA',
        'codice_iva': 'DB_VOIVCOD'
    }
}

DBF_TABLES = {
    "agenda":     {"file": "APPUNTA.DBF",    "categoria": "USER"},
    "promemoria": {"file": "APPUNTA.DBF",    "categoria": "USER"},
    "pazienti":   {"file": "PAZIENTI.DBF",   "categoria": "DATI"},
    "fatture":    {"file": "FATTURE.DBF",    "categoria": "DATI"},
    "richiami":   {"file": "PAZIENTI.DBF",   "categoria": "DATI"},
    "acconti":    {"file": "ACCONTI.DBF",    "categoria":"DATI"},
    "spese_fornitori": {"file": "SPESAFOR.DBF", "categoria": "DATI"},
    "dettagli_spese_fornitori": {"file": "VOCISPES.DBF", "categoria": "DATI"},
    "fornitori":  {"file": "FORNITOR.DBF",   "categoria": "DATI"},
    "conti":      {"file": "CONTI.DBF",      "categoria": "DATI"},
    "vocispes":   {"file": "VOCISPES.DBF",   "categoria": "DATI"},
    # AGGIUNGERE QUI EVENTUALI TABELLE MANCANTI
}
