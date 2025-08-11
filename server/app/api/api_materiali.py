from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
import sqlite3

logger = logging.getLogger(__name__)

materiali_bp = Blueprint('materiali', __name__, url_prefix='/api/materiali')

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
        ]:
            if col_def[0] not in existing_cols:
                cursor.execute(f"ALTER TABLE materiali ADD COLUMN {col_def[0]} {col_def[1]}")
        # Indici utili
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiali_fornitore ON materiali(fornitoreid)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiali_conto ON materiali(contoid)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiali_branca ON materiali(brancaid)')
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
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
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