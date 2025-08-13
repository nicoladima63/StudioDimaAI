"""
API endpoints per statistiche fornitori flessibili
Combina classificazioni da studio_dima.db con dati finanziari da DBF
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
import sqlite3
import pandas as pd
from datetime import datetime, date
from server.app.core.db_calendar import _get_dbf_path, _leggi_tabella_dbf
from server.app.config.constants import COLONNE
from server.app.config.config import Config
import os

logger = logging.getLogger(__name__)

api_statistiche = Blueprint('api_statistiche', __name__, url_prefix='/api/fornitori')

def safe_float(val):
    """Converte un valore in float sicuro per JSON"""
    try:
        if pd.isna(val):
            return 0.0
        return float(val)
    except (ValueError, TypeError):
        return 0.0

def safe_int(val):
    """Converte un valore in int sicuro per JSON"""
    try:
        if pd.isna(val):
            return 0
        return int(val)
    except (ValueError, TypeError):
        return 0

def get_periodo_filters(periodo='anno_corrente', anni=None, data_inizio=None, data_fine=None):
    """
    Genera filtri temporali per pandas DataFrame con supporto multi-anno
    
    Args:
        periodo: 'anno_corrente', 'ultimo_trimestre', 'ultimi_6_mesi', etc.
        anni: Lista di anni da includere [2023, 2024, 2025] (opzionale)
        data_inizio: Data inizio custom (YYYY-MM-DD)
        data_fine: Data fine custom (YYYY-MM-DD)
    
    Returns:
        tuple: (start_date, end_date) per filtering
    """
    oggi = datetime.now()
    
    # Priorità 1: Range custom esplicito
    if data_inizio and data_fine:
        start_date = pd.to_datetime(data_inizio)
        end_date = pd.to_datetime(data_fine)
        
    # Priorità 2: Multi-anno o singolo anno specificato
    elif anni and len(anni) > 0:
        # Multi-anno: dal gennaio del primo anno al dicembre dell'ultimo
        if len(anni) > 1:
            start_date = pd.to_datetime(f"{min(anni)}-01-01")
            end_date = pd.to_datetime(f"{max(anni)}-12-31")
        else:
            # Singolo anno specificato
            anno = anni[0]
            start_date = pd.to_datetime(f"{anno}-01-01")
            end_date = pd.to_datetime(f"{anno}-12-31")
            
    # Priorità 3: Periodi predefiniti
    elif periodo == 'ultimo_trimestre':
        # Ultimi 3 mesi
        start_date = pd.to_datetime(oggi.replace(month=max(1, oggi.month-2), day=1))
        end_date = pd.to_datetime(oggi)
    elif periodo == 'ultimi_6_mesi':
        # Ultimi 6 mesi
        start_date = pd.to_datetime(oggi.replace(month=max(1, oggi.month-5), day=1))
        end_date = pd.to_datetime(oggi)
    else:
        # Default: anno corrente
        start_date = pd.to_datetime(oggi.replace(month=1, day=1))
        end_date = pd.to_datetime(oggi.replace(month=12, day=31))
    
    return start_date, end_date

@api_statistiche.route('/statistiche', methods=['GET'])
@jwt_required()
def get_statistiche_fornitori():
    """
    Endpoint flessibile per statistiche fornitori con supporto multi-anno
    
    Query params:
    - contoid: Filtra per conto ID (opzionale)
    - brancaid: Filtra per branca ID (opzionale)  
    - sottocontoid: Filtra per sottoconto ID (opzionale)
    - periodo: 'anno_corrente' | 'ultimo_trimestre' | 'ultimi_6_mesi' (default: anno_corrente)
    - anni: Lista di anni separati da virgola es. "2023,2024,2025" (opzionale)
    - data_inizio: Data inizio custom YYYY-MM-DD (opzionale)
    - data_fine: Data fine custom YYYY-MM-DD (opzionale)
    """
    try:
        # Parametri query
        contoid = request.args.get('contoid', type=int)
        brancaid = request.args.get('brancaid', type=int) 
        sottocontoid = request.args.get('sottocontoid', type=int)
        periodo = request.args.get('periodo', default='anno_corrente')
        data_inizio = request.args.get('data_inizio')
        data_fine = request.args.get('data_fine')
        
        # Parsing array di anni dalla query string
        anni_param = request.args.get('anni')
        anni = None
        if anni_param:
            try:
                anni = [int(anno.strip()) for anno in anni_param.split(',') if anno.strip().isdigit()]
                logger.info(f"Anni richiesti: {anni}")
            except (ValueError, AttributeError):
                logger.warning(f"Formato anni non valido: {anni_param}")
                anni = None
        
        logger.info(f"Richiesta statistiche: contoid={contoid}, brancaid={brancaid}, sottocontoid={sottocontoid}, periodo={periodo}, anni={anni}")
        
        # STEP 1: Ottieni fornitori classificati da studio_dima.db
        db_path = os.path.join(Config.INSTANCE_FOLDER, 'studio_dima.db')
        fornitori_classificati = []
        
        with sqlite3.connect(db_path) as conn:
            # Costruisci query dinamica per filtri classificazione
            where_conditions = ["cc.tipo_entita = 'fornitore'"]
            params = []
            
            if contoid:
                where_conditions.append("cc.contoid = ?")
                params.append(contoid)
            if brancaid:
                where_conditions.append("cc.brancaid = ?")
                params.append(brancaid)
            if sottocontoid:
                where_conditions.append("cc.sottocontoid = ?")
                params.append(sottocontoid)
            
            where_clause = " AND ".join(where_conditions)
            
            query = f"""
                SELECT DISTINCT 
                    cc.codice_riferimento,
                    cc.fornitore_nome,
                    cc.contoid,
                    cc.brancaid,
                    cc.sottocontoid,
                    b.nome as branca_nome
                FROM classificazioni_costi cc
                LEFT JOIN branche b ON cc.brancaid = b.id
                WHERE {where_clause}
            """
            
            cursor = conn.execute(query, params)
            for row in cursor.fetchall():
                fornitori_classificati.append({
                    'codice_riferimento': row[0],
                    'fornitore_nome': row[1] or f'Fornitore {row[0]}',
                    'contoid': row[2],
                    'brancaid': row[3],
                    'sottocontoid': row[4],
                    'branca_nome': row[5] or 'Non classificato'
                })
        
        logger.info(f"Trovati {len(fornitori_classificati)} fornitori classificati")
        
        if not fornitori_classificati:
            return jsonify({
                'success': True,
                'data': [],
                'total_fornitori': 0,
                'periodo': {
                    'periodo': periodo,
                    'data_inizio': data_inizio or 'auto',
                    'data_fine': data_fine or 'auto'
                },
                'filters_applied': {
                    'contoid': contoid,
                    'brancaid': brancaid,
                    'sottocontoid': sottocontoid
                }
            })
        
        # STEP 2: Leggi dati finanziari dalle tabelle DBF
        path_spese = _get_dbf_path('spese_fornitori')
        path_fornitori = _get_dbf_path('fornitori')
        
        df_spese = _leggi_tabella_dbf(path_spese)
        df_fornitori = _leggi_tabella_dbf(path_fornitori)
        
        if df_spese.empty:
            logger.warning("Tabella spese fornitori vuota")
            return jsonify({
                'success': True,
                'data': [],
                'total_fornitori': len(fornitori_classificati),
                'warning': 'Nessuna spesa trovata nelle tabelle DBF'
            })
        
        # STEP 3: Applica filtri temporali
        col_map = COLONNE['spese_fornitori']
        col_data = col_map['data_spesa']
        col_costo = col_map['costo_netto']
        col_fornitore = col_map['codice_fornitore']
        
        # Converte date
        df_spese[col_data] = pd.to_datetime(df_spese[col_data], errors='coerce')
        
        # Filtra per periodo con supporto multi-anno
        start_date, end_date = get_periodo_filters(periodo, anni, data_inizio, data_fine)
        mask_periodo = (df_spese[col_data] >= start_date) & (df_spese[col_data] <= end_date)
        df_filtered = df_spese[mask_periodo]
        
        logger.info(f"Spese nel periodo {start_date.date()} - {end_date.date()}: {len(df_filtered)}")
        
        # STEP 4: Crea mappa fornitori per lookup nomi
        fornitori_map = {}
        if not df_fornitori.empty:
            col_map_fornitori = COLONNE['fornitori']
            for _, fornitore_row in df_fornitori.iterrows():
                codice_fornitore = fornitore_row.get(col_map_fornitori['id'])
                nome_fornitore = fornitore_row.get(col_map_fornitori['nome'])
                
                if pd.notna(codice_fornitore) and pd.notna(nome_fornitore):
                    # Gestisci bytes e strings
                    if isinstance(codice_fornitore, bytes):
                        codice_fornitore = codice_fornitore.decode('latin-1', errors='ignore').strip()
                    if isinstance(nome_fornitore, bytes):
                        nome_fornitore = nome_fornitore.decode('latin-1', errors='ignore').strip()
                    
                    fornitori_map[str(codice_fornitore).strip()] = str(nome_fornitore).strip()
        
        # STEP 5: Filtra spese solo per fornitori classificati
        codici_classificati = {f['codice_riferimento'] for f in fornitori_classificati}
        
        def match_fornitore_classificato(val):
            """Controlla se il codice fornitore è nei classificati"""
            if pd.isna(val):
                return False
            if isinstance(val, bytes):
                val_str = val.decode('latin-1', errors='ignore').strip()
            else:
                val_str = str(val).strip()
            return val_str in codici_classificati
        
        mask_classificati = df_filtered[col_fornitore].apply(match_fornitore_classificato)
        df_classificati = df_filtered[mask_classificati]
        
        logger.info(f"Spese di fornitori classificati: {len(df_classificati)}")
        
        # STEP 6: Aggrega statistiche per fornitore
        statistiche_risultato = []
        totale_generale = safe_float(df_classificati[col_costo].sum())
        
        # Group by fornitore per aggregazione
        def clean_fornitore_code(val):
            """Pulisce codice fornitore per groupby"""
            if pd.isna(val):
                return 'UNKNOWN'
            if isinstance(val, bytes):
                return val.decode('latin-1', errors='ignore').strip()
            return str(val).strip()
        
        df_classificati['fornitore_clean'] = df_classificati[col_fornitore].apply(clean_fornitore_code)
        
        fornitore_stats = df_classificati.groupby('fornitore_clean')[col_costo].agg(['sum', 'count', 'mean']).reset_index()
        
        for _, row in fornitore_stats.iterrows():
            codice_fornitore = row['fornitore_clean']
            
            # Trova classificazione
            classificazione = next((f for f in fornitori_classificati if f['codice_riferimento'] == codice_fornitore), None)
            
            if classificazione:
                # Calcola ultima data spesa
                spese_fornitore = df_classificati[df_classificati['fornitore_clean'] == codice_fornitore]
                ultima_spesa = spese_fornitore[col_data].max()
                
                # Usa nome da classificazione o da fornitori_map
                nome_fornitore = classificazione.get('fornitore_nome')
                if not nome_fornitore or nome_fornitore.startswith('Fornitore '):
                    nome_fornitore = fornitori_map.get(codice_fornitore, classificazione['fornitore_nome'])
                
                spesa_totale = safe_float(row['sum'])
                numero_fatture = safe_int(row['count'])
                spesa_media = safe_float(row['mean'])
                
                statistiche_risultato.append({
                    'codice_riferimento': codice_fornitore,
                    'fornitore_nome': nome_fornitore,
                    'spesa_totale': spesa_totale,
                    'numero_fatture': numero_fatture,
                    'spesa_media': spesa_media,
                    'percentuale_sul_totale': round((spesa_totale / totale_generale * 100), 2) if totale_generale > 0 else 0.0,
                    'ultimo_acquisto': ultima_spesa.strftime('%Y-%m-%d') if pd.notna(ultima_spesa) else None,
                    'classificazione': {
                        'contoid': classificazione.get('contoid'),
                        'brancaid': classificazione.get('brancaid'),
                        'sottocontoid': classificazione.get('sottocontoid'),
                        'branca_nome': classificazione.get('branca_nome')
                    }
                })
        
        # Ordina per spesa totale decrescente
        statistiche_risultato.sort(key=lambda x: x['spesa_totale'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': statistiche_risultato,
            'total_fornitori': len(statistiche_risultato),
            'totale_generale': totale_generale,
            'periodo': {
                'periodo': periodo,
                'data_inizio': start_date.strftime('%Y-%m-%d'),
                'data_fine': end_date.strftime('%Y-%m-%d')
            },
            'filters_applied': {
                'contoid': contoid,
                'brancaid': brancaid,
                'sottocontoid': sottocontoid,
                'fornitori_classificati_trovati': len(fornitori_classificati)
            }
        })
        
    except Exception as e:
        logger.error(f"Errore get_statistiche_fornitori: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500