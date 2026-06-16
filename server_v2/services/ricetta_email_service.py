"""
Servizio per l'invio via email del PDF promemoria della ricetta elettronica al paziente.
Usa le credenziali SMTP Aruba gia' configurate in .env (SMTP_HOST/SMTP_USER/SMTP_PASS).
"""
import os
import base64
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

logger = logging.getLogger(__name__)


def invia_pdf_ricetta_email(email_paziente: str, nome_paziente: str, pdf_base64: str, nre: str = None) -> None:
    """Invia il PDF promemoria della ricetta elettronica via email al paziente.

    Solleva ValueError se la configurazione SMTP e' incompleta o i parametri sono invalidi.
    """
    smtp_host = os.getenv('SMTP_HOST')
    smtp_port = int(os.getenv('SMTP_PORT', '465'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')
    smtp_from = os.getenv('SMTP_FROM', smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass]):
        raise ValueError("Configurazione SMTP incompleta nel file .env")
    if not email_paziente or not pdf_base64:
        raise ValueError("Email paziente e PDF sono obbligatori")

    msg = MIMEMultipart()
    msg['From'] = smtp_from
    msg['To'] = email_paziente
    msg['Subject'] = f"Ricetta elettronica{f' - NRE {nre}' if nre else ''}"

    corpo = (
        f"Gentile {nome_paziente},\n\n"
        "in allegato trova il promemoria della ricetta elettronica.\n\n"
        "Cordiali saluti"
    )
    msg.attach(MIMEText(corpo, 'plain'))

    pdf_bytes = base64.b64decode(pdf_base64)
    allegato = MIMEBase('application', 'pdf')
    allegato.set_payload(pdf_bytes)
    encoders.encode_base64(allegato)
    nome_file = f"ricetta_{nre}.pdf" if nre else "ricetta_promemoria.pdf"
    allegato.add_header('Content-Disposition', f'attachment; filename="{nome_file}"')
    msg.attach(allegato)

    with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [email_paziente], msg.as_string())

    logger.info(f"Email ricetta inviata a {email_paziente} (NRE: {nre})")
