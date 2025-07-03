from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from server.app.core.db_handler import DBHandler
from datetime import date, timedelta
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
        primo_corrente, primo_prossimo = get_month_range(oggi)
        print(f"DEBUG: Date range: {primo_corrente} - {primo_prossimo}")
        
        df = db.leggi_tabella_dbf(db.path_appuntamenti)
        print(f"DEBUG: DataFrame letto. Empty: {df.empty}, 'DATA' in columns: {'DATA' in df.columns}")
        
        if df.empty or 'DATA' not in df.columns:
            print("DEBUG: DataFrame vuoto o colonna DATA mancante.")
            return jsonify({'success': True, 'data': {'mese_corrente': 0, 'mese_prossimo': 0}})
        
        df['DATA'] = pd.to_datetime(df['DATA'], errors='coerce').dt.date
        print("DEBUG: Colonna DATA convertita.")
        
        mese_corrente = df[(df['DATA'] >= primo_corrente) & (df['DATA'] <= fine_corrente)]
        mese_prossimo = df[(df['DATA'] >= primo_prossimo) & (df['DATA'] <= fine_prossimo)]
        print(f"DEBUG: Conteggi: Mese corrente={len(mese_corrente)}, Mese prossimo={len(mese_prossimo)}")
        
        return jsonify({'success': True, 'data': {
            'mese_corrente': len(mese_corrente),
            'mese_prossimo': len(mese_prossimo)
        }})
    except Exception as e:
        import traceback
        print("ERRORE IN get_stats:")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@appuntamenti_bp.route('/prime-visite', methods=['GET'])
def get_prime_visite():
    return jsonify({'success': True, 'data': {'nuove_visite': 0}}), 200