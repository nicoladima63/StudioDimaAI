from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
import sqlite3

logger = logging.getLogger(__name__)

struttura_conti_bp = Blueprint('struttura_conti', __name__, url_prefix='/api/struttura-conti')

# ===================== CONTI =====================

@struttura_conti_bp.route('/conti', methods=['GET'])
#@jwt_required()
def get_conti():
    """Ottiene tutti i conti"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, nome FROM conti ORDER BY nome')
        conti = [{'id': row[0], 'nome': row[1]} for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': conti,
            'total': len(conti)
        })
        
    except Exception as e:
        logger.error(f"Errore get conti: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/conti/<int:conto_id>', methods=['GET'])
@jwt_required()
def get_conto(conto_id):
    """Ottiene un conto specifico"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, nome FROM conti WHERE id = ?', (conto_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return jsonify({'success': False, 'error': 'Conto non trovato'}), 404
        
        conto = {'id': row[0], 'nome': row[1]}
        conn.close()
        
        return jsonify({
            'success': True,
            'data': conto
        })
        
    except Exception as e:
        logger.error(f"Errore get conto {conto_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/conti', methods=['POST'])
@jwt_required()
def create_conto():
    """Crea un nuovo conto"""
    try:
        data = request.get_json()
        if not data or not data.get('nome'):
            return jsonify({'success': False, 'error': 'Nome conto obbligatorio'}), 400
        
        nome = data['nome'].strip()
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('INSERT INTO conti (nome) VALUES (?)', (nome,))
        conto_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': {'id': conto_id, 'nome': nome},
            'message': f'Conto "{nome}" creato con successo'
        })
        
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Conto già esistente'}), 400
    except Exception as e:
        logger.error(f"Errore create conto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/conti/<int:conto_id>', methods=['PUT'])
@jwt_required()
def update_conto(conto_id):
    """Aggiorna un conto"""
    try:
        data = request.get_json()
        if not data or not data.get('nome'):
            return jsonify({'success': False, 'error': 'Nome conto obbligatorio'}), 400
        
        nome = data['nome'].strip()
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('UPDATE conti SET nome = ? WHERE id = ?', (nome, conto_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Conto non trovato'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': {'id': conto_id, 'nome': nome},
            'message': f'Conto aggiornato con successo'
        })
        
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Nome conto già esistente'}), 400
    except Exception as e:
        logger.error(f"Errore update conto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/conti/<int:conto_id>', methods=['DELETE'])
@jwt_required()
def delete_conto(conto_id):
    """Elimina un conto (solo se non ha branche)"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Controlla se ha branche
        cursor.execute('SELECT COUNT(*) FROM branche WHERE contoid = ?', (conto_id,))
        if cursor.fetchone()[0] > 0:
            conn.close()
            return jsonify({'success': False,'warning': True, 'error': 'Impossibile eliminare: conto ha branche associate'}), 400
        
        cursor.execute('DELETE FROM conti WHERE id = ?', (conto_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Conto non trovato'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Conto eliminato con successo'
        })
        
    except Exception as e:
        logger.error(f"Errore delete conto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ===================== BRANCHE =====================

@struttura_conti_bp.route('/branche', methods=['GET'])
@jwt_required()
def get_branche():
    """Ottiene tutte le branche"""
    try:
        conto_id = request.args.get('conto_id', type=int)
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        if conto_id:
            cursor.execute('''
                SELECT b.id, b.contoid, b.nome, c.nome as conto_nome
                FROM branche b
                JOIN conti c ON b.contoid = c.id
                WHERE b.contoid = ?
                ORDER BY b.nome
            ''', (conto_id,))
        else:
            cursor.execute('''
                SELECT b.id, b.contoid, b.nome, c.nome as conto_nome
                FROM branche b
                JOIN conti c ON b.contoid = c.id
                ORDER BY c.nome, b.nome
            ''')
        
        branche = []
        for row in cursor.fetchall():
            branche.append({
                'id': row[0],
                'contoid': row[1], 
                'nome': row[2],
                'conto_nome': row[3]
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': branche,
            'total': len(branche)
        })
        
    except Exception as e:
        logger.error(f"Errore get branche: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/branche/<int:branca_id>', methods=['GET'])
@jwt_required()
def get_branca(branca_id):
    """Ottiene una branca specifica"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT b.id, b.contoid, b.nome, c.nome as conto_nome
            FROM branche b
            JOIN conti c ON b.contoid = c.id
            WHERE b.id = ?
        ''', (branca_id,))
        
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return jsonify({'success': False, 'error': 'Branca non trovata'}), 404
        
        branca = {
            'id': row[0],
            'contoid': row[1],
            'nome': row[2],
            'conto_nome': row[3]
        }
        conn.close()
        
        return jsonify({
            'success': True,
            'data': branca
        })
        
    except Exception as e:
        logger.error(f"Errore get branca {branca_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/branche', methods=['POST'])
@jwt_required()
def create_branca():
    """Crea una nuova branca"""
    try:
        data = request.get_json()
        if not data or not data.get('nome') or not data.get('contoid'):
            return jsonify({'success': False, 'error': 'Nome e conto_id obbligatori'}), 400
        
        nome = data['nome'].strip()
        contoid = data['contoid']
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Verifica che il conto esista
        cursor.execute('SELECT nome FROM conti WHERE id = ?', (contoid,))
        conto = cursor.fetchone()
        if not conto:
            conn.close()
            return jsonify({'success': False, 'error': 'Conto non trovato'}), 404
        
        cursor.execute('INSERT INTO branche (contoid, nome) VALUES (?, ?)', (contoid, nome))
        branca_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': {
                'id': branca_id,
                'contoid': contoid,
                'nome': nome,
                'conto_nome': conto[0]
            },
            'message': f'Branca "{nome}" creata con successo'
        })
        
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Branca già esistente per questo conto'}), 400
    except Exception as e:
        logger.error(f"Errore create branca: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/branche/<int:branca_id>', methods=['PUT'])
@jwt_required()
def update_branca(branca_id):
    """Aggiorna una branca"""
    try:
        data = request.get_json()
        if not data or not data.get('nome'):
            return jsonify({'success': False, 'error': 'Nome branca obbligatorio'}), 400
        
        nome = data['nome'].strip()
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('UPDATE branche SET nome = ? WHERE id = ?', (nome, branca_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Branca non trovata'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Branca aggiornata con successo'
        })
        
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Nome branca già esistente per questo conto'}), 400
    except Exception as e:
        logger.error(f"Errore update branca: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/branche/<int:branca_id>', methods=['DELETE'])
@jwt_required()
def delete_branca(branca_id):
    """Elimina una branca (solo se non ha sottoconti)"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Controlla se ha sottoconti
        cursor.execute('SELECT COUNT(*) FROM sottoconti WHERE brancaid = ?', (branca_id,))
        if cursor.fetchone()[0] > 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Impossibile eliminare: branca ha sottoconti associati'}), 400
        
        cursor.execute('DELETE FROM branche WHERE id = ?', (branca_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Branca non trovata'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Branca eliminata con successo'
        })
        
    except Exception as e:
        logger.error(f"Errore delete branca: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ===================== SOTTOCONTI =====================

@struttura_conti_bp.route('/sottoconti', methods=['GET'])
@jwt_required()
def get_sottoconti():
    """Ottiene tutti i sottoconti"""
    try:
        branca_id = request.args.get('branca_id', type=int)
        conto_id = request.args.get('conto_id', type=int)
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        if branca_id:
            cursor.execute('''
                SELECT s.id, s.contoid, s.brancaid, s.nome, 
                       c.nome as conto_nome, b.nome as branca_nome
                FROM sottoconti s
                JOIN conti c ON s.contoid = c.id
                JOIN branche b ON s.brancaid = b.id
                WHERE s.brancaid = ?
                ORDER BY s.nome
            ''', (branca_id,))
        elif conto_id:
            cursor.execute('''
                SELECT s.id, s.contoid, s.brancaid, s.nome, 
                       c.nome as conto_nome, b.nome as branca_nome
                FROM sottoconti s
                JOIN conti c ON s.contoid = c.id
                JOIN branche b ON s.brancaid = b.id
                WHERE s.contoid = ?
                ORDER BY b.nome, s.nome
            ''', (conto_id,))
        else:
            cursor.execute('''
                SELECT s.id, s.contoid, s.brancaid, s.nome, 
                       c.nome as conto_nome, b.nome as branca_nome
                FROM sottoconti s
                JOIN conti c ON s.contoid = c.id
                JOIN branche b ON s.brancaid = b.id
                ORDER BY c.nome, b.nome, s.nome
            ''')
        
        sottoconti = []
        for row in cursor.fetchall():
            sottoconti.append({
                'codice': str(row[0]),  # Usa l'id come codice
                'descrizione': row[3],   # Nome del sottoconto
                'label': f"{row[0]} - {row[3]}",  # ID - Nome
                'fonte': 'sqlite',
                # Mantieni anche i campi originali per compatibilità
                'id': row[0],
                'contoid': row[1],
                'brancaid': row[2],
                'nome': row[3],
                'conto_nome': row[4],
                'branca_nome': row[5]
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': sottoconti,
            'total': len(sottoconti)
        })
        
    except Exception as e:
        logger.error(f"Errore get sottoconti: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/sottoconti/<int:sottoconto_id>', methods=['GET'])
@jwt_required()
def get_sottoconto(sottoconto_id):
    """Ottiene un sottoconto specifico"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT s.id, s.contoid, s.brancaid, s.nome, 
                   c.nome as conto_nome, b.nome as branca_nome
            FROM sottoconti s
            JOIN conti c ON s.contoid = c.id
            JOIN branche b ON s.brancaid = b.id
            WHERE s.id = ?
        ''', (sottoconto_id,))
        
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return jsonify({'success': False, 'error': 'Sottoconto non trovato'}), 404
        
        sottoconto = {
            'id': row[0],
            'contoid': row[1],
            'brancaid': row[2],
            'nome': row[3],
            'conto_nome': row[4],
            'branca_nome': row[5]
        }
        conn.close()
        
        return jsonify({
            'success': True,
            'data': sottoconto
        })
        
    except Exception as e:
        logger.error(f"Errore get sottoconto {sottoconto_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/sottoconti', methods=['POST'])
@jwt_required()
def create_sottoconto():
    """Crea un nuovo sottoconto"""
    try:
        data = request.get_json()
        if not data or not data.get('nome') or not data.get('brancaid'):
            return jsonify({'success': False, 'error': 'Nome e branca_id obbligatori'}), 400
        
        nome = data['nome'].strip()
        brancaid = data['brancaid']
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Verifica che la branca esista e ottieni il contoid
        cursor.execute('SELECT contoid, nome FROM branche WHERE id = ?', (brancaid,))
        branca = cursor.fetchone()
        if not branca:
            conn.close()
            return jsonify({'success': False, 'error': 'Branca non trovata'}), 404
        
        contoid = branca[0]
        branca_nome = branca[1]
        
        cursor.execute('INSERT INTO sottoconti (contoid, brancaid, nome) VALUES (?, ?, ?)', 
                      (contoid, brancaid, nome))
        sottoconto_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': {
                'id': sottoconto_id,
                'contoid': contoid,
                'brancaid': brancaid,
                'nome': nome,
                'branca_nome': branca_nome
            },
            'message': f'Sottoconto "{nome}" creato con successo'
        })
        
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Sottoconto già esistente per questa branca'}), 400
    except Exception as e:
        logger.error(f"Errore create sottoconto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/sottoconti/<int:sottoconto_id>', methods=['PUT'])
@jwt_required()
def update_sottoconto(sottoconto_id):
    """Aggiorna un sottoconto"""
    try:
        data = request.get_json()
        if not data or not data.get('nome'):
            return jsonify({'success': False, 'error': 'Nome sottoconto obbligatorio'}), 400
        
        nome = data['nome'].strip()
        
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        cursor.execute('UPDATE sottoconti SET nome = ? WHERE id = ?', (nome, sottoconto_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Sottoconto non trovato'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Sottoconto aggiornato con successo'
        })
        
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Nome sottoconto già esistente per questa branca'}), 400
    except Exception as e:
        logger.error(f"Errore update sottoconto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@struttura_conti_bp.route('/sottoconti/<int:sottoconto_id>', methods=['DELETE'])
@jwt_required()
def delete_sottoconto(sottoconto_id):
    """Elimina un sottoconto (solo se non ha materiali)"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Controlla se ha materiali
        cursor.execute('SELECT COUNT(*) FROM materiali WHERE brancaid = (SELECT brancaid FROM sottoconti WHERE id = ?)', (sottoconto_id,))
        if cursor.fetchone()[0] > 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Impossibile eliminare: sottoconto ha materiali associati'}), 400
        
        cursor.execute('DELETE FROM sottoconti WHERE id = ?', (sottoconto_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Sottoconto non trovato'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Sottoconto eliminato con successo'
        })
        
    except Exception as e:
        logger.error(f"Errore delete sottoconto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ===================== STRUTTURA COMPLETA =====================

@struttura_conti_bp.route('/struttura-completa', methods=['GET'])
@jwt_required()
def get_struttura_completa():
    """Ottiene la struttura completa conti -> branche -> sottoconti"""
    try:
        conn = sqlite3.connect('server/instance/studio_dima.db')
        cursor = conn.cursor()
        
        # Query per ottenere tutto in una volta
        cursor.execute('''
            SELECT 
                c.id as conto_id, c.nome as conto_nome,
                b.id as branca_id, b.nome as branca_nome,
                s.id as sottoconto_id, s.nome as sottoconto_nome
            FROM conti c
            LEFT JOIN branche b ON c.id = b.contoid
            LEFT JOIN sottoconti s ON b.id = s.brancaid
            ORDER BY c.nome, b.nome, s.nome
        ''')
        
        struttura = {}
        for row in cursor.fetchall():
            conto_id, conto_nome, branca_id, branca_nome, sottoconto_id, sottoconto_nome = row
            
            if conto_id not in struttura:
                struttura[conto_id] = {
                    'id': conto_id,
                    'nome': conto_nome,
                    'branche': {}
                }
            
            if branca_id and branca_id not in struttura[conto_id]['branche']:
                struttura[conto_id]['branche'][branca_id] = {
                    'id': branca_id,
                    'nome': branca_nome,
                    'sottoconti': []
                }
            
            if sottoconto_id and branca_id:
                struttura[conto_id]['branche'][branca_id]['sottoconti'].append({
                    'id': sottoconto_id,
                    'nome': sottoconto_nome
                })
        
        conn.close()
        
        # Converte in lista
        result = []
        for conto in struttura.values():
            conto['branche'] = list(conto['branche'].values())
            result.append(conto)
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Errore get struttura completa: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500