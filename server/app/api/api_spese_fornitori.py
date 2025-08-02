from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
from datetime import datetime, date
import pandas as pd
from server.app.core.db_calendar import _get_dbf_path, _leggi_tabella_dbf
from server.app.config.constants import COLONNE

logger = logging.getLogger(__name__)

spese_fornitori_bp = Blueprint('spese_fornitori', __name__)

@spese_fornitori_bp.route('/api/spese-fornitori', methods=['GET'])
#@jwt_required()
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

@spese_fornitori_bp.route('/api/spese-fornitori/riepilogo', methods=['GET'])
#@jwt_required()
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

@spese_fornitori_bp.route('/api/spese-fornitori/<string:fattura_id>/dettagli', methods=['GET'])
@jwt_required()
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

@spese_fornitori_bp.route('/api/spese-fornitori/ricerca-articoli', methods=['GET'])
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