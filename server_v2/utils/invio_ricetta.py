def invio_ricetta(self, cf_assistito: str, dati_ricetta: dict) -> dict:
    """
    FUNZIONE PER INVIO RICETTA CORRETTA SECONDO LE SPECIFICHE XSD
    
    dati_ricetta deve contenere:
    - cognome_nome: str (opzionale - "ROSSI MARIO")
    - indirizzo: str (opzionale - "Via Roma, 1|00100|Roma|RM") 
    - cod_diagnosi: str (opzionale - "V48.4")
    - descr_diagnosi: str (opzionale - "Diagnosi di prova")
    - prescrizioni: list di dict con:
        - cod_prodotto: str (opzionale - AIC del prodotto)
        - descrizione: str (opzionale - descrizione farmaco)
        - quantita: str (OBBLIGATORIO - numero 1-99)
        - tdl: str (OBBLIGATORIO - "0" o "1" per terapia del dolore)
        - posologia: str (opzionale)
        - note: str (opzionale - descrTestoLiberoNote)
        - cod_gruppo_equiv: str (opzionale)
        - descr_gruppo_equiv: str (opzionale)
        - non_sost: str (opzionale - solo "1" se non sostituibile)
        - cod_motivaz_non_sost: str (opzionale - "1","2","3","4")
        - durata_trattamento: str (opzionale)
        - modalita_impiego: str (opzionale)
        - preparaz_farmaceutica: str (opzionale)
        - num_ripetibilita: str (opzionale)
        - validita_farm: str (opzionale)
        - prescrizione1: str (opzionale - info aggiuntive)
        - prescrizione2: str (opzionale - info aggiuntive)
    
    CAMPI OBBLIGATORI dal XSD:
    - cfMedico (preso da self)
    - codSpecializzazione (OBBLIGATORIO)
    - numIscrizAlbo (OBBLIGATORIO)  
    - indirMedico (OBBLIGATORIO)
    - telefMedico (OBBLIGATORIO)
    - codicePaziente (cf cifrato)
    - tipoPrescrizione (OBBLIGATORIO - "F")
    - dataCompilazione (OBBLIGATORIO)
    - almeno 1 dettaglioPrescrizioneRicettaBianca
    """
    try:
        self.logger.info(f"=== INVIO RICETTA (XSD COMPLIANT) ===")
        self.logger.info(f"CF Assistito: {cf_assistito}")
        
        # Validazione dati obbligatori secondo XSD
        if 'prescrizioni' not in dati_ricetta or not dati_ricetta['prescrizioni']:
            return {
                'success': False,
                'error': 'MISSING_PRESCRIPTIONS',
                'message': 'Almeno una prescrizione è obbligatoria',
                'http_status': 0
            }
        
        # Validazione prescrizioni secondo XSD
        for i, prescrizione in enumerate(dati_ricetta['prescrizioni']):
            # Campi obbligatori per ogni prescrizione
            if 'quantita' not in prescrizione:
                return {
                    'success': False,
                    'error': 'MISSING_QUANTITA',
                    'message': f'Prescrizione {i+1}: campo quantita obbligatorio',
                    'http_status': 0
                }
            
            if 'tdl' not in prescrizione:
                return {
                    'success': False,
                    'error': 'MISSING_TDL', 
                    'message': f'Prescrizione {i+1}: campo tdl obbligatorio (0 o 1)',
                    'http_status': 0
                }
            
            # Validazione valori enum
            if prescrizione['tdl'] not in ['0', '1']:
                return {
                    'success': False,
                    'error': 'INVALID_TDL',
                    'message': f'Prescrizione {i+1}: tdl deve essere "0" o "1"',
                    'http_status': 0
                }
            
            # Validazione quantita (1-99)
            try:
                qty = int(prescrizione['quantita'])
                if qty < 1 or qty > 99:
                    return {
                        'success': False,
                        'error': 'INVALID_QUANTITA',
                        'message': f'Prescrizione {i+1}: quantita deve essere 1-99',
                        'http_status': 0
                    }
            except ValueError:
                return {
                    'success': False,
                    'error': 'INVALID_QUANTITA_FORMAT',
                    'message': f'Prescrizione {i+1}: quantita deve essere un numero',
                    'http_status': 0
                }
            
            # Validazione campi enum opzionali
            if 'non_sost' in prescrizione and prescrizione['non_sost'] != '1':
                return {
                    'success': False,
                    'error': 'INVALID_NON_SOST',
                    'message': f'Prescrizione {i+1}: non_sost può essere solo "1" o omesso',
                    'http_status': 0
                }
            
            if 'cod_motivaz_non_sost' in prescrizione:
                if prescrizione['cod_motivaz_non_sost'] not in ['1', '2', '3', '4']:
                    return {
                        'success': False,
                        'error': 'INVALID_COD_MOTIVAZ',
                        'message': f'Prescrizione {i+1}: cod_motivaz_non_sost deve essere 1,2,3 o 4',
                        'http_status': 0
                    }
        
        # Cifra CF assistito usando il servizio esistente
        cf_cifrato = self._encrypt_cf_assistito(cf_assistito)
        self.logger.info(f"CF cifrato: {cf_cifrato[:50]}...")
        
        # Cifra PIN usando il servizio esistente  
        pin_cifrato = self._encrypt_pincode(self.pincode)
        self.logger.info(f"PIN cifrato: {pin_cifrato[:50]}...")
        
        # Valori di default OBBLIGATORI secondo XSD
        defaults = {
            'cod_regione': '130',  # opzionale
            'cod_asl': '201',      # opzionale 
            'cod_struttura': '',   # opzionale
            'specializzazione': 'F',  # OBBLIGATORIO - 1 char
            'special_clinica': '',    # opzionale
            'num_iscrizione_albo': '123456',  # OBBLIGATORIO
            'indirizzo_medico': 'Via Medico, 88|00100|Roma|RM',  # OBBLIGATORIO
            'telefono_medico': '+39|0765488120',  # OBBLIGATORIO
            'tipo_prescrizione': 'F',  # OBBLIGATORIO - 1 char
            'testata1': '',        # opzionale
            'testata2': ''         # opzionale
        }
        
        # Applica defaults
        for key, default_value in defaults.items():
            if key not in dati_ricetta or not dati_ricetta[key]:
                dati_ricetta[key] = default_value
        
        # Data compilazione corrente - OBBLIGATORIO formato aaaa-mm-dd hh24:mm:ss (19 char)
        data_compilazione = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Costruisci elementi XML per le prescrizioni secondo XSD
        prescrizioni_xml = ""
        for prescrizione in dati_ricetta['prescrizioni']:
            
            # Elementi opzionali - aggiungi solo se presenti e non vuoti
            elements = []
            
            if prescrizione.get('cod_prodotto'):
                elements.append(f"<tip:codProdPrest>{prescrizione['cod_prodotto']}</tip:codProdPrest>")
            
            if prescrizione.get('descrizione'):
                elements.append(f"<tip:descrProdPrest>{prescrizione['descrizione']}</tip:descrProdPrest>")
            
            if prescrizione.get('cod_gruppo_equiv'):
                elements.append(f"<tip:codGruppoEquival>{prescrizione['cod_gruppo_equiv']}</tip:codGruppoEquival>")
            
            if prescrizione.get('descr_gruppo_equiv'):
                elements.append(f"<tip:descrGruppoEquival>{prescrizione['descr_gruppo_equiv']}</tip:descrGruppoEquival>")
            
            if prescrizione.get('non_sost') == '1':
                elements.append(f"<tip:nonSost>1</tip:nonSost>")
            
            if prescrizione.get('cod_motivaz_non_sost'):
                elements.append(f"<tip:codMotivazNonSost>{prescrizione['cod_motivaz_non_sost']}</tip:codMotivazNonSost>")
            
            # TDL OBBLIGATORIO
            elements.append(f"<tip:tdl>{prescrizione['tdl']}</tip:tdl>")
            
            if prescrizione.get('note'):
                elements.append(f"<tip:descrTestoLiberoNote>{prescrizione['note']}</tip:descrTestoLiberoNote>")
            
            # QUANTITA OBBLIGATORIA
            elements.append(f"<tip:quantita>{prescrizione['quantita']}</tip:quantita>")
            
            if prescrizione.get('posologia'):
                elements.append(f"<tip:posologia>{prescrizione['posologia']}</tip:posologia>")
            
            if prescrizione.get('durata_trattamento'):
                elements.append(f"<tip:durataTrattamento>{prescrizione['durata_trattamento']}</tip:durataTrattamento>")
            
            if prescrizione.get('modalita_impiego'):
                elements.append(f"<tip:modalitaImpiego>{prescrizione['modalita_impiego']}</tip:modalitaImpiego>")
            
            if prescrizione.get('preparaz_farmaceutica'):
                elements.append(f"<tip:preparazFarmaceutica>{prescrizione['preparaz_farmaceutica']}</tip:preparazFarmaceutica>")
            
            if prescrizione.get('num_ripetibilita'):
                elements.append(f"<tip:numRipetibilita>{prescrizione['num_ripetibilita']}</tip:numRipetibilita>")
            
            if prescrizione.get('validita_farm'):
                elements.append(f"<tip:validitaFarm>{prescrizione['validita_farm']}</tip:validitaFarm>")
            
            if prescrizione.get('prescrizione1'):
                elements.append(f"<tip:prescrizione1>{prescrizione['prescrizione1']}</tip:prescrizione1>")
            
            if prescrizione.get('prescrizione2'):
                elements.append(f"<tip:prescrizione2>{prescrizione['prescrizione2']}</tip:prescrizione2>")
            
            prescrizioni_xml += f'''
            <inv:dettaglioPrescrizioneRicettaBianca>
               {chr(10).join(elements)}
            </inv:dettaglioPrescrizioneRicettaBianca>'''
        
        # Elementi opzionali - aggiungi solo se presenti e non vuoti
        optional_elements = []
        
        if dati_ricetta.get('testata1'):
            optional_elements.append(f"<inv:testata1>{dati_ricetta['testata1']}</inv:testata1>")
        
        if dati_ricetta.get('testata2'):
            optional_elements.append(f"<inv:testata2>{dati_ricetta['testata2']}</inv:testata2>")
        
        if dati_ricetta.get('special_clinica'):
            optional_elements.append(f"<inv:specialClinica>{dati_ricetta['special_clinica']}</inv:specialClinica>")
        
        if dati_ricetta.get('cognome_nome'):
            optional_elements.append(f"<inv:cognNome>{dati_ricetta['cognome_nome']}</inv:cognNome>")
        
        if dati_ricetta.get('indirizzo'):
            optional_elements.append(f"<inv:indirizzo>{dati_ricetta['indirizzo']}</inv:indirizzo>")
        
        if dati_ricetta.get('cod_diagnosi'):
            optional_elements.append(f"<inv:codDiagnosi>{dati_ricetta['cod_diagnosi']}</inv:codDiagnosi>")
        
        if dati_ricetta.get('descr_diagnosi'):
            optional_elements.append(f"<inv:descrDiagnosi>{dati_ricetta['descr_diagnosi']}</inv:descrDiagnosi>")
        
        # Crea SOAP request secondo XSD
        soap_body = f'''<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                         xmlns:inv="http://invioprescrittoricettabiancarichiesta.xsd.dem.sanita.finanze.it" 
                         xmlns:tip="http://tipodatiinvioprescrittoricettabianca.xsd.dem.sanita.finanze.it">
           <soapenv:Header/>
           <soapenv:Body>
              <inv:InvioPrescrittoRicettaBiancaRichiesta>
                 <inv:pinCode>{pin_cifrato}</inv:pinCode>
                 <inv:cfMedico>{self.cf_medico}</inv:cfMedico>
                 <inv:codRegione>{dati_ricetta['cod_regione']}</inv:codRegione>
                 <inv:codASLAo>{dati_ricetta['cod_asl']}</inv:codASLAo>
                 <inv:codStruttura>{dati_ricetta['cod_struttura']}</inv:codStruttura>
                 <inv:codSpecializzazione>{dati_ricetta['specializzazione']}</inv:codSpecializzazione>
                 {chr(10).join(optional_elements)}
                 <inv:numIscrizAlbo>{dati_ricetta['num_iscrizione_albo']}</inv:numIscrizAlbo>
                 <inv:indirMedico>{dati_ricetta['indirizzo_medico']}</inv:indirMedico>
                 <inv:telefMedico>{dati_ricetta['telefono_medico']}</inv:telefMedico>
                 <inv:codicePaziente>{cf_cifrato}</inv:codicePaziente>
                 <inv:tipoPrescrizione>{dati_ricetta['tipo_prescrizione']}</inv:tipoPrescrizione>
                 <inv:dataCompilazione>{data_compilazione}</inv:dataCompilazione>
                 {prescrizioni_xml}
              </inv:InvioPrescrittoRicettaBiancaRichiesta>
           </soapenv:Body>
        </soapenv:Envelope>'''
        
        # Headers IDENTICI alla visualizzazione
        headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'Authorization': f"Basic {base64.b64encode(f'{self.cf_medico}:{self.password}'.encode()).decode()}",
            'Authorization2F': f"Bearer {self.id_sessione}",
            'SOAPAction': "http://invioprescrittoricettabianca.wsdl.dem.sanita.finanze.it/InvioPrescrittoRicettaBianca"
        }
        
        # Endpoint per invio
        url = "https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca"
        
        self.logger.info(f"URL: {url}")
        self.logger.info(f"Numero prescrizioni: {len(dati_ricetta['prescrizioni'])}")
        
        # Chiamata HTTP
        response = requests.post(url, data=soap_body.strip(), headers=headers)
        
        self.logger.info(f"Status Code: {response.status_code}")
        self.logger.info(f"Response: {response.text[:500]}...")
        
        # Salva XML per debug
        xml_file = f"response_xml_invio_ricetta_{cf_assistito}_{int(datetime.now().timestamp())}.xml"
        with open(xml_file, 'w', encoding='utf-8') as f:
            f.write(response.text)
        self.logger.info(f"XML salvato: {xml_file}")
        
        if response.status_code == 200:
            try:
                root = ET.fromstring(response.text)
                
                # Parsing secondo XSD della ricevuta
                nrbe_element = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}nrbe")
                pin_nrbe_element = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}pinNrbe")
                codice_esito_element = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}codEsitoInserimento")
                protocollo_element = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}protocolloTransazione")
                data_inserimento_element = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}dataInserimento")
                nome_medico_element = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}nomeMedico")
                cognome_medico_element = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}cognomeMedico")
                flag_promemoria_element = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}flagPromemoria")
                pdf_promemoria_element = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}pdfPromemoria")
                
                # Estrai eventuali errori
                errori = []
                for errore in root.findall(".//{http://tipodatiinvioprescrittoricettabianca.xsd.dem.sanita.finanze.it}erroreRicetta"):
                    cod_esito = errore.find(".//codEsito")
                    esito_text = errore.find(".//esito")
                    identificativo_prod = errore.find(".//identificativoProdPrest")
                    tipo_errore = errore.find(".//tipoErrore")
                    
                    errori.append({
                        'codice': cod_esito.text if cod_esito is not None else 'N/A',
                        'messaggio': esito_text.text if esito_text is not None else 'N/A',
                        'identificativo_prodotto': identificativo_prod.text if identificativo_prod is not None else 'N/A',
                        'tipo': tipo_errore.text if tipo_errore is not None else 'N/A'
                    })
                
                # Estrai comunicazioni
                comunicazioni = []
                for comunicazione in root.findall(".//{http://tipodatiinvioprescrittoricettabianca.xsd.dem.sanita.finanze.it}comunicazione"):
                    codice = comunicazione.find(".//codice")
                    messaggio = comunicazione.find(".//messaggio")
                    
                    comunicazioni.append({
                        'codice': codice.text if codice is not None else 'N/A',
                        'messaggio': messaggio.text if messaggio is not None else 'N/A'
                    })
                
                result_data = {
                    'nrbe': nrbe_element.text if nrbe_element is not None else None,
                    'pin_nrbe': pin_nrbe_element.text if pin_nrbe_element is not None else None,
                    'codice_esito': codice_esito_element.text if codice_esito_element is not None else None,
                    'protocollo_transazione': protocollo_element.text if protocollo_element is not None else None,
                    'data_inserimento': data_inserimento_element.text if data_inserimento_element is not None else None,
                    'nome_medico': nome_medico_element.text if nome_medico_element is not None else None,
                    'cognome_medico': cognome_medico_element.text if cognome_medico_element is not None else None,
                    'flag_promemoria': flag_promemoria_element.text if flag_promemoria_element is not None else None,
                    'pdf_promemoria': pdf_promemoria_element.text if pdf_promemoria_element is not None else None,
                    'errori': errori,
                    'comunicazioni': comunicazioni
                }
                
                # Success: codice 0000 e nessun errore bloccante
                is_success = (result_data['codice_esito'] == '0000' and 
                             result_data['nrbe'] is not None and
                             not any(e.get('tipo') == 'Bloccante' for e in errori))
                
                if is_success:
                    self.logger.info(f"NRBE generato: {result_data['nrbe']}")
                
                return {
                    'success': is_success,
                    'ricetta_data': result_data,
                    'response_xml': response.text,
                    'http_status': 200,
                    'message': 'Ricetta inviata con successo' if is_success else f'Errore invio ricetta: {errori[0]["messaggio"] if errori else "Errore sconosciuto"}'
                }
                
            except ET.ParseError as e:
                self.logger.error(f"Errore parsing XML: {e}")
                return {
                    'success': False,
                    'error': 'XML_PARSE_ERROR',
                    'message': f'Errore parsing risposta XML: {e}',
                    'response_xml': response.text,
                    'http_status': response.status_code
                }
        else:
            return {
                'success': False,
                'error': f'HTTP_{response.status_code}',
                'message': f'Errore HTTP {response.status_code}',
                'response_xml': response.text,
                'http_status': response.status_code
            }
            
    except Exception as e:
        self.logger.error(f"Errore invio_ricetta: {e}")
        return {
            'success': False,
            'error': 'EXCEPTION',
            'message': f'Errore: {e}',
            'http_status': 0
        }