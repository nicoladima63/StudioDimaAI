from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
import sqlite3
import os

logger = logging.getLogger(__name__)

materiali_bp = Blueprint('materiali', __name__, url_prefix='/api/materiali')

# Cache per suggerimenti materiali per migliorare performance
_cache_suggerimenti_materiali = {}

# Dizionario pattern per famiglie di prodotti - Pattern matching intelligente
PRODUCT_FAMILY_PATTERNS = {
    # IMPLANTOLOGIA
    'impianti_dentali': {
        'patterns': [
            r'seven\s+xd.*implant',  # SEVEN XD int. hex. implant
            r'.*implant.*d\d+\.?\d*.*l\d+\.?\d*',  # Qualsiasi implant con diametro e lunghezza
            r'.*impianto.*\d+\.?\d*.*\d+\.?\d*',
            r'.*fixture.*\d+\.?\d*',
            r'.*abutment.*implant',
            # NUOVI pattern dalla prima foto (Biaggini Medical Devices):
            r'.*moncone.*titanio.*\d+gr.*zimmer.*tsv.*d\d+\.?\d*.*h\d+\.?\d*',  # MONCONE TITANIO 15gr ZIMMER TSV d.3,5 h.2,0
            r'.*provvisorio.*transfer.*n/r.*mis.*seven.*d\d+\.?\d*',  # PROVVISORIO/TRANSFER N/R MIS SEVEN d.3,3
            r'.*vite.*tpa.*mis.*seven.*d\d+\.?\d*',  # VITE TPA MIS SEVEN d.3,3
            # NUOVI pattern dalla seconda foto (Titanium Component SAS):
            r'.*analogo.*mua',  # ANALOGO MUA
            r'.*cilindro.*in.*ti.*x.*mua.*angolato',  # CILINDRO IN Ti x MUA ANGOLATO
            r'.*moncone.*angolato.*\d+°.*platinum',  # MONCONE ANGOLATO 25° PLATINUM
            r'.*moncone.*dritto.*platinum.*\d+\.?\d*',  # MONCONE DRITTO PLATINUM 3,75
            r'.*vite.*di.*connessione',  # VITE DI CONNESSIONE
            # Pattern generali:
            r'.*moncone.*titanio',  # Pattern generale moncone titanio
            r'.*moncone.*angolato',  # Pattern generale moncone angolato
            r'.*moncone.*dritto',  # Pattern generale moncone dritto
            r'.*transfer.*seven',  # Pattern generale transfer
            r'.*vite.*tpa',  # Pattern generale vite TPA
            r'.*cilindro.*in.*ti',  # Pattern generale cilindro in titanio
            r'.*analogo.*mua',  # Pattern generale analogo MUA
        ],
        'classification': 'IMPLANTOLOGIA',
        'confidence': 90,
        'motivo': 'Pattern famiglia impianti dentali'
    },
    
    # COMPOSITI E RESINE
    'compositi': {
        'patterns': [
            r'.*composit.*flow',
            r'.*resina.*composit',
            r'.*bulk.*fill',
            r'.*filtek.*\w+',
            r'.*tetric.*\w+',
            r'.*charisma.*\w+',
        ],
        'classification': 'CONSERVATIVA_COMPOSITI',
        'confidence': 85,
        'motivo': 'Pattern famiglia compositi dentali'
    },
    
    # ORTODONZIA
    'ortodonzia': {
        'patterns': [
            r'.*bracket.*\d+\.?\d*',
            r'.*filo.*ortodont.*\d+\.?\d*',
            r'.*arco.*ortodont.*\d+\.?\d*',
            r'.*allineator.*\d+',
            r'.*invisalign.*',
        ],
        'classification': 'ORTODONZIA',
        'confidence': 88,
        'motivo': 'Pattern famiglia ortodonzia'
    },
    
    # ENDODONZIA
    'endodonzia': {
        'patterns': [
            r'.*reciproc.*file',
            r'.*protaper.*file',
            r'.*lime.*endodont.*\d+\.?\d*',
            r'.*rotary.*file.*\d+\.?\d*',
            r'.*k.*file.*\d+',
        ],
        'classification': 'ENDODONZIA_STRUMENTI',
        'confidence': 90,
        'motivo': 'Pattern famiglia endodonzia'
    },
    
    # CHIRURGIA
    'chirurgia': {
        'patterns': [
            r'.*sutura.*\d+\.?\d*',
            r'.*bisturi.*\d+',
            r'.*membrana.*collagen',
            r'.*bone.*graft',
            r'.*osso.*artificial',
        ],
        'classification': 'CHIRURGIA',
        'confidence': 87,
        'motivo': 'Pattern famiglia chirurgia'
    }
}

def _match_product_family(descrizione: str, codice_articolo: str = '') -> dict:
    """
    Cerca una corrispondenza nella famiglia di prodotti basata su pattern regex
    Ora considera anche il codice articolo (REF) per match più precisi
    
    Args:
        descrizione: Descrizione del materiale
        codice_articolo: REF del materiale (opzionale)
        
    Returns:
        Dict con pattern match o None se non trovato
    """
    import re
    
    desc_clean = descrizione.lower().strip()
    ref_clean = codice_articolo.upper().strip() if codice_articolo else ''
    
    for family_name, family_data in PRODUCT_FAMILY_PATTERNS.items():
        for pattern in family_data['patterns']:
            # Prima controlla la descrizione
            if re.search(pattern, desc_clean, re.IGNORECASE):
                return {
                    'family': family_name,
                    'classification': family_data['classification'],
                    'confidence': family_data['confidence'],
                    'motivo': family_data['motivo'],
                    'pattern_matched': pattern
                }
    
    # Pattern specifici per REF (più accurati)
    ref_patterns = {
        'endodonzia_reciproc': {
            'pattern': r'^V04025',  # REF che iniziano con V04025 = RECIPROC BLUE
            'classification': 'ENDODONZIA_STRUMENTI',
            'confidence': 95,
            'motivo': 'REF pattern RECIPROC endodonzia'
        },
        'endodonzia_rpilot': {
            'pattern': r'^V04021',  # REF che iniziano con V04021 = R-PILOT
            'classification': 'ENDODONZIA_STRUMENTI', 
            'confidence': 95,
            'motivo': 'REF pattern R-PILOT endodonzia'
        },
        'impianti_seven': {
            'pattern': r'^MF7-D',  # REF che iniziano con MF7-D = SEVEN implants
            'classification': 'IMPLANTOLOGIA', 
            'confidence': 95,
            'motivo': 'REF pattern SEVEN implants'
        },
        'conservativa_sdr': {
            'pattern': r'^60603',  # REF che iniziano con 60603 = SDR FLOW+
            'classification': 'CONSERVATIVA_COMPOSITI',
            'confidence': 95,
            'motivo': 'REF pattern SDR FLOW+ conservativa'
        },
        'protesi_celtra_blocchetti': {
            'pattern': r'^536541',  # REF che iniziano con 536541 = CELTRA DUO blocchetti CAD/CAM
            'classification': 'PROTESI_BLOCCHETTI_CADCAM', 
            'confidence': 95,
            'motivo': 'REF pattern CELTRA DUO blocchetti protesi'
        }
    }
    
    # Controlla pattern REF se disponibile
    if ref_clean:
        logger.debug(f"🔍 Controllo pattern REF per '{ref_clean}'")
        for ref_name, ref_data in ref_patterns.items():
            if re.match(ref_data['pattern'], ref_clean):
                logger.debug(f"✅ MATCH REF pattern '{ref_data['pattern']}' per '{ref_clean}' → {ref_data['classification']}")
                return {
                    'family': ref_name,
                    'classification': ref_data['classification'],
                    'confidence': ref_data['confidence'],
                    'motivo': ref_data['motivo'],
                    'pattern_matched': ref_data['pattern']
                }
        logger.debug(f"❌ Nessun pattern REF trovato per '{ref_clean}'")
    
    return None

def _resolve_classification_from_pattern(pattern_result: dict, cursor) -> dict:
    """
    Risolve la classificazione pattern in contoid/brancaid/sottocontoid reali
    """
    if not pattern_result:
        return None
        
    classification = pattern_result['classification']
    
    # Mapping delle classificazioni ai dati reali del database
    classification_mapping = {
        'IMPLANTOLOGIA': {
            'conto_like': '%MATERIALI%DENTAL%',
            'branca_like': '%IMPLANTO%',
            'sottoconto_like': '%IMPIANTI%'
        },
        'CONSERVATIVA_COMPOSITI': {
            'conto_like': '%MATERIALI%DENTAL%', 
            'branca_like': '%CONSERVATIV%',
            'sottoconto_like': '%COMPOSIT%'
        },
        'ORTODONZIA': {
            'conto_like': '%MATERIALI%DENTAL%',
            'branca_like': '%ORTODONZ%',
            'sottoconto_like': '%ORTODONZ%'
        },
        'ENDODONZIA_STRUMENTI': {
            'conto_like': '%MATERIALI%DENTAL%',
            'branca_like': '%ENDODONZ%', 
            'sottoconto_like': '%STRUMENT%'
        },
        'CHIRURGIA': {
            'conto_like': '%MATERIALI%DENTAL%',
            'branca_like': '%CHIRURG%',
            'sottoconto_like': '%CHIRURG%'
        },
        'PROTESI_BLOCCHETTI_CADCAM': {
            'conto_like': '%MATERIALI%DENTAL%',
            'branca_like': '%PROTESI%',
            'sottoconto_like': '%BLOCCHETT%'
        }
    }
    
    mapping = classification_mapping.get(classification)
    if not mapping:
        return pattern_result
    
    try:
        # Trova conto
        cursor.execute('SELECT id, nome FROM conti WHERE nome LIKE ? LIMIT 1', (mapping['conto_like'],))
        conto_row = cursor.fetchone()
        if not conto_row:
            return pattern_result
            
        contoid, contonome = conto_row
        
        # Trova branca
        cursor.execute('SELECT id, nome FROM branche WHERE contoid = ? AND nome LIKE ? LIMIT 1', 
                      (contoid, mapping['branca_like']))
        branca_row = cursor.fetchone()
        brancaid, brancanome = branca_row if branca_row else (None, None)
        
        # Trova sottoconto
        sottocontoid, sottocontonome = None, None
        if brancaid:
            cursor.execute('SELECT id, nome FROM sottoconti WHERE brancaid = ? AND nome LIKE ? LIMIT 1', 
                          (brancaid, mapping['sottoconto_like']))
            sottoconto_row = cursor.fetchone()
            if sottoconto_row:
                sottocontoid, sottocontonome = sottoconto_row
        
        return {
            'contoid': contoid,
            'brancaid': brancaid,
            'sottocontoid': sottocontoid,
            'confidence': pattern_result['confidence'],
            'motivo': f"{pattern_result['motivo']} -> {contonome}" + 
                     (f" > {brancanome}" if brancanome else "") +
                     (f" > {sottocontonome}" if sottocontonome else "")
        }
        
    except Exception as e:
        logger.warning(f"Errore risoluzione pattern {classification}: {e}")
        return pattern_result

# Crea la tabella se non esiste
def _ensure_materiali_table_exists() -> None:
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS materiali (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codicearticolo TEXT,
                nome TEXT NOT NULL,
                fornitoreid INTEGER,
                fornitorenome TEXT,
                contoid INTEGER,
                contonome TEXT,
                brancaid INTEGER,
                brancanome TEXT,
                sottocontoid INTEGER,
                sottocontonome TEXT,
                metodo_classificazione TEXT,
                confidence INTEGER DEFAULT 0,
                confermato INTEGER DEFAULT 0,
                occorrenze INTEGER DEFAULT 0
            )
        ''')
        # Aggiungi colonne mancanti in caso di schema già esistente
        cursor.execute("PRAGMA table_info(materiali)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        for col_def in [
            ("sottocontoid", "INTEGER"),
            ("sottocontonome", "TEXT"),
            ("conto_codice", "TEXT"),
            ("sottoconto_codice", "TEXT"),
            ("categoria_contabile", "TEXT"),
            ("occorrenze", "INTEGER DEFAULT 0"),
            ("data_fattura", "DATE"),
            ("costo_unitario", "REAL"),
            ("fattura_id", "TEXT"),
            ("riga_fattura_id", "TEXT"),
        ]:
            if col_def[0] not in existing_cols:
                cursor.execute(f"ALTER TABLE materiali ADD COLUMN {col_def[0]} {col_def[1]}")
        # Indici utili per performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiali_fornitore ON materiali(fornitoreid)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiali_conto ON materiali(contoid)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiali_branca ON materiali(brancaid)')
        # Indice composito ottimizzato per lookup suggerimenti
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiali_lookup ON materiali(nome, fornitoreid, confermato, contoid)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiali_confidence ON materiali(confidence DESC, id DESC)')
        conn.commit()
    except Exception as e:
        logger.error(f"Errore creazione tabella materiali: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass

_ensure_materiali_table_exists()

# ===================== MATERIALI =====================

@materiali_bp.route('/save-classificazione', methods=['POST'])
@jwt_required()
def save_classificazione_materiale():
    """Upsert della classificazione in tabella materiali per chiavi logiche.

    Chiave logica: (codice_articolo, descrizione, codice_fornitore)
    Aggiorna/Inserisce: conto_codice, sottoconto_codice, categoria_contabile, metodo_classificazione, confidence, confermato.
    """
    try:
        data = request.get_json() or {}

        codice_articolo = (data.get('codice_articolo') or '').strip()
        descrizione = (data.get('descrizione') or '').strip()
        codice_fornitore = (data.get('codice_fornitore') or '').strip()
        nome_fornitore = (data.get('nome_fornitore') or '').strip()
        conto_codice = (data.get('conto_codice') or '').strip() or None
        conto_nome = (data.get('conto_nome') or '').strip() or None
        branca_codice = (data.get('branca_codice') or '').strip() or None
        branca_nome = (data.get('branca_nome') or '').strip() or None
        sottoconto_codice = (data.get('sottoconto_codice') or '').strip() or None
        categoria_contabile = (data.get('categoria_contabile') or '').strip() or None
        metodo_classificazione = data.get('metodo_classificazione') or 'manuale'
        confidence = int(data.get('confidence') or 100)

        if not (descrizione and codice_fornitore):
            return jsonify({'success': False, 'error': 'descrizione e codice_fornitore sono obbligatori'}), 400

        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()

        # Trova record esistente per chiave logica
        cursor.execute('''
            SELECT id FROM materiali
            WHERE (IFNULL(codicearticolo,'') = ?) AND nome = ? AND (IFNULL(fornitoreid,'') = ?)
        ''', (codice_articolo, descrizione, codice_fornitore))
        row = cursor.fetchone()

        # Risolvi ID strutturali a partire dai nomi (UI passa i "codici" come nomi)
        contoid_val = None
        sottocontoid_val = None
        brancaid_val = None
        contonome_val = None
        sottocontonome_val = None
        brancanome_val = None

        # Risoluzione principalmente dal sottoconto
        if sottoconto_codice:
            cursor.execute('''
                SELECT s.id, s.brancaid, s.contoid, s.nome,
                       b.nome as branca_nome, c.nome as conto_nome
                FROM sottoconti s
                JOIN branche b ON s.brancaid = b.id
                JOIN conti c ON s.contoid = c.id
                WHERE s.nome = ?
                LIMIT 1
            ''', (sottoconto_codice,))
            s_row = cursor.fetchone()
            if s_row:
                sottocontoid_val, brancaid_val, contoid_val, sottocontonome_val, brancanome_val, contonome_val = s_row
        
        # Usa i nomi passati dal frontend se disponibili, altrimenti usa quelli del database
        if conto_nome:
            contonome_val = conto_nome
        if branca_nome:
            brancanome_val = branca_nome
        
        # In fallback prova a risolvere solo il conto
        if contoid_val is None and conto_codice:
            cursor.execute('SELECT id, nome FROM conti WHERE nome = ? LIMIT 1', (conto_codice,))
            c_row = cursor.fetchone()
            if c_row:
                contoid_val, contonome_val = c_row
                # Usa il nome passato dal frontend se disponibile
                if conto_nome:
                    contonome_val = conto_nome

        if row:
            # Update con ID e nomi risolti
            updates = [
                'fornitoreid = ?', 'fornitorenome = ?',
                'metodo_classificazione = ?', 'confidence = ?', 'confermato = 1'
            ]
            params = [
                codice_fornitore, nome_fornitore,
                metodo_classificazione, confidence
            ]
            if contoid_val is not None:
                updates += ['contoid = ?', 'contonome = ?']
                params += [contoid_val, contonome_val or conto_codice]
            if brancaid_val is not None:
                updates += ['brancaid = ?', 'brancanome = ?']
                params += [brancaid_val, brancanome_val]
            if sottocontoid_val is not None:
                updates += ['sottocontoid = ?', 'sottocontonome = ?']
                params += [sottocontoid_val, sottocontonome_val or sottoconto_codice]
            if categoria_contabile is not None:
                updates += ['categoria_contabile = ?']
                params += [categoria_contabile]

            params.append(row[0])
            cursor.execute(f"UPDATE materiali SET {', '.join(updates)} WHERE id = ?", params)
            materiale_id = row[0]
            operazione = 'aggiornata'
        else:
            cursor.execute('''
                INSERT INTO materiali (
                    codicearticolo, fornitoreid, fornitorenome,
                    nome, contoid, contonome, brancaid, brancanome,
                    sottocontoid, sottocontonome, categoria_contabile,
                    metodo_classificazione, confidence, confermato, occorrenze
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
            ''', (
                codice_articolo, codice_fornitore, nome_fornitore,
                descrizione, contoid_val, contonome_val or conto_codice, brancaid_val, brancanome_val,
                sottocontoid_val, sottocontonome_val or sottoconto_codice, categoria_contabile,
                metodo_classificazione, confidence
            ))
            materiale_id = cursor.lastrowid
            operazione = 'salvata'

        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Classificazione {operazione} con successo',
            'data': {
                'id': materiale_id,
                'operazione': operazione
            }
        })
    except Exception as e:
        logger.error(f"Errore save_classificazione_materiale: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('/sync-from-dbf', methods=['POST'])
@jwt_required()
def sync_materiali_from_dbf():
    """Popola la tabella materiali da VOCISPES/DBF con suggerimenti come in materiali-da-classificare"""
    try:
        # Riusa la logica dall'endpoint esistente in spese_fornitori
        from server.app.api.api_spese_fornitori import get_materiali_da_classificare  # noqa
        # Esegui la stessa estrazione ma in-process ottenendo JSON
        # Qui richiamiamo direttamente la funzione per ottenere i dati aggregati
        resp = get_materiali_da_classificare()
        # resp è una response Flask; estrai json
        data = resp[0].get_json() if isinstance(resp, tuple) else resp.get_json()
        if not data or not data.get('success'):
            return jsonify({'success': False, 'error': 'Sync fallita: nessun dato dai DBF'}), 500

        materiali = data.get('data', [])

        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()

        inseriti = 0
        aggiornati = 0
        for m in materiali:
            codice_articolo = (m.get('codice_articolo') or '').strip()
            descrizione = (m.get('descrizione') or '').strip()
            codice_fornitore = (m.get('codice_fornitore') or '').strip()

            # esistenza per chiave logica (codice_articolo, descrizione, fornitore)
            cursor.execute('''
                SELECT id FROM materiali
                WHERE (IFNULL(codicearticolo,'') = ?) AND nome = ? AND (IFNULL(fornitoreid,'') = ?)
            ''', (codice_articolo, descrizione, codice_fornitore))
            row = cursor.fetchone()

            fields = {
                'codicearticolo': codice_articolo,
                'fornitoreid': codice_fornitore,
                'fornitorenome': m.get('nome_fornitore'),
                'nome': descrizione,
                'conto_codice': m.get('conto_codice'),
                'sottoconto_codice': m.get('sottoconto_codice'),
                'categoria_contabile': m.get('categoria_contabile'),
                'metodo_classificazione': m.get('metodo_classificazione'),
                'confidence': m.get('confidence') or 0,
                'confermato': 1 if m.get('confermato_da_utente') else 0,
                'occorrenze': m.get('occorrenze') or 0,
            }

            if row:
                # update
                cursor.execute('''
                    UPDATE materiali SET
                        fornitoreid = ?, fornitorenome = ?, nome = ?,
                        conto_codice = ?, sottoconto_codice = ?, categoria_contabile = ?,
                        metodo_classificazione = ?, confidence = ?, confermato = ?, occorrenze = ?
                    WHERE id = ?
                ''', (
                    fields['fornitoreid'], fields['fornitorenome'], fields['nome'],
                    fields['conto_codice'], fields['sottoconto_codice'], fields['categoria_contabile'],
                    fields['metodo_classificazione'], fields['confidence'], fields['confermato'], fields['occorrenze'],
                    row[0]
                ))
                aggiornati += 1
            else:
                # insert
                cursor.execute('''
                    INSERT INTO materiali (
                        codicearticolo, fornitoreid, fornitorenome,
                        nome, conto_codice, sottoconto_codice, categoria_contabile,
                        metodo_classificazione, confidence, confermato, occorrenze
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    fields['codicearticolo'], fields['fornitoreid'], fields['fornitorenome'],
                    fields['nome'], fields['conto_codice'], fields['sottoconto_codice'], fields['categoria_contabile'],
                    fields['metodo_classificazione'], fields['confidence'], fields['confermato'], fields['occorrenze']
                ))
                inseriti += 1

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Sync completata', 'inseriti': inseriti, 'aggiornati': aggiornati})
    except Exception as e:
        logger.error(f"Errore sync materiali da DBF: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('/confirm-da-verificare', methods=['POST'])
@jwt_required()
def confirm_da_verificare():
    """Conferma in blocco le classificazioni automatiche (da_verificare) scrivendo SOLO in SQLite 'materiali'."""
    try:
        # Riusa l'estrazione dai DBF SOLO in lettura per ottenere la lista corrente
        from server.app.api.api_spese_fornitori import get_materiali_da_classificare  # noqa

        resp = get_materiali_da_classificare()
        data = resp[0].get_json() if isinstance(resp, tuple) else resp.get_json()
        if not data or not data.get('success'):
            return jsonify({'success': False, 'error': 'Nessun dato disponibile'}), 500

        materiali = data.get('data', [])
        da_verificare = [m for m in materiali
                         if m.get('stato_classificazione') == 'da_verificare'
                         and m.get('conto_codice') and m.get('sottoconto_codice')]

        if not da_verificare:
            return jsonify({'success': True, 'message': 'Nessuna classificazione da confermare', 'materiali_confermati': 0})

        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()

        confermati = 0
        for m in da_verificare:
            codice_articolo = (m.get('codice_articolo') or '').strip()
            descrizione = (m.get('descrizione') or '').strip()
            codice_fornitore = (m.get('codice_fornitore') or '').strip()
            nome_fornitore = (m.get('nome_fornitore') or '').strip()
            conto_codice = m.get('conto_codice')
            sottoconto_codice = m.get('sottoconto_codice')
            categoria_contabile = m.get('categoria_contabile')

            # risolve brancaid dal sottoconto, se possibile
            brancaid_val = None
            try:
                if sottoconto_codice:
                    cursor.execute('''
                        SELECT b.id
                        FROM sottoconti s
                        JOIN branche b ON s.brancaid = b.id
                        WHERE s.nome = ?
                        LIMIT 1
                    ''', (sottoconto_codice,))
                    r = cursor.fetchone()
                    if r:
                        brancaid_val = r[0]
            except Exception:
                brancaid_val = None

            cursor.execute('''
                SELECT id FROM materiali
                WHERE (IFNULL(codicearticolo,'') = ?) AND nome = ? AND (IFNULL(fornitoreid,'') = ?)
            ''', (codice_articolo, descrizione, codice_fornitore))
            row = cursor.fetchone()

            if row:
                # Risolvi contoid/sottocontoid dai nomi
                contoid_val = None
                sottocontoid_val = None
                contonome_val = None
                sottocontonome_val = None
                if sottoconto_codice:
                    cursor.execute('''
                        SELECT s.id, s.contoid, s.nome, c.nome
                        FROM sottoconti s JOIN conti c ON s.contoid = c.id
                        WHERE s.nome = ? LIMIT 1
                    ''', (sottoconto_codice,))
                    srow = cursor.fetchone()
                    if srow:
                        sottocontoid_val, contoid_val, sottocontonome_val, contonome_val = srow

                updates = [
                    'fornitoreid = ?', 'fornitorenome = ?',
                    'metodo_classificazione = \"confermato\"', 'confidence = 100', 'confermato = 1'
                ]
                params = [codice_fornitore, nome_fornitore]
                if contoid_val is not None:
                    updates += ['contoid = ?', 'contonome = ?']
                    params += [contoid_val, contonome_val or conto_codice]
                if brancaid_val is not None:
                    updates += ['brancaid = ?']
                    params += [brancaid_val]
                if sottocontoid_val is not None:
                    updates += ['sottocontoid = ?', 'sottocontonome = ?']
                    params += [sottocontoid_val, sottocontonome_val or sottoconto_codice]
                if categoria_contabile:
                    updates += ['categoria_contabile = ?']
                    params += [categoria_contabile]
                params.append(row[0])
                cursor.execute(f"UPDATE materiali SET {', '.join(updates)} WHERE id = ?", params)
            else:
                # Inserisci con ID risolti
                contoid_val = None
                sottocontoid_val = None
                contonome_val = None
                sottocontonome_val = None
                if sottoconto_codice:
                    cursor.execute('''
                        SELECT s.id, s.contoid, s.nome, c.nome
                        FROM sottoconti s JOIN conti c ON s.contoid = c.id
                        WHERE s.nome = ? LIMIT 1
                    ''', (sottoconto_codice,))
                    srow = cursor.fetchone()
                    if srow:
                        sottocontoid_val, contoid_val, sottocontonome_val, contonome_val = srow

                cursor.execute('''
                    INSERT INTO materiali (
                        codicearticolo, fornitoreid, fornitorenome,
                        nome, contoid, contonome, brancaid, brancanome,
                        sottocontoid, sottocontonome, categoria_contabile,
                        metodo_classificazione, confidence, confermato, occorrenze
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confermato', 100, 1, 1)
                ''', (
                    codice_articolo, codice_fornitore, nome_fornitore,
                    descrizione, contoid_val, contonome_val or conto_codice, brancaid_val, None,
                    sottocontoid_val, sottocontonome_val or sottoconto_codice, categoria_contabile
                ))
            confermati += 1

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Classificazioni confermate', 'materiali_confermati': confermati})
    except Exception as e:
        logger.error(f"Errore confirm_da_verificare: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('/confirm-lista', methods=['POST'])
@jwt_required()
def confirm_lista_materiali():
    """Conferma una lista specifica di materiali passati dal frontend."""
    try:
        data = request.get_json()
        if not data or 'materiali' not in data:
            return jsonify({'success': False, 'error': 'Lista materiali obbligatoria'}), 400

        materiali = data['materiali']
        if not materiali:
            return jsonify({'success': True, 'message': 'Nessun materiale da confermare', 'materiali_confermati': 0, 'materiali_falliti': 0})

        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()

        confermati = 0
        falliti = 0

        for m in materiali:
            try:
                codicearticolo = (m.get('codicearticolo') or '').strip()
                nome = (m.get('nome') or '').strip()
                fornitoreid = (m.get('fornitoreid') or '').strip()
                fornitorenome = (m.get('fornitorenome') or '').strip()
                contoid = m.get('contoid')
                contonome = m.get('contonome')
                brancaid = m.get('brancaid')
                brancanome = m.get('brancanome')
                sottocontoid = m.get('sottocontoid')
                sottocontonome = m.get('sottocontonome')
                confidence = m.get('confidence', 100)

                if not (nome and fornitoreid):
                    falliti += 1
                    continue

                # Cerca materiale esistente
                cursor.execute('''
                    SELECT id FROM materiali
                    WHERE (IFNULL(codicearticolo,'') = ?) AND nome = ? AND (IFNULL(fornitoreid,'') = ?)
                ''', (codicearticolo, nome, fornitoreid))
                row = cursor.fetchone()

                if row:
                    # Aggiorna materiale esistente
                    updates = [
                        'fornitoreid = ?', 'fornitorenome = ?',
                        'metodo_classificazione = ?', 'confidence = ?', 'confermato = 1'
                    ]
                    params = [fornitoreid, fornitorenome, 'confermato', confidence]

                    if contoid is not None:
                        updates += ['contoid = ?', 'contonome = ?']
                        params += [contoid, contonome]
                    if brancaid is not None:
                        updates += ['brancaid = ?', 'brancanome = ?']
                        params += [brancaid, brancanome]
                    if sottocontoid is not None:
                        updates += ['sottocontoid = ?', 'sottocontonome = ?']
                        params += [sottocontoid, sottocontonome]

                    params.append(row[0])
                    cursor.execute(f"UPDATE materiali SET {', '.join(updates)} WHERE id = ?", params)
                else:
                    # Inserisci nuovo materiale
                    cursor.execute('''
                        INSERT INTO materiali (
                            codicearticolo, fornitoreid, fornitorenome, nome,
                            contoid, contonome, brancaid, brancanome,
                            sottocontoid, sottocontonome,
                            metodo_classificazione, confidence, confermato, occorrenze
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confermato', ?, 1, 1)
                    ''', (
                        codicearticolo, fornitoreid, fornitorenome, nome,
                        contoid, contonome, brancaid, brancanome,
                        sottocontoid, sottocontonome, confidence
                    ))
                
                confermati += 1

            except Exception as e:
                logger.warning(f"Errore conferma singolo materiale {m.get('nome', 'N/A')}: {e}")
                falliti += 1
                continue

        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Confermati {confermati} materiali',
            'materiali_confermati': confermati,
            'materiali_falliti': falliti
        })

    except Exception as e:
        logger.error(f"Errore confirm_lista_materiali: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('', methods=['GET'])
@jwt_required()
def get_materiali():
    """Ottiene tutti i materiali"""
    try:
        fornitore_id = request.args.get('fornitore_id')
        conto_id = request.args.get('conto_id', type=int)
        branca_id = request.args.get('branca_id', type=int)
        sottoconto_id = request.args.get('sottoconto_id', type=int)
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Query base
        query = '''
            SELECT m.id, m.codicearticolo, m.fornitoreid, m.fornitorenome,
                   m.contoid, m.contonome, m.brancaid, m.brancanome,
                   m.sottocontoid, m.sottocontonome,
                   m.conto_codice, m.sottoconto_codice, m.categoria_contabile,
                   m.nome, m.metodo_classificazione, m.confidence, m.confermato, m.occorrenze
            FROM materiali m
        '''
        params = []
        conditions = []
        
        # Aggiungi filtri
        if fornitore_id:
            conditions.append('m.fornitoreid = ?')
            params.append(fornitore_id)
        
        if conto_id:
            conditions.append('m.contoid = ?')
            params.append(conto_id)
            
        if branca_id:
            conditions.append('m.brancaid = ?')
            params.append(branca_id)
        
        if sottoconto_id:
            conditions.append('m.sottocontoid = ?')
            params.append(sottoconto_id)
        
        if conditions:
            query += ' WHERE ' + ' AND '.join(conditions)
        
        query += ' ORDER BY m.fornitorenome, m.nome'
        
        cursor.execute(query, params)
        
        materiali = []
        for row in cursor.fetchall():
            materiali.append({
                'id': row[0],
                'codicearticolo': row[1],
                'fornitoreid': row[2],
                'fornitorenome': row[3],
                'contoid': row[4],
                'contonome': row[5],
                'brancaid': row[6],
                'brancanome': row[7],
                'sottocontoid': row[8],
                'sottocontonome': row[9],
                'conto_codice': row[10],
                'sottoconto_codice': row[11],
                'categoria_contabile': row[12],
                'nome': row[13],
                'metodo_classificazione': row[14],
                'confidence': row[15],
                'confermato': bool(row[16]),
                'occorrenze': row[17]
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': materiali,
            'total': len(materiali)
        })
        
    except Exception as e:
        logger.error(f"Errore get materiali: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('/<int:materiale_id>', methods=['GET'])
@jwt_required()
def get_materiale(materiale_id):
    """Ottiene un materiale specifico"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT m.id, m.codicearticolo, m.fornitoreid, m.fornitorenome,
                   m.contoid, m.contonome, m.brancaid, m.brancanome,
                   m.sottocontoid, m.sottocontonome,
                   m.conto_codice, m.sottoconto_codice, m.categoria_contabile,
                   m.nome, m.metodo_classificazione, m.confidence, m.confermato, m.occorrenze
            FROM materiali m
            WHERE m.id = ?
        ''', (materiale_id,))
        
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return jsonify({'success': False, 'error': 'Materiale non trovato'}), 404
        
        materiale = {
            'id': row[0],
            'codicearticolo': row[1],
            'fornitoreid': row[2],
            'fornitorenome': row[3],
            'contoid': row[4],
            'contonome': row[5],
            'brancaid': row[6],
            'brancanome': row[7],
            'sottocontoid': row[8],
            'sottocontonome': row[9],
            'conto_codice': row[10],
            'sottoconto_codice': row[11],
            'categoria_contabile': row[12],
            'nome': row[13],
            'metodo_classificazione': row[14],
            'confidence': row[15],
            'confermato': bool(row[16]),
            'occorrenze': row[17]
        }
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': materiale
        })
        
    except Exception as e:
        logger.error(f"Errore get materiale {materiale_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('', methods=['POST'])
@jwt_required()
def create_materiale():
    """Crea un nuovo materiale"""
    try:
        data = request.get_json()
        required_fields = ['nome', 'fornitoreid', 'fornitorenome']
        
        for field in required_fields:
            if not data or not data.get(field):
                return jsonify({'success': False, 'error': f'{field} obbligatorio'}), 400
        
        nome = data['nome'].strip()
        fornitoreid = data['fornitoreid'].strip()
        fornitorenome = data['fornitorenome'].strip()
        codicearticolo = data.get('codicearticolo', '').strip()
        contoid = data.get('contoid')
        brancaid = data.get('brancaid')
        metodo_classificazione = data.get('metodo_classificazione', 'manuale')
        confidence = data.get('confidence', 100)
        sottocontoid = data.get('sottocontoid')
        sottocontonome = ''
        conto_codice = data.get('conto_codice')
        sottoconto_codice = data.get('sottoconto_codice')
        categoria_contabile = data.get('categoria_contabile')
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Ottieni nomi di conto e branca se forniti gli ID
        contonome = ''
        brancanome = ''
        
        if contoid:
            cursor.execute('SELECT nome FROM conti WHERE id = ?', (contoid,))
            conto_row = cursor.fetchone()
            if conto_row:
                contonome = conto_row[0]
        
        if brancaid:
            cursor.execute('SELECT nome FROM branche WHERE id = ?', (brancaid,))
            branca_row = cursor.fetchone()
            if branca_row:
                brancanome = branca_row[0]

        if sottocontoid:
            cursor.execute('SELECT nome FROM sottoconti WHERE id = ?', (sottocontoid,))
            sottoconto_row = cursor.fetchone()
            if sottoconto_row:
                sottocontonome = sottoconto_row[0]
        
        cursor.execute('''
            INSERT INTO materiali 
            (codicearticolo, fornitoreid, fornitorenome, contoid, contonome,
             brancaid, brancanome, sottocontoid, sottocontonome,
             conto_codice, sottoconto_codice, categoria_contabile,
             nome, metodo_classificazione, confidence, confermato, occorrenze)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (codicearticolo, fornitoreid, fornitorenome, contoid, contonome,
              brancaid, brancanome, sottocontoid, sottocontonome,
              conto_codice, sottoconto_codice, categoria_contabile,
              nome, metodo_classificazione, confidence, True, 1))
        
        materiale_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': {
                'id': materiale_id,
                'codicearticolo': codicearticolo,
                'fornitoreid': fornitoreid,
                'fornitorenome': fornitorenome,
                'contoid': contoid,
                'contonome': contonome,
                'brancaid': brancaid,
                'brancanome': brancanome,
                'sottocontoid': sottocontoid,
                'sottocontonome': sottocontonome,
                'conto_codice': conto_codice,
                'sottoconto_codice': sottoconto_codice,
                'categoria_contabile': categoria_contabile,
                'nome': nome,
                'metodo_classificazione': metodo_classificazione,
                'confidence': confidence,
                'confermato': True,
                'occorrenze': 1
            },
            'message': f'Materiale "{nome}" creato con successo'
        })
        
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Materiale già esistente'}), 400
    except Exception as e:
        logger.error(f"Errore create materiale: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('/<int:materiale_id>', methods=['PUT'])
@jwt_required()
def update_materiale(materiale_id):
    """Aggiorna un materiale"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Dati obbligatori'}), 400
        
        conn = sqlite3.connect('server_v2/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Ottieni materiale esistente
        cursor.execute('SELECT * FROM materiali WHERE id = ?', (materiale_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Materiale non trovato'}), 404
        
        # Prepara i campi da aggiornare
        updates = []
        params = []
        
        if 'nome' in data:
            updates.append('nome = ?')
            params.append(data['nome'].strip())
        
        if 'codicearticolo' in data:
            updates.append('codicearticolo = ?')
            params.append(data['codicearticolo'].strip())
        
        if 'fornitoreid' in data:
            updates.append('fornitoreid = ?')
            params.append(data['fornitoreid'].strip())
            
        if 'fornitorenome' in data:
            updates.append('fornitorenome = ?')
            params.append(data['fornitorenome'].strip())
        
        if 'contoid' in data:
            updates.append('contoid = ?')
            params.append(data['contoid'])
            
            # Aggiorna anche il nome del conto
            if data['contoid']:
                cursor.execute('SELECT nome FROM conti WHERE id = ?', (data['contoid'],))
                conto_row = cursor.fetchone()
                if conto_row:
                    updates.append('contonome = ?')
                    params.append(conto_row[0])
        
        if 'brancaid' in data:
            updates.append('brancaid = ?')
            params.append(data['brancaid'])
            
            # Aggiorna anche il nome della branca
            if data['brancaid']:
                cursor.execute('SELECT nome FROM branche WHERE id = ?', (data['brancaid'],))
                branca_row = cursor.fetchone()
                if branca_row:
                    updates.append('brancanome = ?')
                    params.append(branca_row[0])
        
        if 'metodo_classificazione' in data:
            updates.append('metodo_classificazione = ?')
            params.append(data['metodo_classificazione'])
            
        if 'confidence' in data:
            updates.append('confidence = ?')
            params.append(data['confidence'])
        
        if 'confermato' in data:
            updates.append('confermato = ?')
            params.append(data['confermato'])

        if 'sottocontoid' in data:
            updates.append('sottocontoid = ?')
            params.append(data['sottocontoid'])
            if data['sottocontoid']:
                cursor.execute('SELECT nome FROM sottoconti WHERE id = ?', (data['sottocontoid'],))
                s_row = cursor.fetchone()
                if s_row:
                    updates.append('sottocontonome = ?')
                    params.append(s_row[0])

        if 'conto_codice' in data:
            updates.append('conto_codice = ?')
            params.append(data['conto_codice'])

        if 'sottoconto_codice' in data:
            updates.append('sottoconto_codice = ?')
            params.append(data['sottoconto_codice'])

        if 'categoria_contabile' in data:
            updates.append('categoria_contabile = ?')
            params.append(data['categoria_contabile'])
        
        if not updates:
            conn.close()
            return jsonify({'success': False, 'error': 'Nessun campo da aggiornare'}), 400
        
        # Esegui update
        query = f"UPDATE materiali SET {', '.join(updates)} WHERE id = ?"
        params.append(materiale_id)
        
        cursor.execute(query, params)
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Materiale aggiornato con successo'
        })
        
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Violazione vincoli unici'}), 400
    except Exception as e:
        logger.error(f"Errore update materiale {materiale_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('/<int:materiale_id>', methods=['DELETE'])
@jwt_required()
def delete_materiale(materiale_id):
    """Elimina un materiale"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM materiali WHERE id = ?', (materiale_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Materiale non trovato'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Materiale eliminato con successo'
        })
        
    except Exception as e:
        logger.error(f"Errore delete materiale {materiale_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('/fornitori/<fornitore_id>/materiali-intelligenti', methods=['GET'])
@jwt_required()
def get_materiali_intelligenti(fornitore_id):
    """
    Ottieni materiali filtrati intelligentemente dalle fatture di un fornitore
    con classificazioni suggerite automaticamente
    Query params:
    - show_classified: true/false per mostrare anche materiali già classificati (default: false)
    """
    try:
        from server.app.core.db_calendar import _get_dbf_path, _leggi_tabella_dbf
        from server.app.config.constants import COLONNE
        import pandas as pd
        
        # Parametri query
        show_classified = request.args.get('show_classified', 'false').lower() == 'true'
        
        # Ottieni tabelle - STESSO PATTERN DELLE ROUTE FUNZIONANTI
        path_spese = _get_dbf_path('spese_fornitori')
        path_dettagli = _get_dbf_path('dettagli_spese_fornitori')
        df_spese = _leggi_tabella_dbf(path_spese)
        df_dettagli = _leggi_tabella_dbf(path_dettagli)
        
        if df_spese.empty or df_dettagli.empty:
            return jsonify({
                'success': True,
                'data': [],
                'fornitore_id': fornitore_id,
                'message': 'Nessuna tabella spese/dettagli trovata'
            })
        
        # Mapping colonne
        col_map_spese = COLONNE['spese_fornitori']
        col_map_dettagli = COLONNE['dettagli_spese_fornitori']
        
        # Funzione decode condivisa
        def safe_decode(val):
            if pd.isna(val):
                return ''
            if isinstance(val, bytes):
                return val.decode('latin-1', errors='ignore').strip()
            return str(val).strip()
        
        # STEP 1: Trova tutte le fatture del fornitore (come get_all_fatture_fornitore)
        def match_fornitore(val):
            if pd.isna(val):
                return False
            val_str = safe_decode(val)
            return val_str == str(fornitore_id).strip()
        
        df_fatture_fornitore = df_spese[df_spese[col_map_spese['codice_fornitore']].apply(match_fornitore)]
        
        if df_fatture_fornitore.empty:
            return jsonify({
                'success': True,
                'data': [],
                'fornitore_id': fornitore_id,
                'message': 'Nessuna fattura trovata per questo fornitore'
            })
        
        # STEP 2: Estrai IDs fatture e crea mappa fattura_id → data_fattura
        fattura_ids = []
        fattura_date_map = {}
        for _, row in df_fatture_fornitore.iterrows():
            fattura_id = safe_decode(row.get(col_map_spese['id']))
            if fattura_id:
                fattura_ids.append(fattura_id)
                # Ottieni data fattura
                data_fattura = row.get(col_map_spese['data_spesa'])
                if pd.notnull(data_fattura):
                    try:
                        data_fattura_str = pd.to_datetime(data_fattura).strftime('%Y-%m-%d')
                        fattura_date_map[fattura_id] = data_fattura_str
                    except:
                        fattura_date_map[fattura_id] = None
                else:
                    fattura_date_map[fattura_id] = None
        
        # STEP 3: Filtra dettagli per fatture del fornitore (JOIN corretto)
        def match_fattura_id(val):
            if pd.isna(val):
                return False
            val_str = safe_decode(val)
            return val_str in fattura_ids
        
        df_dettagli_fornitore = df_dettagli[df_dettagli[col_map_dettagli['codice_fattura']].apply(match_fattura_id)]
        
        if df_dettagli_fornitore.empty:
            return jsonify({
                'success': True,
                'data': [],
                'fornitore_id': fornitore_id,
                'message': 'Nessun dettaglio materiale trovato per questo fornitore'
            })
        
        # Database connection per controllo materiali già classificati
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # LOGICA DI FILTRAGGIO INTELLIGENTE CON ASSOCIAZIONE REF
        materiali_filtrati = []
        
        # Converte in lista per poter accedere all'indice e alla riga successiva
        df_rows = list(df_dettagli_fornitore.iterrows())
        
        i = 0
        while i < len(df_rows):
            _, row = df_rows[i]
            descrizione = safe_decode(row.get(col_map_dettagli['descrizione'], ''))
            prezzo = float(row.get(col_map_dettagli['prezzo_unitario'], 0))
            quantita = float(row.get(col_map_dettagli['quantita'], 0))
            totale = float(row.get(col_map_dettagli.get('totale_riga', col_map_dettagli['prezzo_unitario']), 0))
            aliquota_iva = float(row.get(col_map_dettagli.get('aliquota_iva', 'IVA'), 0))
            
            # FILTRI DI ESCLUSIONE POTENZIATI - mantieni filtri esistenti + nuovi
            desc_upper = descrizione.upper()
            
            # Escludi voci amministrative (filtri esistenti + nuovi)
            if ('DDT' in desc_upper or
                desc_upper.startswith('DM1 ') or
                ('TRASPORTO' in desc_upper and prezzo <= 10) or  # Solo trasporti economici
                len(descrizione.strip()) <= 3 or  # Descrizioni troppo brevi
                # NUOVI FILTRI basati sulle foto:
                desc_upper.startswith('ORDINE NUMERO') or  # "Ordine numero 63243 del 07/03/2024"
                desc_upper.startswith('SPESE TRASPORTO') or  # "Spese Trasporto"
                desc_upper.startswith('**VS ORDINE') or  # "**Vs ordine 3276 su PROTESICACOMPATIBILE"
                'IMPORTO BOLLO' in desc_upper or  # "Importo bollo"
                (prezzo == 0 and quantita == 0 and not desc_upper.startswith('CODICE ART.') and 
                 not desc_upper.startswith('REF ') and not desc_upper.startswith('ASWARTFOR ') and 
                 len(descrizione.strip()) < 15)):  # Codici isolati con prezzo 0
                i += 1
                continue
            
            # LOGICA ASSOCIAZIONE REF + MATERIALE (esistente + nuova)
            codice_articolo = ''
            
            # NUOVO: Se questa riga è un "Codice Art. fornitore" o "AswArtFor" (dalle foto)
            if desc_upper.startswith('CODICE ART. FORNITORE ') or desc_upper.startswith('ASWARTFOR '):
                # Estrai il codice fornitore (es: "ABC/FA-PN-03" o "AswArtFor PL-AN0003")
                if desc_upper.startswith('CODICE ART. FORNITORE '):
                    ref_fornitore = descrizione.replace('Codice Art. fornitore ', '').strip()
                else:  # AswArtFor
                    ref_fornitore = descrizione.strip()
                
                # Cerca il materiale vero e il codice numerico nelle righe successive
                j = i + 1
                materiale_trovato = False
                codice_numerico = ''
                
                while j < len(df_rows) and not materiale_trovato:
                    _, next_row = df_rows[j]
                    next_desc = safe_decode(next_row.get(col_map_dettagli['descrizione'], ''))
                    next_desc_upper = next_desc.upper()
                    next_prezzo = float(next_row.get(col_map_dettagli['prezzo_unitario'], 0))
                    next_quantita = float(next_row.get(col_map_dettagli['quantita'], 0))
                    
                    # Salta amministrative
                    if (next_desc_upper.startswith('ORDINE NUMERO') or
                        next_desc_upper.startswith('SPESE TRASPORTO') or
                        len(next_desc.strip()) <= 3):
                        j += 1
                        continue
                    
                    # Se trovo un codice numerico (es: A2307414, 24PR0104), salvalo
                    if (next_prezzo == 0 and next_quantita == 0 and 
                        len(next_desc.strip()) > 3 and len(next_desc.strip()) < 15 and
                        (next_desc.strip().replace(' ', '').isalnum() or  # Codici alfanumerici
                         next_desc.strip().startswith('24PR'))):
                        codice_numerico = next_desc.strip()
                        j += 1
                        continue
                    
                    # Se trovo un materiale vero (prezzo > 0), associa tutto
                    if (next_prezzo > 0 and next_quantita > 0 and 
                        len(next_desc.strip()) > 15 and
                        not next_desc_upper.startswith('CODICE ART.')):
                        # Combina REF fornitore + codice numerico
                        codice_articolo = f"{ref_fornitore} {codice_numerico}".strip()
                        descrizione = next_desc
                        prezzo = next_prezzo
                        quantita = next_quantita
                        totale = float(next_row.get(col_map_dettagli.get('totale_riga', col_map_dettagli['prezzo_unitario']), 0))
                        aliquota_iva = float(next_row.get(col_map_dettagli.get('aliquota_iva', 'IVA'), 0))
                        
                        # Dati fattura per il materiale associato
                        fattura_id = safe_decode(next_row.get(col_map_dettagli['codice_fattura'], ''))
                        riga_fattura_id = f"{fattura_id}_riga_{next_row.name}"
                        
                        materiale_trovato = True
                        # Salta al materiale successivo al prossimo ciclo
                        i = j + 1
                        break
                    
                    j += 1
                
                # Se non ho trovato materiale associato, salta questo REF
                if not materiale_trovato:
                    i += 1
                    continue
            
            # ESISTENTE: Se questa riga è un REF
            elif desc_upper.startswith('REF '):
                # Salva il REF e cerca il materiale successivo
                ref_corrente = descrizione
                
                # Cerca il prossimo materiale non-REF
                j = i + 1
                while j < len(df_rows):
                    _, next_row = df_rows[j]
                    next_desc = safe_decode(next_row.get(col_map_dettagli['descrizione'], ''))
                    next_desc_upper = next_desc.upper()
                    
                    # Salta amministrative
                    if ('DDT' in next_desc_upper or
                        next_desc_upper.startswith('DM1 ') or
                        len(next_desc.strip()) <= 3):
                        j += 1
                        continue
                    
                    # Se trovo un altro REF, questo REF non ha materiale associato
                    if next_desc_upper.startswith('REF '):
                        break
                    
                    # Trovato materiale! Associa REF e usa i dati del materiale
                    if len(next_desc.strip()) > 5:
                        codice_articolo = ref_corrente
                        descrizione = next_desc
                        prezzo = float(next_row.get(col_map_dettagli['prezzo_unitario'], 0))
                        quantita = float(next_row.get(col_map_dettagli['quantita'], 0))
                        totale = float(next_row.get(col_map_dettagli.get('totale_riga', col_map_dettagli['prezzo_unitario']), 0))
                        aliquota_iva = float(next_row.get(col_map_dettagli.get('aliquota_iva', 'IVA'), 0))
                        
                        # Dati fattura per il materiale associato
                        fattura_id = safe_decode(next_row.get(col_map_dettagli['codice_fattura'], ''))
                        riga_fattura_id = f"{fattura_id}_riga_{next_row.name}"
                        
                        # Salta al materiale successivo al prossimo ciclo
                        i = j + 1
                        break
                    
                    j += 1
                
                # Se non ho trovato materiale associato, salta questo REF
                if not codice_articolo:
                    i += 1
                    continue
                    
            # Se questa riga è un materiale (non REF)
            elif len(descrizione.strip()) > 5:
                # Materiale senza REF precedente
                codice_articolo = ''
                i += 1
            else:
                # Riga da saltare
                i += 1
                continue
            
            # FILTRO FINALE: Solo materiali validi con valore commerciale
            if (prezzo <= 0 or quantita <= 0 or 
                len(descrizione.strip()) < 10 or  # Descrizioni troppo corte
                desc_upper.startswith('VITE ') and prezzo == 0):  # Viti con prezzo 0 dalla foto
                i += 1
                continue
            
            # Dati fattura per ogni materiale
            fattura_id = safe_decode(row.get(col_map_dettagli['codice_fattura'], ''))
            riga_fattura_id = f"{fattura_id}_riga_{row.name}"
            data_fattura = fattura_date_map.get(fattura_id)
            
            # RIMOSSO: controllo esistenza materiale per permettere storico completo
            # Ogni riga di fattura diventa un record separato
            
            # Crea l'oggetto materiale con REF associato e dati fattura
            materiale = {
                'codice_articolo': codice_articolo,
                'descrizione': descrizione,
                'prezzo_unitario': round(prezzo, 2),
                'quantita': round(quantita, 2),
                'totale_riga': round(totale, 2),
                'fattura_id': fattura_id,
                'data_fattura': data_fattura,
                'riga_fattura_id': riga_fattura_id,
                'riga_originale_id': f"{row.name}"  # Per tracciabilità
            }
            
            # CLASSIFICAZIONE SUGGERITA - FLUSSO LOGICO CORRETTO
            try:
                suggerimento = None
                materiale_esistente = None
                
                logger.debug(f"🔍 INIZIO suggerimento per '{descrizione}' REF '{codice_articolo}' fornitore {fornitore_id}")
                
                # STEP 1: PRIORITÀ ASSOLUTA - REF MATCH ESATTO nella tabella materiali
                if codice_articolo:
                    cursor.execute('''
                        SELECT contoid, brancaid, sottocontoid, contonome, brancanome, sottocontonome, confidence
                        FROM materiali 
                        WHERE TRIM(LOWER(codicearticolo)) = TRIM(LOWER(?)) AND fornitoreid = ?
                          AND confermato = 1
                          AND contoid IS NOT NULL
                        ORDER BY confidence DESC, id DESC
                        LIMIT 1
                    ''', (codice_articolo, fornitore_id))
                    materiale_esistente = cursor.fetchone()
                    
                    if materiale_esistente:
                        contoid, brancaid, sottocontoid, contonome, brancanome, sottocontonome, confidence = materiale_esistente
                        suggerimento = {
                            'contoid': contoid,
                            'brancaid': brancaid,
                            'sottocontoid': sottocontoid,
                            'confidence': 95,  # Confidence alta per match esatto
                            'motivo': f"REF identico già classificato: {contonome}" + 
                                     (f" > {brancanome}" if brancanome else "") + 
                                     (f" > {sottocontonome}" if sottocontonome else "")
                        }
                        logger.debug(f"✅ STEP 1 - REF ESATTO trovato: {suggerimento}")

                # STEP 2: PRIORITÀ ALTA - DESCRIZIONE MATCH su CORE TERMS nella tabella materiali
                if not suggerimento:
                    # Prima prova match esatto
                    cursor.execute('''
                        SELECT contoid, brancaid, sottocontoid, contonome, brancanome, sottocontonome, confidence
                        FROM materiali 
                        WHERE TRIM(LOWER(nome)) = TRIM(LOWER(?)) AND fornitoreid = ? 
                          AND confermato = 1
                          AND contoid IS NOT NULL
                        ORDER BY confidence DESC, id DESC
                        LIMIT 1
                    ''', (descrizione, fornitore_id))
                    materiale_esistente = cursor.fetchone()
                    
                    # Se non trovato, prova match per CORE TERMS (prodotti simili della stessa famiglia)
                    if not materiale_esistente:
                        core_terms = []
                        desc_upper = descrizione.upper()
                        
                        # Estrai core terms in base a prodotti noti
                        if 'CELTRA DUO' in desc_upper:
                            core_terms.append('CELTRA DUO')
                        elif 'SDR FLOW' in desc_upper:
                            core_terms.append('SDR FLOW')
                        elif 'RECIPROC' in desc_upper:
                            core_terms.append('RECIPROC')
                        elif 'SEVEN XD' in desc_upper:
                            core_terms.append('SEVEN XD')
                        elif 'R-PILOT' in desc_upper:
                            core_terms.append('R-PILOT')
                        
                        # Cerca materiale con core term simile
                        for core_term in core_terms:
                            cursor.execute('''
                                SELECT contoid, brancaid, sottocontoid, contonome, brancanome, sottocontonome, confidence
                                FROM materiali 
                                WHERE UPPER(nome) LIKE ? AND fornitoreid = ?
                                  AND confermato = 1
                                  AND contoid IS NOT NULL
                                ORDER BY confidence DESC, id DESC
                                LIMIT 1
                            ''', (f'%{core_term}%', fornitore_id))
                            materiale_esistente = cursor.fetchone()
                            if materiale_esistente:
                                logger.debug(f"✅ STEP 2 - CORE TERM '{core_term}' trovato in tabella")
                                break
                    
                    if materiale_esistente:
                        contoid, brancaid, sottocontoid, contonome, brancanome, sottocontonome, confidence = materiale_esistente
                        suggerimento = {
                            'contoid': contoid,
                            'brancaid': brancaid,
                            'sottocontoid': sottocontoid,
                            'confidence': 95,  # Confidence alta per match famiglia
                            'motivo': f"Famiglia prodotto già classificata: {contonome}" + 
                                     (f" > {brancanome}" if brancanome else "") + 
                                     (f" > {sottocontonome}" if sottocontonome else "")
                        }
                        logger.debug(f"✅ STEP 2 - DESCRIZIONE/FAMIGLIA trovata: {suggerimento}")

                # STEP 3: PATTERN REF INTELLIGENTE
                if not suggerimento and codice_articolo:
                    ref_match = _match_product_family(descrizione, codice_articolo)
                    if ref_match:
                        resolved_pattern = _resolve_classification_from_pattern(ref_match, cursor)
                        if resolved_pattern and resolved_pattern.get('contoid'):
                            suggerimento = {
                                'contoid': resolved_pattern.get('contoid'),
                                'brancaid': resolved_pattern.get('brancaid'),
                                'sottocontoid': resolved_pattern.get('sottocontoid'),
                                'confidence': 90,  # Confidence media per pattern REF
                                'motivo': f"Pattern REF {codice_articolo[:6]}... → {resolved_pattern.get('motivo', 'Match REF')}"
                            }
                            logger.debug(f"✅ STEP 3 - PATTERN REF trovato: {suggerimento}")

                # STEP 4: PATTERN DESCRIZIONE
                if not suggerimento:
                    desc_match = _match_product_family(descrizione, '')  # Solo descrizione, senza REF
                    if desc_match:
                        resolved_pattern = _resolve_classification_from_pattern(desc_match, cursor)
                        if resolved_pattern and resolved_pattern.get('contoid'):
                            suggerimento = {
                                'contoid': resolved_pattern.get('contoid'),
                                'brancaid': resolved_pattern.get('brancaid'),
                                'sottocontoid': resolved_pattern.get('sottocontoid'),
                                'confidence': 80,  # Confidence più bassa per pattern descrizione
                                'motivo': f"Pattern descrizione → {resolved_pattern.get('motivo', 'Match descrizione')}"
                            }
                            logger.debug(f"✅ STEP 4 - PATTERN DESCRIZIONE trovato: {suggerimento}")

                # STEP 5: FALLBACK - Non classificato
                if not suggerimento:
                    suggerimento = {
                        'contoid': None,
                        'brancaid': None,
                        'sottocontoid': None,
                        'confidence': 0,
                        'motivo': 'Nessuna classificazione trovata - classificare manualmente'
                    }
                    logger.debug(f"❌ STEP 5 - FALLBACK: Nessuna classificazione trovata")
                
                # Adatta il formato per il frontend
                materiale['classificazione_suggerita'] = {
                    'contoid': suggerimento.get('contoid'),
                    'brancaid': suggerimento.get('brancaid'), 
                    'sottocontoid': suggerimento.get('sottocontoid'),
                    'confidence': suggerimento.get('confidence', 0),
                    'motivo': suggerimento.get('motivo', 'Nessun suggerimento disponibile')
                }
                
            except Exception as e:
                logger.warning(f"Errore suggerimento classificazione per {descrizione}: {e}")
                materiale['classificazione_suggerita'] = {
                    'contoid': None,
                    'brancaid': None,
                    'sottocontoid': None,
                    'confidence': 0,
                    'motivo': 'Errore nel suggerimento automatico'
                }
            
            materiali_filtrati.append(materiale)
        
        # Chiudi connessione database
        conn.close()
        
        # Raggruppa REF + Descrizioni correlate
        # (logica semplificata - in produzione si potrebbe migliorare il grouping)
        
        return jsonify({
            'success': True,
            'data': materiali_filtrati,
            'count': len(materiali_filtrati),
            'fornitore_id': fornitore_id,
            'filtri_applicati': {
                'esclusi_amministrativi': True,
                'esclusi_valore_zero': True,
                'mantenuti_ref': True,
                'prezzo_minimo': 0
            }
        })
        
    except Exception as e:
        logger.error(f"Errore get_materiali_intelligenti per fornitore {fornitore_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@materiali_bp.route('/salva-classificazione', methods=['POST'])
@jwt_required()
def salva_classificazione_materiale():
    """
    Salva la classificazione di un materiale nella tabella materiali
    
    Body: {
        "codice_articolo": "REF V04025202502S", 
        "descrizione": "RECIPROC BLUE FILES",
        "codice_fornitore": "ZZZZZZO",
        "nome_fornitore": "Dentsply Sirona Italia Srl",
        "contoid": 18,
        "contonome": "MATERIALI DENTALI",
        "brancaid": 3,
        "brancanome": "CONSERVATIVA", 
        "sottocontoid": 7,
        "sottocontonome": "COMPOSITI"
    }
    """
    #{"codice_articolo":"","descrizione":"AGHI INJECT+ 30GA 0,3X16MM.","fattura_id":"ZZZWHC","fornitore_id":"ZZZZZZ","classificazione":{"contoid":18,"brancaid":1,"sottocontoid":1,"tipo_di_costo":1}}
    try:
        data = request.get_json()
        logger.info(f"🔍 MATERIALI: Ricevuta richiesta salvataggio classificazione: {data}")
        
        # Validazione campi obbligatori
        required_fields = ['descrizione', 'codice_fornitore', 'nome_fornitore', 'contoid']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        # Estrai dati dal payload
        codicearticolo = data.get('codice_articolo', '').strip()
        nome = data.get('descrizione', '').strip()
        fornitoreid = data.get('codice_fornitore', '').strip()
        fornitorenome = data.get('nome_fornitore', '').strip()
        contoid = int(data.get('contoid'))
        contonome = data.get('contonome', '').strip() if data.get('contonome') else None
        brancaid = int(data.get('brancaid')) if data.get('brancaid') else None
        brancanome = data.get('brancanome', '').strip() if data.get('brancanome') else None
        sottocontoid = int(data.get('sottocontoid')) if data.get('sottocontoid') else None
        sottocontonome = data.get('sottocontonome', '').strip() if data.get('sottocontonome') else None
        
        # Connetti al database
        import sqlite3
        import os
        from server.app.config.config import Config
        
        db_path = os.path.join(Config.INSTANCE_FOLDER, 'studio_dima.db')
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Verifica se esiste già il materiale
            cursor.execute('''
                SELECT id FROM materiali 
                WHERE codicearticolo = ? AND nome = ? AND fornitoreid = ?
            ''', (codicearticolo, nome, fornitoreid))
            
            existing = cursor.fetchone()
            
            if existing:
                # Aggiorna il materiale esistente
                cursor.execute('''
                    UPDATE materiali 
                    SET contoid = ?, contonome = ?, brancaid = ?, brancanome = ?, 
                        sottocontoid = ?, sottocontonome = ?, confermato = 1,
                        metodo_classificazione = 'manuale'
                    WHERE id = ?
                ''', (contoid, contonome, brancaid, brancanome, sottocontoid, sottocontonome, existing[0]))
                
                operazione = 'aggiornata'
            else:
                # Inserisci nuovo materiale
                cursor.execute('''
                    INSERT INTO materiali 
                    (codicearticolo, nome, fornitoreid, fornitorenome, 
                     contoid, contonome, brancaid, brancanome, 
                     sottocontoid, sottocontonome, confidence, confermato,
                     occorrenze, metodo_classificazione)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 1, 1, 'manuale')
                ''', (codicearticolo, nome, fornitoreid, fornitorenome,
                      contoid, contonome, brancaid, brancanome,
                      sottocontoid, sottocontonome))
                
                operazione = 'salvata'
            
            conn.commit()
        
        return jsonify({
            'success': True,
            'message': f'Classificazione materiale {operazione} correttamente',
            'data': {
                'codicearticolo': codicearticolo,
                'nome': nome,
                'contoid': contoid,
                'brancaid': brancaid,
                'sottocontoid': sottocontoid,
                'operazione': operazione
            }
        })
        
    except Exception as e:
        logger.error(f"Errore salvataggio classificazione materiale: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
@materiali_bp.route('/insert-bundle', methods=['POST'])
@jwt_required()
def insert_materiali_bundle():
    """
    Inserisce un bundle di materiali in modo seriale.
    Riceve un oggetto JSON con array di materiali strutturati.
    """
    try:
        data = request.get_json() or {}
        materiali = data.get('materiali', [])
        
        if not materiali:
            return jsonify({'success': False, 'error': 'Array materiali obbligatorio'}), 400
            
        from server.app.config.config import Config
        db_path = os.path.join(Config.INSTANCE_FOLDER, 'studio_dima.db')
        
        salvati = 0
        falliti = 0
        errori = []
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            for idx, materiale in enumerate(materiali):
                try:
                    # Estrai e valida campi obbligatori
                    nome = (materiale.get('nome') or '').strip()
                    fornitoreid = (materiale.get('fornitoreid') or '').strip()
                    fornitorenome = (materiale.get('fornitorenome') or '').strip()
                    
                    if not (nome and fornitoreid and fornitorenome):
                        errori.append(f"Materiale {idx}: campi obbligatori mancanti")
                        falliti += 1
                        continue
                    
                    # Estrai tutti i campi della tabella materiali
                    codicearticolo = (materiale.get('codicearticolo') or '').strip()
                    contoid = materiale.get('contoid')
                    contonome = materiale.get('contonome', '')
                    brancaid = materiale.get('brancaid')
                    brancanome = materiale.get('brancanome', '')
                    sottocontoid = materiale.get('sottocontoid')
                    sottocontonome = materiale.get('sottocontonome', '')
                    confidence = materiale.get('confidence', 100)
                    confermato = 1 if materiale.get('confermato', True) else 0
                    occorrenze = materiale.get('occorrenze', 1)
                    conto_codice = materiale.get('conto_codice', '')
                    sottoconto_codice = materiale.get('sottoconto_codice', '')
                    categoria_contabile = materiale.get('categoria_contabile', '')
                    metodo_classificazione = materiale.get('metodo_classificazione', 'manuale')
                    data_fattura = materiale.get('data_fattura')
                    costo_unitario = materiale.get('costo_unitario')
                    fattura_id = materiale.get('fattura_id', '')
                    riga_fattura_id = materiale.get('riga_fattura_id', '')
                    
                    # Inserisci sempre un nuovo record per storico completo con TUTTI i campi
                    cursor.execute('''
                        INSERT INTO materiali (
                            codicearticolo, nome, fornitoreid, fornitorenome,
                            contoid, contonome, brancaid, brancanome,
                            sottocontoid, sottocontonome, confidence, confermato, occorrenze,
                            conto_codice, sottoconto_codice, categoria_contabile, metodo_classificazione,
                            data_fattura, costo_unitario, fattura_id, riga_fattura_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        codicearticolo, nome, fornitoreid, fornitorenome,
                        contoid, contonome, brancaid, brancanome,
                        sottocontoid, sottocontonome, confidence, confermato, occorrenze,
                        conto_codice, sottoconto_codice, categoria_contabile, metodo_classificazione,
                        data_fattura, costo_unitario, fattura_id, riga_fattura_id
                    ))
                    
                    salvati += 1
                    
                except Exception as e:
                    errori.append(f"Materiale {idx}: {str(e)}")
                    falliti += 1
                    continue
            
            conn.commit()
        
        return jsonify({
            'success': True,
            'message': f'Bundle processato: {salvati} salvati, {falliti} falliti',
            'materiali_salvati': salvati,
            'materiali_falliti': falliti,
            'errori': errori if errori else None
        })
        
    except Exception as e:
        logger.error(f"Errore insert_materiali_bundle: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@materiali_bp.route('/create', methods=['POST'])
@jwt_required()
def create_or_update_materiale():
    """
    Crea o aggiorna un materiale con eventuale classificazione.
    Accetta sia payload da 'crea materiale' che da 'salva classificazione'.
    """
    try:
        data = request.get_json() or {}

        # Mappa chiavi alternative del payload
        nome = data.get('nome') or data.get('descrizione', '')
        codicearticolo = data.get('codicearticolo') or data.get('codice_articolo', '')
        fornitoreid = data.get('fornitoreid') or data.get('codice_fornitore', '')
        fornitorenome = data.get('fornitorenome') or data.get('nome_fornitore', '')

        # Validazione campi obbligatori
        required_fields = ['nome', 'fornitoreid', 'fornitorenome']
        for field in required_fields:
            if not locals()[field] or not locals()[field].strip():
                return jsonify({'success': False, 'error': f'{field} obbligatorio'}), 400

        # Pulizia valori
        nome = nome.strip()
        codicearticolo = codicearticolo.strip()
        fornitoreid = fornitoreid.strip()
        fornitorenome = fornitorenome.strip()

        contoid = data.get('contoid')
        brancaid = data.get('brancaid')
        sottocontoid = data.get('sottocontoid')
        metodo_classificazione = data.get('metodo_classificazione', 'manuale')
        confidence = data.get('confidence', 100)
        conto_codice = data.get('conto_codice')
        sottoconto_codice = data.get('sottoconto_codice')
        categoria_contabile = data.get('categoria_contabile')

        contonome = data.get('contonome', '')
        brancanome = data.get('brancanome', '')
        sottocontonome = data.get('sottocontonome', '')
        
        # Campi costo e fattura
        data_fattura = data.get('data_fattura')
        costo_unitario = data.get('costo_unitario') or data.get('prezzo_unitario')
        fattura_id = data.get('fattura_id')
        riga_fattura_id = data.get('riga_fattura_id')

        from server.app.config.config import Config
        db_path = os.path.join(Config.INSTANCE_FOLDER, 'studio_dima.db')

        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            # Recupera nomi conto/branca/sottoconto se non forniti ma abbiamo l'ID
            if contoid and not contonome:
                cursor.execute('SELECT nome FROM conti WHERE id = ?', (contoid,))
                row = cursor.fetchone()
                if row:
                    contonome = row[0]

            if brancaid and not brancanome:
                cursor.execute('SELECT nome FROM branche WHERE id = ?', (brancaid,))
                row = cursor.fetchone()
                if row:
                    brancanome = row[0]

            if sottocontoid and not sottocontonome:
                cursor.execute('SELECT nome FROM sottoconti WHERE id = ?', (sottocontoid,))
                row = cursor.fetchone()
                if row:
                    sottocontonome = row[0]

            # SEMPRE inserisci nuovo materiale per storico completo
            # (rimosso controllo esistenza per permettere storico prezzi)
            cursor.execute('''
                INSERT INTO materiali
                (codicearticolo, nome, fornitoreid, fornitorenome,
                 contoid, contonome, brancaid, brancanome,
                 sottocontoid, sottocontonome,
                 conto_codice, sottoconto_codice, categoria_contabile,
                 metodo_classificazione, confidence, confermato, occorrenze,
                 data_fattura, costo_unitario, fattura_id, riga_fattura_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)
            ''', (codicearticolo, nome, fornitoreid, fornitorenome,
                  contoid, contonome, brancaid, brancanome,
                  sottocontoid, sottocontonome,
                  conto_codice, sottoconto_codice, categoria_contabile,
                  metodo_classificazione, confidence,
                  data_fattura, costo_unitario, fattura_id, riga_fattura_id))
            materiale_id = cursor.lastrowid
            operazione = 'salvato'

            conn.commit()

        return jsonify({
            'success': True,
            'message': f'Materiale {operazione} con successo',
            'data': {
                'id': materiale_id,
                'codicearticolo': codicearticolo,
                'nome': nome,
                'fornitoreid': fornitoreid,
                'fornitorenome': fornitorenome,
                'contoid': contoid,
                'contonome': contonome,
                'brancaid': brancaid,
                'brancanome': brancanome,
                'sottocontoid': sottocontoid,
                'sottocontonome': sottocontonome,
                'conto_codice': conto_codice,
                'sottoconto_codice': sottoconto_codice,
                'categoria_contabile': categoria_contabile,
                'metodo_classificazione': metodo_classificazione,
                'confidence': confidence,
                'confermato': True,
                'occorrenze': 1
            }
        })

    except Exception as e:
        logger.error(f"Errore creazione/aggiornamento materiale: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
