from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
from datetime import datetime, date
import pandas as pd
from server.app.core.db_calendar import _get_dbf_path, _leggi_tabella_dbf
from server.app.config.constants import COLONNE
from server.app.services.gestionale_intelligence_service import gestionale_service
from server.app.services.xml_parser_service import xml_parser_service

logger = logging.getLogger(__name__)

spese_fornitori_bp = Blueprint('spese_fornitori', __name__, url_prefix='/spese-fornitori')

@spese_fornitori_bp.route('/', methods=['GET'])
@jwt_required()
def get_spese_fornitori():
    """
    Ottieni spese fornitori con filtri opzionali
    Query params:
    - anno: anno di riferimento (default: anno corrente)
    - mese: mese specifico (1-12, opzionale)
    - data_inizio: data inizio periodo (formato YYYY-MM-DD, opzionale)
    - data_fine: data fine periodo (formato YYYY-MM-DD, opzionale)
    - codice_fornitore: filtra per codice fornitore specifico (opzionale)
    - numero_documento: filtra per numero documento specifico (opzionale)
    - fattura_id: filtra per ID fattura specifico (opzionale)
    - page: numero pagina per paginazione (default: 1)
    - limit: numero massimo record per pagina (default: 1000)
    """
    try:
        # Parametri query
        anno = request.args.get('anno', type=int, default=datetime.now().year)
        mese = request.args.get('mese', type=int)
        data_inizio = request.args.get('data_inizio')
        data_fine = request.args.get('data_fine')
        codice_fornitore = request.args.get('codice_fornitore')
        numero_documento = request.args.get('numero_documento')
        fattura_id = request.args.get('fattura_id')
        page = request.args.get('page', type=int, default=1)
        limit = request.args.get('limit', type=int, default=1000)
        
        # Ottieni percorsi DBF
        path_spese = _get_dbf_path('spese_fornitori')
        path_fornitori = _get_dbf_path('fornitori')
        
        # Leggi tabelle
        df = _leggi_tabella_dbf(path_spese)
        df_fornitori = _leggi_tabella_dbf(path_fornitori)
        
        if df.empty:
            return jsonify({
                'success': True,
                'data': [],
                'total': 0,
                'page': page,
                'limit': limit,
                'total_pages': 0,
                'filters_applied': {
                    'anno': anno,
                    'mese': mese,
                    'data_inizio': data_inizio,
                    'data_fine': data_fine,
                    'codice_fornitore': codice_fornitore,
                    'page': page,
                    'limit': limit
                }
            })
        
        # Mapping colonne
        col_map = COLONNE['spese_fornitori']
        col_data = col_map['data_spesa']
        
        # Converte date
        df[col_data] = pd.to_datetime(df[col_data], errors='coerce')
        
        # Applica filtri temporali
        if data_inizio and data_fine:
            # Filtro per range date specifico
            start_date = pd.to_datetime(data_inizio)
            end_date = pd.to_datetime(data_fine)
            mask = (df[col_data] >= start_date) & (df[col_data] <= end_date)
        elif mese:
            # Filtro per mese specifico
            mask = (df[col_data].dt.year == anno) & (df[col_data].dt.month == mese)
        else:
            # Filtro solo per anno
            mask = df[col_data].dt.year == anno
        
        df_filtered = df[mask]
        
        # Filtra per codice fornitore se specificato
        if codice_fornitore:
            col_fornitore = col_map['codice_fornitore']
            # Gestisci anche valori bytes e stringhe
            def match_fornitore(val):
                if pd.isna(val):
                    return False
                if isinstance(val, bytes):
                    val_str = val.decode('latin-1', errors='ignore').strip()
                else:
                    val_str = str(val).strip()
                return val_str == str(codice_fornitore).strip()
            
            df_filtered = df_filtered[df_filtered[col_fornitore].apply(match_fornitore)]

        # Filtra per numero documento se specificato
        if numero_documento:
            col_numero = col_map['numero_documento']
            def match_numero(val):
                if pd.isna(val):
                    return False
                if isinstance(val, bytes):
                    val_str = val.decode('latin-1', errors='ignore').strip()
                else:
                    val_str = str(val).strip()
                return numero_documento.lower() in val_str.lower()
            
            df_filtered = df_filtered[df_filtered[col_numero].apply(match_numero)]

        # Filtra per ID fattura se specificato
        if fattura_id:
            col_id = col_map['id']
            def match_id(val):
                if pd.isna(val):
                    return False
                if isinstance(val, bytes):
                    val_str = val.decode('latin-1', errors='ignore').strip()
                else:
                    val_str = str(val).strip()
                return val_str == str(fattura_id).strip()
            
            df_filtered = df_filtered[df_filtered[col_id].apply(match_id)]
        
        # Conta totale prima della paginazione
        total_records = len(df_filtered)
        
        # Applica paginazione
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        df_filtered = df_filtered.iloc[start_idx:end_idx]
        
        # Crea mappa fornitori per lookup veloce
        # SPESAFOR.DB_SPFOCOD -> FORNITOR.DB_CODE
        fornitori_map = {}
        if not df_fornitori.empty:
            col_map_fornitori = COLONNE['fornitori']
            for _, fornitore_row in df_fornitori.iterrows():
                codice_fornitore = fornitore_row.get(col_map_fornitori['id'])  # DB_CODE
                nome_fornitore = fornitore_row.get(col_map_fornitori['nome'])  # DB_FONOME
                
                if pd.notna(codice_fornitore) and pd.notna(nome_fornitore):
                    # Gestisci bytes e strings
                    if isinstance(codice_fornitore, bytes):
                        codice_fornitore = codice_fornitore.decode('latin-1', errors='ignore').strip()
                    else:
                        codice_fornitore = str(codice_fornitore).strip()
                    
                    if isinstance(nome_fornitore, bytes):
                        nome_fornitore = nome_fornitore.decode('latin-1', errors='ignore').strip()
                    else:
                        nome_fornitore = str(nome_fornitore).strip()
                    
                    fornitori_map[codice_fornitore] = nome_fornitore

        # Prepara dati di output
        spese = []
        for _, row in df_filtered.iterrows():
            # Helper function per gestire NaN
            def safe_float(val, default=0.0):
                if pd.isna(val) or val is None:
                    return default
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return default
            
            def safe_int(val, default=0):
                if pd.isna(val) or val is None:
                    return default  
                try:
                    return int(val)
                except (ValueError, TypeError):
                    return default
            
            def safe_str(val, default=''):
                if pd.isna(val) or val is None:
                    return default
                return str(val).strip()
            
            codice_fornitore = safe_str(row.get(col_map['codice_fornitore']))
            nome_fornitore = fornitori_map.get(codice_fornitore, None)
            
            spesa = {
                'id': safe_str(row.get(col_map['id'])),
                'codice_fornitore': codice_fornitore,
                'nome_fornitore': nome_fornitore,
                'descrizione': safe_str(row.get(col_map['descrizione'])),
                'costo_netto': safe_float(row.get(col_map['costo_netto'])),
                'costo_iva': safe_float(row.get(col_map['costo_iva'])),
                'data_spesa': row[col_data].strftime('%Y-%m-%d') if pd.notnull(row[col_data]) else None,
                'data_registrazione': row.get(col_map['data_registrazione'], ''),
                'numero_documento': safe_str(row.get(col_map['numero_documento'])),
                'note': safe_str(row.get(col_map['note'])),
                'categoria': safe_int(row.get(col_map['categoria'])),
                'importo_1': safe_float(row.get(col_map['importo_1'])),
                'importo_2': safe_float(row.get(col_map['importo_2'])),
                'aliquota_iva_1': safe_int(row.get(col_map['aliquota_iva_1'])),
                'aliquota_iva_2': safe_int(row.get(col_map['aliquota_iva_2'])),
                'rate': safe_str(row.get(col_map['rate']))
            }
            spese.append(spesa)
        
        return jsonify({
            'success': True,
            'data': spese,
            'total': total_records,
            'page': page,
            'limit': limit,
            'total_pages': (total_records + limit - 1) // limit,
            'filters_applied': {
                'anno': anno,
                'mese': mese,
                'data_inizio': data_inizio,
                'data_fine': data_fine,
                'codice_fornitore': codice_fornitore,
                'numero_documento': numero_documento,
                'fattura_id': fattura_id,
                'page': page,
                'limit': limit
            }
        })
        
    except Exception as e:
        logger.error(f"Errore recupero spese fornitori: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/all', methods=['GET'])
@jwt_required()
def get_all_spese_fornitori():
    """
    Ottieni TUTTE le spese fornitori senza filtri temporali di default
    Query params:
    - data_inizio: data inizio periodo (formato YYYY-MM-DD, opzionale)
    - data_fine: data fine periodo (formato YYYY-MM-DD, opzionale)
    - codice_fornitore: filtra per codice fornitore specifico (opzionale)
    - numero_documento: filtra per numero documento specifico (opzionale)
    - fattura_id: filtra per ID fattura specifico (opzionale)
    - page: numero pagina per paginazione (default: 1)
    - limit: numero massimo record per pagina (default: 1000)
    """
    try:
        # Parametri query (senza filtro anno di default)
        data_inizio = request.args.get('data_inizio')
        data_fine = request.args.get('data_fine')
        codice_fornitore = request.args.get('codice_fornitore')
        numero_documento = request.args.get('numero_documento')
        fattura_id = request.args.get('fattura_id')
        page = request.args.get('page', type=int, default=1)
        limit = request.args.get('limit', type=int, default=1000)
        
        # Ottieni percorsi DBF
        path_spese = _get_dbf_path('spese_fornitori')
        path_fornitori = _get_dbf_path('fornitori')
        
        # Leggi tabelle
        df = _leggi_tabella_dbf(path_spese)
        df_fornitori = _leggi_tabella_dbf(path_fornitori)
        
        if df.empty:
            return jsonify({
                'success': True,
                'data': [],
                'total': 0,
                'page': page,
                'limit': limit,
                'total_pages': 0,
                'filters_applied': {
                    'data_inizio': data_inizio,
                    'data_fine': data_fine,
                    'codice_fornitore': codice_fornitore,
                    'page': page,
                    'limit': limit
                }
            })
        
        # Mapping colonne
        col_map = COLONNE['spese_fornitori']
        col_data = col_map['data_spesa']
        
        # Converte date
        df[col_data] = pd.to_datetime(df[col_data], errors='coerce')
        
        # Applica filtri temporali SOLO se specificati
        df_filtered = df.copy()
        if data_inizio and data_fine:
            start_date = pd.to_datetime(data_inizio)
            end_date = pd.to_datetime(data_fine)
            mask = (df[col_data] >= start_date) & (df[col_data] <= end_date)
            df_filtered = df[mask]
        
        # Filtra per codice fornitore se specificato
        if codice_fornitore:
            col_fornitore = col_map['codice_fornitore']
            def match_fornitore(val):
                if pd.isna(val):
                    return False
                if isinstance(val, bytes):
                    val_str = val.decode('latin-1', errors='ignore').strip()
                else:
                    val_str = str(val).strip()
                return val_str == str(codice_fornitore).strip()
            
            df_filtered = df_filtered[df_filtered[col_fornitore].apply(match_fornitore)]

        # Filtra per numero documento se specificato
        if numero_documento:
            col_numero = col_map['numero_documento']
            def match_numero(val):
                if pd.isna(val):
                    return False
                if isinstance(val, bytes):
                    val_str = val.decode('latin-1', errors='ignore').strip()
                else:
                    val_str = str(val).strip()
                return numero_documento.lower() in val_str.lower()
            
            df_filtered = df_filtered[df_filtered[col_numero].apply(match_numero)]

        # Filtra per ID fattura se specificato
        if fattura_id:
            col_id = col_map['id']
            def match_id(val):
                if pd.isna(val):
                    return False
                if isinstance(val, bytes):
                    val_str = val.decode('latin-1', errors='ignore').strip()
                else:
                    val_str = str(val).strip()
                return val_str == str(fattura_id).strip()
            
            df_filtered = df_filtered[df_filtered[col_id].apply(match_id)]
        
        # Conta totale prima della paginazione
        total_records = len(df_filtered)
        
        # Applica paginazione
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        df_filtered = df_filtered.iloc[start_idx:end_idx]
        
        # Crea mappa fornitori per lookup veloce
        fornitori_map = {}
        if not df_fornitori.empty:
            col_map_fornitori = COLONNE['fornitori']
            for _, fornitore_row in df_fornitori.iterrows():
                codice_fornitore = fornitore_row.get(col_map_fornitori['id'])
                nome_fornitore = fornitore_row.get(col_map_fornitori['nome'])
                
                if pd.notna(codice_fornitore) and pd.notna(nome_fornitore):
                    if isinstance(codice_fornitore, bytes):
                        codice_fornitore = codice_fornitore.decode('latin-1', errors='ignore').strip()
                    else:
                        codice_fornitore = str(codice_fornitore).strip()
                    
                    if isinstance(nome_fornitore, bytes):
                        nome_fornitore = nome_fornitore.decode('latin-1', errors='ignore').strip()
                    else:
                        nome_fornitore = str(nome_fornitore).strip()
                    
                    fornitori_map[codice_fornitore] = nome_fornitore

        # Prepara dati di output
        spese = []
        for _, row in df_filtered.iterrows():
            def safe_float(val, default=0.0):
                if pd.isna(val) or val is None:
                    return default
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return default
            
            def safe_int(val, default=0):
                if pd.isna(val) or val is None:
                    return default  
                try:
                    return int(val)
                except (ValueError, TypeError):
                    return default
            
            def safe_str(val, default=''):
                if pd.isna(val) or val is None:
                    return default
                return str(val).strip()
            
            codice_fornitore = safe_str(row.get(col_map['codice_fornitore']))
            nome_fornitore = fornitori_map.get(codice_fornitore, None)
            descrizione = safe_str(row.get(col_map['descrizione']))
            
            # Categorizzazione automatica (inclusi collaboratori)
            categoria_automatica = "Non classificato"
            categoria_confidence = 0.0
            conto_suggerito = None
            branca_suggerita = None
            sottoconto_suggerito = None
            try:
                result = gestionale_service.categorize_spesa(
                    descrizione, nome_fornitore or "", codice_fornitore
                )
                categoria_automatica = result.get("categoria_nome", "Non classificato")
                categoria_confidence = result.get("confidence", 0.0)
                conto_suggerito = result.get("conto_suggerito")
                branca_suggerita = result.get("branca_suggerita")
                sottoconto_suggerito = result.get("sottoconto_suggerito")
            except Exception as e:
                logger.warning(f"Errore categorizzazione spesa {descrizione}: {e}")
            
            spesa = {
                'id': safe_str(row.get(col_map['id'])),
                'codice_fornitore': codice_fornitore,
                'nome_fornitore': nome_fornitore,
                'descrizione': descrizione,
                'costo_netto': safe_float(row.get(col_map['costo_netto'])),
                'costo_iva': safe_float(row.get(col_map['costo_iva'])),
                'data_spesa': row[col_data].strftime('%Y-%m-%d') if pd.notnull(row[col_data]) else None,
                'data_registrazione': row.get(col_map['data_registrazione'], ''),
                'numero_documento': safe_str(row.get(col_map['numero_documento'])),
                'note': safe_str(row.get(col_map['note'])),
                'categoria': safe_int(row.get(col_map['categoria'])),
                'categoria_automatica': categoria_automatica,
                'categoria_confidence': categoria_confidence,
                'conto_suggerito': conto_suggerito,
                'branca_suggerita': branca_suggerita,
                'sottoconto_suggerito': sottoconto_suggerito,
                'importo_1': safe_float(row.get(col_map['importo_1'])),
                'importo_2': safe_float(row.get(col_map['importo_2'])),
                'aliquota_iva_1': safe_int(row.get(col_map['aliquota_iva_1'])),
                'aliquota_iva_2': safe_int(row.get(col_map['aliquota_iva_2'])),
                'rate': safe_str(row.get(col_map['rate']))
            }
            spese.append(spesa)
        
        return jsonify({
            'success': True,
            'data': spese,
            'total': total_records,
            'page': page,
            'limit': limit,
            'total_pages': (total_records + limit - 1) // limit,
            'filters_applied': {
                'data_inizio': data_inizio,
                'data_fine': data_fine,
                'codice_fornitore': codice_fornitore,
                'numero_documento': numero_documento,
                'fattura_id': fattura_id,
                'page': page,
                'limit': limit
            }
        })
        
    except Exception as e:
        logger.error(f"Errore recupero tutte le spese fornitori: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/fornitore/<string:fornitore_id>/all', methods=['GET'])
#@jwt_required()
def get_all_fatture_fornitore(fornitore_id):
    """
    Ottieni TUTTE le fatture di un fornitore specifico senza filtri temporali di default
    Query params:
    - data_inizio: data inizio periodo (formato YYYY-MM-DD, opzionale)
    - data_fine: data fine periodo (formato YYYY-MM-DD, opzionale)
    - numero_documento: filtra per numero documento specifico (opzionale)
    - page: numero pagina per paginazione (default: 1)
    - limit: numero massimo record per pagina (default: 10)
    """
    try:
        # Parametri query
        data_inizio = request.args.get('data_inizio')
        data_fine = request.args.get('data_fine')
        numero_documento = request.args.get('numero_documento')
        page = request.args.get('page', type=int, default=1)
        limit = request.args.get('limit', type=int, default=10)
        
        # Ottieni percorsi DBF
        path_spese = _get_dbf_path('spese_fornitori')
        path_fornitori = _get_dbf_path('fornitori')
        
        # Leggi tabelle
        df = _leggi_tabella_dbf(path_spese)
        df_fornitori = _leggi_tabella_dbf(path_fornitori)
        
        if df.empty:
            return jsonify({
                'success': True,
                'data': [],
                'total': 0,
                'page': page,
                'limit': limit,
                'total_pages': 0,
                'fornitore_id': fornitore_id
            })
        
        # Mapping colonne
        col_map = COLONNE['spese_fornitori']
        col_data = col_map['data_spesa']
        col_fornitore = col_map['codice_fornitore']
        
        # Converte date
        df[col_data] = pd.to_datetime(df[col_data], errors='coerce')
        
        # Filtra per fornitore (obbligatorio)
        def match_fornitore(val):
            if pd.isna(val):
                return False
            if isinstance(val, bytes):
                val_str = val.decode('latin-1', errors='ignore').strip()
            else:
                val_str = str(val).strip()
            return val_str == str(fornitore_id).strip()
        
        df_filtered = df[df[col_fornitore].apply(match_fornitore)]
        
        # Applica filtri temporali SOLO se specificati
        if data_inizio and data_fine:
            start_date = pd.to_datetime(data_inizio)
            end_date = pd.to_datetime(data_fine)
            mask = (df_filtered[col_data] >= start_date) & (df_filtered[col_data] <= end_date)
            df_filtered = df_filtered[mask]

        # Filtra per numero documento se specificato
        if numero_documento:
            col_numero = col_map['numero_documento']
            def match_numero(val):
                if pd.isna(val):
                    return False
                if isinstance(val, bytes):
                    val_str = val.decode('latin-1', errors='ignore').strip()
                else:
                    val_str = str(val).strip()
                return numero_documento.lower() in val_str.lower()
            
            df_filtered = df_filtered[df_filtered[col_numero].apply(match_numero)]
        
        # Conta totale prima della paginazione
        total_records = len(df_filtered)
        
        # Applica paginazione
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        df_filtered = df_filtered.iloc[start_idx:end_idx]
        
        # Ottieni nome fornitore
        nome_fornitore = None
        if not df_fornitori.empty:
            col_map_fornitori = COLONNE['fornitori']
            for _, fornitore_row in df_fornitori.iterrows():
                codice = fornitore_row.get(col_map_fornitori['id'])
                nome = fornitore_row.get(col_map_fornitori['nome'])
                
                if pd.notna(codice):
                    if isinstance(codice, bytes):
                        codice = codice.decode('latin-1', errors='ignore').strip()
                    else:
                        codice = str(codice).strip()
                    
                    if codice == str(fornitore_id).strip():
                        if isinstance(nome, bytes):
                            nome_fornitore = nome.decode('latin-1', errors='ignore').strip()
                        else:
                            nome_fornitore = str(nome).strip()
                        break

        # Prepara dati di output
        fatture = []
        for _, row in df_filtered.iterrows():
            def safe_float(val, default=0.0):
                if pd.isna(val) or val is None:
                    return default
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return default
            
            def safe_str(val, default=''):
                if pd.isna(val) or val is None:
                    return default
                return str(val).strip()
            
            fattura = {
                'id': safe_str(row.get(col_map['id'])),
                'codice_fornitore': fornitore_id,
                'nome_fornitore': nome_fornitore,
                'descrizione': safe_str(row.get(col_map['descrizione'])),
                'costo_netto': safe_float(row.get(col_map['costo_netto'])),
                'costo_iva': safe_float(row.get(col_map['costo_iva'])),
                'data_spesa': row[col_data].strftime('%Y-%m-%d') if pd.notnull(row[col_data]) else None,
                'numero_documento': safe_str(row.get(col_map['numero_documento'])),
                'note': safe_str(row.get(col_map['note']))
            }
            fatture.append(fattura)
        
        return jsonify({
            'success': True,
            'data': fatture,
            'total': total_records,
            'page': page,
            'limit': limit,
            'total_pages': (total_records + limit - 1) // limit,
            'fornitore_id': fornitore_id,
            'nome_fornitore': nome_fornitore,
            'filters_applied': {
                'data_inizio': data_inizio,
                'data_fine': data_fine,
                'numero_documento': numero_documento,
                'page': page,
                'limit': limit
            }
        })
        
    except Exception as e:
        logger.error(f"Errore recupero fatture fornitore {fornitore_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'fornitore_id': fornitore_id
        }), 500

@spese_fornitori_bp.route('/riepilogo', methods=['GET'])
@jwt_required()
def get_riepilogo_spese():
    """
    Ottieni riepilogo spese per analisi (totali per mese, categoria, ecc.)
    """
    try:
        anno = request.args.get('anno', type=int, default=datetime.now().year)
        
        # Ottieni percorso DBF
        path_spese = _get_dbf_path('spese_fornitori')
        
        # Leggi tabella
        df = _leggi_tabella_dbf(path_spese)
        
        if df.empty:
            return jsonify({
                'success': True,
                'riepilogo': {
                    'totale_anno': 0,
                    'per_mese': [],
                    'per_categoria': [],
                    'top_fornitori': []
                }
            })
        
        # Mapping colonne
        col_map = COLONNE['spese_fornitori']
        col_data = col_map['data_spesa']
        col_costo = col_map['costo_iva']  # Usiamo costo con IVA per totali
        
        # Converte date e filtra per anno
        df[col_data] = pd.to_datetime(df[col_data], errors='coerce')
        df_year = df[df[col_data].dt.year == anno]
        
        if df_year.empty:
            return jsonify({
                'success': True,
                'riepilogo': {
                    'totale_anno': 0,
                    'per_mese': [],
                    'per_categoria': [],  
                    'top_fornitori': []
                }
            })
        
        # Rimuovi righe con valori NaN per evitare errori nei calcoli
        df_year = df_year.dropna(subset=[col_costo])
        
        # Helper per safe conversion
        def safe_float(val):
            if pd.isna(val):
                return 0.0
            return float(val)
        
        # Totale anno
        totale_anno = safe_float(df_year[col_costo].sum())
        
        # Totali per mese
        per_mese = []
        for mese in range(1, 13):
            df_mese = df_year[df_year[col_data].dt.month == mese]
            totale_mese = safe_float(df_mese[col_costo].sum())
            per_mese.append({
                'mese': mese,
                'nome_mese': pd.Timestamp(year=anno, month=mese, day=1).strftime('%B'),
                'totale': totale_mese,
                'count': len(df_mese)
            })
        
        # Totali per categoria (escludendo NaN)
        df_cat = df_year.dropna(subset=[col_map['categoria']])
        per_categoria = df_cat.groupby(col_map['categoria'])[col_costo].agg(['sum', 'count']).reset_index()
        per_categoria_list = []
        for _, row in per_categoria.iterrows():
            per_categoria_list.append({
                'categoria': int(row[col_map['categoria']]) if not pd.isna(row[col_map['categoria']]) else 0,
                'totale': safe_float(row['sum']),
                'count': int(row['count'])
            })
        
        # Top 10 fornitori (escludendo NaN)
        df_forn = df_year.dropna(subset=[col_map['codice_fornitore']])
        top_fornitori = df_forn.groupby(col_map['codice_fornitore'])[col_costo].agg(['sum', 'count']).reset_index()
        top_fornitori = top_fornitori.sort_values('sum', ascending=False).head(10)
        top_fornitori_list = []
        for _, row in top_fornitori.iterrows():
            top_fornitori_list.append({
                'codice_fornitore': str(row[col_map['codice_fornitore']]).strip(),
                'totale': safe_float(row['sum']),
                'count': int(row['count'])
            })
        
        return jsonify({
            'success': True,
            'riepilogo': {
                'anno': anno,
                'totale_anno': totale_anno,
                'per_mese': per_mese,
                'per_categoria': per_categoria_list,
                'top_fornitori': top_fornitori_list
            }
        })
        
    except Exception as e:
        logger.error(f"Errore riepilogo spese: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/<string:fattura_id>/dettagli', methods=['GET'])
#@jwt_required()
def get_dettagli_fattura(fattura_id):
    """
    Ottieni i dettagli/righe di una specifica fattura fornitore
    """
    try:
        # Ottieni percorso DBF per i dettagli
        path_dettagli = _get_dbf_path('dettagli_spese_fornitori')
        
        # Leggi tabella dettagli
        df = _leggi_tabella_dbf(path_dettagli)
        
        if df.empty:
            return jsonify({
                'success': True,
                'data': [],
                'fattura_id': fattura_id
            })
        
        # Mapping colonne
        col_map = COLONNE['dettagli_spese_fornitori']
        col_fattura = col_map['codice_fattura']
        
        # Filtra per codice fattura
        def match_fattura(val):
            if pd.isna(val):
                return False
            if isinstance(val, bytes):
                val_str = val.decode('latin-1', errors='ignore').strip()
            else:
                val_str = str(val).strip()
            return val_str == str(fattura_id).strip()
        
        df_filtered = df[df[col_fattura].apply(match_fattura)]
        
        # Prepara dati di output
        dettagli = []
        for _, row in df_filtered.iterrows():
            # Helper functions per gestire NaN
            def safe_float(val, default=0.0):
                if pd.isna(val) or val is None:
                    return default
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return default
            
            def safe_str(val, default=''):
                if pd.isna(val) or val is None:
                    return default
                if isinstance(val, bytes):
                    return val.decode('latin-1', errors='ignore').strip()
                return str(val).strip()
            
            dettaglio = {
                'codice_fattura': safe_str(row.get(col_map['codice_fattura'])),
                'codice_articolo': safe_str(row.get(col_map['codice_articolo'])),
                'descrizione': safe_str(row.get(col_map['descrizione'])),
                'quantita': safe_float(row.get(col_map['quantita'])),
                'prezzo_unitario': safe_float(row.get(col_map['prezzo_unitario'])),
                'sconto': safe_float(row.get(col_map['sconto'])),
                'ritenuta': safe_str(row.get(col_map['ritenuta'])),
                'aliquota_iva': safe_float(row.get(col_map['aliquota_iva'])),
                'codice_iva': safe_str(row.get(col_map['codice_iva'])),
                'totale_riga': safe_float(row.get(col_map['quantita'])) * safe_float(row.get(col_map['prezzo_unitario'])) * (1 - safe_float(row.get(col_map['sconto'])) / 100)
            }
            dettagli.append(dettaglio)
        
        return jsonify({
            'success': True,
            'data': dettagli,
            'fattura_id': fattura_id,
            'total_righe': len(dettagli)
        })
        
    except Exception as e:
        logger.error(f"Errore recupero dettagli fattura {fattura_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'fattura_id': fattura_id
        }), 500

@spese_fornitori_bp.route('/ricerca-articoli', methods=['GET'])
@jwt_required()
def ricerca_articoli():
    """
    Ricerca articoli nei dettagli fatture e restituisce info fattura origine
    Query params:
    - q: termine di ricerca nella descrizione articolo
    - limit: numero massimo risultati (default: 50)
    """
    try:
        # Parametri query
        query = request.args.get('q', '').strip()
        limit = request.args.get('limit', type=int, default=50)
        
        if not query or len(query) < 2:
            return jsonify({
                'success': False,
                'error': 'Termine di ricerca troppo corto (minimo 2 caratteri)'
            }), 400
        
        # Ottieni percorsi DBF
        path_dettagli = _get_dbf_path('dettagli_spese_fornitori')
        path_fatture = _get_dbf_path('spese_fornitori')
        path_fornitori = _get_dbf_path('fornitori')
        
        # Leggi tabelle
        df_dettagli = _leggi_tabella_dbf(path_dettagli)
        df_fatture = _leggi_tabella_dbf(path_fatture)
        df_fornitori = _leggi_tabella_dbf(path_fornitori)
        
        if df_dettagli.empty:
            return jsonify({
                'success': True,
                'data': [],
                'query': query
            })
        
        # Mapping colonne
        col_map_dettagli = COLONNE['dettagli_spese_fornitori']
        col_map_fatture = COLONNE['spese_fornitori']
        
        # Ricerca nei dettagli
        col_descrizione = col_map_dettagli['descrizione']
        
        def match_query(val):
            if pd.isna(val):
                return False
            if isinstance(val, bytes):
                val_str = val.decode('latin-1', errors='ignore').strip().lower()
            else:
                val_str = str(val).strip().lower()
            return query.lower() in val_str
        
        df_found = df_dettagli[df_dettagli[col_descrizione].apply(match_query)]
        
        # Crea mappa fornitori per lookup veloce
        fornitori_map = {}
        if not df_fornitori.empty:
            col_map_fornitori = COLONNE['fornitori']
            for _, fornitore_row in df_fornitori.iterrows():
                codice_fornitore = fornitore_row.get(col_map_fornitori['id'])
                nome_fornitore = fornitore_row.get(col_map_fornitori['nome'])
                
                if pd.notna(codice_fornitore) and pd.notna(nome_fornitore):
                    if isinstance(codice_fornitore, bytes):
                        codice_fornitore = codice_fornitore.decode('latin-1', errors='ignore').strip()
                    else:
                        codice_fornitore = str(codice_fornitore).strip()
                    
                    if isinstance(nome_fornitore, bytes):
                        nome_fornitore = nome_fornitore.decode('latin-1', errors='ignore').strip()
                    else:
                        nome_fornitore = str(nome_fornitore).strip()
                    
                    fornitori_map[codice_fornitore] = nome_fornitore
        
        # Join con fatture per ottenere info complete
        risultati = []
        for _, dettaglio_row in df_found.head(limit).iterrows():
            cod_fattura = dettaglio_row.get(col_map_dettagli['codice_fattura'])
            
            # Trova fattura corrispondente
            def match_fattura_id(val):
                if pd.isna(val):
                    return False
                if isinstance(val, bytes):
                    val_str = val.decode('latin-1', errors='ignore').strip()
                else:
                    val_str = str(val).strip()
                return val_str == str(cod_fattura).strip()
            
            fattura_match = df_fatture[df_fatture[col_map_fatture['id']].apply(match_fattura_id)]
            
            # Helper functions
            def safe_float(val, default=0.0):
                if pd.isna(val) or val is None:
                    return default
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return default
            
            def safe_str(val, default=''):
                if pd.isna(val) or val is None:
                    return default
                if isinstance(val, bytes):
                    return val.decode('latin-1', errors='ignore').strip()
                return str(val).strip()
            
            # Prepara risultato
            risultato = {
                'articolo': {
                    'codice_articolo': safe_str(dettaglio_row.get(col_map_dettagli['codice_articolo'])),
                    'descrizione': safe_str(dettaglio_row.get(col_map_dettagli['descrizione'])),
                    'quantita': safe_float(dettaglio_row.get(col_map_dettagli['quantita'])),
                    'prezzo_unitario': safe_float(dettaglio_row.get(col_map_dettagli['prezzo_unitario']))
                },
                'fattura': None
            }
            
            if not fattura_match.empty:
                fattura_row = fattura_match.iloc[0]
                codice_fornitore = safe_str(fattura_row.get(col_map_fatture['codice_fornitore']))
                nome_fornitore = fornitori_map.get(codice_fornitore, None)
                
                risultato['fattura'] = {
                    'id': safe_str(fattura_row.get(col_map_fatture['id'])),
                    'numero_documento': safe_str(fattura_row.get(col_map_fatture['numero_documento'])),
                    'codice_fornitore': codice_fornitore,
                    'nome_fornitore': nome_fornitore,
                    'descrizione': safe_str(fattura_row.get(col_map_fatture['descrizione'])),
                    'data_spesa': fattura_row[col_map_fatture['data_spesa']].strftime('%Y-%m-%d') if pd.notnull(fattura_row[col_map_fatture['data_spesa']]) else None,
                    'costo_totale': safe_float(fattura_row.get(col_map_fatture['costo_iva']))
                }
            
            risultati.append(risultato)
        
        return jsonify({
            'success': True,
            'data': risultati,
            'query': query,
            'total_found': len(risultati)
        })
        
    except Exception as e:
        logger.error(f"Errore ricerca articoli: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# === NUOVI ENDPOINT PER CATEGORIZZAZIONE INTELLIGENTE ===

@spese_fornitori_bp.route('/categorie-gestionale', methods=['GET'])
@jwt_required()
def get_categorie_gestionale():
    """
    Restituisce le categorie di spesa dal piano dei conti del gestionale
    """
    try:
        conti = gestionale_service.get_piano_conti()
        
        # Converti in formato adatto al frontend
        categorie = []
        for codice, info in conti.items():
            categorie.append({
                'codice': codice,
                'nome': info['descrizione'],
                'importo_totale': info['importo_totale'],
                'iva_totale': info['iva_totale'],
                'peso': info['peso']
            })
        
        # Ordina per importo decrescente
        categorie.sort(key=lambda x: x['importo_totale'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': categorie,
            'total': len(categorie)
        })
        
    except Exception as e:
        logger.error(f"Errore recupero categorie gestionale: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/categorizza-spesa', methods=['POST'])
@jwt_required()
def categorizza_spesa():
    """
    Categorizza automaticamente una spesa basandosi sui pattern del gestionale
    
    Body: {
        "descrizione": "Descrizione della spesa",
        "fornitore": "Nome fornitore" (opzionale),
        "codice_fornitore": "Codice fornitore per controllo collaboratori" (opzionale)
    }
    """
    try:
        data = request.get_json()
        descrizione = data.get('descrizione', '')
        fornitore = data.get('fornitore', '')
        codice_fornitore = data.get('codice_fornitore', '')
        
        if not descrizione:
            return jsonify({
                'success': False,
                'error': 'Descrizione richiesta'
            }), 400
        
        # Categorizza usando il service (con controllo collaboratori integrato)
        result = gestionale_service.categorize_spesa(descrizione, fornitore, codice_fornitore)
        
        return jsonify({
            'success': True,
            'data': {
                'categoria': result.get("categoria_nome"),
                'confidence': result.get("confidence"),
                'conto_suggerito': result.get("conto_suggerito"),
                'branca_suggerita': result.get("branca_suggerita"),
                'sottoconto_suggerito': result.get("sottoconto_suggerito"),
                'motivo': result.get("motivo"),
                'descrizione_input': descrizione,
                'fornitore_input': fornitore
            }
        })
        
    except Exception as e:
        logger.error(f"Errore categorizzazione spesa: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/statistiche-gestionale', methods=['GET'])
@jwt_required()
def get_statistiche_gestionale():
    """
    Restituisce statistiche sui dati del gestionale per categorizzazione
    """
    try:
        stats = gestionale_service.get_statistics()
        
        return jsonify({
            'success': True,
            'data': stats
        })
        
    except Exception as e:
        logger.error(f"Errore statistiche gestionale: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/clear-cache', methods=['POST'])
@jwt_required()
def clear_categorization_cache():
    """
    Pulisce la cache dei pattern di categorizzazione per ricaricare i miglioramenti
    """
    try:
        gestionale_service.clear_cache()
        return jsonify({
            "success": True,
            "message": "Cache pulita con successo. I pattern sono stati ricaricati."
        })
    except Exception as e:
        logger.error(f"Errore nella pulizia cache: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@spese_fornitori_bp.route('/analyze-xml-fatture', methods=['POST'])
@jwt_required()
def analyze_xml_fattures():
    """
    Analizza le fatture XML SDI per estrarre pattern di categorizzazione
    """
    try:
        # Path esatto alla cartella XML
        xml_path = r'C:\Users\gengi\Desktop\StudioDimaAI\sample_fatture_xml'
        
        # Crea un'istanza con il path corretto
        from server.app.services.xml_parser_service import XMLParserService
        xml_service = XMLParserService(xml_path)
        
        # Analizza tutte le fatture XML nella cartella
        analysis_results = xml_service.analyze_xml_files()
        
        if not analysis_results:
            return jsonify({
                "success": False,
                "error": "Nessuna fattura XML trovata o analizzabile"
            }), 404
        
        return jsonify({
            "success": True,
            "message": f"Analizzate {analysis_results['statistiche'].get('totale_fornitori', 0)} fatture XML",
            "data": analysis_results
        })
        
    except Exception as e:
        logger.error(f"Errore nell'analisi fatture XML: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@spese_fornitori_bp.route('/integrate-xml-patterns', methods=['POST'])
@jwt_required()
def integrate_xml_patterns():
    """
    Analizza le fatture XML e integra i pattern nel sistema di categorizzazione
    """
    try:
        # Path esatto alla cartella XML
        xml_path = r'C:\Users\gengi\Desktop\StudioDimaAI\sample_fatture_xml'
        
        # Crea un'istanza con il path corretto
        from server.app.services.xml_parser_service import XMLParserService
        xml_service = XMLParserService(xml_path)
        
        # Analizza fatture XML
        xml_analysis = xml_service.analyze_xml_files()
        
        if not xml_analysis:
            return jsonify({
                "success": False,
                "error": "Nessuna fattura XML trovata"
            }), 404
        
        # Integra pattern nel sistema di categorizzazione
        integrated_patterns = gestionale_service.integrate_xml_patterns(xml_analysis)
        
        return jsonify({
            "success": True,
            "message": f"Pattern XML integrati con successo. {xml_analysis['statistiche'].get('totale_fornitori', 0)} fornitori analizzati.",
            "data": {
                "fornitori_xml": xml_analysis['fornitori_identificati'],
                "pattern_integrati": list(integrated_patterns.keys()),
                "statistiche": xml_analysis['statistiche']
            }
        })
        
    except Exception as e:
        logger.error(f"Errore nell'integrazione pattern XML: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@spese_fornitori_bp.route('/test-categorizzazione', methods=['GET'])
@jwt_required()
def test_categorizzazione():
    """
    Endpoint di test per validare la categorizzazione con esempi
    """
    try:
        # Esempi di test
        test_cases = [
            {"descrizione": "PUNTE VERDI 671/204/060 5PZ", "fornitore": "Dental Supply"},
            {"descrizione": "ENERGIA ELETTRICA MARZO 2024", "fornitore": "ENEL"},
            {"descrizione": "17D0NNLC-Aggiunta Gancio a protesi", "fornitore": "Laboratorio Odonto"},
            {"descrizione": "GL001AS Confezione da 100 guanti ALOE", "fornitore": "Medical Store"},
            {"descrizione": "Canone telefono fisso", "fornitore": "TIM"},
            {"descrizione": "Ricalcolo acqua precedenti", "fornitore": "Acquedotto"},
        ]
        
        risultati = []
        for test in test_cases:
            result = gestionale_service.categorize_spesa(
                test['descrizione'], 
                test['fornitore']
            )
            risultati.append({
                'input': test,
                'categoria_predetta': result.get("categoria_nome"),
                'confidence': result.get("confidence"),
                'conto_suggerito': result.get("conto_suggerito"),
                'branca_suggerita': result.get("branca_suggerita"),
                'sottoconto_suggerito': result.get("sottoconto_suggerito"),
                'motivo': result.get("motivo")
            })
        
        return jsonify({
            'success': True,
            'data': {
                'test_results': risultati,
                'total_tests': len(test_cases)
            }
        })
        
    except Exception as e:
        logger.error(f"Errore test categorizzazione: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/materiali-da-classificare', methods=['GET'])
@jwt_required()
def get_materiali_da_classificare():
    """
    Restituisce tutti i materiali unici dal database con il loro stato di classificazione
    
    Query params:
    - stato: 'tutti', 'classificati', 'non_classificati', 'da_verificare' (default: 'tutti')
    - fornitore: filtra per codice fornitore specifico
    - limit: numero massimo risultati (default: 1000)
    - page: numero pagina (default: 1)
    """
    try:
        # Parametri query
        stato = request.args.get('stato', 'tutti')
        codice_fornitore_filtro = request.args.get('fornitore')
        limit = request.args.get('limit', type=int, default=1000)
        page = request.args.get('page', type=int, default=1)
        
        # Ottieni percorsi DBF
        path_dettagli = _get_dbf_path('dettagli_spese_fornitori')
        path_fornitori = _get_dbf_path('fornitori')
        path_spese = _get_dbf_path('spese_fornitori')
        
        # Leggi tabelle
        df_dettagli = _leggi_tabella_dbf(path_dettagli)
        df_fornitori = _leggi_tabella_dbf(path_fornitori)
        df_spese = _leggi_tabella_dbf(path_spese)
        
        if df_dettagli.empty:
            return jsonify({
                'success': True,
                'data': [],
                'total': 0,
                'stats': {'classificati': 0, 'non_classificati': 0, 'da_verificare': 0}
            })
        
        # Mapping colonne
        col_map_dettagli = COLONNE['dettagli_spese_fornitori']
        col_map_fornitori = COLONNE['fornitori']
        col_map_spese = COLONNE['spese_fornitori']
        
        # Crea mappa fornitori
        fornitori_map = {}
        if not df_fornitori.empty:
            for _, fornitore_row in df_fornitori.iterrows():
                codice = fornitore_row.get(col_map_fornitori['id'])
                nome = fornitore_row.get(col_map_fornitori['nome'])
                
                if pd.notna(codice) and pd.notna(nome):
                    if isinstance(codice, bytes):
                        codice_str = codice.decode('latin-1', errors='ignore').strip()
                    else:
                        codice_str = str(codice).strip()
                    
                    if isinstance(nome, bytes):
                        nome_str = nome.decode('latin-1', errors='ignore').strip()
                    else:
                        nome_str = str(nome).strip()
                    
                    fornitori_map[codice_str] = nome_str
        
        # Crea mappa fatture -> fornitori
        fatture_fornitori_map = {}
        if not df_spese.empty:
            for _, spesa_row in df_spese.iterrows():
                fattura_id = spesa_row.get(col_map_spese['id'])
                cod_forn = spesa_row.get(col_map_spese['codice_fornitore'])
                
                if pd.notna(fattura_id) and pd.notna(cod_forn):
                    if isinstance(fattura_id, bytes):
                        fat_id_str = fattura_id.decode('latin-1', errors='ignore').strip()
                    else:
                        fat_id_str = str(fattura_id).strip()
                        
                    if isinstance(cod_forn, bytes):
                        cod_forn_str = cod_forn.decode('latin-1', errors='ignore').strip()
                    else:
                        cod_forn_str = str(cod_forn).strip()
                    
                    fatture_fornitori_map[fat_id_str] = cod_forn_str
        
        # Pre-processa per unire descrizioni spezzate (limite 75 caratteri DBF)
        df_dettagli_processato = df_dettagli.copy()
        rows_to_remove = []
        
        for i in range(len(df_dettagli_processato) - 1):
            current_row = df_dettagli_processato.iloc[i]
            next_row = df_dettagli_processato.iloc[i + 1]
            
            # Safe string conversion
            def safe_str_pre(val, default=''):
                if pd.isna(val):
                    return default
                if isinstance(val, bytes):
                    return val.decode('latin-1', errors='ignore').strip()
                return str(val).strip()
            
            current_desc = safe_str_pre(current_row.get(col_map_dettagli['descrizione']))
            next_desc = safe_str_pre(next_row.get(col_map_dettagli['descrizione']))
            current_fattura = safe_str_pre(current_row.get(col_map_dettagli['codice_fattura']))
            next_fattura = safe_str_pre(next_row.get(col_map_dettagli['codice_fattura']))
            
            # Identifica righe spezzate: stessa fattura, descrizione ~75 caratteri che finisce con parola incompleta
            if (current_fattura == next_fattura and 
                len(current_desc) >= 70 and  # Vicino al limite di 75
                len(next_desc) > 0 and len(next_desc) < 50 and  # Continuazione probabile
                not current_desc[-1].isspace() and  # Non finisce con spazio
                not next_desc[0].isupper()):  # Non inizia con maiuscola
                
                # Unisci le descrizioni
                combined_desc = current_desc + next_desc
                df_dettagli_processato.iloc[i, df_dettagli_processato.columns.get_loc(col_map_dettagli['descrizione'])] = combined_desc
                rows_to_remove.append(i + 1)
        
        # Rimuovi righe già unite
        df_dettagli_processato = df_dettagli_processato.drop(df_dettagli_processato.index[rows_to_remove]).reset_index(drop=True)
        
        # AGGREGAZIONE INTELLIGENTE UTENZE - Logica semplificata
        # Identifica e seleziona solo le voci principali delle fatture utenze
        logger.info(f"AGGREGAZIONE: Inizio selezione voci principali utenze")
        
        try:
            from server.app.services.classificazione_costi_service import classificazione_service
            logger.info(f"AGGREGAZIONE: Servizio classificazione importato")
        except Exception as e:
            logger.error(f"AGGREGAZIONE: Errore import servizio: {str(e)}")
            classificazione_service = None
        
        if classificazione_service:
            voci_principali_utenze = 0
            voci_secondarie_rimosse = 0
            fatture_utenze_processate = {}
            
            # Raggruppa per codice fattura e identifica le utenze
            for idx, det_row in df_dettagli_processato.iterrows():
                def safe_str_agg(val, default=''):
                    if pd.isna(val):
                        return default
                    if isinstance(val, bytes):
                        return val.decode('latin-1', errors='ignore').strip()
                    return str(val).strip()
                
                cod_fat_str = safe_str_agg(det_row.get(col_map_dettagli['codice_fattura']))
                cod_fornitore = fatture_fornitori_map.get(cod_fat_str, '')
                nome_fornitore = fornitori_map.get(cod_fornitore, '')
                descrizione = safe_str_agg(det_row.get(col_map_dettagli['descrizione']))
                prezzo = det_row.get(col_map_dettagli['prezzo_unitario'], 0) or 0
                
                # Verifica se è un fornitore utenze
                if classificazione_service.is_fornitore_utenze(nome_fornitore)['is_utenza']:
                    if cod_fat_str not in fatture_utenze_processate:
                        fatture_utenze_processate[cod_fat_str] = {
                            'voci': [],
                            'codice_fornitore': cod_fornitore,
                            'nome_fornitore': nome_fornitore
                        }
                    
                    fatture_utenze_processate[cod_fat_str]['voci'].append({
                        'index': idx,
                        'descrizione': descrizione,
                        'prezzo': float(prezzo),
                        'row_data': det_row
                    })
            
            # Per ogni fattura utenze, seleziona la voce principale
            indici_da_rimuovere = set()
            for cod_fattura, fattura_data in fatture_utenze_processate.items():
                voci = fattura_data['voci']
                if len(voci) <= 1:
                    continue  # Una sola voce, niente da fare
                
                # Trova la voce principale (importo maggiore, escludendo voci secondarie)
                voci_filtrate = []
                for voce in voci:
                    desc_lower = voce['descrizione'].lower()
                    # Escludi voci chiaramente secondarie
                    if (not any(keyword in desc_lower for keyword in ['iva', 'imposta', 'sconto', 'trasporto']) and
                        voce['prezzo'] >= 5.0):  # Importo minimo significativo
                        voci_filtrate.append(voce)
                
                if not voci_filtrate:
                    voci_filtrate = voci  # Fallback: usa tutte le voci
                
                # Seleziona la voce con importo maggiore
                voce_principale = max(voci_filtrate, key=lambda x: x['prezzo'])
                
                # Modifica la descrizione della voce principale
                nome_fornitore = fattura_data['nome_fornitore']
                nuova_descrizione = f"{nome_fornitore} - Fattura #{cod_fattura}"
                
                # Aggiorna la descrizione nel DataFrame
                df_dettagli_processato.loc[voce_principale['index'], col_map_dettagli['descrizione']] = nuova_descrizione
                
                # Marca le altre voci per la rimozione
                for voce in voci:
                    if voce['index'] != voce_principale['index']:
                        indici_da_rimuovere.add(voce['index'])
                        voci_secondarie_rimosse += 1
                
                voci_principali_utenze += 1
            
            # Rimuovi le voci secondarie
            if indici_da_rimuovere:
                df_dettagli_processato = df_dettagli_processato.drop(indici_da_rimuovere).reset_index(drop=True)
            
            logger.info(f"AGGREGAZIONE: {voci_principali_utenze} fatture utenze processate, "
                       f"{voci_secondarie_rimosse} voci secondarie rimosse, "
                       f"DataFrame finale: {len(df_dettagli_processato)} righe")
        else:
            logger.warning(f"AGGREGAZIONE: Saltata - servizio non disponibile")
        
        # Estrai materiali unici dai dettagli (ora con voci principali utenze)
        materiali_unici = {}
        
        for _, det_row in df_dettagli_processato.iterrows():
            descrizione = det_row.get(col_map_dettagli['descrizione'])
            codice_articolo = det_row.get(col_map_dettagli['codice_articolo'])
            codice_fattura = det_row.get(col_map_dettagli['codice_fattura'])
            
            # Safe string conversion
            def safe_str(val, default=''):
                if pd.isna(val):
                    return default
                if isinstance(val, bytes):
                    return val.decode('latin-1', errors='ignore').strip()
                return str(val).strip()
            
            desc_str = safe_str(descrizione)
            cod_art_str = safe_str(codice_articolo)
            cod_fat_str = safe_str(codice_fattura)
            
            # Pulisci codice articolo - rimuovi placeholder per utenze/servizi
            if cod_art_str in ['ZZZZZL', 'ZZZZZ', 'NULL', '']:
                cod_art_str = ''
            
            # Filtra descrizioni valide
            if (desc_str and len(desc_str) > 5 and
                'DDT' not in desc_str.upper() and
                'COD_FORNITORE' not in desc_str.upper() and
                'TRASPORTO' not in desc_str.upper() and
                'SPESE' not in desc_str.upper()):
                
                # Ottieni fornitore dalla fattura
                cod_fornitore = fatture_fornitori_map.get(cod_fat_str, '')
                nome_fornitore = fornitori_map.get(cod_fornitore, '')
                
                # Applica filtro fornitore se specificato
                if codice_fornitore_filtro and cod_fornitore != codice_fornitore_filtro:
                    continue
                
                # Chiave unica per materiale
                chiave_materiale = f"{cod_art_str}|{desc_str}|{cod_fornitore}"
                
                if chiave_materiale not in materiali_unici:
                    materiali_unici[chiave_materiale] = {
                        'codicearticolo': cod_art_str,
                        'nome': desc_str,
                        'fornitoreid': cod_fornitore,
                        'fornitorenome': nome_fornitore,
                        'occorrenze': 1
                    }
                else:
                    materiali_unici[chiave_materiale]['occorrenze'] += 1
        
        # Connetti al database SQLite per ottenere classificazioni esistenti
        import sqlite3
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Ottieni classificazioni esistenti dalla tabella materiali (SQLite)
        cursor.execute('''
            SELECT m.codicearticolo,
                   m.nome,
                   m.fornitoreid,
                   m.fornitorenome,
                   m.contoid,
                   c.nome as contonome,
                   m.brancaid,
                   b.nome as brancanome,
                   m.sottocontoid,
                   s.nome as sottocontonome,
                   m.categoria_contabile,
                   m.metodo_classificazione,
                   m.confidence,
                   m.confermato as confermato_da_utente
            FROM materiali m
            LEFT JOIN conti c ON m.contoid = c.id
            LEFT JOIN branche b ON m.brancaid = b.id
            LEFT JOIN sottoconti s ON m.sottocontoid = s.id
        ''')
        
        classificazioni_esistenti = {}
        for row in cursor.fetchall():
            codicearticolo, nome, fornitoreid, fornitorenome, contoid, contonome, brancaid, brancanome, sottocontoid, sottocontonome, categoria_contabile, metodo_classificazione, confidence, confermato = row
            chiave = f"{codicearticolo}|{nome}|{fornitoreid}"
            classificazioni_esistenti[chiave] = {
                'contoid': contoid,
                'contonome': contonome,
                'brancaid': brancaid,
                'brancanome': brancanome,
                'sottocontoid': sottocontoid,
                'sottocontonome': sottocontonome,
                'categoria_contabile': categoria_contabile,
                'metodo_classificazione': metodo_classificazione,
                'confidence': confidence,
                'confermato_da_utente': bool(confermato)
            }
        
        conn.close()
        
        # Risolvi la branca a partire da conto_nome/sottoconto_nome
        def resolve_branca_id(conto_nome: str, sottoconto_nome: str):
            try:
                conn_r = sqlite3.connect('server/instance/studio_dima.db')
                c = conn_r.cursor()
                c.execute('''
                    SELECT b.id
                    FROM sottoconti s
                    JOIN branche b ON s.brancaid = b.id
                    JOIN conti c2 ON s.contoid = c2.id
                    WHERE c2.nome = ? AND s.nome = ?
                    LIMIT 1
                ''', (conto_nome, sottoconto_nome))
                r = c.fetchone()
                conn_r.close()
                return r[0] if r else None
            except Exception:
                return None

        # Funzione per classificazione automatica usando il nuovo sistema intelligente
        def classifica_automaticamente(descrizione, codice_articolo, codice_fornitore=None, nome_fornitore=""):
            try:
                # Usa il nostro nuovo servizio di classificazione intelligente
                result = gestionale_service.categorize_spesa(descrizione, nome_fornitore, codice_fornitore or "")
                
                if result and result.get("confidence", 0) > 0.3:  # Soglia minima 30%
                    # Usa i nomi già recuperati dalla query con JOIN, se disponibili
                    conto_nome = result.get("conto_nome")
                    branca_nome = result.get("branca_nome")
                    sottoconto_nome = result.get("sottoconto_nome")
                    
                    # Fallback ai lookup se i nomi non sono presenti (per compatibilità)
                    if not conto_nome or not branca_nome or not sottoconto_nome:
                        conn = sqlite3.connect('server/instance/studio_dima.db')
                        cursor = conn.cursor()
                        
                        if not conto_nome and result.get("conto_suggerito"):
                            cursor.execute("SELECT nome FROM conti WHERE id = ?", (result["conto_suggerito"],))
                            row = cursor.fetchone()
                            conto_nome = row[0] if row else None
                            
                        if not branca_nome and result.get("branca_suggerita"):
                            cursor.execute("SELECT nome FROM branche WHERE id = ?", (result["branca_suggerita"],))
                            row = cursor.fetchone()
                            branca_nome = row[0] if row else None
                            
                        if not sottoconto_nome and result.get("sottoconto_suggerito"):
                            cursor.execute("SELECT nome FROM sottoconti WHERE id = ?", (result["sottoconto_suggerito"],))
                            row = cursor.fetchone()
                            sottoconto_nome = row[0] if row else None
                        
                        conn.close()
                    
                    logger.info(f"Classificazione per {nome_fornitore}: {conto_nome} -> {branca_nome} -> {sottoconto_nome}")
                    
                    return {
                        'contoid': result.get("conto_suggerito"),
                        'contonome': conto_nome,
                        'brancaid': result.get("branca_suggerita"),
                        'brancanome': branca_nome,
                        'sottocontoid': result.get("sottoconto_suggerito"),
                        'sottocontonome': sottoconto_nome,
                        'categoria_contabile': result.get("categoria_nome"),
                        'metodo_classificazione': 'intelligente',
                        'confidence': int(result.get("confidence", 0) * 100),
                        'confermato_da_utente': False,
                        'motivo': result.get("motivo", "")
                    }
                    
            except Exception as e:
                logger.warning(f"Errore classificazione intelligente per {descrizione}: {e}")
            
            # Fallback al sistema vecchio
            descrizione_upper = descrizione.upper()
            
            conn = sqlite3.connect('server/instance/studio_dima.db')
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT pattern_descrizione, conto_codice, sottoconto_codice, 
                       categoria_contabile, priorita
                FROM categorizzazione_dettaglio_fattura 
                WHERE attivo = 1
                ORDER BY priorita DESC
            ''')
            
            patterns = cursor.fetchall()
            conn.close()
            
            for pattern, conto, sottoconto, categoria, priorita in patterns:
                if pattern in descrizione_upper:
                    branca_id = resolve_branca_id(conto, sottoconto)
                    # Ottieni gli ID dai nomi per il nuovo formato
                    conn_ids = sqlite3.connect('server/instance/studio_dima.db')
                    cursor_ids = conn_ids.cursor()
                    
                    # Ottieni contoid
                    cursor_ids.execute("SELECT id FROM conti WHERE nome = ?", (conto,))
                    conto_row = cursor_ids.fetchone()
                    contoid = conto_row[0] if conto_row else None
                    
                    # Ottieni sottocontoid
                    cursor_ids.execute("SELECT id FROM sottoconti WHERE nome = ?", (sottoconto,))
                    sottoconto_row = cursor_ids.fetchone()
                    sottocontoid = sottoconto_row[0] if sottoconto_row else None
                    
                    # Ottieni brancanome
                    brancanome = None
                    if branca_id:
                        cursor_ids.execute("SELECT nome FROM branche WHERE id = ?", (branca_id,))
                        branca_row = cursor_ids.fetchone()
                        brancanome = branca_row[0] if branca_row else None
                    
                    conn_ids.close()
                    
                    return {
                        'contoid': contoid,
                        'contonome': conto,
                        'brancaid': branca_id,
                        'brancanome': brancanome,
                        'sottocontoid': sottocontoid,
                        'sottocontonome': sottoconto,
                        'categoria_contabile': categoria,
                        'metodo_classificazione': 'pattern',
                        'confidence': min(95, priorita),
                        'confermato_da_utente': False
                    }
            
            return None
        
        # Prepara risultati finali
        materiali_risultato = []
        stats = {'classificati': 0, 'non_classificati': 0, 'da_verificare': 0}
        materiali_filtrati_2plus = 0  # Conta materiali filtrati per 2+ livelli
        
        for chiave, materiale in materiali_unici.items():
            risultato = materiale.copy()
            
            # Verifica se già classificato manualmente
            if chiave in classificazioni_esistenti:
                classificazione = classificazioni_esistenti[chiave]
                brancaid = classificazione.get('brancaid', 0)
                
                # FILTRO: Escludere materiali già classificati a 2+ livelli (con branca)
                # Solo materiali con classificazione parziale (solo conto) o non classificati devono apparire
                if brancaid and brancaid != 0:
                    materiali_filtrati_2plus += 1
                    continue  # Salta questo materiale - già classificato a 2+ livelli
                
                risultato.update(classificazione)
                risultato['stato_classificazione'] = 'classificato'
                stats['classificati'] += 1
            else:
                # Prima prova classificazione automatica standard
                auto_class = classifica_automaticamente(
                    materiale['nome'], 
                    materiale['codicearticolo'],
                    materiale['fornitoreid'],
                    materiale['fornitorenome']
                )
                
                # Poi verifica se è un fornitore utenze per classificazione ereditata
                utenza_class = None
                if classificazione_service and materiale['fornitorenome']:
                    utenza_info = classificazione_service.is_fornitore_utenze(materiale['fornitorenome'])
                    if utenza_info['is_utenza']:
                        # Classifica automaticamente come utenza con classificazione del fornitore
                        classificazione_suggerita = utenza_info.get('classificazione_suggerita', {})
                        if classificazione_suggerita:
                            utenza_class = {
                                'contoid': None,  # Sarà risolto dopo
                                'contonome': 'UTENZE',
                                'brancaid': None,  # Sarà risolto dopo
                                'brancanome': classificazione_suggerita.get('branca', 'GENERICHE'),
                                'sottocontoid': None,  # Sarà risolto dopo
                                'sottocontonome': classificazione_suggerita.get('sottoconto', 'BOLLETTE'),
                                'categoria_contabile': f"UTENZE - {classificazione_suggerita.get('branca', 'GENERICHE')}",
                                'metodo_classificazione': 'utenza_ereditata',
                                'confidence': 85,  # Alta confidenza per utenze
                                'confermato_da_utente': False
                            }
                
                # Usa classificazione utenze se disponibile, altrimenti quella standard
                if utenza_class:
                    # FILTRO: Le utenze hanno sempre 2+ livelli, quindi non le mostriamo in ContiSottocontiTab
                    # Classificale automaticamente ma non includerle nella tabella
                    materiali_filtrati_2plus += 1
                    continue  # Salta materiale utenze - auto-classificato a 2+ livelli
                elif auto_class and auto_class['confidence'] >= 30:
                    risultato.update(auto_class)
                    risultato['stato_classificazione'] = 'da_verificare'
                    stats['da_verificare'] += 1
                else:
                    risultato.update({
                        'contoid': None,
                        'contonome': None,
                        'brancaid': None,
                        'brancanome': None,
                        'sottocontoid': None,
                        'sottocontonome': None,
                        'categoria_contabile': None,
                        'metodo_classificazione': None,
                        'confidence': 0,
                        'confermato_da_utente': False
                    })
                    risultato['stato_classificazione'] = 'non_classificato'
                    stats['non_classificati'] += 1
            
            materiali_risultato.append(risultato)
        
        # Filtra per stato se richiesto
        if stato != 'tutti':
            # Mappa gli stati dalla UI (plurale) agli stati interni (singolare)
            stato_map = {
                'classificati': 'classificato',
                'non_classificati': 'non_classificato', 
                'da_verificare': 'da_verificare'
            }
            stato_filtro = stato_map.get(stato, stato)
            materiali_risultato = [m for m in materiali_risultato 
                                 if m['stato_classificazione'] == stato_filtro]
        
        # Ordina per occorrenze decrescenti
        materiali_risultato.sort(key=lambda x: x['occorrenze'], reverse=True)
        
        # Log finale con info filtro
        logger.info(f"MATERIALI: {len(materiali_risultato)} materiali finali (esclusi {materiali_filtrati_2plus} già classificati a 2+ livelli)")
        
        # Paginazione
        total = len(materiali_risultato)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        materiali_paginati = materiali_risultato[start_idx:end_idx]
        
        return jsonify({
            'success': True,
            'data': materiali_paginati,
            'total': total,
            'page': page,
            'limit': limit,
            'total_pages': (total + limit - 1) // limit,
            'stats': stats,
            'filters_applied': {
                'stato': stato,
                'fornitore': codice_fornitore_filtro
            }
        })
        
    except Exception as e:
        logger.error(f"Errore recupero materiali da classificare: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/salva-classificazione-materiale', methods=['POST'])
@jwt_required()
def salva_classificazione_materiale():
    """
    Salva o aggiorna la classificazione di un materiale
    
    Body: {
        "codice_articolo": "DM1 1012148",
        "descrizione": "CELTRA DUO S LT A3",
        "codice_fornitore": "ZZZZZO",
        "nome_fornitore": "DENTSPLY SIRONA",
        "conto_codice": "ZZZZZZ",
        "sottoconto_codice": "Blocchetti cerec",
        "categoria_contabile": "Materiali Dentali - Blocchetti CEREC"
    }
    """
    try:
        data = request.get_json()
        
        # Validazione campi obbligatori
        required_fields = ['descrizione', 'codice_fornitore', 'conto_codice', 'sottoconto_codice']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        # Estrai dati
        codice_articolo = data.get('codice_articolo', '').strip()
        descrizione = data.get('descrizione', '').strip()
        codice_fornitore = data.get('codice_fornitore', '').strip()
        nome_fornitore = data.get('nome_fornitore', '').strip()
        conto_codice = data.get('conto_codice', '').strip()
        sottoconto_codice = data.get('sottoconto_codice', '').strip()
        categoria_contabile = data.get('categoria_contabile', '').strip()
        note = data.get('note', '').strip()
        
        # Connetti al database
        import sqlite3
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        try:
            # Verifica se esiste già una classificazione
            cursor.execute('''
                SELECT id FROM materiali_classificazioni 
                WHERE codice_articolo = ? AND descrizione = ? AND codice_fornitore = ?
            ''', (codice_articolo, descrizione, codice_fornitore))
            
            existing_id = cursor.fetchone()
            
            if existing_id:
                # Aggiorna classificazione esistente
                cursor.execute('''
                    UPDATE materiali_classificazioni 
                    SET nome_fornitore = ?, conto_codice = ?, sottoconto_codice = ?,
                        categoria_contabile = ?, metodo_classificazione = 'manuale',
                        confidence = 100, confermato_da_utente = TRUE,
                        data_ultima_modifica = CURRENT_TIMESTAMP, note = ?
                    WHERE id = ?
                ''', (nome_fornitore, conto_codice, sottoconto_codice, 
                      categoria_contabile, note, existing_id[0]))
                
                operazione = 'aggiornata'
                record_id = existing_id[0]
                
            else:
                # Inserisci nuova classificazione
                cursor.execute('''
                    INSERT INTO materiali_classificazioni 
                    (codice_articolo, descrizione, codice_fornitore, nome_fornitore,
                     conto_codice, sottoconto_codice, categoria_contabile,
                     metodo_classificazione, confidence, confermato_da_utente, note)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'manuale', 100, TRUE, ?)
                ''', (codice_articolo, descrizione, codice_fornitore, nome_fornitore,
                      conto_codice, sottoconto_codice, categoria_contabile, note))
                
                operazione = 'salvata'
                record_id = cursor.lastrowid
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'Classificazione {operazione} con successo',
                'data': {
                    'id': record_id,
                    'operazione': operazione,
                    'classificazione': {
                        'codice_articolo': codice_articolo,
                        'descrizione': descrizione,
                        'codice_fornitore': codice_fornitore,
                        'nome_fornitore': nome_fornitore,
                        'conto_codice': conto_codice,
                        'sottoconto_codice': sottoconto_codice,
                        'categoria_contabile': categoria_contabile,
                        'confidence': 100,
                        'metodo_classificazione': 'manuale'
                    }
                }
            })
            
        except sqlite3.IntegrityError as e:
            conn.rollback()
            return jsonify({
                'success': False,
                'error': f'Errore integrità database: {str(e)}'
            }), 400
            
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Errore salvataggio classificazione materiale: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/conti-disponibili', methods=['GET'])
@jwt_required()
def get_conti_disponibili():
    """
    Restituisce tutti i conti disponibili dal database SQLite
    """
    try:
        import sqlite3
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, nome FROM conti ORDER BY nome')
        conti_rows = cursor.fetchall()
        
        conti = []
        for row in conti_rows:
            conti.append({
                'id': row[0],
                'codice': str(row[0]),  # Per compatibilità con il frontend
                'descrizione': row[1],
                'tipo': '',  # Non abbiamo tipo nel nuovo schema
                'label': f"{row[0]} - {row[1]}"
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': conti,
            'total': len(conti)
        })
        
    except Exception as e:
        logger.error(f"Errore recupero conti disponibili: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/sottoconti-disponibili/<string:conto_codice>', methods=['GET'])
@jwt_required()
def get_sottoconti_disponibili(conto_codice):
    """
    Restituisce i sottoconti disponibili per un conto specifico
    """
    try:
        import sqlite3
        
        # Estrai sottoconti unici dalle classificazioni esistenti per questo conto
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Sottoconti dai pattern automatici
        cursor.execute('''
            SELECT DISTINCT sottoconto_codice, categoria_contabile
            FROM categorizzazione_dettaglio_fattura 
            WHERE conto_codice = ? AND attivo = 1
            ORDER BY sottoconto_codice
        ''', (conto_codice,))
        
        sottoconti_automatici = cursor.fetchall()
        
        # Sottoconti dalle classificazioni manuali
        cursor.execute('''
            SELECT DISTINCT sottoconto_codice, categoria_contabile
            FROM materiali_classificazioni 
            WHERE conto_codice = ?
            ORDER BY sottoconto_codice
        ''', (conto_codice,))
        
        sottoconti_manuali = cursor.fetchall()
        conn.close()
        
        # Unisci e deduplica
        sottoconti_set = set()
        sottoconti = []
        
        for sottoconto, categoria in sottoconti_automatici + sottoconti_manuali:
            if sottoconto and sottoconto not in sottoconti_set:
                sottoconti_set.add(sottoconto)
                sottoconti.append({
                    'codice': sottoconto,
                    'descrizione': categoria or sottoconto,
                    'label': f'{sottoconto} - {categoria}' if categoria else sottoconto,
                    'fonte': 'sistema'
                })
        
        # Ordina per codice
        sottoconti.sort(key=lambda x: x['codice'])
        
        return jsonify({
            'success': True,
            'data': sottoconti,
            'total': len(sottoconti),
            'conto_codice': conto_codice
        })
        
    except Exception as e:
        logger.error(f"Errore recupero sottoconti per conto {conto_codice}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/conferma-classificazione-materiale', methods=['POST'])
@jwt_required()
def conferma_classificazione_materiale():
    """
    Conferma una classificazione automatica da "da_verificare" a "classificato"
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Nessun dato ricevuto'}), 400
        
        codice_articolo = data.get('codice_articolo', '').strip()
        descrizione = data.get('descrizione', '').strip()
        codice_fornitore = data.get('codice_fornitore', '').strip()
        nome_fornitore = data.get('nome_fornitore', '').strip()
        conto_codice = data.get('conto_codice', '').strip()
        sottoconto_codice = data.get('sottoconto_codice', '').strip()
        categoria_contabile = data.get('categoria_contabile', '').strip()
        
        if not all([descrizione, codice_fornitore, conto_codice, sottoconto_codice]):
            return jsonify({
                'success': False,
                'error': 'Dati obbligatori mancanti'
            }), 400
        
        # Connessione database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Controlla se esiste già una classificazione
            cursor.execute('''
                SELECT id FROM materiali_classificazioni 
                WHERE codice_articolo = ? AND descrizione = ? AND codice_fornitore = ?
            ''', (codice_articolo, descrizione, codice_fornitore))
            
            existing = cursor.fetchone()
            
            if existing:
                # Aggiorna esistente confermandola
                cursor.execute('''
                    UPDATE materiali_classificazioni 
                    SET confermato_da_utente = TRUE,
                        metodo_classificazione = 'confermato',
                        confidence = 100,
                        data_aggiornamento = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (existing[0],))
                operazione = 'confermata'
                record_id = existing[0]
            else:
                # Inserisce nuova classificazione confermata
                cursor.execute('''
                    INSERT INTO materiali_classificazioni 
                    (codice_articolo, descrizione, codice_fornitore, nome_fornitore,
                     conto_codice, sottoconto_codice, categoria_contabile,
                     metodo_classificazione, confidence, confermato_da_utente)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'confermato', 100, TRUE)
                ''', (codice_articolo, descrizione, codice_fornitore, nome_fornitore,
                      conto_codice, sottoconto_codice, categoria_contabile))
                
                operazione = 'confermata'
                record_id = cursor.lastrowid
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'Classificazione {operazione} con successo',
                'data': {
                    'id': record_id,
                    'operazione': operazione,
                    'classificazione': {
                        'codice_articolo': codice_articolo,
                        'descrizione': descrizione,
                        'codice_fornitore': codice_fornitore,
                        'nome_fornitore': nome_fornitore,
                        'conto_codice': conto_codice,
                        'sottoconto_codice': sottoconto_codice,
                        'categoria_contabile': categoria_contabile,
                        'confidence': 100,
                        'metodo_classificazione': 'confermato',
                        'confermato_da_utente': True,
                        'stato_classificazione': 'classificato'
                    }
                }
            })
            
        except sqlite3.IntegrityError as e:
            conn.rollback()
            return jsonify({
                'success': False,
                'error': f'Errore integrità database: {str(e)}'
            }), 400
            
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Errore conferma classificazione materiale: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@spese_fornitori_bp.route('/conferma-tutti-da-verificare', methods=['POST'])
@jwt_required()
def conferma_tutti_da_verificare():
    """
    Conferma tutte le classificazioni automatiche da "da_verificare" a "classificato"
    """
    try:
        # Connessione database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        materiali_confermati = 0
        
        try:
            # Prima ottieni tutti i materiali da verificare usando la stessa logica
            # dell'endpoint materiali-da-classificare
            
            path_vocispes = _get_dbf_path('vocispes')
            path_spesafor = _get_dbf_path('spese_fornitori')
            path_fornitor = _get_dbf_path('fornitori')
            
            df_vocispes = _leggi_tabella_dbf(path_vocispes)
            df_spesafor = _leggi_tabella_dbf(path_spesafor)  
            df_fornitor = _leggi_tabella_dbf(path_fornitor)
            
            if df_vocispes.empty or df_spesafor.empty:
                return jsonify({
                    'success': True,
                    'message': 'Nessun materiale da elaborare',
                    'materiali_confermati': 0
                })
            
            # Ottieni classificazioni esistenti
            cursor.execute('''
                SELECT codice_articolo, descrizione, codice_fornitore,
                       conto_codice, sottoconto_codice, categoria_contabile,
                       metodo_classificazione, confidence, confermato_da_utente
                FROM materiali_classificazioni
            ''')
            
            classificazioni_esistenti = {}
            for row in cursor.fetchall():
                def safe_str_db(val, default=''):
                    if val is None:
                        return default
                    if isinstance(val, bytes):
                        return val.decode('latin-1', errors='ignore').strip()
                    return str(val).strip()
                
                cod_art = safe_str_db(row[0])
                desc = safe_str_db(row[1])  
                cod_forn = safe_str_db(row[2])
                chiave = f"{cod_art}|{desc}|{cod_forn}"
                
                classificazioni_esistenti[chiave] = {
                    'conto_codice': safe_str_db(row[3]),
                    'sottoconto_codice': safe_str_db(row[4]),
                    'categoria_contabile': safe_str_db(row[5]),
                    'metodo_classificazione': safe_str_db(row[6]),
                    'confidence': row[7] or 0,
                    'confermato_da_utente': bool(row[8])
                }
            
            # Ottieni patterns classificazione
            cursor.execute('''
                SELECT pattern_codice, pattern_descrizione, conto_codice, sottoconto_codice
                FROM categorizzazione_dettaglio_fattura
                ORDER BY priority ASC
            ''')
            
            patterns = cursor.fetchall()
            
            def classifica_automaticamente(descrizione, codice_articolo):
                desc_lower = descrizione.lower()
                cod_lower = (codice_articolo or '').lower()
                
                for pattern in patterns:
                    pattern_cod = pattern[0] or ''
                    pattern_desc = pattern[1] or ''
                    
                    if pattern_cod and pattern_cod.lower() in cod_lower:
                        return {
                            'conto_codice': pattern[2],
                            'sottoconto_codice': pattern[3], 
                            'categoria_contabile': f"{pattern[2]} - {pattern[3]}",
                            'metodo_classificazione': 'pattern_codice',
                            'confidence': 95,
                            'confermato_da_utente': False
                        }
                    
                    if pattern_desc and pattern_desc.lower() in desc_lower:
                        return {
                            'conto_codice': pattern[2],
                            'sottoconto_codice': pattern[3],
                            'categoria_contabile': f"{pattern[2]} - {pattern[3]}",
                            'metodo_classificazione': 'pattern_descrizione',
                            'confidence': 85,
                            'confermato_da_utente': False
                        }
                
                return None
            
            # Processa materiali per trovare quelli "da_verificare"
            materiali_da_confermare = []
            
            # Safe string conversion function
            def safe_str(val, default=''):
                if pd.isna(val):
                    return default
                if isinstance(val, bytes):
                    return val.decode('latin-1', errors='ignore').strip()
                return str(val).strip()
            
            # Join tables e crea lista materiali unici usando nomi colonne corretti
            col_map_vocispes = COLONNE['dettagli_spese_fornitori']  # VOCISPES.DBF mapping
            col_map_spese = COLONNE['spese_fornitori']              # SPESAFOR.DBF mapping  
            col_map_fornitori = COLONNE['fornitori']                # FORNITOR.DBF mapping
            
            df_merged = df_vocispes.merge(df_spesafor, left_on=col_map_vocispes['codice_fattura'], right_on=col_map_spese['id'], how='inner')
            df_merged = df_merged.merge(df_fornitor, left_on=col_map_spese['codice_fornitore'], right_on=col_map_fornitori['id'], how='left')
            
            materiali_unici = {}
            
            for _, row in df_merged.iterrows():
                cod_art = safe_str(row.get(col_map_vocispes['codice_articolo']))
                desc = safe_str(row.get(col_map_vocispes['descrizione']))
                cod_forn = safe_str(row.get(col_map_spese['codice_fornitore']))
                nome_forn = safe_str(row.get(col_map_fornitori['nome']))
                
                if not desc or not cod_forn:
                    continue
                    
                chiave = f"{cod_art}|{desc}|{cod_forn}"
                
                if chiave not in materiali_unici:
                    materiali_unici[chiave] = {
                        'codice_articolo': cod_art,
                        'descrizione': desc,
                        'codice_fornitore': cod_forn,
                        'nome_fornitore': nome_forn,
                        'occorrenze': 1
                    }
                else:
                    materiali_unici[chiave]['occorrenze'] += 1
            
            # Trova materiali "da_verificare"
            for chiave, materiale in materiali_unici.items():
                # Salta se già classificato manualmente
                if chiave in classificazioni_esistenti and classificazioni_esistenti[chiave]['confermato_da_utente']:
                    continue
                
                # Prova classificazione automatica
                auto_class = classifica_automaticamente(
                    materiale['descrizione'], 
                    materiale['codice_articolo']
                )
                
                if auto_class and auto_class['confidence'] >= 85:
                    # Questo è un materiale "da_verificare"
                    materiali_da_confermare.append({
                        'codice_articolo': materiale['codice_articolo'],
                        'descrizione': materiale['descrizione'], 
                        'codice_fornitore': materiale['codice_fornitore'],
                        'nome_fornitore': materiale['nome_fornitore'],
                        'conto_codice': auto_class['conto_codice'],
                        'sottoconto_codice': auto_class['sottoconto_codice'],
                        'categoria_contabile': auto_class['categoria_contabile']
                    })
            
            # Conferma tutti i materiali da verificare
            for materiale in materiali_da_confermare:
                # Controlla se esiste già
                cursor.execute('''
                    SELECT id FROM materiali_classificazioni 
                    WHERE codice_articolo = ? AND descrizione = ? AND codice_fornitore = ?
                ''', (materiale['codice_articolo'], materiale['descrizione'], materiale['codice_fornitore']))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Aggiorna esistente
                    cursor.execute('''
                        UPDATE materiali_classificazioni 
                        SET confermato_da_utente = TRUE,
                            metodo_classificazione = 'confermato_bulk',
                            confidence = 100,
                            data_aggiornamento = CURRENT_TIMESTAMP
                        WHERE id = ?
                    ''', (existing[0],))
                else:
                    # Inserisce nuova
                    cursor.execute('''
                        INSERT INTO materiali_classificazioni 
                        (codice_articolo, descrizione, codice_fornitore, nome_fornitore,
                         conto_codice, sottoconto_codice, categoria_contabile,
                         metodo_classificazione, confidence, confermato_da_utente)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'confermato_bulk', 100, TRUE)
                    ''', (materiale['codice_articolo'], materiale['descrizione'], 
                          materiale['codice_fornitore'], materiale['nome_fornitore'],
                          materiale['conto_codice'], materiale['sottoconto_codice'], 
                          materiale['categoria_contabile']))
                
                materiali_confermati += 1
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'Confermate {materiali_confermati} classificazioni automatiche',
                'materiali_confermati': materiali_confermati
            })
            
        except Exception as e:
            conn.rollback()
            raise e
            
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Errore conferma tutti da verificare: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500