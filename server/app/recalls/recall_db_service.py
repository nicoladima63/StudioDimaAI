import sqlite3
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))
DB_PATH = os.getenv('RECALL_DB_PATH', 'recall_db.db')

def get_connection():
    return sqlite3.connect(DB_PATH)

# --- CRUD MESSAGGI ---

def get_all_messages(tipo=None):
    conn = get_connection()
    c = conn.cursor()
    if tipo:
        c.execute("SELECT * FROM message WHERE tipo = ? ORDER BY attivo DESC, data_modifica DESC", (tipo,))
    else:
        c.execute("SELECT * FROM message ORDER BY attivo DESC, data_modifica DESC")
    rows = c.fetchall()
    conn.close()
    return rows

def get_message_by_id(msg_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM message WHERE id = ?", (msg_id,))
    row = c.fetchone()
    conn.close()
    return row

def create_message(tipo, testo, titolo=None, attivo=1):
    conn = get_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO message (tipo, titolo, testo, attivo, data_creazione, data_modifica) VALUES (?, ?, ?, ?, ?, ?)",
        (tipo, titolo, testo, attivo, datetime.now(), datetime.now())
    )
    conn.commit()
    msg_id = c.lastrowid
    conn.close()
    return msg_id

def update_message(msg_id, testo=None, titolo=None, attivo=None):
    conn = get_connection()
    c = conn.cursor()
    fields = []
    values = []
    if testo is not None:
        fields.append("testo = ?")
        values.append(testo)
    if titolo is not None:
        fields.append("titolo = ?")
        values.append(titolo)
    if attivo is not None:
        fields.append("attivo = ?")
        values.append(attivo)
    fields.append("data_modifica = ?")
    values.append(datetime.now())
    values.append(msg_id)
    sql = f"UPDATE message SET {', '.join(fields)} WHERE id = ?"
    c.execute(sql, values)
    conn.commit()
    conn.close()

def delete_message(msg_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM message WHERE id = ?", (msg_id,))
    conn.commit()
    conn.close()

def render_message_template(template, richiamo):
    """
    Sostituisce i segnaposto nel template con i dati reali del richiamo.
    """
    mapping = {
        'nomepaziente': richiamo.get('nome_completo', ''),
        'tiporichiamo': richiamo.get('tipo_descrizione', ''),
        'dataappuntamento': richiamo.get('data_richiamo', ''),
    }
    for key, value in mapping.items():
        template = template.replace(f'{{{key}}}', str(value))
    return template

# --- LETTURA STORICO INVII ---

def get_all_invio(tipo=None, id_paziente=None):
    conn = get_connection()
    c = conn.cursor()
    query = "SELECT * FROM invio WHERE 1=1"
    params = []
    if tipo:
        query += " AND tipo = ?"
        params.append(tipo)
    if id_paziente:
        query += " AND id_paziente = ?"
        params.append(id_paziente)
    query += " ORDER BY data_invio DESC"
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    return rows

def get_invio_by_id(invio_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM invio WHERE id = ?", (invio_id,))
    row = c.fetchone()
    conn.close()
    return row
