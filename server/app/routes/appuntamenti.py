from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from server.app.core.db_handler import DBHandler
from server.app.config.constants import COLONNE
from datetime import date, timedelta, datetime
import pandas as pd

appuntamenti_bp = Blueprint('appuntamenti', __name__, url_prefix='/api/appuntamenti')

def get_month_range(dt):
    primo = dt.replace(day=1)
    if dt.month == 12:
        prossimo = dt.replace(year=dt.year+1, month=1, day=1)
    else:
        prossimo = dt.replace(month=dt.month+1, day=1)
    return primo, prossimo

@appuntamenti_bp.route('/statistiche', methods=['GET'])
@jwt_required()
def get_stats():
    try:
        print("DEBUG: Inizio get_stats")
        db = DBHandler()
        print(f"DEBUG: DBHandler creato. Path appuntamenti: {db.path_appuntamenti}")
        oggi = date.today()
        mese_corrente = oggi.month
        anno_corrente = oggi.year
        # Calcola mese e anno precedente
        if mese_corrente == 1:
            mese_precedente = 12
            anno_precedente = anno_corrente - 1
        else:
            mese_precedente = mese_corrente - 1
            anno_precedente = anno_corrente
        # Calcola mese e anno prossimo
        if mese_corrente == 12:
            mese_prossimo = 1
            anno_prossimo = anno_corrente + 1
        else:
            mese_prossimo = mese_corrente + 1
            anno_prossimo = anno_corrente
        print(f"DEBUG: Mesi/Anni: prec={mese_precedente}/{anno_precedente}, curr={mese_corrente}/{anno_corrente}, next={mese_prossimo}/{anno_prossimo}")
        # Usa la stessa logica del calendario
        appuntamenti_precedente = db.get_appointments(month=mese_precedente, year=anno_precedente)
        appuntamenti_corrente = db.get_appointments(month=mese_corrente, year=anno_corrente)
        appuntamenti_prossimo = db.get_appointments(month=mese_prossimo, year=anno_prossimo)
        n_precedente = len(appuntamenti_precedente)
        n_corrente = len(appuntamenti_corrente)
        n_prossimo = len(appuntamenti_prossimo)
        print(f"DEBUG: Conteggi: Prec={n_precedente}, Corr={n_corrente}, Next={n_prossimo}")
        # Percentuali
        if n_precedente == 0:
            percentuale_corrente = 100 if n_corrente > 0 else 0
        else:
            percentuale_corrente = round(((n_corrente - n_precedente) / n_precedente) * 100)
        if n_corrente == 0:
            percentuale_prossimo = 100 if n_prossimo > 0 else 0
        else:
            percentuale_prossimo = round(((n_prossimo - n_corrente) / n_corrente) * 100)
        return jsonify({'success': True, 'data': {
            'mese_precedente': n_precedente,
            'mese_corrente': n_corrente,
            'mese_prossimo': n_prossimo,
            'percentuale_corrente': percentuale_corrente,  # corrente vs precedente
            'percentuale_prossimo': percentuale_prossimo   # prossimo vs corrente
        }})
    except Exception as e:
        import traceback
        print("ERRORE IN get_stats:")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@appuntamenti_bp.route('/prime-visite', methods=['GET'])
@jwt_required()
def get_prime_visite():
    return jsonify({'success': True, 'data': {'nuove_visite': 0}}), 200

@appuntamenti_bp.route('/totale-fino-a', methods=['GET'])
@jwt_required()
def totale_fino_a():
    anno = int(request.args.get('anno'))
    giorno_str = request.args.get('giorno')
    giorno = datetime.strptime(giorno_str, '%Y-%m-%d').date()
    db = DBHandler()
    col_data = COLONNE['appuntamenti']['data']
    df = db.leggi_tabella_dbf(db.path_appuntamenti)
    if df.empty or col_data not in df.columns:
        return jsonify({'success': True, 'data': {'anno': anno, 'fino_a': giorno_str, 'totale': 0}})
    df[col_data] = pd.to_datetime(df[col_data], errors='coerce').dt.date
    inizio = datetime(anno, 1, 1).date()
    mask = (df[col_data] >= inizio) & (df[col_data] <= giorno)
    totale = df[mask].shape[0]
    return jsonify({'success': True, 'data': {'anno': anno, 'fino_a': giorno_str, 'totale': int(totale)}})