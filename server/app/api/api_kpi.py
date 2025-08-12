from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from server.app.services.calendar_service import CalendarService
from datetime import date, datetime,timedelta
import sqlite3
import logging
import pandas as pd
from dbfread import DBF
from server.app.core.db_utils import get_dbf_path
from server.app.config.constants import COLONNE
import sqlite3

logger = logging.getLogger(__name__)

kpi_bp = Blueprint('kpi', __name__, url_prefix='/api/kpi')


@kpi_bp.route('/ping', methods=['GET'])
def ping():
    """
    Test endpoint per verificare che il servizio KPI sia attivo
    """
    return jsonify({
        'success': True,
        'message': 'KPI service is running',
        'timestamp': datetime.now().isoformat()
    })

def get_periodo(periodo):
    """Helper per calcolare date inizio/fine in base al periodo"""
    oggi = datetime.now()
    
    if periodo == 'mese_corrente':
        inizio = oggi.replace(day=1)
        if oggi.month == 12:
            fine = oggi.replace(year=oggi.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            fine = oggi.replace(month=oggi.month + 1, day=1) - timedelta(days=1)
    elif periodo == 'ultimi_3_mesi':
        inizio = (oggi.replace(day=1) - timedelta(days=90))
        fine = oggi
    elif periodo == 'ultimi_6_mesi':
        inizio = (oggi.replace(day=1) - timedelta(days=180))
        fine = oggi
    elif periodo == 'anno_corrente':
        inizio = oggi.replace(month=1, day=1)
        fine = oggi.replace(month=12, day=31)
    elif periodo == 'anno_precedente':
        anno_prec = oggi.year - 1
        inizio = datetime(anno_prec, 1, 1)
        fine = datetime(anno_prec, 12, 31)
    else:
        # Default: anno corrente
        inizio = oggi.replace(month=1, day=1)
        fine = oggi.replace(month=12, day=31)
    
    return inizio.date(), fine.date()


@kpi_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_overview():
    """
    Dashboard overview con KPI principali
    Restituisce una sintesi di tutti i KPI più importanti
    
    Query params:
    - anno: anno di riferimento (default: anno corrente)
    """
    try:
        # TODO: Implementare dashboard overview
        # Placeholder per ora
        return jsonify({
            'success': True,
            'message': 'Endpoint in implementazione',
            'data': {
                'fatturato_anno': 0,
                'pazienti_attivi': 0,
                'margine_medio': 0,
                'produttivita_oraria': 0
            }
        })
        
    except Exception as e:
        logger.error(f"Errore dashboard overview: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@kpi_bp.route('/marginalita', methods=['GET'])
@jwt_required()
def get_marginalita_prestazioni():
    """
    Analisi marginalità per tipo di prestazione
    Calcola ricavi e margini per ogni tipo di trattamento
    
    DEPRECATO: Questa funzione è inefficiente per più anni.
    Usare invece i nuovi endpoint:
    - GET /api/fatture/raw?anni=2022,2023,2024
    - GET /api/calendar/raw?anni=2022,2023,2024
    E fare i calcoli lato client.
    
    Query params:
    - anno: anno di riferimento (default: anno corrente)
    - data_inizio: data inizio periodo (formato YYYY-MM-DD, opzionale)
    - data_fine: data fine periodo (formato YYYY-MM-DD, opzionale)
    """
    try:
        # Parametri query
        anno = request.args.get('anno', type=int, default=datetime.now().year)
        data_inizio = request.args.get('data_inizio')
        data_fine = request.args.get('data_fine')
        
        # Helper functions
        def safe_float(val, default=0.0):
            if val is None:
                return default
            try:
                return float(val)
            except (ValueError, TypeError):
                return default
        
        def safe_str(val, default=''):
            if val is None:
                return default
            return str(val).strip()
        
        def parse_date(date_str):
            if not date_str:
                return None
            try:
                return datetime.strptime(str(date_str)[:10], '%Y-%m-%d').date()
            except:
                return None
        
        # Leggi tabelle
        path_fatture = get_dbf_path('fatture')
        path_appuntamenti = get_dbf_path('agenda')
        
        # Mapping colonne
        col_map_fatture = COLONNE['fatture']
        col_map_app = COLONNE['appuntamenti']
        
        # Raccogli dati fatture
        fatture_data = []
        for record in DBF(path_fatture, encoding='latin-1'):
            data_fattura = parse_date(record.get(col_map_fatture['fatturadata']))
            if not data_fattura:
                continue
                
            # Applica filtri temporali
            if data_inizio and data_fine:
                start_date = datetime.strptime(data_inizio, '%Y-%m-%d').date()
                end_date = datetime.strptime(data_fine, '%Y-%m-%d').date()
                if not (start_date <= data_fattura <= end_date):
                    continue
            elif data_fattura.year != anno:
                continue
            
            importo = safe_float(record.get(col_map_fatture['fatturaimporto']))
            if importo <= 0:
                continue
                
            fatture_data.append({
                'paziente_id': safe_str(record.get(col_map_fatture['fatturapazienteid'])),
                'data': data_fattura,
                'importo': importo
            })
        
        # Raccogli dati appuntamenti
        appuntamenti_data = []
        for record in DBF(path_appuntamenti, encoding='latin-1'):
            data_app = parse_date(record.get(col_map_app['data']))
            if not data_app:
                continue
                
            tipo_prestazione = safe_str(record.get(col_map_app['tipo']))
            if not tipo_prestazione:
                continue
                
            appuntamenti_data.append({
                'paziente_id': safe_str(record.get(col_map_app['id_paziente'])),
                'data': data_app,
                'tipo': tipo_prestazione
            })
        
        # Associa fatture ad appuntamenti
        risultati_per_tipo = {}
        
        for fattura in fatture_data:
            # Trova appuntamenti dello stesso paziente in un range di ±7 giorni
            for app in appuntamenti_data:
                if (app['paziente_id'] == fattura['paziente_id'] and 
                    abs((app['data'] - fattura['data']).days) <= 7):
                    
                    tipo = app['tipo']
                    if tipo not in risultati_per_tipo:
                        risultati_per_tipo[tipo] = {
                            'ricavo_totale': 0,
                            'numero_prestazioni': 0,
                            'ricavo_medio': 0
                        }
                    
                    risultati_per_tipo[tipo]['ricavo_totale'] += fattura['importo']
                    risultati_per_tipo[tipo]['numero_prestazioni'] += 1
                    break  # Usa solo il primo appuntamento trovato
        
        # Prepara output
        from server.app.config.constants import TIPI_APPUNTAMENTO
        
        risultati = []
        for tipo, stats in risultati_per_tipo.items():
            if stats['numero_prestazioni'] > 0:
                stats['ricavo_medio'] = stats['ricavo_totale'] / stats['numero_prestazioni']
            
            risultati.append({
                'tipo_codice': tipo,
                'tipo_nome': TIPI_APPUNTAMENTO.get(tipo, f'Tipo {tipo}'),
                'ricavo_totale': round(stats['ricavo_totale'], 2),
                'numero_prestazioni': stats['numero_prestazioni'],
                'ricavo_medio': round(stats['ricavo_medio'], 2)
            })
        
        # Ordina per ricavo totale decrescente
        risultati.sort(key=lambda x: x['ricavo_totale'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': risultati,
            'period': {
                'anno': anno,
                'data_inizio': data_inizio,
                'data_fine': data_fine
            },
            'total_revenue': sum(r['ricavo_totale'] for r in risultati),
            'total_prestazioni': sum(r['numero_prestazioni'] for r in risultati)
        })
        
    except Exception as e:
        logger.error(f"Errore analisi marginalità prestazioni: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@kpi_bp.route('/produttivita', methods=['GET'])
@jwt_required()
def get_analisi_produttivita():
    """
    Analisi produttività dello studio
    Calcola ricavi per ora, utilizzo fasce orarie, KPI produttività
    
    Query params:
    - anno: anno di riferimento (default: anno corrente)
    - mese: mese specifico (1-12, opzionale)
    - data_inizio: data inizio periodo (formato YYYY-MM-DD, opzionale)
    - data_fine: data fine periodo (formato YYYY-MM-DD, opzionale)
    """
    try:
        # Parametri query
        anno = request.args.get('anno', type=int, default=datetime.now().year)
        mese = request.args.get('mese', type=int)
        data_inizio = request.args.get('data_inizio')
        data_fine = request.args.get('data_fine')
        
        # Helper functions
        def safe_float(val, default=0.0):
            if val is None:
                return default
            try:
                return float(val)
            except (ValueError, TypeError):
                return default
        
        def safe_str(val, default=''):
            if val is None:
                return default
            return str(val).strip()
        
        def parse_date(date_str):
            if not date_str:
                return None
            try:
                return datetime.strptime(str(date_str)[:10], '%Y-%m-%d').date()
            except:
                return None
        
        def parse_time(time_str):
            if not time_str:
                return None
            try:
                # Assumiamo formato HH:MM
                time_clean = str(time_str).strip()
                if ':' in time_clean:
                    return datetime.strptime(time_clean, '%H:%M').time()
                elif len(time_clean) == 4:  # HHMM
                    return datetime.strptime(time_clean, '%H%M').time()
            except:
                pass
            return None
        
        # Leggi tabelle
        path_fatture = get_dbf_path('fatture')
        path_appuntamenti = get_dbf_path('agenda')
        
        col_map_fatture = COLONNE['fatture']
        col_map_app = COLONNE['appuntamenti']
        
        # Raccogli dati fatture
        fatture_data = []
        for record in DBF(path_fatture, encoding='latin-1'):
            data_fattura = parse_date(record.get(col_map_fatture['fatturadata']))
            if not data_fattura:
                continue
                
            # Applica filtri temporali
            if data_inizio and data_fine:
                start_date = datetime.strptime(data_inizio, '%Y-%m-%d').date()
                end_date = datetime.strptime(data_fine, '%Y-%m-%d').date()
                if not (start_date <= data_fattura <= end_date):
                    continue
            else:
                if data_fattura.year != anno:
                    continue
                if mese and data_fattura.month != mese:
                    continue
            
            importo = safe_float(record.get(col_map_fatture['fatturaimporto']))
            if importo <= 0:
                continue
                
            fatture_data.append({
                'paziente_id': safe_str(record.get(col_map_fatture['fatturapazienteid'])),
                'data': data_fattura,
                'importo': importo
            })
        
        # Raccogli dati appuntamenti con orari
        appuntamenti_data = []
        for record in DBF(path_appuntamenti, encoding='latin-1'):
            data_app = parse_date(record.get(col_map_app['data']))
            if not data_app:
                continue
                
            # Applica gli stessi filtri temporali
            if data_inizio and data_fine:
                start_date = datetime.strptime(data_inizio, '%Y-%m-%d').date()
                end_date = datetime.strptime(data_fine, '%Y-%m-%d').date()
                if not (start_date <= data_app <= end_date):
                    continue
            else:
                if data_app.year != anno:
                    continue
                if mese and data_app.month != mese:
                    continue
            
            ora_inizio = parse_time(record.get(col_map_app['ora_inizio']))
            if not ora_inizio:
                continue
                
            appuntamenti_data.append({
                'paziente_id': safe_str(record.get(col_map_app['id_paziente'])),
                'data': data_app,
                'ora_inizio': ora_inizio,
                'tipo': safe_str(record.get(col_map_app['tipo'])),
                'medico': safe_str(record.get(col_map_app['medico']))
            })
        
        # Associa fatture ad appuntamenti per calcolare ricavi orari
        ricavi_per_ora = {}
        appuntamenti_per_ora = {}
        
        for fattura in fatture_data:
            # Trova appuntamento corrispondente (stesso paziente, stessa data o ±1 giorno)
            for app in appuntamenti_data:
                if (app['paziente_id'] == fattura['paziente_id'] and 
                    abs((app['data'] - fattura['data']).days) <= 1):
                    
                    ora = app['ora_inizio'].hour
                    
                    if ora not in ricavi_per_ora:
                        ricavi_per_ora[ora] = 0
                        appuntamenti_per_ora[ora] = 0
                    
                    ricavi_per_ora[ora] += fattura['importo']
                    appuntamenti_per_ora[ora] += 1
                    break
        
        # Analisi fasce orarie
        fasce_orarie = []
        for ora in sorted(ricavi_per_ora.keys()):
            fasce_orarie.append({
                'ora': f"{ora:02d}:00",
                'ricavo': round(ricavi_per_ora[ora], 2),
                'appuntamenti': appuntamenti_per_ora[ora],
                'ricavo_medio': round(ricavi_per_ora[ora] / max(1, appuntamenti_per_ora[ora]), 2)
            })
        
        # Statistiche per medico
        ricavi_per_medico = {}
        appuntamenti_per_medico = {}
        
        for fattura in fatture_data:
            for app in appuntamenti_data:
                if (app['paziente_id'] == fattura['paziente_id'] and 
                    abs((app['data'] - fattura['data']).days) <= 1):
                    
                    medico = app['medico'] or 'Non specificato'
                    
                    if medico not in ricavi_per_medico:
                        ricavi_per_medico[medico] = 0
                        appuntamenti_per_medico[medico] = 0
                    
                    ricavi_per_medico[medico] += fattura['importo']
                    appuntamenti_per_medico[medico] += 1
                    break
        
        medici_stats = []
        for medico in ricavi_per_medico:
            medici_stats.append({
                'medico': medico,
                'ricavo_totale': round(ricavi_per_medico[medico], 2),
                'appuntamenti': appuntamenti_per_medico[medico],
                'ricavo_medio': round(ricavi_per_medico[medico] / max(1, appuntamenti_per_medico[medico]), 2)
            })
        
        medici_stats.sort(key=lambda x: x['ricavo_totale'], reverse=True)
        
        # KPI generali
        total_ricavi = sum(ricavi_per_ora.values())
        total_appuntamenti = sum(appuntamenti_per_ora.values())
        giorni_lavorativi = len(set(app['data'] for app in appuntamenti_data))
        
        risultato = {
            'periodo': {
                'anno': anno,
                'mese': mese,
                'data_inizio': data_inizio,
                'data_fine': data_fine
            },
            'kpi_generali': {
                'ricavo_totale': round(total_ricavi, 2),
                'appuntamenti_totali': total_appuntamenti,
                'giorni_lavorativi': giorni_lavorativi,
                'ricavo_medio_giorno': round(total_ricavi / max(1, giorni_lavorativi), 2),
                'appuntamenti_medio_giorno': round(total_appuntamenti / max(1, giorni_lavorativi), 1),
                'ricavo_medio_appuntamento': round(total_ricavi / max(1, total_appuntamenti), 2)
            },
            'fasce_orarie': fasce_orarie,
            'medici': medici_stats,
            'top_ore_produttive': sorted(fasce_orarie, key=lambda x: x['ricavo'], reverse=True)[:5]
        }
        
        return jsonify({
            'success': True,
            'data': risultato
        })
        
    except Exception as e:
        logger.error(f"Errore analisi produttività: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@kpi_bp.route('/trend', methods=['GET'])
@jwt_required()
def get_trend_temporali():
    """
    Analisi trend temporali dei ricavi
    Calcola trend mensili, stagionalità, crescita anno su anno
    
    Query params:
    - anni: numero di anni da includere nell'analisi (default: 3)
    - tipo: tipo di analisi (mensile, trimestrale, annuale - default: mensile)
    """
    try:
        # Parametri query
        anni = request.args.get('anni', type=int, default=3)
        tipo = request.args.get('tipo', default='mensile')
        
        # Helper functions
        def safe_float(val, default=0.0):
            if val is None:
                return default
            try:
                return float(val)
            except (ValueError, TypeError):
                return default
        
        def parse_date(date_str):
            if not date_str:
                return None
            try:
                return datetime.strptime(str(date_str)[:10], '%Y-%m-%d').date()
            except:
                return None
        
        # Calcola range di anni
        anno_corrente = datetime.now().year
        anno_inizio = anno_corrente - anni + 1
        
        # Leggi tabella fatture
        path_fatture = get_dbf_path('fatture')
        col_map_fatture = COLONNE['fatture']
        
        # Raccogli dati fatture per tutti gli anni
        fatture_data = []
        for record in DBF(path_fatture, encoding='latin-1'):
            data_fattura = parse_date(record.get(col_map_fatture['fatturadata']))
            if not data_fattura or data_fattura.year < anno_inizio:
                continue
                
            importo = safe_float(record.get(col_map_fatture['fatturaimporto']))
            if importo <= 0:
                continue
                
            fatture_data.append({
                'data': data_fattura,
                'importo': importo,
                'anno': data_fattura.year,
                'mese': data_fattura.month,
                'trimestre': (data_fattura.month - 1) // 3 + 1
            })
        
        # Analizza per tipo richiesto
        if tipo == 'mensile':
            risultati = {}
            for fattura in fatture_data:
                key = f"{fattura['anno']}-{fattura['mese']:02d}"
                if key not in risultati:
                    risultati[key] = {
                        'periodo': key,
                        'anno': fattura['anno'],
                        'mese': fattura['mese'],
                        'ricavo': 0,
                        'num_fatture': 0
                    }
                risultati[key]['ricavo'] += fattura['importo']
                risultati[key]['num_fatture'] += 1
                
        elif tipo == 'trimestrale':
            risultati = {}
            for fattura in fatture_data:
                key = f"{fattura['anno']}-T{fattura['trimestre']}"
                if key not in risultati:
                    risultati[key] = {
                        'periodo': key,
                        'anno': fattura['anno'],
                        'trimestre': fattura['trimestre'],
                        'ricavo': 0,
                        'num_fatture': 0
                    }
                risultati[key]['ricavo'] += fattura['importo']
                risultati[key]['num_fatture'] += 1
                
        else:  # annuale
            risultati = {}
            for fattura in fatture_data:
                key = str(fattura['anno'])
                if key not in risultati:
                    risultati[key] = {
                        'periodo': key,
                        'anno': fattura['anno'],
                        'ricavo': 0,
                        'num_fatture': 0
                    }
                risultati[key]['ricavo'] += fattura['importo']
                risultati[key]['num_fatture'] += 1
        
        # Converti in lista e ordina
        trend_data = list(risultati.values())
        trend_data.sort(key=lambda x: x['periodo'])
        
        # Arrotonda ricavi
        for item in trend_data:
            item['ricavo'] = round(item['ricavo'], 2)
        
        # Calcola statistiche aggiuntive
        ricavi = [item['ricavo'] for item in trend_data]
        crescita_percentuali = []
        
        for i in range(1, len(trend_data)):
            ricavo_precedente = trend_data[i-1]['ricavo']
            ricavo_corrente = trend_data[i]['ricavo']
            if ricavo_precedente > 0:
                crescita = ((ricavo_corrente - ricavo_precedente) / ricavo_precedente) * 100
                crescita_percentuali.append(round(crescita, 1))
            else:
                crescita_percentuali.append(0)
        
        # Aggiungi crescita ai dati
        for i, item in enumerate(trend_data[1:], 1):
            item['crescita_percentuale'] = crescita_percentuali[i-1]
        
        return jsonify({
            'success': True,
            'data': {
                'trend': trend_data,
                'statistiche': {
                    'ricavo_totale': sum(ricavi),
                    'ricavo_medio': round(sum(ricavi) / max(1, len(ricavi)), 2),
                    'ricavo_max': max(ricavi) if ricavi else 0,
                    'ricavo_min': min(ricavi) if ricavi else 0,
                    'crescita_media': round(sum(crescita_percentuali) / max(1, len(crescita_percentuali)), 1) if crescita_percentuali else 0,
                    'periodi_analizzati': len(trend_data)
                }
            },
            'parametri': {
                'anni': anni,
                'tipo': tipo,
                'periodo_analisi': f"{anno_inizio}-{anno_corrente}"
            }
        })
        
    except Exception as e:
        logger.error(f"Errore analisi trend temporali: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@kpi_bp.route('/ricorrenza-pazienti', methods=['GET'])
@jwt_required()
def get_ricorrenza_pazienti():
    """
    Analisi ricorrenza pazienti dello studio
    Calcola pazienti nuovi vs ricorrenti, frequenza visite, pazienti persi
    
    Query params:
    - anno: anno di riferimento (default: anno corrente)
    - data_inizio: data inizio periodo (formato YYYY-MM-DD, opzionale)
    - data_fine: data fine periodo (formato YYYY-MM-DD, opzionale)
    - mesi_perdita: mesi senza visite per considerare paziente "perso" (default: 18)
    """
    try:
        # Parametri query
        anno = request.args.get('anno', type=int, default=datetime.now().year)
        data_inizio = request.args.get('data_inizio')
        data_fine = request.args.get('data_fine')
        mesi_perdita = request.args.get('mesi_perdita', type=int, default=18)
        
        # Helper functions
        def safe_str(val, default=''):
            if val is None:
                return default
            return str(val).strip()
        
        def parse_date(date_str):
            if not date_str:
                return None
            try:
                return datetime.strptime(str(date_str)[:10], '%Y-%m-%d').date()
            except:
                return None
        
        # Leggi tabelle
        path_appuntamenti = get_dbf_path('agenda')
        
        # Mapping colonne
        col_map_app = COLONNE['appuntamenti']
        
        # Raccogli tutti gli appuntamenti
        appuntamenti_data = []
        for record in DBF(path_appuntamenti, encoding='latin-1'):
            data_app = parse_date(record.get(col_map_app['data']))
            if not data_app:
                continue
                
            tipo_prestazione = safe_str(record.get(col_map_app['tipo']))
            paziente_id = safe_str(record.get(col_map_app['id_paziente']))
            
            if not paziente_id:
                continue
                
            appuntamenti_data.append({
                'paziente_id': paziente_id,
                'data': data_app,
                'tipo': tipo_prestazione
            })
        
        # Ordina per data
        appuntamenti_data.sort(key=lambda x: x['data'])
        
        # Analizza per periodo richiesto
        if data_inizio and data_fine:
            start_date = datetime.strptime(data_inizio, '%Y-%m-%d').date()
            end_date = datetime.strptime(data_fine, '%Y-%m-%d').date()
            appuntamenti_periodo = [a for a in appuntamenti_data 
                                  if start_date <= a['data'] <= end_date]
        else:
            # Filtra per anno
            appuntamenti_periodo = [a for a in appuntamenti_data 
                                  if a['data'].year == anno]
        
        # Raggruppa per paziente
        pazienti_visite = {}
        for app in appuntamenti_data:
            pid = app['paziente_id']
            if pid not in pazienti_visite:
                pazienti_visite[pid] = []
            pazienti_visite[pid].append(app)
        
        # Classifica pazienti
        pazienti_nuovi = set()
        pazienti_ricorrenti = set()
        pazienti_controllo_igiene = set()
        
        # Data limite per pazienti persi (calcolo semplificato)
        data_oggi = datetime.now().date()
        anno_limite = data_oggi.year - (mesi_perdita // 12)
        mese_limite = data_oggi.month - (mesi_perdita % 12)
        if mese_limite <= 0:
            anno_limite -= 1
            mese_limite += 12
        
        try:
            data_limite_perdita = data_oggi.replace(year=anno_limite, month=mese_limite)
        except ValueError:
            # Se il giorno non esiste nel mese (es. 31 feb), usa l'ultimo giorno del mese
            import calendar
            ultimo_giorno = calendar.monthrange(anno_limite, mese_limite)[1]
            data_limite_perdita = data_oggi.replace(year=anno_limite, month=mese_limite, day=min(data_oggi.day, ultimo_giorno))
        pazienti_persi = set()
        
        for paziente_id, visite in pazienti_visite.items():
            visite.sort(key=lambda x: x['data'])
            
            # Prima visita di sempre
            prima_visita = visite[0]['data']
            ultima_visita = visite[-1]['data']
            
            # Visite nel periodo analizzato
            visite_periodo = [v for v in visite 
                            if any(v['data'] == a['data'] for a in appuntamenti_periodo)]
            
            if not visite_periodo:
                continue
            
            # Classifica nuovo vs ricorrente
            if prima_visita.year == anno or (data_inizio and data_fine and 
                                           start_date <= prima_visita <= end_date):
                pazienti_nuovi.add(paziente_id)
            else:
                pazienti_ricorrenti.add(paziente_id)
            
            # Controlli/igiene (tipo I o S)
            ha_controlli = any(v['tipo'] in ['I', 'S'] for v in visite_periodo)
            if ha_controlli:
                pazienti_controllo_igiene.add(paziente_id)
            
            # Paziente perso?
            if ultima_visita < data_limite_perdita:
                pazienti_persi.add(paziente_id)
        
        # Statistiche
        total_pazienti_periodo = len(set(a['paziente_id'] for a in appuntamenti_periodo))
        total_visite_periodo = len(appuntamenti_periodo)
        
        risultato = {
            'periodo': {
                'anno': anno,
                'data_inizio': data_inizio,
                'data_fine': data_fine
            },
            'totali': {
                'pazienti_unici': total_pazienti_periodo,
                'visite_totali': total_visite_periodo,
                'visite_per_paziente': round(total_visite_periodo / max(1, total_pazienti_periodo), 1)
            },
            'ricorrenza': {
                'pazienti_nuovi': len(pazienti_nuovi),
                'pazienti_ricorrenti': len(pazienti_ricorrenti),
                'percentuale_nuovi': round(len(pazienti_nuovi) / max(1, total_pazienti_periodo) * 100, 1),
                'percentuale_ricorrenti': round(len(pazienti_ricorrenti) / max(1, total_pazienti_periodo) * 100, 1)
            },
            'fidelizzazione': {
                'pazienti_controllo_igiene': len(pazienti_controllo_igiene),
                'percentuale_controlli': round(len(pazienti_controllo_igiene) / max(1, total_pazienti_periodo) * 100, 1)
            },
            'pazienti_persi': {
                'numero': len(pazienti_persi),
                'soglia_mesi': mesi_perdita,
                'percentuale_persi': round(len(pazienti_persi) / max(1, len(pazienti_visite)) * 100, 1)
            }
        }
        
        return jsonify({
            'success': True,
            'data': risultato
        })
        
    except Exception as e:
        logger.error(f"Errore analisi ricorrenza pazienti: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@kpi_bp.route('/marginalita-v2', methods=['GET'])
@jwt_required()
def get_marginalita_prestazioni_v2():
    """
    Analisi marginalità ottimizzata per tipo di prestazione.
    Restituisce istruzioni per il client su come ottenere dati raw
    e fare i calcoli localmente per migliori performance.
    
    Query params:
    - anni: lista anni separati da virgola (es: 2022,2023,2024)
    """
    try:
        anni_param = request.args.get('anni', str(datetime.now().year))
        
        # Validation
        try:
            anni = [int(anno.strip()) for anno in anni_param.split(',')]
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Formato anni non valido. Usare: 2022,2023,2024'
            }), 400
        
        return jsonify({
            'success': True,
            'message': 'Usa i nuovi endpoint raw per performance migliori',
            'instructions': {
                'step1': f'Chiama GET /api/fatture/raw?anni={anni_param}',
                'step2': f'Chiama GET /api/calendar/raw?anni={anni_param}',
                'step3': 'Associa fatture-appuntamenti lato client per paziente_id e data (±7 giorni)',
                'step4': 'Calcola marginalità per tipo_prestazione'
            },
            'benefits': [
                'Una sola lettura DBF per endpoint invece di N chiamate',
                'Transfer dati raw senza processing server',
                'Possibilità di cache client-side',
                'Scalabilità migliore per più anni'
            ],
            'sample_client_logic': {
                'javascript': '''
// Esempio logica client-side
const fatture = await fetch('/api/fatture/raw?anni=2022,2023,2024');
const appuntamenti = await fetch('/api/calendar/raw?anni=2022,2023,2024');

// Associa fatture ad appuntamenti
const marginalita = {};
fatture.data.forEach(fattura => {
    const appCorrispondente = appuntamenti.data.find(app => 
        app.paziente_id === fattura.paziente_id && 
        Math.abs(daysDiff(app.data, fattura.data)) <= 7
    );
    
    if (appCorrispondente) {
        const tipo = appCorrispondente.tipo;
        if (!marginalita[tipo]) marginalita[tipo] = {ricavo: 0, count: 0};
        marginalita[tipo].ricavo += fattura.importo;
        marginalita[tipo].count += 1;
    }
});
                '''
            }
        })
        
    except Exception as e:
        logger.error(f"Errore marginalità v2: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500 
    
@kpi_bp.route('/statistiche', methods=['GET'])
@jwt_required()
def get_stats():
    try:
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
        # Qui dovresti recuperare gli appuntamenti tramite una funzione centralizzata (es. da db_utils)
        # e passarli a CalendarService se serve.
        # Per ora lasciamo la struttura come placeholder.
        return jsonify({'success': True, 'data': {
            'mese_precedente': 0,
            'mese_corrente': 0,
            'mese_prossimo': 0,
            'percentuale_corrente': 0,
            'percentuale_prossimo': 0
        }})
    except Exception as e:
        logger.error("Errore in get_stats", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@kpi_bp.route('/prime-visite', methods=['GET'])
@jwt_required()
def get_prime_visite():
    return jsonify({'success': True, 'data': {'nuove_visite': 0}}), 200

@kpi_bp.route('/totale-fino-a', methods=['GET'])
@jwt_required()
def totale_fino_a():
    anno = int(request.args.get('anno'))
    giorno_str = request.args.get('giorno')
    giorno = datetime.strptime(giorno_str, '%Y-%m-%d').date()
    # Qui va la logica aggiornata per il conteggio appuntamenti, usando funzioni centralizzate
    return jsonify({'success': True, 'data': {'anno': anno, 'fino_a': giorno_str, 'totale': 0}})
