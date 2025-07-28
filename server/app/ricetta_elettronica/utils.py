import json
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

BASE_PATH = Path(__file__).resolve().parent / "data"

def load_json_file(filename):
    file_path = BASE_PATH / filename
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def cerca_diagnosi(query: str):
    """
    Cerca diagnosi supportando sia ICD9 che ICD10 per il Sistema TS
    """
    # Prima cerca nelle diagnosi ICD10 (prioritarie per Sistema TS)
    try:
        data_aic = load_json_file("farmaci_aic_validi.json")
        risultati = []
        query_lower = query.lower()
        
        # Cerca nelle diagnosi ICD10
        for codice, item in data_aic.get("diagnosi_odontoiatriche_icd10", {}).items():
            if (query_lower in item["descrizione"].lower() or 
                query_lower in codice.lower()):
                risultati.append({
                    "codice": codice,
                    "descrizione": item["descrizione"]
                })
        
        # Se abbiamo risultati ICD10, li restituiamo (prioritari)
        if risultati:
            return risultati
            
    except Exception as e:
        logger.error(f"Errore nel caricamento diagnosi ICD10: {e}")
    
    # Fallback ai dati ICD9 originali
    data = load_json_file("icd9_odontoiatria.json")
    risultati = []
    query_lower = query.lower()
    for codice, item in data.items():
        # Cerca nella descrizione principale
        if query_lower in item["descrizione"].lower() or query in codice:
            risultati.append({"codice": codice, "descrizione": item["descrizione"]})
        # Cerca nei sottocodici
        for sub_codice, sub_descr in item.get("sottocodici", {}).items():
            if query_lower in sub_descr.lower() or query in sub_codice:
                risultati.append({"codice": sub_codice, "descrizione": sub_descr})
    return risultati

def cerca_farmaci(query: str):
    """
    Cerca farmaci nei dati con codici AIC validi per il Sistema TS
    """
    # Prima cerca nei dati AIC validi
    try:
        data_aic = load_json_file("farmaci_aic_validi.json")
        risultati = []
        query_lower = query.lower()
        
        # Cerca nei farmaci sicuri con codici AIC
        for categoria, farmaci_lista in data_aic.get("farmaci_sicuri", {}).items():
            if query_lower in categoria:
                # Aggiungi tutti i farmaci della categoria
                for farmaco in farmaci_lista:
                    risultati.append({
                        "codice": farmaco["codice_aic"],
                        "principio_attivo": farmaco["principio_attivo"],
                        "descrizione": farmaco["nome_commerciale"]
                    })
            else:
                # Cerca in ogni farmaco
                for farmaco in farmaci_lista:
                    if (query_lower in farmaco["principio_attivo"].lower() or
                        query_lower in farmaco["nome_commerciale"].lower() or
                        query in farmaco["codice_aic"]):
                        risultati.append({
                            "codice": farmaco["codice_aic"],
                            "principio_attivo": farmaco["principio_attivo"],
                            "descrizione": farmaco["nome_commerciale"]
                        })
        
        # Se abbiamo risultati AIC, li restituiamo (prioritari)
        if risultati:
            return risultati
            
    except Exception as e:
        logger.error(f"Errore nel caricamento farmaci AIC: {e}")
    
    # Fallback ai dati ATC originali
    data = load_json_file("atc_farmaci.json")
    risultati = []
    query_lower = query.lower()
    for codice_macro, macro in data.items():
        # Cerca nella descrizione macro
        if query_lower in macro["descrizione"].lower() or query in codice_macro:
            risultati.append({
                "codice": codice_macro,
                "principio_attivo": "",
                "descrizione": macro["descrizione"]
            })
        for codice_gruppo, gruppo in macro.get("gruppi_rilevanti", {}).items():
            # Cerca nel nome del gruppo
            if query_lower in gruppo["nome"].lower() or query in codice_gruppo:
                risultati.append({
                    "codice": codice_gruppo,
                    "principio_attivo": "",
                    "descrizione": gruppo["nome"]
                })
            for codice_pa, pa_nome in gruppo.get("principi_attivi", {}).items():
                if query_lower in pa_nome.lower() or query in codice_pa:
                    risultati.append({
                        "codice": codice_pa,
                        "principio_attivo": pa_nome,
                        "descrizione": gruppo["nome"]
                    })
    return risultati

def get_protocolli_terapeutici():
    """
    Restituisce tutti i protocolli terapeutici disponibili
    """
    try:
        return load_json_file("protocolli_terapeutici.json")
    except Exception as e:
        logger.error(f"Errore nel caricamento protocolli: {e}")
        return {}

def get_diagnosi_disponibili():
    """
    Restituisce lista delle diagnosi con farmaci associati
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        diagnosi = []
        
        for protocollo_id, protocollo in data.get("protocolli_odontoiatrici", {}).items():
            diagnosi.append({
                "id": protocollo_id,
                "codice": protocollo["diagnosi"]["codice"],
                "descrizione": protocollo["diagnosi"]["descrizione"],
                "num_farmaci": len(protocollo["farmaci_raccomandati"])
            })
        
        return diagnosi
    except Exception as e:
        logger.error(f"Errore nel caricamento diagnosi: {e}")
        return []

def get_farmaci_per_diagnosi(diagnosi_id: str):
    """
    Restituisce farmaci raccomandati per una diagnosi specifica
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        protocollo = data.get("protocolli_odontoiatrici", {}).get(diagnosi_id)
        
        if not protocollo:
            return []
        
        farmaci = []
        for farmaco_data in protocollo["farmaci_raccomandati"]:
            farmaco = farmaco_data["farmaco"]
            posologie = farmaco_data["posologie_standard"]
            
            # Trova posologia di default
            posologia_default = next(
                (p for p in posologie if p.get("default")), 
                posologie[0] if posologie else {}
            )
            
            farmaci.append({
                "codice": farmaco["codice"],
                "nome": farmaco["nome"],
                "principio_attivo": farmaco["principio_attivo"],
                "classe": farmaco["classe"],
                "posologia_default": posologia_default.get("posologia", ""),
                "durata_default": posologia_default.get("durata", ""),
                "note_default": posologia_default.get("note", ""),
                "posologie_alternative": [
                    {
                        "posologia": p["posologia"],
                        "durata": p["durata"],
                        "note": p["note"]
                    } for p in posologie
                ]
            })
        
        return farmaci
    except Exception as e:
        logger.error(f"Errore nel caricamento farmaci per diagnosi: {e}")
        return []

def get_posologie_per_farmaco(principio_attivo: str):
    """
    Restituisce posologie standard per un principio attivo
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        posologie_map = data.get("posologie_personalizzabili", {})
        
        # Trova il principio attivo (case insensitive)
        for key, posologie in posologie_map.items():
            if key.lower() in principio_attivo.lower():
                return posologie
        
        return []
    except Exception as e:
        logger.error(f"Errore nel caricamento posologie: {e}")
        return []

def get_durate_standard():
    """
    Restituisce durate di terapia standard
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        return data.get("durate_standard", [])
    except Exception as e:
        logger.error(f"Errore nel caricamento durate: {e}")
        return []

def get_note_frequenti():
    """
    Restituisce note di prescrizione frequenti
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        return data.get("note_frequenti", [])
    except Exception as e:
        logger.error(f"Errore nel caricamento note: {e}")
        return []

def save_protocolli_terapeutici(data):
    """
    Salva i protocolli terapeutici nel file JSON
    """
    try:
        file_path = BASE_PATH / "protocolli_terapeutici.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": "Protocolli salvati con successo"}
    except Exception as e:
        logger.error(f"Errore nel salvataggio protocolli: {e}")
        return {"success": False, "error": str(e)}

def add_diagnosi(diagnosi_data):
    """
    Aggiunge una nuova diagnosi ai protocolli
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        
        if "protocolli_odontoiatrici" not in data:
            data["protocolli_odontoiatrici"] = {}
        
        # Crea nuovo protocollo per la diagnosi
        data["protocolli_odontoiatrici"][diagnosi_data["id"]] = {
            "diagnosi": {
                "codice": diagnosi_data["codice"],
                "descrizione": diagnosi_data["descrizione"]
            },
            "farmaci_raccomandati": []
        }
        
        return save_protocolli_terapeutici(data)
    except Exception as e:
        return {"success": False, "error": str(e)}

def update_diagnosi(diagnosi_id, diagnosi_data):
    """
    Aggiorna una diagnosi esistente
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        
        if diagnosi_id not in data.get("protocolli_odontoiatrici", {}):
            return {"success": False, "error": "Diagnosi non trovata"}
        
        # Aggiorna solo i dati della diagnosi, mantiene i farmaci
        data["protocolli_odontoiatrici"][diagnosi_id]["diagnosi"] = {
            "codice": diagnosi_data["codice"],
            "descrizione": diagnosi_data["descrizione"]
        }
        
        return save_protocolli_terapeutici(data)
    except Exception as e:
        return {"success": False, "error": str(e)}

def delete_diagnosi(diagnosi_id):
    """
    Elimina una diagnosi dai protocolli
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        
        if diagnosi_id not in data.get("protocolli_odontoiatrici", {}):
            return {"success": False, "error": "Diagnosi non trovata"}
        
        del data["protocolli_odontoiatrici"][diagnosi_id]
        
        return save_protocolli_terapeutici(data)
    except Exception as e:
        return {"success": False, "error": str(e)}

def add_farmaco_to_diagnosi(diagnosi_id, farmaco_data):
    """
    Aggiunge un farmaco a una diagnosi
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        
        if diagnosi_id not in data.get("protocolli_odontoiatrici", {}):
            return {"success": False, "error": "Diagnosi non trovata"}
        
        # Crea struttura farmaco completa
        nuovo_farmaco = {
            "farmaco": {
                "codice": farmaco_data["codice"],
                "nome": farmaco_data["nome"],
                "principio_attivo": farmaco_data["principio_attivo"],
                "classe": farmaco_data["classe"]
            },
            "posologie_standard": [
                {
                    "posologia": farmaco_data["posologia_default"],
                    "durata": farmaco_data["durata_default"],
                    "note": farmaco_data["note_default"],
                    "default": True
                }
            ]
        }
        
        data["protocolli_odontoiatrici"][diagnosi_id]["farmaci_raccomandati"].append(nuovo_farmaco)
        
        return save_protocolli_terapeutici(data)
    except Exception as e:
        return {"success": False, "error": str(e)}

def update_farmaco_in_diagnosi(diagnosi_id, farmaco_codice, farmaco_data):
    """
    Aggiorna un farmaco esistente in una diagnosi
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        
        if diagnosi_id not in data.get("protocolli_odontoiatrici", {}):
            return {"success": False, "error": "Diagnosi non trovata"}
        
        farmaci = data["protocolli_odontoiatrici"][diagnosi_id]["farmaci_raccomandati"]
        
        # Trova il farmaco da aggiornare
        for i, farmaco_item in enumerate(farmaci):
            if farmaco_item["farmaco"]["codice"] == farmaco_codice:
                # Aggiorna i dati del farmaco
                farmaci[i]["farmaco"] = {
                    "codice": farmaco_data["codice"],
                    "nome": farmaco_data["nome"],
                    "principio_attivo": farmaco_data["principio_attivo"],
                    "classe": farmaco_data["classe"]
                }
                
                # Aggiorna la posologia default
                posologie = farmaci[i]["posologie_standard"]
                for pos in posologie:
                    if pos.get("default"):
                        pos["posologia"] = farmaco_data["posologia_default"]
                        pos["durata"] = farmaco_data["durata_default"]
                        pos["note"] = farmaco_data["note_default"]
                        break
                
                return save_protocolli_terapeutici(data)
        
        return {"success": False, "error": "Farmaco non trovato"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def delete_farmaco_from_diagnosi(diagnosi_id, farmaco_codice):
    """
    Elimina un farmaco da una diagnosi
    """
    try:
        data = load_json_file("protocolli_terapeutici.json")
        
        if diagnosi_id not in data.get("protocolli_odontoiatrici", {}):
            return {"success": False, "error": "Diagnosi non trovata"}
        
        farmaci = data["protocolli_odontoiatrici"][diagnosi_id]["farmaci_raccomandati"]
        
        # Rimuovi il farmaco
        data["protocolli_odontoiatrici"][diagnosi_id]["farmaci_raccomandati"] = [
            f for f in farmaci if f["farmaco"]["codice"] != farmaco_codice
        ]
        
        return save_protocolli_terapeutici(data)
    except Exception as e:
        return {"success": False, "error": str(e)} 