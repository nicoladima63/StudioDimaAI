"""
Sistema di classificazione fatture basato su conti/sottoconti e caratteristiche
"""

# Mappature da tabelle DBF
CONTO_COLLABORATORI = "ZZZZZI"

SOTTOCONTI_COLLABORATORI = {
    "ZZZZYB": "Igienista",
    "ZZZZXP": "Ortodonzia", 
    "ZZZZXO": "Chirurgia"
}

# Codici fornitori collaboratori (da tabella FORNITOR.DBF)
FORNITORI_COLLABORATORI = {
    # Chirurghi (2)
    "ZZZZWB": {"nome": "Roberto Dott. Calvisi", "tipo": "Chirurgia"},
    "ZZZZYM": {"nome": "Dr. Fabio Marchi", "tipo": "Chirurgia"},
    
    # Ortodontista (1) 
    "ZZZZXP": {"nome": "Dr. Giacomo D'Orlandi Odontoiatra", "tipo": "Ortodonzia"},
    
    # Igienisti (3)
    "ZZZZXJ": {"nome": "Armandi Lara", "tipo": "Igienista"},
    "ZZZZUC": {"nome": "Jablonsky Anet", "tipo": "Igienista"},
}

# Pattern per identificazione
PATTERN_IVA_ESENTE = ["Esen", "ESEN"]
PATTERN_NOTE_ESENZIONE = ["N4", "N2", "N6", "Natura esenzione"]


def is_collaboratore_fattura(conto_code=None, sottoconto_code=None, fornitore_code=None, iva_field=None, note=None):
    """
    Identifica se è una fattura di collaboratore
    """
    # Criterio principale: codice fornitore collaboratore
    if fornitore_code in FORNITORI_COLLABORATORI:
        return True
    
    # Criterio: conto collaboratori
    if conto_code == CONTO_COLLABORATORI:
        return True
    
    # Criterio: sottoconto collaboratore
    if sottoconto_code in SOTTOCONTI_COLLABORATORI:
        return True
        
    # Criterio IVA: collaboratori sono sempre esenti
    if iva_field:
        for pattern in PATTERN_IVA_ESENTE:
            if pattern in str(iva_field):
                return True
    
    # Criterio note: natura esenzione
    if note:
        for pattern in PATTERN_NOTE_ESENZIONE:
            if pattern in str(note):
                return True
    
    return False


def get_tipo_collaboratore(sottoconto_code=None, fornitore_code=None):
    """
    Restituisce il tipo di collaboratore dal sottoconto o codice fornitore
    """
    # Prima prova con codice fornitore (più specifico)
    if fornitore_code in FORNITORI_COLLABORATORI:
        return FORNITORI_COLLABORATORI[fornitore_code]["tipo"]
    
    # Poi prova con sottoconto
    if sottoconto_code in SOTTOCONTI_COLLABORATORI:
        return SOTTOCONTI_COLLABORATORI[sottoconto_code]
    
    return "Collaboratore generico"


def get_nome_collaboratore(fornitore_code=None):
    """
    Restituisce il nome del collaboratore dal codice fornitore
    """
    if fornitore_code in FORNITORI_COLLABORATORI:
        return FORNITORI_COLLABORATORI[fornitore_code]["nome"]
    
    return None


def classify_fattura_collaboratore(record):
    """
    Classifica completamente una fattura di collaboratore
    """
    result = {
        "is_collaboratore": False,
        "tipo_collaboratore": None,
        "nome_collaboratore": None,
        "codice_fornitore": None,
        "caratteristiche": []
    }
    
    # Estrai i campi rilevanti dal record
    conto = record.get("conto_code") or record.get("DB_SOCOCOD")
    sottoconto = record.get("sottoconto_code") or record.get("DB_CODE")
    fornitore = record.get("fornitore_code") or record.get("DB_FAPACOD")
    iva = record.get("iva") or record.get("campo_iva") or record.get("DB_FAIVCOD")
    note = record.get("note") or record.get("descrizione")
    
    # Verifica se è collaboratore
    if is_collaboratore_fattura(conto, sottoconto, fornitore, iva, note):
        result["is_collaboratore"] = True
        result["tipo_collaboratore"] = get_tipo_collaboratore(sottoconto, fornitore)
        result["nome_collaboratore"] = get_nome_collaboratore(fornitore)
        result["codice_fornitore"] = fornitore
        
        # Aggiungi caratteristiche rilevate
        if iva and any(p in str(iva) for p in PATTERN_IVA_ESENTE):
            result["caratteristiche"].append("IVA_ESENTE")
            
        if note and any(p in str(note) for p in PATTERN_NOTE_ESENZIONE):
            result["caratteristiche"].append("NATURA_ESENZIONE")
            
        if fornitore in FORNITORI_COLLABORATORI:
            result["caratteristiche"].append("FORNITORE_REGISTRATO")
    
    return result


def create_fattura_filters():
    """
    Crea filtri modulari per classificare fatture
    """
    filters = {
        "collaboratori": {
            "conto_codes": [CONTO_COLLABORATORI],
            "sottoconto_codes": list(SOTTOCONTI_COLLABORATORI.keys()),
            "iva_patterns": PATTERN_IVA_ESENTE,
            "note_patterns": PATTERN_NOTE_ESENZIONE,
            "description": "Fatture collaboratori esterni"
        },
        
        "igienista": {
            "sottoconto_codes": ["ZZZZYB"],
            "tipo": "Igienista",
            "parent_filter": "collaboratori"
        },
        
        "ortodonzia": {
            "sottoconto_codes": ["ZZZZXP"], 
            "tipo": "Ortodonzia",
            "parent_filter": "collaboratori"
        },
        
        "chirurgia": {
            "sottoconto_codes": ["ZZZZXO"],
            "tipo": "Chirurgia", 
            "parent_filter": "collaboratori"
        }
    }
    
    return filters


def apply_filter(records, filter_name):
    """
    Applica un filtro specifico a una lista di record
    """
    filters = create_fattura_filters()
    
    if filter_name not in filters:
        raise ValueError(f"Filtro '{filter_name}' non esistente")
    
    filter_config = filters[filter_name]
    filtered_records = []
    
    for record in records:
        matches = True
        
        # Verifica codici conto
        if "conto_codes" in filter_config:
            conto = record.get("conto_code") or record.get("DB_SOCOCOD")
            if conto not in filter_config["conto_codes"]:
                matches = False
        
        # Verifica codici sottoconto
        if "sottoconto_codes" in filter_config:
            sottoconto = record.get("sottoconto_code") or record.get("DB_CODE")
            if sottoconto not in filter_config["sottoconto_codes"]:
                matches = False
        
        # Verifica pattern IVA
        if "iva_patterns" in filter_config:
            iva = record.get("iva") or record.get("campo_iva")
            if not iva or not any(p in str(iva) for p in filter_config["iva_patterns"]):
                matches = False
        
        # Verifica pattern note  
        if "note_patterns" in filter_config:
            note = record.get("note") or record.get("descrizione")
            if not note or not any(p in str(note) for p in filter_config["note_patterns"]):
                matches = False
        
        if matches:
            # Aggiungi metadata della classificazione
            record_copy = record.copy()
            record_copy["_classification"] = {
                "filter": filter_name,
                "tipo": filter_config.get("tipo", filter_name),
                "description": filter_config.get("description", "")
            }
            filtered_records.append(record_copy)
    
    return filtered_records


# Funzioni di utilità per integrare con il sistema esistente
def get_collaboratori_summary():
    """
    Restituisce un riassunto dei collaboratori configurati
    """
    return {
        "conto_principale": {
            "code": CONTO_COLLABORATORI,
            "descrizione": "Collaboratori"
        },
        "sottoconti": [
            {"code": code, "tipo": tipo} 
            for code, tipo in SOTTOCONTI_COLLABORATORI.items()
        ],
        "pattern_identificazione": {
            "iva_esente": PATTERN_IVA_ESENTE,
            "note_esenzione": PATTERN_NOTE_ESENZIONE
        }
    }


def identify_collaboratori_dinamico(table_fornitori, table_fatture):
    """
    Identifica collaboratori dinamicamente senza mappatura statica
    Trova esattamente i 6 collaboratori reali usando pattern specifici delle fatture
    """
    # Pattern precisi trovati analizzando le fatture dei collaboratori
    collaboratori_pattern = {}
    
    # Trova fornitori con pattern completo collaboratori
    for record in table_fatture:
        fornitore = record.get('DB_FAPACOD', '')
        iva_code = record.get('DB_FAIVCOD', '')
        iva_art = record.get('DB_FAARTIC', '')
        estip = record.get('DB_FAESTIP')
        tipra = record.get('DB_FATIPRA') 
        bolca = record.get('DB_FABOLCA', '')
        bocod = record.get('DB_FABOCOD', '')
        
        # Pattern specifico collaboratori (tutti hanno questi valori identici)
        pattern_match = (
            iva_code == 'EseArt10' and
            iva_art and 'ART. 10' in iva_art.upper() and 'D.P.R. 633' in iva_art and
            estip == 4 and
            tipra == 1 and 
            bolca == 'S' and
            bocod == 'EseArt15' and
            fornitore
        )
        
        if pattern_match:
            if fornitore not in collaboratori_pattern:
                collaboratori_pattern[fornitore] = 0
            collaboratori_pattern[fornitore] += 1
    
    # Filtro fornitori per trovare persone fisiche vs aziende
    titoli_medici = ['DOTT', 'DR.', 'DR ']
    aziende_escluse = ['LABORATORIO', 'LAB.', 'OLIVIERI', 'PERUZZI', 'DE CERTO', 'FARMACIA', 'FARM.', 'SRL', 'SPA', 'CORPO', 'ORDINE']
    
    collaboratori_identificati = []
    
    for record in table_fornitori:
        code = record.get('DB_CODE')
        nome = record.get('DB_FONOME', '')
        cf = record.get('DB_FOCODFI', '')
        piva = record.get('DB_FOPAIVA', '')
        suffisso = record.get('DB_FOSUFFI', '')
        
        # Deve avere pattern fatture collaboratori
        if code not in collaboratori_pattern:
            continue
        
        # Calcola score per identificare collaboratori reali vs aziende
        score = 0
        criteri = []
        
        # 1. Pattern fatture collaboratori (criterio principale)
        num_fatture = collaboratori_pattern[code]
        score += 4  # Bonus alto per pattern corretto
        criteri.append(f'PATTERN_COLLABORATORI({num_fatture}_fatture)')
        
        # 2. Ha titolo medico nel nome
        if any(titolo in nome.upper() for titolo in titoli_medici):
            score += 3
            criteri.append('TITOLO_MEDICO')
        
        # 3. Ha CF persona fisica E P.IVA
        if cf and len(cf) == 16 and piva and len(piva) == 11:
            score += 2
            criteri.append('CF_PIVA_PERSONA')
        
        # 4. Suffisso Dott.ssa
        if 'DOTT' in (suffisso or '').upper():
            score += 2
            criteri.append('SUFFISSO_MEDICO')
        
        # 5. Non è azienda esclusa
        if not any(escl in nome.upper() for escl in aziende_escluse):
            score += 1
            criteri.append('NON_AZIENDA_ESCLUSA')
        
        # 6. Nome semplice persona (2-4 parole)
        parole = len([p for p in nome.split() if p.strip()])
        if 2 <= parole <= 4:
            score += 1
            criteri.append('NOME_SEMPLICE')
        
        # Soglia per essere collaboratore (alta per eliminare falsi positivi)
        if score >= 8:
            collaboratori_identificati.append({
                'code': code,
                'nome': nome,
                'score': score,
                'criteri': criteri
            })
    
    return collaboratori_identificati


if __name__ == "__main__":
    # Test delle funzioni
    print("=== Test Classificatore Fatture ===")
    print("Collaboratori configurati:")
    summary = get_collaboratori_summary()
    print(f"Conto: {summary['conto_principale']}")
    print("Sottoconti:")
    for sc in summary["sottoconti"]:
        print(f"  {sc['code']}: {sc['tipo']}")
    
    # Test record di esempio
    test_record_1 = {
        "conto_code": "ZZZZZI",
        "sottoconto_code": "ZZZZXO", 
        "iva": "Esen4T10",
        "note": "Natura esenzione N4"
    }
    
    test_record_2 = {
        "DB_FAPACOD": "ZZZZWB",  # Roberto Dott. Calvisi
        "DB_FAIVCOD": "EseArt10",
        "DB_FAARTIC": "Esente da I.V.A. ai sensi dell'art. 10"
    }
    
    print("\nTest 1 - Classificazione per conto/sottoconto:")
    classification1 = classify_fattura_collaboratore(test_record_1)
    print(f"  {classification1}")
    
    print("\nTest 2 - Classificazione per codice fornitore:")
    classification2 = classify_fattura_collaboratore(test_record_2)
    print(f"  {classification2}")