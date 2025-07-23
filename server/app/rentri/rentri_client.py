import requests
import json
import logging
from server.app.rentri.auth.jwt_auth import get_auth_headers as get_advanced_auth_headers, get_env

class RentriClient:
    def __init__(self, demo=False, timeout=30, logger=None):
        self.demo = demo
        self.timeout = timeout
        self.logger = logger or logging.getLogger(__name__)
        self.audience, self.issuer, self.url_base = get_env(demo)
        self.api_version = "v1.0"

    def _jwt_headers(self, body="{}"):
        return get_advanced_auth_headers(body, demo=self.demo)

    def get_operatori(self, num_iscr_ass=None):
        url = f"{self.url_base}/operatore"
        params = {}
        if num_iscr_ass:
            params['num_iscr_ass'] = num_iscr_ass
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, params=params, timeout=self.timeout)
        return self._handle_response(resp)

    def get_controllo_iscrizione(self, identificativo):
        url = f"{self.url_base}/operatore/{identificativo}/controllo-iscrizione"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_siti(self, num_iscr):
        url = f"{self.url_base}/operatore/{num_iscr}/siti"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def post_operatore_registro(self, num_iscr_sito, attivita, descrizione=None, attivita_rec_smalt=None):
        url = f"{self.url_base}/operatore/registri"
        # Validazione payload secondo CreateRegistroRequest
        if not num_iscr_sito or not isinstance(num_iscr_sito, str):
            raise ValueError("num_iscr_sito obbligatorio e deve essere stringa")
        if not attivita or not isinstance(attivita, list) or not all(isinstance(a, str) for a in attivita):
            raise ValueError("attivita obbligatorio e deve essere lista di stringhe")
        body = {
            "num_iscr_sito": num_iscr_sito,
            "attivita": attivita
        }
        if descrizione:
            if not isinstance(descrizione, str):
                raise ValueError("descrizione deve essere stringa")
            body["descrizione"] = descrizione
        if attivita_rec_smalt:
            if not isinstance(attivita_rec_smalt, list) or not all(isinstance(a, str) for a in attivita_rec_smalt):
                raise ValueError("attivita_rec_smalt deve essere lista di stringhe")
            body["attivita_rec_smalt"] = attivita_rec_smalt
        body_json = json.dumps(body)
        headers = self._jwt_headers(body_json)
        resp = requests.post(url, headers=headers, data=body_json, timeout=self.timeout)
        return self._handle_response(resp)

    def get_status_anagrafica(self):
        url = f"{self.url_base}/anagrafiche/{self.api_version}/status"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_anagrafica_operatore(self, codice_fiscale):
        """Restituisce i dati dell'operatore dato il codice fiscale."""
        url = f"{self.url_base}/anagrafiche/{self.api_version}/operatore/{codice_fiscale}"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_anagrafica_sede(self, codice_fiscale, id_sede):
        """Restituisce i dati della sede dell'operatore."""
        url = f"{self.url_base}/anagrafiche/{self.api_version}/operatore/{codice_fiscale}/sede/{id_sede}"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_registro(self, id_registro):
        """Restituisce i dati di un registro."""
        url = f"{self.url_base}/registri/{self.api_version}/registro/{id_registro}"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_registri(self):
        """Restituisce l'elenco di tutti i registri associati all'operatore autenticato."""
        # Prova prima l'endpoint diretto
        url = f"{self.url_base}/registri/{self.api_version}/registro"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        status_code, data = self._handle_response(resp)
        
        # Se otteniamo 404, potrebbe essere che non ci sono registri
        # In questo caso restituiamo un array vuoto invece di errore
        if status_code == 404:
            return 200, {"data": [], "message": "Nessun registro trovato"}
            
        return status_code, data

    def post_registro(self, payload):
        """Crea un nuovo registro. Payload: dict conforme a OpenAPI."""
        url = f"{self.url_base}/registri/{self.api_version}/registro"
        body_json = json.dumps(payload)
        headers = self._jwt_headers(body_json)
        resp = requests.post(url, headers=headers, data=body_json, timeout=self.timeout)
        return self._handle_response(resp)

    def get_movimenti_registro(self, id_registro):
        """Restituisce i movimenti associati a un registro."""
        url = f"{self.url_base}/registri/{self.api_version}/registro/{id_registro}/movimenti"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_stampe_registro(self, id_registro):
        """Restituisce le stampe associate a un registro."""
        url = f"{self.url_base}/registri/{self.api_version}/registro/{id_registro}/stampe"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_stampa_registro(self, id_registro, id_stampa):
        """Restituisce una stampa specifica di un registro."""
        url = f"{self.url_base}/registri/{self.api_version}/registro/{id_registro}/stampe/{id_stampa}"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_movimento(self, id_movimento):
        """Restituisce i dati di un movimento."""
        url = f"{self.url_base}/movimenti/{self.api_version}/movimento/{id_movimento}"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def post_movimento(self, payload):
        """Crea un nuovo movimento. Payload: dict conforme a OpenAPI."""
        url = f"{self.url_base}/movimenti/{self.api_version}/movimento"
        body_json = json.dumps(payload)
        headers = self._jwt_headers(body_json)
        resp = requests.post(url, headers=headers, data=body_json, timeout=self.timeout)
        return self._handle_response(resp)

    def get_stampe_movimento(self, id_movimento):
        """Restituisce le stampe associate a un movimento."""
        url = f"{self.url_base}/movimenti/{self.api_version}/movimento/{id_movimento}/stampe"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_stampa_movimento(self, id_movimento, id_stampa):
        """Restituisce una stampa specifica di un movimento."""
        url = f"{self.url_base}/movimenti/{self.api_version}/movimento/{id_movimento}/stampe/{id_stampa}"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_fir(self, id_fir):
        """Restituisce i dati di un FIR."""
        url = f"{self.url_base}/fir/{self.api_version}/fir/{id_fir}"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)

    def get_fir_pdf(self, id_fir):
        """Restituisce il PDF di un FIR."""
        url = f"{self.url_base}/fir/{self.api_version}/fir/{id_fir}/pdf"
        headers = self._jwt_headers()
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        return self._handle_response(resp)
    
    def upload_documento(self, file_path, tipo_documento="allegato"):
        """Upload di un documento. Supporta file PDF, immagini, etc."""
        url = f"{self.url_base}/documenti/{self.api_version}/upload"
        
        try:
            with open(file_path, 'rb') as file:
                files = {'file': file}
                data = {'tipo': tipo_documento}
                headers = self._jwt_headers()
                headers.pop('Content-Type', None)  # Rimuove Content-Type per multipart
                
                resp = requests.post(url, files=files, data=data, headers=headers, timeout=self.timeout)
                return self._handle_response(resp)
        except FileNotFoundError:
            self.logger.error(f"File non trovato: {file_path}")
            return 404, {"error": "File not found"}
        except Exception as e:
            self.logger.error(f"Errore upload: {e}")
            return 500, {"error": str(e)}

    def _handle_response(self, resp):
        try:
            data = resp.json()
        except Exception as e:
            data = resp.text
            self.logger.debug(f"Response parsing error: {e}")
        
        if resp.status_code >= 400:
            self.logger.error(f"HTTP {resp.status_code} - {data}")
        
        return resp.status_code, data

if __name__ == "__main__":
    client = RentriClient(demo=False)  # Produzione
    # Test endpoint status anagrafica
    status, data = client.get_status_anagrafica() 