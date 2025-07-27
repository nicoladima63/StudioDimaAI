"""
Servizio per l'invio di email con ricette elettroniche
"""
import os
import smtplib
import base64
import logging
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from datetime import datetime
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Carica il file .env
load_dotenv()

logger = logging.getLogger(__name__)

class RicettaEmailService:
    """
    Servizio per inviare ricette elettroniche via email
    """
    
    def __init__(self):
        self._load_configuration()
    
    def _load_configuration(self):
        """Carica configurazione SMTP - SOLO da .env"""
        
        # DEBUG: Verifica lettura .env
        smtp_port_raw = os.getenv('SMTP_PORT')
        logger.info(f"DEBUG: SMTP_PORT dal .env = '{smtp_port_raw}' (type: {type(smtp_port_raw)})")
        
        # Configurazione SMTP - RICHIEDE .env configurato correttamente
        self.smtp_server = os.getenv('SMTP_SERVER')
        self.smtp_port = int(os.getenv('SMTP_PORT'))
        self.smtp_user = os.getenv('SMTP_USER')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.use_ssl = os.getenv('SMTP_SSL', 'false').lower() == 'true'
        self.use_tls = os.getenv('SMTP_TLS', 'false').lower() == 'true'
        
        # Email mittente
        self.from_email = os.getenv('FROM_EMAIL')
        self.from_name = os.getenv('FROM_NAME')
        
        # Validazioni obbligatorie
        if not all([self.smtp_server, self.smtp_port, self.smtp_user, self.from_email, self.from_name]):
            missing = [k for k, v in {
                'SMTP_SERVER': self.smtp_server,
                'SMTP_PORT': self.smtp_port, 
                'SMTP_USER': self.smtp_user,
                'FROM_EMAIL': self.from_email,
                'FROM_NAME': self.from_name
            }.items() if not v]
            raise ValueError(f"Configurazione email incompleta! Mancano nel .env: {', '.join(missing)}")
        
        if not self.smtp_password:
            logger.warning("SMTP_PASSWORD vuota - l'invio email potrebbe fallire")
        
        # Configurazione Brevo API
        self.brevo_api_key = os.getenv('BREVO_API_KEY', '')
        self.brevo_api_url = 'https://api.brevo.com/v3/smtp/email'
        self.use_brevo_api = os.getenv('USE_BREVO_API', 'false').lower() == 'true'
        
        if self.use_brevo_api:
            logger.info(f"Email service configurato con Brevo API")
            logger.info(f"From: {self.from_name} <{self.from_email}>")
        else:
            logger.info(f"Email service configurato: {self.smtp_server}:{self.smtp_port} (SSL: {self.use_ssl}, TLS: {self.use_tls})")
            logger.info(f"From: {self.from_name} <{self.from_email}>")
    
    def invia_ricetta_email(self, 
                           destinatario_email: str,
                           destinatario_nome: str,
                           ricetta_data: Dict[str, Any],
                           pdf_base64: str) -> Dict[str, Any]:
        """
        Invia ricetta elettronica via email
        
        Args:
            destinatario_email: Email del paziente
            destinatario_nome: Nome del paziente
            ricetta_data: Dati della ricetta (NRE, PIN, farmaco, etc.)
            pdf_base64: PDF della ricetta in base64
            
        Returns:
            Dict con risultato invio
        """
        try:
            logger.info(f"Invio ricetta via email a: {destinatario_email}")
            
            # Valida dati obbligatori
            if not destinatario_email or '@' not in destinatario_email:
                return {
                    'success': False,
                    'error': 'Email destinatario non valida'
                }
            
            if not pdf_base64:
                return {
                    'success': False,
                    'error': 'PDF ricetta mancante'
                }
            
            # Crea messaggio email
            msg = self._crea_messaggio_email(
                destinatario_email,
                destinatario_nome, 
                ricetta_data,
                pdf_base64
            )
            
            # Invia email
            if self.use_brevo_api:
                return self._invia_email_brevo(destinatario_email, destinatario_nome, ricetta_data, pdf_base64)
            else:
                return self._invia_email(msg, destinatario_email)
            
        except Exception as e:
            logger.error(f"Errore invio email ricetta: {e}")
            return {
                'success': False,
                'error': f'Errore invio email: {str(e)}'
            }
    
    def _crea_messaggio_email(self,
                             destinatario_email: str,
                             destinatario_nome: str,
                             ricetta_data: Dict[str, Any],
                             pdf_base64: str) -> MIMEMultipart:
        """Crea il messaggio email con allegato PDF"""
        
        # Crea messaggio multipart
        msg = MIMEMultipart()
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = destinatario_email
        msg['Subject'] = f"Ricetta Elettronica - NRE: {ricetta_data.get('nre', 'N/A')}"
        
        # Corpo del messaggio
        corpo_html = self._genera_corpo_email(destinatario_nome, ricetta_data)
        msg.attach(MIMEText(corpo_html, 'html'))
        
        # Allegato PDF
        try:
            pdf_bytes = base64.b64decode(pdf_base64)
            pdf_attachment = MIMEApplication(pdf_bytes, _subtype='pdf')
            
            nre = ricetta_data.get('nre', 'ricetta')
            filename = f"ricetta_elettronica_{nre}.pdf"
            pdf_attachment.add_header('Content-Disposition', 'attachment', filename=filename)
            
            msg.attach(pdf_attachment)
            logger.info(f"Allegato PDF creato: {filename} ({len(pdf_bytes)} bytes)")
            
        except Exception as e:
            logger.error(f"Errore creazione allegato PDF: {e}")
            raise
        
        return msg
    
    def _genera_corpo_email(self, destinatario_nome: str, ricetta_data: Dict[str, Any]) -> str:
        """Genera il corpo HTML dell'email"""
        
        nre = ricetta_data.get('nre', 'N/A')
        pin = ricetta_data.get('pin_ricetta', 'N/A')
        data_creazione = ricetta_data.get('data_inserimento', datetime.now().strftime('%d/%m/%Y %H:%M'))
        farmaco = ricetta_data.get('denominazione_farmaco', 'N/A')
        posologia = ricetta_data.get('posologia', 'N/A')
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
                .info-box {{ background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 10px 0; }}
                .highlight {{ color: #007bff; font-weight: bold; }}
                .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #6c757d; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>🏥 Studio Dr. Nicola Di Martino</h2>
                <h3>Ricetta Elettronica</h3>
            </div>
            
            <p>Gentile <strong>{destinatario_nome}</strong>,</p>
            
            <p>Le inviamo in allegato la Sua ricetta elettronica appena emessa.</p>
            
            <div class="info-box">
                <h4>📋 Dettagli Ricetta:</h4>
                <p><strong>NRE (Numero Ricetta Elettronica):</strong> <span class="highlight">{nre}</span></p>
                <p><strong>PIN Ricetta:</strong> <span class="highlight">{pin}</span></p>
                <p><strong>Data Emissione:</strong> {data_creazione}</p>
                <p><strong>Farmaco Prescritto:</strong> {farmaco}</p>
                <p><strong>Posologia:</strong> {posologia}</p>
            </div>
            
            <div class="info-box">
                <h4>💊 Come utilizzare la ricetta:</h4>
                <ul>
                    <li>Presenti il <strong>Codice PIN</strong> in farmacia insieme al Suo documento di identità</li>
                    <li>Il farmacista verificherà la ricetta nel sistema informatico</li>
                    <li>In alternativa può mostrare il PDF allegato stampato o dal telefono</li>
                </ul>
            </div>
            
            <div class="info-box">
                <h4>⚠️ Importante:</h4>
                <ul>
                    <li>Conservi questo messaggio per i Suoi archivi</li>
                    <li>Il PDF allegato contiene tutti i dettagli della prescrizione</li>
                    <li>Per eventuali chiarimenti, non esiti a contattarci</li>
                </ul>
            </div>
            
            <div class="footer">
                <p><strong>Studio Dr. Nicola Di Martino</strong><br>
                Via Michelangelo Buonarroti, 15 - 51031 Agliana (PT)<br>
                Tel: 0574 712060<br>
                Email: segreteria@studiodimartino.eu</p>
                
                <p><em>Questo messaggio è stato generato automaticamente dal sistema di ricette elettroniche.<br>
                La ricetta è valida secondo le normative del Sistema Tessera Sanitaria.</em></p>
            </div>
        </body>
        </html>
        """
    
    def _invia_email(self, msg: MIMEMultipart, destinatario: str) -> Dict[str, Any]:
        """Invia effettivamente l'email via SMTP Aruba"""
        
        try:
            # Connessione SMTP Aruba
            logger.info(f"Connessione a {self.smtp_server}:{self.smtp_port}")
            
            if self.use_ssl:
                # SSL sulla porta 465
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port)
                logger.info("Connessione SSL stabilita")
            else:
                # SMTP normale con TLS sulla porta 587 (configurazione Aruba standard)
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                if self.use_tls:
                    server.starttls()
                    logger.info("TLS abilitato")
            
            # Autenticazione
            if self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)
                logger.info("Autenticazione SMTP completata")
            else:
                logger.warning("Password SMTP non configurata - continuo senza autenticazione")
            
            # Invio
            text = msg.as_string()
            server.sendmail(self.from_email, destinatario, text)
            server.quit()
            
            logger.info(f"Email inviata con successo a: {destinatario}")
            
            return {
                'success': True,
                'message': f'Email inviata con successo a {destinatario}',
                'timestamp': datetime.now().isoformat()
            }
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"Errore autenticazione SMTP: {e}")
            return {
                'success': False,
                'error': 'Errore autenticazione email - verificare credenziali SMTP'
            }
            
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"Destinatario rifiutato: {e}")
            return {
                'success': False,
                'error': f'Indirizzo email destinatario non valido: {destinatario}'
            }
            
        except Exception as e:
            logger.error(f"Errore generico invio email: {e}")
            return {
                'success': False,
                'error': f'Errore invio email: {str(e)}'
            }
    
    def test_connessione(self) -> Dict[str, Any]:
        """Testa la connessione SMTP Aruba"""
        try:
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port)
            else:
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                if self.use_tls:
                    server.starttls()
            
            if self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)
            
            server.quit()
            
            return {
                'success': True,
                'message': 'Connessione SMTP Aruba OK'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Errore connessione SMTP: {str(e)}'
            }
    
    def _invia_email_brevo(self, destinatario_email: str, destinatario_nome: str, 
                          ricetta_data: Dict[str, Any], pdf_base64: str) -> Dict[str, Any]:
        """Invia email usando Brevo API invece di SMTP"""
        
        try:
            # Corpo HTML email
            corpo_html = self._genera_corpo_email(destinatario_nome, ricetta_data)
            
            # Payload Brevo API
            payload = {
                "sender": {
                    "name": self.from_name,
                    "email": self.from_email
                },
                "to": [
                    {
                        "email": destinatario_email,
                        "name": destinatario_nome
                    }
                ],
                "subject": f"Ricetta Elettronica - NRE: {ricetta_data.get('nre', 'N/A')}",
                "htmlContent": corpo_html,
                "attachment": [
                    {
                        "content": pdf_base64,
                        "name": f"ricetta_elettronica_{ricetta_data.get('nre', 'ricetta')}.pdf"
                    }
                ]
            }
            
            # Headers Brevo
            headers = {
                'accept': 'application/json',
                'api-key': self.brevo_api_key,
                'content-type': 'application/json'
            }
            
            # Invio richiesta
            logger.info(f"Invio email via Brevo API a: {destinatario_email}")
            
            response = requests.post(self.brevo_api_url, json=payload, headers=headers)
            
            if response.status_code == 201:
                logger.info(f"Email inviata con successo via Brevo a: {destinatario_email}")
                return {
                    'success': True,
                    'message': f'Email inviata con successo via Brevo a {destinatario_email}',
                    'timestamp': datetime.now().isoformat(),
                    'brevo_response': response.json()
                }
            else:
                logger.error(f"Errore Brevo API: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': f'Errore Brevo API: {response.status_code} - {response.text}'
                }
                
        except Exception as e:
            logger.error(f"Errore invio email Brevo: {e}")
            return {
                'success': False,
                'error': f'Errore Brevo: {str(e)}'
            }

# Istanza globale del servizio
ricetta_email_service = RicettaEmailService()