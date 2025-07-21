import os
import pdfplumber
import re
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
import json
from datetime import datetime
from pyzbar.pyzbar import decode as decode_qr

def estrai_testo_con_ocr(pdf_path, tesseract_path=None, poppler_path=None):
    if tesseract_path:
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
    immagini = convert_from_path(pdf_path, poppler_path=poppler_path)
    testo = ""
    for img in immagini:
        testo += pytesseract.image_to_string(img, lang='ita+eng') + "\n"
    return testo

def estrai_qrcode_da_pdf(pdf_path, poppler_path=None):
    immagini = convert_from_path(pdf_path, poppler_path=poppler_path)
    risultati = []
    for img in immagini:
        qr_codes = decode_qr(img)
        for qr in qr_codes:
            risultati.append(qr.data.decode('utf-8'))
    return risultati

def estrai_dati_fir(pdf_path, config=None):
    config = config or {}
    tesseract_path = config.get('TESSERACT_PATH')
    poppler_path = config.get('POPPLER_PATH')
    dati = {
        'numero_fir': None,
        'data': None,
        'cer': None,
        'quantita_kg': None,
        'trasportatore': None,
        'smaltitore': None,
        'qrcode': None
    }
    with pdfplumber.open(pdf_path) as pdf:
        testo = "\n".join(page.extract_text() or '' for page in pdf.pages)
    if not testo.strip():
        testo = estrai_testo_con_ocr(pdf_path, tesseract_path, poppler_path)
    m = re.search(r'emissione\|\s*([0-9]{2}/[0-9]{2}/[0-9]{4})\s*([A-Z0-9 ]{8,})', testo, re.IGNORECASE)
    if m:
        dati['data'] = m.group(1)
        dati['numero_fir'] = m.group(2).strip()
    else:
        m = re.search(r'([0-9]{2}/[0-9]{2}/[0-9]{4})\s*([A-Z0-9 ]{8,})', testo)
        if m:
            dati['data'] = m.group(1)
            dati['numero_fir'] = m.group(2).strip()
    m = re.search(r'Codice\s+E[ER]{2}\s*([0-9]{6,8}\*?)', testo)
    if m:
        dati['cer'] = m.group(1)
    m = re.search(r'Quantita\s*([0-9.,]+)', testo)
    if m:
        dati['quantita_kg'] = m.group(1).replace(',', '.')
    m = re.search(r'TRASPORTATORE\s*Denominazione\s*([A-Z0-9 .\-]+)', testo)
    if m:
        dati['trasportatore'] = m.group(1).strip()
    m = re.search(r'DESTINATARIO\s*Denominazione\s*([A-Z0-9 .\-]+)', testo)
    if m:
        dati['smaltitore'] = m.group(1).strip()
    qrcodes = estrai_qrcode_da_pdf(pdf_path, poppler_path)
    if qrcodes:
        dati['qrcode'] = qrcodes[0] if len(qrcodes) == 1 else qrcodes
    return dati

def estrai_tutti_i_fir(data_dir, config=None):
    config = config or {}
    registro_path = config.get('REGISTRO_PATH', os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'output', 'registro_fir.json')))
    def carica_registro():
        if os.path.exists(registro_path):
            try:
                with open(registro_path, 'r', encoding='utf-8') as f:
                    contenuto = f.read().strip()
                    if not contenuto:
                        return {}
                    return json.loads(contenuto)
            except Exception as e:
                print(f"[ATTENZIONE] Errore nel registro JSON: {e}. Verrà ricreato da zero.")
                return {}
        return {}
    def salva_registro(registro):
        with open(registro_path, 'w', encoding='utf-8') as f:
            json.dump(registro, f, ensure_ascii=False, indent=2)
    risultati = []
    registro = carica_registro()
    pdf_files = [f for f in os.listdir(data_dir) if f.lower().endswith('.pdf')]
    if not pdf_files:
        return risultati
    pdf_files.sort()
    for nome_file in pdf_files:
        if nome_file in registro:
            continue
        path = os.path.join(data_dir, nome_file)
        dati = estrai_dati_fir(path, config)
        if not dati.get('numero_fir'):
            continue
        risultati.append(dati)
        registro[nome_file] = {
            'data_elaborazione': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'dati_estratti': dati
        }
        salva_registro(registro)
    return risultati 