import xml.etree.ElementTree as ET
from base64 import b64decode

def parse_ricetta_bianca(xml_string: str) -> dict:
    """
    Estrae i campi principali e decodifica il PDF (base64) da una risposta SOAP
    di VisualizzaPrescrittoRicettaBiancaRicevuta.
    """
    ns = {
        'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
        'vpr': 'http://visualizzaprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it'
    }
    root = ET.fromstring(xml_string)
    body = root.find('soap:Body', ns)
    ricetta = body.find('vpr:VisualizzaPrescrittoRicettaBiancaRicevuta', ns)

    # helper
    def val(tag):
        el = ricetta.find(f'vpr:{tag}', ns)
        return el.text if el is not None else None

    # campi di interesse
    data = {
        "protocollo": val('protocolloTransazione'),
        "data_ricezione": val('dataRicezione'),
        "cf_medico": val('cfMedico'),
        "nome_medico": val('nomeMedico'),
        "cognome_medico": val('cognomeMedico'),
        "specialita": val('specialClinica'),
        "nrbe": val('nrbe'),
        "pin_nrbe": val('pinNrbe'),
        "tipo_prescrizione": val('tipoPrescrizione'),
        "data_compilazione": val('dataCompilazione'),
        "stato_processo": val('statoProcesso'),
        "cod_esito": val('codEsitoVisualizzazione'),
        "pdf_bytes": None,
        "dettaglio_prescrizione": {}
    }

    # dettaglio farmaco
    dett = ricetta.find('vpr:dettaglioPrescrizioneRicettaBianca', ns)
    if dett is not None:
        data["dettaglio_prescrizione"] = {
            "cod_gruppo": (dett.findtext('codGruppoEquival') or '').strip(),
            "descr_gruppo": (dett.findtext('descrGruppoEquival') or '').strip(),
            "quantita": dett.findtext('quantita'),
            "posologia": dett.findtext('posologia'),
            "durata": dett.findtext('durataTrattamento'),
            "num_ripetibilita": dett.findtext('numRipetibilita'),
            "validita_farm": dett.findtext('validitaFarm')
        }

    # pdf base64 → bytes e mantieni anche il base64 originale
    pdf_b64 = val('pdfPromemoria')
    if pdf_b64:
        data["pdf_base64"] = pdf_b64  # Base64 originale come stringa
        data["pdf_bytes"] = b64decode(pdf_b64)  # Decodificato in bytes

    return data
