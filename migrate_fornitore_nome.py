import sqlite3
import requests
import json

# Mappa fornitori dal JSON che hai fornito
FORNITORI_MAP = {
    "ZZZZZZ": "UMBRA SPA",
    "ZZZZZP": "DELTA TRE ELABORAZIONI SNC", 
    "ZZZZZO": "Dentsply Sirona Italia Srl",
    "ZZZZZN": "BNP PARIBAS LEASING SOLUTIONS SPA",
    "ZZZZZM": "Wind Tre S.p.A.",
    "ZZZZZL": "Enel Energia SpA",
    "ZZZZZK": "BNP PARIBAS LEASE GROUP SA",
    "ZZZZZJ": "C.R.T. srl",
    "ZZZZZI": "VODAFONE ITALIA S.p.A.",
    "ZZZZZH": "PRONTOPRO SRL",
    "ZZZZZG": "Publiacqua S.p.A.",
    "ZZZZZF": "HENRY SCHEIN KRUGG S.R.L",
    "ZZZZZE": "Aruba S.p.A.",
    "ZZZZZD": "BASICO S.R.L.",
    "ZZZZZC": "TEKHNE' s.r.l.",
    "ZZZZZB": "TIM  S.p.A.",
    "ZZZZYP": "NEXI PAYMENTS S.p.A.",
    "ZZZZYO": "Cei Francesco",
    "ZZZZYN": "FUTURIMPLANT1 SRL UNIPERSONALE",
    "ZZZZYM": "Dr. Fabio Marchi",
    "ZZZZYL": "Biomax Spa",
    "ZZZZYK": "ECOLOGIA TRASPORTI SAS",
    "ZZZZYJ": "RITA  NANNINI",
    "ZZZZYI": "ARTIGIANO - ASSOCIAZIONE CULTURALE",
    "ZZZZYH": "Hotel Gril Padova Srl",
    "ZZZZYG": "MV CONGRESSI SPA",
    "ZZZZYF": "ACCADEMIA TECNICHE NUOVE SRL",
    "ZZZZYE": "ITALIANA HOTELS AND RESORT SRL",
    "ZZZZYD": "TECNOFLORENCE DI MANETTI ROBERTO E",
    "ZZZZYC": "FARM.SAN NICCOLO' DR.NATALI E.",
    "ZZZZYB": "Tecniche Nuove SpA",
    "ZZZZXP": "Dr. Giacomo D'Orlandi Odontoiatra",
    "ZZZZXO": "ALKIMISIA",
    "ZZZZXN": "HOTEL_LE_MURA residence s.r.l",
    "ZZZZXM": "JOLLY ESTINTORI S.R.L. UNIPERSONALE",
    "ZZZZXL": "BRICOMAN ITALIA S.R.L. SOCIETA' A S",
    "ZZZZXK": "Laboratorio Odontotecnico Riccomini",
    "ZZZZXJ": "Armandi Lara",
    "ZZZZXI": "Cipriani Elisabetta Tabacchi",
    "ZZZZXH": "EDRA S.P.A.",
    "ZZZZXG": "Laboratorio Odontotecnico ORTHO-T d",
    "ZZZZXF": "BLUDENTAL DI RUGA FRANCESCO",
    "ZZZZXE": "VITALEX HC S.R.L.",
    "ZZZZXD": "TUEOR SERVIZI SRL",
    "ZZZZXC": "Lab.Odontotecnico ROBERTO MORELLI",
    "ZZZZXB": "SWEDEN & MARTINA S.p.A.",
    "ZZZZWO": "CAMPOPIANO GIOVANNI",
    "ZZZZWN": "Web Service Internet Solutions S.r.",
    "ZZZZWM": "Pixartprinting SpA",
    "ZZZZWL": "Leroy Merlin Italia srl",
    "ZZZZWK": "FARMAKON WELLCARE S.R.L. CON UNICO",
    "ZZZZWJ": "DE CERTO MAURO",
    "ZZZZWI": "J DENTAL CARE SRL",
    "ZZZZWH": "COMPASS BANCA SPA",
    "ZZZZWG": "DANIMATIC DI CIAFRO DANIELA",
    "ZZZZWF": "PERUZZI IACOPO",
    "ZZZZWE": "DENTALCOMM S.R.L.",
    "ZZZZWD": "United Parcel Service Italia S.r.l.",
    "ZZZZWC": "Quaderno Elettronico srl",
    "ZZZZWB": "Roberto Dott. Calvisi",
    "ZZZZVN": "ABI.SAN DI FONDACCI SONIA",
    "ZZZZVM": "Thermocalor di Luperto Aldo",
    "ZZZZVL": "alia spa",
    "ZZZZVK": "OLIVIERI GIUSEPPE",
    "ZZZZVJ": "IDS SpA",
    "ZZZZVI": "MEF S.R.L.",
    "ZZZZVH": "BINI PERLA Alimentari Tabacchi",
    "ZZZZVG": "MICERIUM SPA",
    "ZZZZVF": "ZIMMER DENTAL ITALY S.R.L",
    "ZZZZVE": "Metro Italia Cash and Carry S.p.A",
    "ZZZZVD": "BUREAU VERITAS ITALIA Spa",
    "ZZZZVC": "EMPIRE POWERGAS & MOBILITY S.R.L.",
    "ZZZZVB": "Amazon EU S.à r.l., Succursale Ital",
    "ZZZZUR": "FLORENCE HEALTH GROUP s.r.l.",
    "ZZZZUO": "Telepass spa",
    "ZZZZUN": "Autostrade per l'Italia",
    "ZZZZUM": "GENERAL OFFICE S.R.L.",
    "ZZZZUL": "PiErre Service srl Socio Unico",
    "ZZZZUH": "ITALTRADING S.R.L.",
    "ZZZZUG": "Aiesi Hospital Service s.a.s.",
    "ZZZZUF": "ORTHO-T S.A.S. DI TOMMASO ROSSI & C",
    "ZZZZUD": "Odontosan di Bellini Lucia",
    "ZZZZUC": "Jablonsky Anet",
    "ZZZZUB": "INFOCERT S.p.A.",
    "ZZZZTP": "GOLDEN GRAPHIC di Luca Coppola",
    "ZZZZTO": "Dvg Commerce S.r.l.",
    "ZZZZTJ": "Protesitalia SRLs",
    "ZZZZTI": "Ordine dei Medici Firenze",
    "ZZZZTH": "Corpo Musicale Giuseppe Verdi",
    "ZZZZTG": "Societa' Pubblicita' Editoriale e D",
    "ZZZZTF": "NIKOLAOS 2.1 S.R.L.S.",
    "ZZZZTE": "LINDBERGH HOTELS S.R.L.",
    "ZZZZTD": "Vitruvia srls",
    "ZZZZTC": "Think functional s.a.s",
    "ZZZZTB": "HP Italy S.r.l.",
    "ZZZZSQ": "IT FLOW di Buono Antonio",
    "ZZZZSP": "DILC Srl",
    "ZZZZSO": "AZIENDA AGRICOLA MALOURA DI OTTAVIA",
    "ZZZZSN": "Yes Hotels Srl",
    "ZZZZSM": "Pacoprint srl",
    "ZZZZSL": "H.C.A. S.R.L.S.",
    "ZZZZSK": "S.I.D.AL. SRL",
    "ZZZZSJ": "FASTWEB SpA",
    "ZZZZSI": "COCO DI CHEN MIN",
    "ZZZZSH": "CGM XDent Software Srl",
    "ZZZZSG": "HOTEL BUTTERFLY D KARMA S.R.L.S.",
    "ZZZZSF": "VI.VI.MED SRL",
    "ZZZZSE": "FORINI SPA",
    "ZZZZSD": "ERAS SRL",
    "ZZZZSC": "DNA SRL",
    "ZZZZSB": "FARMACIA SAN MICHELE SAS DEI DOTT.",
    "ZZZZRO": "BRI-GE BRIANZA GESTIONI S.R.L.",
    "ZZZZRN": "Dental Zenith s.n.c. di D. Grossi e",
    "ZZZZRM": "AMERICAN ORTHODONTIC LABORATORY SRL",
    "ZZZZRL": "PISANTE ROSSELLA",
    "ZZZZRK": "REVELLO SPA",
    "ZZZZRJ": "PISTOIA DISTRIBUZIONE ESPRESSA S.R.",
    "ZZZZRI": "HT s.r.l.",
    "ZZZZRH": "Biaggini Medical Devices s.r.l.",
    "ZZZZRG": "DELUXE SRL",
    "ZZZZRF": "GHALIM HASSAN",
    "ZZZZRE": "TITANIUM COMPONENT SAS",
    "ZZZZRD": "COLLINI SNC di Collini M. & F.",
    "ZZZZRC": "INTECH S.R.L.",
    "ZZZZRB": "P.S.P. SRL",
    "ZZZZQP": "Straumann Italia Srl",
    "ZZZZQN": "RIPARATUTTO DI MAURO VINCENZO S.R.L",
    "ZZZZQJ": "Health Coaching Academy Co. UK Ltd",
    "ZZZZQI": "OFFICINA srls",
    "ZZZZQH": "IL GALLO NERO SOCIETA' A RESPONSABI",
    "ZZZZQG": "I.D.I. Evolution S.r.l."
}

def migrate_fornitore_nome():
    db_path = 'server/instance/studio_dima.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Reset nomi precedenti
        cursor.execute("UPDATE classificazioni_costi SET fornitore_nome = NULL WHERE tipo_entita = 'fornitore'")
        print("Reset nomi precedenti")
        
        # Aggiorna con nomi reali
        updated = 0
        for codice, nome in FORNITORI_MAP.items():
            cursor.execute('''
                UPDATE classificazioni_costi 
                SET fornitore_nome = ? 
                WHERE codice_riferimento = ? AND tipo_entita = 'fornitore'
            ''', (nome, codice))
            if cursor.rowcount > 0:
                updated += cursor.rowcount
                print(f"{codice} -> {nome}")
        
        conn.commit()
        print(f"Aggiornati {updated} fornitori con nomi reali")
        return True
        
    except Exception as e:
        print(f"Errore: {e}")
        return False
        
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    migrate_fornitore_nome()