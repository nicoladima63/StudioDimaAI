import os
from imap_tools import MailBox, AND
from datetime import datetime

# Funzione adattata per essere importabile e configurabile

def scarica_fir_da_pec(config, mittente="formulari@pec.ecologiatrasporti.it", oggetto_keyword=None, max_email=20):
    """
    Cerca tutte le email dal mittente specificato e scarica gli allegati PDF.
    Restituisce la lista dei file PDF scaricati.
    """
    PEC_EMAIL = config.get('PEC_EMAIL')
    PEC_PASSWORD = config.get('PEC_PASSWORD')
    IMAP_SERVER = config.get('IMAP_SERVER')
    IMAP_PORT = int(config.get('IMAP_PORT', 993))
    DATA_DIR = config.get('DATA_DIR', os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data')))
    os.makedirs(DATA_DIR, exist_ok=True)
    pdf_files = []
    with MailBox(IMAP_SERVER).login(PEC_EMAIL, PEC_PASSWORD, 'INBOX') as mailbox:
        criteria = AND(from_=mittente) if mittente else None
        for msg in mailbox.fetch(criteria, reverse=True, limit=max_email):
            allegati = [att for att in msg.attachments if att.filename.lower().endswith('.pdf')]
            for att in allegati:
                data_mail = msg.date.strftime('%Y%m%d')
                fir_num = 'SENZA_NUMERO'
                if 'FIR' in msg.subject:
                    parti = msg.subject.split()
                    for i, p in enumerate(parti):
                        if p == 'FIR' and i+1 < len(parti):
                            fir_num = parti[i+1]
                nome_file = f"{data_mail}_FIR_{fir_num}.pdf"
                path_file = os.path.join(DATA_DIR, nome_file)
                with open(path_file, 'wb') as f:
                    f.write(att.payload)
                pdf_files.append(path_file)
    return pdf_files 