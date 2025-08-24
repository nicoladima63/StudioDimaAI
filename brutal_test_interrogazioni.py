"""
BRUTAL TEST DIRETTO - SOLO NRE
Campi opzionali = OMESSI completamente (non vuoti)
"""
import requests
import urllib3
from datetime import datetime

# DISABILITA AVVISI SSL
urllib3.disable_warnings()

# DATI HARDCODATI - SOLO ESSENZIALI
nre = "C0003340582"
cf_medico = "DMRNCL63S21D612I"
password = "VtmakYjB4CjEN_!"
pincode_cifrato = "LsQiYtf7FcpMYVKvf+51V6t1BSUk+E/dGOB2vmwNl0DhirZ8QzvTI2Ay04p6+t+eH+DjzkJpXrlEEZvKRz6wKVNOt7uYSQUYKBIFcbcEQJnqT7zTgtz7jV3BK+QaEphfKRsOP1Iejv+vKvJ/3te2xNMHPkNYZIAjxEQHftw9Swk="

# ENDPOINT INTERROGAZIONI UFFICIALE
endpoint = "https://demservice.sanita.finanze.it/DemRicettaInterrogazioniServicesWeb/services/demInterrogaNreUtilizzati"

# SOAP PULITO - SOLO campi obbligatori + NRE
soap_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:int="http://interroganreutilrichiesta.xsd.dem.sanita.finanze.it">
    <soapenv:Header/>
    <soapenv:Body>
        <int:InterrogaNreUtilRichiesta>
            <int:pinCode>{pincode_cifrato}</int:pinCode>
            <int:codRegione>090</int:codRegione>
            <int:nre>{nre}</int:nre>
            <int:cfMedico>{cf_medico}</int:cfMedico>
        </int:InterrogaNreUtilRichiesta>
    </soapenv:Body>
</soapenv:Envelope>'''

headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': '"http://interroganreutilizzati.wsdl.dem.sanita.finanze.it/InterrogaNreUtilizzati"',
    'User-Agent': 'Python-requests/2.28.0'
}

print("=== BRUTAL TEST - SOLO CAMPI OBBLIGATORI + NRE ===")
print(f"Endpoint: {endpoint}")
print(f"NRE: {nre}")
print()

try:
    session = requests.Session()
    session.auth = (cf_medico, password)
    session.verify = False
    
    print("Invio richiesta...")
    
    response = session.post(
        endpoint,
        data=soap_xml,
        headers=headers,
        timeout=30,
        verify=False
    )
    
    print(f"Status: {response.status_code}")
    print("=== RISPOSTA ===")
    print(response.text)
    
    # SALVA RESPONSE
    with open("brutal_response.xml", "w", encoding="utf-8") as f:
        f.write(f"<!-- BRUTAL TEST PULITO - {datetime.now().isoformat()} -->\n")
        f.write(f"<!-- Status: {response.status_code} -->\n")
        f.write("\n")
        f.write(response.text)
    
    print("\nFile salvato: brutal_response.xml")
    
except Exception as e:
    print(f"ERRORE: {e}")