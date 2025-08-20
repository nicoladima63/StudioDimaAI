"""
SSL Manager per la gestione sicura dei certificati per la ricetta elettronica
"""
import os
import ssl
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography import x509

logger = logging.getLogger(__name__)

class SSLManager:
    """Gestisce certificati SSL/TLS per la ricetta elettronica"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self.certs_dir = self.project_root / "server_v2" / "certs"
        self._ssl_context_cache: Dict[str, ssl.SSLContext] = {}
        
    def get_environment(self) -> str:
        """Ottiene l'ambiente corrente (test/prod)"""
        try:
            # Prova a leggere da file di configurazione
            mode_file = self.project_root / "server" / "instance" / "ricetta_mode.txt"
            if mode_file.exists():
                return mode_file.read_text().strip().lower()
        except Exception:
            pass
        
        # Fallback a variabile ambiente
        return os.getenv('RICETTA_ENV', 'test').lower()
    
    def get_cert_paths(self, env: Optional[str] = None) -> Dict[str, Path]:
        """Ottiene i path dei certificati per l'ambiente specificato"""
        if env is None:
            env = self.get_environment()
            
        if env == 'test':
            return {
                'client_cert': self.certs_dir / "test" / "client_cert.pem",
                'client_key': self.certs_dir / "test" / "client_key.pem",
                'ca_cert': self.certs_dir / "test" / "ActalisCA.crt",
                'sanitel_cert': self.certs_dir / "test" / "SanitelCF-2024-2027.cer",
                'p12_cert': self.certs_dir / "test" / "TestSanitaMir.p12"
            }
        else:  # prod
            return {
                'client_cert': self.certs_dir / "prod" / "demservice.sanita.finanze.it_cert_2020.crt",
                'ca_cert': self.certs_dir / "prod" / "ActalisCA.crt",
                'p12_cert': self.certs_dir / "DMRNCL63S21D612I.p12"
            }
    
    def create_ssl_context(self, env: Optional[str] = None) -> ssl.SSLContext:
        """Crea un SSL context configurato per l'ambiente"""
        if env is None:
            env = self.get_environment()
            
        # Cache del context per evitare ricostruzioni
        cache_key = f"ssl_context_{env}"
        if cache_key in self._ssl_context_cache:
            return self._ssl_context_cache[cache_key]
        
        try:
            # Crea SSL context con protocollo appropriato
            context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
            
            # Configurazioni per compatibilità con Sistema TS
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE  # Il Sistema TS ha certificati particolari
            
            # Per ambiente test, configurazioni più permissive
            if env == 'test':
                context.set_ciphers('DEFAULT:@SECLEVEL=1')
                context.options |= ssl.OP_LEGACY_SERVER_CONNECT
            
            cert_paths = self.get_cert_paths(env)
            
            # Carica certificati se disponibili
            if env == 'test' and cert_paths['client_cert'].exists() and cert_paths['client_key'].exists():
                context.load_cert_chain(
                    str(cert_paths['client_cert']),
                    str(cert_paths['client_key'])
                )
                logger.info(f"Certificati client caricati per ambiente {env}")
            
            # Carica CA se disponibile
            if cert_paths['ca_cert'].exists():
                context.load_verify_locations(str(cert_paths['ca_cert']))
                logger.info(f"CA certificate caricato per ambiente {env}")
            
            self._ssl_context_cache[cache_key] = context
            return context
            
        except Exception as e:
            logger.error(f"Errore creazione SSL context per {env}: {e}")
            # Fallback a context di base
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            return context
    
    def load_p12_certificate(self, password: str, env: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Carica certificato P12 e ne estrae i componenti"""
        if env is None:
            env = self.get_environment()
            
        cert_paths = self.get_cert_paths(env)
        p12_path = cert_paths['p12_cert']
        
        if not p12_path.exists():
            logger.warning(f"Certificato P12 non trovato: {p12_path}")
            return None
            
        try:
            with open(p12_path, 'rb') as f:
                p12_data = f.read()
            
            # Decodifica P12
            private_key, certificate, additional_certificates = pkcs12.load_key_and_certificates(
                p12_data, password.encode()
            )
            
            return {
                'private_key': private_key,
                'certificate': certificate,
                'additional_certificates': additional_certificates,
                'subject': certificate.subject.rfc4514_string() if certificate else None,
                'issuer': certificate.issuer.rfc4514_string() if certificate else None,
                'serial_number': str(certificate.serial_number) if certificate else None
            }
            
        except Exception as e:
            logger.error(f"Errore caricamento certificato P12: {e}")
            return None
    
    def validate_certificates(self, env: Optional[str] = None) -> Dict[str, bool]:
        """Valida la presenza e validità dei certificati"""
        if env is None:
            env = self.get_environment()
            
        cert_paths = self.get_cert_paths(env)
        validation_results = {}
        
        for cert_name, cert_path in cert_paths.items():
            try:
                exists = cert_path.exists()
                validation_results[cert_name] = exists
                
                if exists and cert_name.endswith('_cert'):
                    # Verifica validità certificato
                    try:
                        with open(cert_path, 'rb') as f:
                            if cert_path.suffix == '.pem':
                                cert_data = f.read()
                                cert = x509.load_pem_x509_certificate(cert_data)
                            elif cert_path.suffix in ['.crt', '.cer']:
                                cert_data = f.read()
                                try:
                                    cert = x509.load_pem_x509_certificate(cert_data)
                                except:
                                    cert = x509.load_der_x509_certificate(cert_data)
                            
                            # Verifica scadenza
                            from datetime import datetime, timezone
                            now = datetime.now(timezone.utc)
                            is_valid = cert.not_valid_before <= now <= cert.not_valid_after
                            validation_results[f"{cert_name}_valid"] = is_valid
                            
                    except Exception as e:
                        logger.warning(f"Errore validazione {cert_name}: {e}")
                        validation_results[f"{cert_name}_valid"] = False
                        
            except Exception as e:
                logger.error(f"Errore controllo {cert_name}: {e}")
                validation_results[cert_name] = False
        
        return validation_results
    
    def get_environment_config(self, env: Optional[str] = None) -> Dict[str, Any]:
        """Ottiene configurazione completa per l'ambiente"""
        if env is None:
            env = self.get_environment()
            
        if env == 'test':
            return {
                'environment': 'test',
                'endpoints': {
                    'invio': 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca',
                    'visualizza': 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca',
                    'annulla': 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
                },
                'credentials': {
                    'cf_medico': os.getenv('CF_MEDICO_TEST', 'PROVAX00X00X000Y'),
                    'password': os.getenv('PASSWORD_TEST', 'Salve123'),
                    'pincode': os.getenv('PINCODE_TEST', '1234567890'),
                    'regione': os.getenv('REGIONE_TEST', '020')
                }
            }
        else:  # prod
            return {
                'environment': 'prod',
                'endpoints': {
                    'invio': 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca',
                    'visualizza': 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca',
                    'annulla': 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
                },
                'credentials': {
                    'cf_medico': os.getenv('CF_MEDICO_PROD'),
                    'password': os.getenv('PASSWORD_PROD'),
                    'pincode': os.getenv('PINCODE_PROD'),
                    'regione': os.getenv('REGIONE_PROD', '020')
                }
            }

# Instance globale
ssl_manager = SSLManager()