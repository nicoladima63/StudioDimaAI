"""
Helper per gestire connessioni SSL legacy con certificati MD5/SHA1
Usa subprocess per aggirare le limitazioni di Python 3.12
"""
import subprocess
import json
import tempfile
import os
import logging

logger = logging.getLogger(__name__)

def create_curl_request(url: str, xml_data: str, username: str, password: str, 
                       cert_path: str = None, key_path: str = None) -> dict:
    """
    Usa curl per inviare richieste SOAP aggirando i problemi SSL di Python
    """
    try:
        # Crea file temporaneo per i dati XML
        with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as f:
            f.write(xml_data)
            xml_file = f.name
        
        # Comando curl base
        curl_cmd = [
            'curl',
            '-X', 'POST',
            '-H', 'Content-Type: text/xml; charset=utf-8',
            '-H', 'SOAPAction: invioRicettaBiancaPrescritto',
            '-H', 'Accept: text/xml',
            '-u', f'{username}:{password}',
            '--data-binary', f'@{xml_file}',
            '--insecure',  # Ignora errori SSL
            '--connect-timeout', '30',
            '--max-time', '60',
            '--silent',
            '--show-error',
            '--write-out', 'HTTPCODE:%{http_code}\\n',
            url
        ]
        
        # Aggiungi certificati client se forniti
        if cert_path and key_path and os.path.exists(cert_path) and os.path.exists(key_path):
            curl_cmd.extend(['--cert', cert_path, '--key', key_path])
            logger.info(f"Certificati SSL aggiunti a curl")
        
        logger.info(f"Eseguendo curl: {' '.join(curl_cmd[:5])}...")
        
        # Esegui curl
        result = subprocess.run(
            curl_cmd,
            capture_output=True,
            text=True,
            timeout=90
        )
        
        # Pulisci file temporaneo
        os.unlink(xml_file)
        
        # Analizza output
        output = result.stdout
        error = result.stderr
        
        # Estrai codice HTTP
        http_code = 0
        response_body = output
        
        if 'HTTPCODE:' in output:
            lines = output.split('\\n')
            for line in lines:
                if line.startswith('HTTPCODE:'):
                    http_code = int(line.split(':')[1])
                    response_body = output.replace(line, '').replace('\\n', '\n')
                    break
        
        return {
            'success': result.returncode == 0,
            'http_code': http_code,
            'response_body': response_body,
            'error': error,
            'curl_return_code': result.returncode
        }
        
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'error': 'Timeout - Il server ha impiegato troppo tempo a rispondere',
            'http_code': 0
        }
    except FileNotFoundError:
        return {
            'success': False,
            'error': 'curl non trovato. Installa curl per Windows o usa il fallback Python',
            'http_code': 0
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Errore nell\'esecuzione di curl: {str(e)}',
            'http_code': 0
        }

def fallback_python_request(url: str, xml_data: str, username: str, password: str,
                           cert_path: str = None, key_path: str = None) -> dict:
    """
    Fallback usando Python con configurazione SSL molto permissiva
    """
    try:
        import ssl
        import urllib3
        import requests
        from requests.adapters import HTTPAdapter
        
        # Disabilita warnings
        urllib3.disable_warnings()
        
        # Configurazione SSL legacy estrema
        class UltraLegacyAdapter(HTTPAdapter):
            def init_poolmanager(self, *args, **kwargs):
                # Prova tutte le configurazioni possibili
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                
                # Security level 0 - accetta tutto
                try:
                    context.set_ciphers('ALL:@SECLEVEL=0')
                except:
                    context.set_ciphers('ALL')
                
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                
                # Tutte le opzioni legacy possibili
                context.options |= ssl.OP_LEGACY_SERVER_CONNECT
                if hasattr(ssl, 'OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION'):
                    context.options |= ssl.OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION
                if hasattr(ssl, 'OP_DONT_INSERT_EMPTY_FRAGMENTS'):
                    context.options |= ssl.OP_DONT_INSERT_EMPTY_FRAGMENTS
                
                kwargs['ssl_context'] = context
                return super().init_poolmanager(*args, **kwargs)
        
        # Modifica variabili ambiente per questa sessione
        old_env = os.environ.copy()
        os.environ['PYTHONHTTPSVERIFY'] = '0'
        os.environ['CURL_CA_BUNDLE'] = ''
        os.environ['REQUESTS_CA_BUNDLE'] = ''
        
        try:
            session = requests.Session()
            session.mount('https://', UltraLegacyAdapter())
            session.auth = (username, password)
            session.verify = False
            
            if cert_path and key_path:
                session.cert = (cert_path, key_path)
            
            headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'invioRicettaBiancaPrescritto',
                'Accept': 'text/xml',
                'User-Agent': 'RicettaElettronica/1.0',
                'Connection': 'close'
            }
            
            response = session.post(
                url,
                data=xml_data.encode('utf-8'),
                headers=headers,
                timeout=30
            )
            
            return {
                'success': True,
                'http_code': response.status_code,
                'response_body': response.text,
                'error': None
            }
            
        finally:
            # Ripristina environment
            os.environ.clear()
            os.environ.update(old_env)
            
    except Exception as e:
        return {
            'success': False,
            'http_code': 0,
            'error': f'Errore Python fallback: {str(e)}',
            'response_body': ''
        }

def send_soap_request(url: str, xml_data: str, username: str, password: str,
                     cert_path: str = None, key_path: str = None) -> dict:
    """
    Invia richiesta SOAP usando il metodo più compatibile disponibile
    """
    logger.info("Tentativo invio SOAP con metodi legacy SSL")
    
    # Prova prima con curl (più affidabile per SSL legacy)
    result = create_curl_request(url, xml_data, username, password, cert_path, key_path)
    
    if result['success'] or result.get('http_code', 0) > 0:
        logger.info(f"Curl riuscito: HTTP {result.get('http_code', 0)}")
        return result
    
    logger.warning("Curl fallito, provo con Python fallback")
    
    # Fallback Python
    result = fallback_python_request(url, xml_data, username, password, cert_path, key_path)
    
    if result['success']:
        logger.info(f"Python fallback riuscito: HTTP {result.get('http_code', 0)}")
    else:
        logger.error(f"Tutti i metodi falliti: {result.get('error', 'Errore sconosciuto')}")
    
    return result