#!/usr/bin/env python3
"""
Script per testare gli endpoint del sistema Ricetta Bianca
Supporta le operazioni: invio, visualizzazione e annullamento
"""

import argparse
import requests
import base64
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom
import os

class RicettaBiancaTester:
    def __init__(self, username, password, base_url=None, auth_token=None):
        self.username = username
        self.password = password
        self.base_url = base_url or "https://ricettabiancaservice.sanita.finanze.it"
        
        # Se non fornito, usa il tuo ID-SESSIONE reale
        if auth_token:
            self.auth_token = auth_token if auth_token.startswith('Bearer ') else f"Bearer {auth_token}"
        else:
            # Usa il nuovo ID-SESSIONE valido
            self.auth_token = "Bearer b1391aeb-12b9-44a2-a99d-1eb105b9a92c"
        
        # Valori di default per PRODUZIONE (cifrati dinamicamente)
        self.pincode_plain = "1141766994"  # Il tuo PIN in chiaro
        self.cf_assistito_plain = "RMGFLL37D69D612X"  # Il tuo CF assistito in chiaro
        self.default_pincode = None  # Sarà cifrato dinamicamente
        self.default_codice_paziente = None  # Sarà cifrato dinamicamente
        
        # Cifra i dati all'inizializzazione
        self._encrypt_data()
    
    def _encrypt_data(self):
        """Cifra PIN e CF assistito usando il servizio esistente"""
        try:
            # Cifra PIN usando il servizio esistente
            response = requests.post('http://localhost:5001/api/v2/ricetta/cifra-pincode', 
                                   json={'pincode': self.pincode_plain})
            if response.status_code == 200:
                self.default_pincode = response.json().get('pincode_cifrato')
                print(f"✅ PIN cifrato: {self.default_pincode[:50]}...")
            else:
                print(f"⚠️ Errore cifratura PIN: {response.status_code}")
                self.default_pincode = self.pincode_plain  # Fallback
            
            # Cifra CF assistito usando il servizio esistente
            response = requests.post('http://localhost:5001/api/v2/ricetta/cifra-cf', 
                                   json={'cf_assistito': self.cf_assistito_plain})
            if response.status_code == 200:
                self.default_codice_paziente = response.json().get('cf_cifrato')
                print(f"✅ CF cifrato: {self.default_codice_paziente[:50]}...")
            else:
                print(f"⚠️ Errore cifratura CF: {response.status_code}")
                self.default_codice_paziente = self.cf_assistito_plain  # Fallback
                
        except Exception as e:
            print(f"⚠️ Errore cifratura: {e}")
            # Fallback ai valori in chiaro
            self.default_pincode = self.pincode_plain
            self.default_codice_paziente = self.cf_assistito_plain
    
        
    def get_headers(self):
        """Restituisce gli headers per le richieste SOAP"""
        return {
            'Content-Type': 'text/xml; charset=utf-8',
            'Authorization': f"Basic {base64.b64encode(f'{self.username}:{self.password}'.encode()).decode()}",
            'Authorization2F': self.auth_token,
            'SOAPAction': ''
        }
    
    def print_debug_info(self):
        """Stampa informazioni di debug"""
        print(f"Debug Info:")
        print(f"  Username: {self.username}")
        print(f"  Auth Token: {self.auth_token}")
        print(f"  Base64 Auth: {base64.b64encode(f'{self.username}:{self.password}'.encode()).decode()}")
        print("-" * 50)
    
    def format_xml_response(self, xml_string):
        """Formatta il response XML per una migliore leggibilità"""
        try:
            dom = minidom.parseString(xml_string)
            return dom.toprettyxml(indent="  ")
        except:
            return xml_string
    
    def invio_prescritto(self, cf_medico, codice_paziente=None, nrbe=None, 
                        cod_prodotto="033052034", descrizione="NIMESULIDE MYL*100MG 30BUST.",
                        quantita="1", posologia="Posologia di prova", 
                        note="Note di prova inserite da script"):
        """
        Invia una nuova ricetta bianca
        """
        print("🔄 Invio ricetta bianca...")
        
        codice_paziente = codice_paziente or self.default_codice_paziente
        data_compilazione = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        soap_body = f'''
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                         xmlns:inv="http://invioprescrittoricettabiancarichiesta.xsd.dem.sanita.finanze.it" 
                         xmlns:tip="http://tipodatiinvioprescrittoricettabianca.xsd.dem.sanita.finanze.it">
           <soapenv:Header/>
           <soapenv:Body>
              <inv:InvioPrescrittoRicettaBiancaRichiesta>
                 <inv:pinCode>{self.default_pincode}</inv:pinCode>
                 <inv:cfMedico>{cf_medico}</inv:cfMedico>
                 <inv:codRegione>090</inv:codRegione>
                 <inv:codASLAo>109</inv:codASLAo>
                 <inv:codStruttura></inv:codStruttura>
                 <inv:codSpecializzazione>F</inv:codSpecializzazione>
                 <inv:specialClinica></inv:specialClinica>
                 <inv:numIscrizAlbo>123456</inv:numIscrizAlbo>
                 <inv:indirMedico>Via Medico, 88|00100|Roma|RM</inv:indirMedico>
                 <inv:telefMedico>+39|0765488120</inv:telefMedico>
                 <inv:codicePaziente>{codice_paziente}</inv:codicePaziente>
                 <inv:cognNome>RMGFLL37D69D612X</inv:cognNome>
                 <inv:indirizzo>Via Assistito, 24|00065|Fiano Romano|RM</inv:indirizzo>
                 <inv:tipoPrescrizione>F</inv:tipoPrescrizione>
                 <inv:codDiagnosi>V48.4</inv:codDiagnosi>
                 <inv:descrDiagnosi>Diagnosi inserita da script</inv:descrDiagnosi>
                 <inv:dataCompilazione>{data_compilazione}</inv:dataCompilazione>
                 <inv:dettaglioPrescrizioneRicettaBianca>
                    <tip:codProdPrest>{cod_prodotto}</tip:codProdPrest>
                    <tip:descrProdPrest>{descrizione}</tip:descrProdPrest>
                    <tip:tdl>0</tip:tdl>
                    <tip:descrTestoLiberoNote>{note}</tip:descrTestoLiberoNote>
                    <tip:quantita>{quantita}</tip:quantita>
                    <tip:posologia>{posologia}</tip:posologia>
                 </inv:dettaglioPrescrizioneRicettaBianca>
              </inv:InvioPrescrittoRicettaBiancaRichiesta>
           </soapenv:Body>
        </soapenv:Envelope>
        '''
        
        url = f"{self.base_url}/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca"
        headers = self.get_headers()
        headers['SOAPAction'] = "http://invioprescrittoricettabianca.wsdl.dem.sanita.finanze.it/InvioPrescrittoRicettaBianca"
        
        try:
            response = requests.post(url, data=soap_body.strip(), headers=headers)
            print(f"Status Code: {response.status_code}")
            print(f"Response:\n{self.format_xml_response(response.text)}")
            
            # Estrai NRBE dalla risposta se presente
            try:
                root = ET.fromstring(response.text)
                nrbe_elem = root.find(".//{http://invioprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it}nrbe")
                if nrbe_elem is not None:
                    print(f"✅ NRBE generato: {nrbe_elem.text}")
                    return nrbe_elem.text
            except ET.ParseError:
                pass
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Errore nella richiesta: {e}")
            return None
    
    def visualizza_prescritto(self, cf_medico, codice_paziente=None, nrbe=None, pin_nrbe=None):
        """
        Visualizza una ricetta bianca esistente
        """
        print("🔍 Visualizzazione ricetta bianca...")
        
        if not nrbe and not pin_nrbe:
            print("❌ Specificare almeno NRBE o PIN NRBE")
            return
        
        codice_paziente = codice_paziente or self.default_codice_paziente
        
        nrbe_element = f"<vis:nrbe>{nrbe}</vis:nrbe>" if nrbe else ""
        pin_nrbe_element = f"<vis:pinNrbe>{pin_nrbe}</vis:pinNrbe>" if pin_nrbe else ""
        
        soap_body = f'''
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                         xmlns:vis="http://visualizzaprescrittoricettabiancarichiesta.xsd.dem.sanita.finanze.it" 
                         xmlns:tip="http://tipodativisualizzaprescrittoricettabianca.xsd.dem.sanita.finanze.it">
           <soapenv:Header/>
           <soapenv:Body>
              <vis:VisualizzaPrescrittoRicettaBiancaRichiesta>
                 <vis:pinCode>{self.default_pincode}</vis:pinCode>
                 <vis:codicePaziente>{codice_paziente}</vis:codicePaziente>
                 {nrbe_element}
                 {pin_nrbe_element}
                 <vis:cfMedico>{cf_medico}</vis:cfMedico>
              </vis:VisualizzaPrescrittoRicettaBiancaRichiesta>
           </soapenv:Body>
        </soapenv:Envelope>
        '''
        
        url = f"{self.base_url}/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca"
        headers = self.get_headers()
        headers['SOAPAction'] = "http://visualizzaprescrittoricettabianca.wsdl.dem.sanita.finanze.it/VisualizzaPrescrittoRicettaBianca"
        
        try:
            response = requests.post(url, data=soap_body.strip(), headers=headers)
            print(f"Status Code: {response.status_code}")
            print(f"Response:\n{self.format_xml_response(response.text)}")
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Errore nella richiesta: {e}")
    
    def annulla_prescritto(self, cf_medico, codice_paziente=None, nrbe=None, pin_nrbe=None):
        """
        Annulla una ricetta bianca esistente
        """
        print("🗑️ Annullamento ricetta bianca...")
        
        if not nrbe and not pin_nrbe:
            print("❌ Specificare almeno NRBE o PIN NRBE")
            return
        
        codice_paziente = codice_paziente or self.default_codice_paziente
        
        nrbe_element = f"<ann:nrbe>{nrbe}</ann:nrbe>" if nrbe else ""
        pin_nrbe_element = f"<ann:pinNrbe>{pin_nrbe}</ann:pinNrbe>" if pin_nrbe else ""
        
        soap_body = f'''
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                         xmlns:ann="http://annullaprescrittoricettabiancarichiesta.xsd.dem.sanita.finanze.it">
           <soapenv:Header/>
           <soapenv:Body>
              <ann:AnnullaPrescrittoRicettaBiancaRichiesta>
                 <ann:pinCode>{self.default_pincode}</ann:pinCode>
                 <ann:codicePaziente>{codice_paziente}</ann:codicePaziente>
                 {nrbe_element}
                 {pin_nrbe_element}
                 <ann:cfMedico>{cf_medico}</ann:cfMedico>
              </ann:AnnullaPrescrittoRicettaBiancaRichiesta>
           </soapenv:Body>
        </soapenv:Envelope>
        '''
        
        url = f"{self.base_url}/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca"
        headers = self.get_headers()
        headers['SOAPAction'] = "http://annullaprescrittoricettabianca.wsdl.dem.sanita.finanze.it/AnnullaPrescrittoRicettaBianca"
        
        try:
            response = requests.post(url, data=soap_body.strip(), headers=headers)
            print(f"Status Code: {response.status_code}")
            print(f"Response:\n{self.format_xml_response(response.text)}")
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Errore nella richiesta: {e}")


def main():
    parser = argparse.ArgumentParser(description='Tester per gli endpoint Ricetta Bianca')
    parser.add_argument('--username', '-u', default='DMRNCL63S21D612I', 
                       help='Username per autenticazione (default: DMRNCL63S21D612I)')
    parser.add_argument('--password', '-p', default='VtmakYjB4CjEN_!',
                       help='Password per autenticazione (default: VtmakYjB4CjEN_!)')
    parser.add_argument('--cf-medico', '-m', default='DMRNCL63S21D612I',
                       help='Codice fiscale del medico (default: DMRNCL63S21D612I)')
    parser.add_argument('--base-url', 
                       default='https://ricettabiancaservice.sanita.finanze.it',
                       help='URL base del servizio')
    parser.add_argument('--auth-token', help='Token di autenticazione (Bearer token)')
    
    # Debug option
    parser.add_argument('--debug', action='store_true', help='Mostra headers di debug')
    
    # Operazioni
    parser.add_argument('--invio', action='store_true', 
                       help='Esegui invio ricetta')
    parser.add_argument('--visualizza', action='store_true',
                       help='Esegui visualizzazione ricetta')
    parser.add_argument('--annulla', action='store_true',
                       help='Esegui annullamento ricetta')
    
    # Parametri per le operazioni
    parser.add_argument('--nrbe', help='Numero Ricetta Bianca Elettronica (12 caratteri)')
    parser.add_argument('--pin-nrbe', help='PIN NRBE (5 caratteri)')
    parser.add_argument('--codice-paziente', help='Codice paziente (criptato)')
    
    # Parametri per invio
    parser.add_argument('--cod-prodotto', default='033052034',
                       help='Codice prodotto farmaceutico (default: 033052034)')
    parser.add_argument('--descrizione', default='NIMESULIDE MYL*100MG 30BUST.',
                       help='Descrizione prodotto')
    parser.add_argument('--quantita', default='1', help='Quantità (default: 1)')
    parser.add_argument('--posologia', default='Posologia di prova',
                       help='Posologia')
    parser.add_argument('--note', default='Note di prova inserite da script',
                       help='Note libere')
    
    args = parser.parse_args()
    
    # Verifica che almeno un'operazione sia specificata
    if not any([args.invio, args.visualizza, args.annulla]):
        parser.error("Specificare almeno una operazione: --invio, --visualizza, o --annulla")
    
    # Crea il tester
    tester = RicettaBiancaTester(args.username, args.password, args.base_url, args.auth_token)
    
    print(f"Ricetta Bianca Tester")
    print(f"URL: {args.base_url}")
    print(f"Username: {args.username}")
    print(f"CF Medico: {args.cf_medico}")
    
    if args.debug:
        tester.print_debug_info()
    
    print("-" * 50)
    
    nrbe_generato = None
    
    # Esegui le operazioni richieste
    if args.invio:
        nrbe_generato = tester.invio_prescritto(
            cf_medico=args.cf_medico,
            codice_paziente=args.codice_paziente,
            cod_prodotto=args.cod_prodotto,
            descrizione=args.descrizione,
            quantita=args.quantita,
            posologia=args.posologia,
            note=args.note
        )
        print("-" * 50)
    
    if args.visualizza:
        # Usa NRBE appena generato se disponibile, altrimenti quello passato come parametro
        nrbe_da_usare = nrbe_generato or args.nrbe
        tester.visualizza_prescritto(
            cf_medico=args.cf_medico,
            codice_paziente=args.codice_paziente,
            nrbe=nrbe_da_usare,
            pin_nrbe=args.pin_nrbe
        )
        print("-" * 50)
    
    if args.annulla:
        # Usa NRBE appena generato se disponibile, altrimenti quello passato come parametro
        nrbe_da_usare = nrbe_generato or args.nrbe
        tester.annulla_prescritto(
            cf_medico=args.cf_medico,
            codice_paziente=args.codice_paziente,
            nrbe=nrbe_da_usare,
            pin_nrbe=args.pin_nrbe
        )


if __name__ == "__main__":
    main()