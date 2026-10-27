"""Persistent purchasing plans, reorder queue and order history."""
from datetime import date, datetime, timedelta
import math


class OrdiniService:
    def __init__(self, database_manager):
        self.db = database_manager

    @staticmethod
    def _schema(conn):
        conn.execute('''CREATE TABLE IF NOT EXISTS materiali_acquisti (
            materiale_id INTEGER PRIMARY KEY, nome TEXT NOT NULL, codice TEXT,
            fornitore_id TEXT NOT NULL, fornitore_nome TEXT NOT NULL,
            quantita REAL NOT NULL CHECK(quantita > 0), unita TEXT NOT NULL,
            frequenza_giorni INTEGER, prossimo_ordine TEXT, note TEXT NOT NULL,
            da_ordinare INTEGER NOT NULL DEFAULT 0, terminato INTEGER NOT NULL DEFAULT 0
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS materiali_ordini (
            id INTEGER PRIMARY KEY AUTOINCREMENT, fornitore_id TEXT NOT NULL,
            fornitore_nome TEXT NOT NULL, data_ordine TEXT NOT NULL,
            stato TEXT NOT NULL DEFAULT 'ordinato', data_ricezione TEXT
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS materiali_ordini_righe (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ordine_id INTEGER NOT NULL,
            materiale_id INTEGER NOT NULL, nome TEXT NOT NULL, codice TEXT,
            quantita REAL NOT NULL, unita TEXT NOT NULL, note TEXT NOT NULL
        )''')
        # Carrello unico condiviso da tutto lo studio: una riga per materiale.
        conn.execute('''CREATE TABLE IF NOT EXISTS materiali_carrello (
            materiale_id INTEGER PRIMARY KEY, quantita REAL NOT NULL CHECK(quantita > 0),
            aggiornato_da TEXT, aggiornato_il TEXT NOT NULL
        )''')
        # Preferiti e "salva per dopo" condivisi dallo studio; la chiave e' il nome normalizzato del prodotto
        # (stabile anche quando una nuova fattura cambia l'id della riga piu' recente).
        conn.execute('''CREATE TABLE IF NOT EXISTS materiali_preferiti (
            chiave TEXT NOT NULL, tipo TEXT NOT NULL CHECK(tipo IN ('preferito', 'dopo')),
            PRIMARY KEY (chiave, tipo)
        )''')

    @staticmethod
    def _rows(cursor):
        names = [column[0] for column in cursor.description]
        return [dict(zip(names, row)) for row in cursor.fetchall()]

    def list(self):
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            plans = self._rows(conn.execute('SELECT * FROM materiali_acquisti ORDER BY fornitore_nome, nome'))
            orders = self._rows(conn.execute('SELECT * FROM materiali_ordini ORDER BY id DESC'))
            lines = self._rows(conn.execute('SELECT * FROM materiali_ordini_righe ORDER BY id'))
            for order in orders:
                order['righe'] = [line for line in lines if line['ordine_id'] == order['id']]
            for plan in plans:
                plan['in_arrivo'] = any(line['materiale_id'] == plan['materiale_id']
                    for order in orders if order['stato'] == 'ordinato' for line in order['righe'])
                plan['scaduto'] = bool(plan['prossimo_ordine'] and plan['prossimo_ordine'] <= date.today().isoformat())
            return {'piani': plans, 'ordini': orders}

    def save(self, material_id, data):
        if not isinstance(data, dict):
            raise ValueError('Dati non validi')
        try:
            quantity = float(data.get('quantita', 1))
            frequency = data.get('frequenza_giorni')
            frequency = None if frequency in (None, '') else float(frequency)
            if not math.isfinite(quantity) or quantity <= 0 or quantity > 1000000:
                raise ValueError()
            if frequency is not None and (not math.isfinite(frequency) or not frequency.is_integer() or not 1 <= frequency <= 3650):
                raise ValueError()
        except (TypeError, ValueError):
            raise ValueError('Quantità positiva e frequenza intera tra 1 e 3650 giorni richieste')
        next_date = data.get('prossimo_ordine') or None
        if next_date:
            try:
                next_date = date.fromisoformat(next_date).isoformat()
            except (TypeError, ValueError):
                raise ValueError('Data del prossimo ordine non valida')
        supplier_id = str(data.get('fornitore_id') or '').strip()
        supplier_name = str(data.get('fornitore_nome') or '').strip()
        unit = str(data.get('unita') or '').strip()
        notes = str(data.get('note') or '').strip()
        if not supplier_id or not supplier_name or not unit or len(unit) > 50 or len(notes) > 2000:
            raise ValueError('Fornitore e unità obbligatori; note massimo 2000 caratteri')
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            material = conn.execute('SELECT nome, codicearticolo FROM materiali WHERE id = ?', (material_id,)).fetchone()
            if not material:
                raise ValueError('Materiale non trovato')
            conn.execute('''INSERT INTO materiali_acquisti
                (materiale_id, nome, codice, fornitore_id, fornitore_nome, quantita, unita,
                 frequenza_giorni, prossimo_ordine, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(materiale_id) DO UPDATE SET nome=excluded.nome, codice=excluded.codice,
                fornitore_id=excluded.fornitore_id, fornitore_nome=excluded.fornitore_nome,
                quantita=excluded.quantita, unita=excluded.unita, frequenza_giorni=excluded.frequenza_giorni,
                prossimo_ordine=excluded.prossimo_ordine, note=excluded.note''',
                (material_id, material[0], material[1], supplier_id, supplier_name, quantity, unit,
                 int(frequency) if frequency else None, next_date, notes))

    def queue(self, material_id, action):
        if action not in ('terminato', 'aggiungi', 'rimuovi'):
            raise ValueError('Azione non valida')
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            if action == 'terminato':
                cursor = conn.execute('UPDATE materiali_acquisti SET da_ordinare=1, terminato=1 WHERE materiale_id=?', (material_id,))
            elif action == 'aggiungi':
                cursor = conn.execute('UPDATE materiali_acquisti SET da_ordinare=1 WHERE materiale_id=?', (material_id,))
            else:
                cursor = conn.execute('UPDATE materiali_acquisti SET da_ordinare=0, terminato=0 WHERE materiale_id=?', (material_id,))
            if not cursor.rowcount:
                raise ValueError('Configura prima il materiale')

    def create_order(self, ids):
        if not isinstance(ids, list) or not ids or len(ids) > 500 or any(type(i) is not int for i in ids):
            raise ValueError('Seleziona da 1 a 500 materiali')
        ids = list(dict.fromkeys(ids))
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            # Lock before reading to avoid two operators ordering the same queue concurrently.
            conn.execute('BEGIN IMMEDIATE')
            plans = self._rows(conn.execute('SELECT * FROM materiali_acquisti WHERE materiale_id IN (' + ','.join('?' for _ in ids) + ')', ids))
            if len(plans) != len(ids) or any(not p['da_ordinare'] for p in plans):
                raise ValueError('La lista è cambiata: aggiorna e seleziona i materiali da ordinare')
            for plan in plans:
                pending = conn.execute('''SELECT 1 FROM materiali_ordini_righe r JOIN materiali_ordini o ON o.id=r.ordine_id
                    WHERE r.materiale_id=? AND o.stato='ordinato' ''', (plan['materiale_id'],)).fetchone()
                if pending:
                    raise ValueError('Un materiale selezionato è già in attesa di ricezione')
            created = []
            for supplier in dict.fromkeys(p['fornitore_id'] for p in plans):
                group = [p for p in plans if p['fornitore_id'] == supplier]
                order_id = conn.execute('INSERT INTO materiali_ordini (fornitore_id, fornitore_nome, data_ordine) VALUES (?, ?, ?)',
                    (supplier, group[0]['fornitore_nome'], date.today().isoformat())).lastrowid
                created.append(order_id)
                for plan in group:
                    conn.execute('''INSERT INTO materiali_ordini_righe
                        (ordine_id, materiale_id, nome, codice, quantita, unita, note) VALUES (?, ?, ?, ?, ?, ?, ?)''',
                        (order_id, plan['materiale_id'], plan['nome'], plan['codice'], plan['quantita'], plan['unita'], plan['note']))
                    next_date = (date.today() + timedelta(days=plan['frequenza_giorni'])).isoformat() if plan['frequenza_giorni'] else None
                    conn.execute('UPDATE materiali_acquisti SET da_ordinare=0, prossimo_ordine=? WHERE materiale_id=?', (next_date, plan['materiale_id']))
            return created

    @staticmethod
    def _carrello(conn):
        return OrdiniService._rows(conn.execute('''SELECT c.materiale_id, m.nome, m.codicearticolo AS codice,
            m.fornitoreid AS fornitore_id, m.fornitorenome AS fornitore_nome, c.quantita,
            c.aggiornato_da, c.aggiornato_il
            FROM materiali_carrello c JOIN materiali m ON m.id = c.materiale_id
            ORDER BY m.fornitorenome, m.nome'''))

    def carrello(self):
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            return self._carrello(conn)

    def carrello_modifica(self, material_id, delta=None, quantita=None, utente=None):
        """Somma delta alla quantita' in carrello (calcolo sul server) oppure la imposta; a 0 la riga sparisce."""
        if (delta is None) == (quantita is None):
            raise ValueError('Indica delta oppure quantita')
        try:
            value = float(delta if delta is not None else quantita)
        except (TypeError, ValueError):
            raise ValueError('Quantita non valida')
        if not math.isfinite(value) or abs(value) > 1000000:
            raise ValueError('Quantita non valida')
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            if not conn.execute('SELECT 1 FROM materiali WHERE id = ?', (material_id,)).fetchone():
                raise ValueError('Materiale non trovato')
            current = conn.execute('SELECT quantita FROM materiali_carrello WHERE materiale_id = ?', (material_id,)).fetchone()
            new = value if delta is None else (current[0] if current else 0) + value
            if new <= 0:
                conn.execute('DELETE FROM materiali_carrello WHERE materiale_id = ?', (material_id,))
            elif new > 1000000:
                raise ValueError('Quantita non valida')
            else:
                conn.execute('''INSERT INTO materiali_carrello (materiale_id, quantita, aggiornato_da, aggiornato_il)
                    VALUES (?, ?, ?, ?) ON CONFLICT(materiale_id) DO UPDATE SET quantita=excluded.quantita,
                    aggiornato_da=excluded.aggiornato_da, aggiornato_il=excluded.aggiornato_il''',
                    (material_id, new, utente, datetime.now().isoformat(timespec='seconds')))
            return self._carrello(conn)

    def carrello_rimuovi(self, material_id=None):
        """Toglie una riga dal carrello, o tutto il carrello se material_id e' None."""
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            if material_id is None:
                conn.execute('DELETE FROM materiali_carrello')
            else:
                conn.execute('DELETE FROM materiali_carrello WHERE materiale_id = ?', (material_id,))
            return self._carrello(conn)

    def carrello_ordina(self, ids):
        """Registra nello storico le righe scelte (un ordine per fornitore) e le toglie dal carrello."""
        if not isinstance(ids, list) or not ids or len(ids) > 500 or any(type(i) is not int for i in ids):
            raise ValueError('Seleziona da 1 a 500 materiali')
        ids = list(dict.fromkeys(ids))
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            lines = [l for l in self._carrello(conn) if l['materiale_id'] in ids]
            if len(lines) != len(ids):
                raise ValueError('Il carrello e\' cambiato: aggiorna la pagina')
            if any(not str(l['fornitore_id'] or '').strip() for l in lines):
                raise ValueError('Un materiale selezionato non ha il fornitore')
            created = []
            for supplier in dict.fromkeys(str(l['fornitore_id']) for l in lines):
                group = [l for l in lines if str(l['fornitore_id']) == supplier]
                order_id = conn.execute('INSERT INTO materiali_ordini (fornitore_id, fornitore_nome, data_ordine) VALUES (?, ?, ?)',
                    (supplier, group[0]['fornitore_nome'] or '', date.today().isoformat())).lastrowid
                created.append(order_id)
                for line in group:
                    conn.execute('''INSERT INTO materiali_ordini_righe
                        (ordine_id, materiale_id, nome, codice, quantita, unita, note) VALUES (?, ?, ?, ?, ?, 'confezioni', '')''',
                        (order_id, line['materiale_id'], line['nome'], line['codice'], line['quantita']))
            conn.execute('DELETE FROM materiali_carrello WHERE materiale_id IN (' + ','.join('?' for _ in ids) + ')', ids)
            return {'ordini': created, 'carrello': self._carrello(conn)}

    def carrello_riordina(self, order_id, utente=None):
        """Rimette nel carrello le righe di un ordine passato; i materiali che non esistono piu' vengono saltati."""
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            if not conn.execute('SELECT 1 FROM materiali_ordini WHERE id = ?', (order_id,)).fetchone():
                raise ValueError('Ordine non trovato')
            added = skipped = 0
            now = datetime.now().isoformat(timespec='seconds')
            for material_id, quantity in conn.execute('SELECT materiale_id, quantita FROM materiali_ordini_righe WHERE ordine_id = ?', (order_id,)).fetchall():
                if not conn.execute('SELECT 1 FROM materiali WHERE id = ?', (material_id,)).fetchone():
                    skipped += 1
                    continue
                conn.execute('''INSERT INTO materiali_carrello (materiale_id, quantita, aggiornato_da, aggiornato_il)
                    VALUES (?, ?, ?, ?) ON CONFLICT(materiale_id) DO UPDATE SET
                    quantita = MIN(materiali_carrello.quantita + excluded.quantita, 1000000),
                    aggiornato_da=excluded.aggiornato_da, aggiornato_il=excluded.aggiornato_il''',
                    (material_id, quantity, utente, now))
                added += 1
            return {'aggiunte': added, 'saltate': skipped, 'carrello': self._carrello(conn)}

    def preferiti(self):
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            return self._rows(conn.execute('SELECT chiave, tipo FROM materiali_preferiti ORDER BY chiave'))

    def preferiti_imposta(self, data):
        if not isinstance(data, dict):
            raise ValueError('Dati non validi')
        key = str(data.get('chiave') or '').strip()
        kind = data.get('tipo')
        if not key or len(key) > 300 or kind not in ('preferito', 'dopo') or not isinstance(data.get('attivo'), bool):
            raise ValueError('Dati non validi')
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            if data['attivo']:
                conn.execute('INSERT OR IGNORE INTO materiali_preferiti (chiave, tipo) VALUES (?, ?)', (key, kind))
            else:
                conn.execute('DELETE FROM materiali_preferiti WHERE chiave = ? AND tipo = ?', (key, kind))
            return self._rows(conn.execute('SELECT chiave, tipo FROM materiali_preferiti ORDER BY chiave'))

    def ordine_modifica(self, order_id, data):
        """Modifica data, stato e righe di un ordine. 'righe' e' l'elenco completo di quelle da tenere: le altre vengono tolte."""
        if not isinstance(data, dict) or not isinstance(data.get('righe'), list):
            raise ValueError('Dati non validi')
        status = data.get('stato')
        if status not in ('ordinato', 'ricevuto', 'annullato'):
            raise ValueError('Stato non valido')
        try:
            order_date = date.fromisoformat(data.get('data_ordine')).isoformat()
            receipt = date.fromisoformat(data['data_ricezione']).isoformat() if status == 'ricevuto' and data.get('data_ricezione') else None
        except (TypeError, ValueError):
            raise ValueError('Data non valida')
        if status == 'ricevuto' and not receipt:
            receipt = date.today().isoformat()
        lines = []
        for line in data['righe']:
            try:
                quantity = float(line['quantita'])
                line_id = line['id']
                notes = str(line.get('note') or '').strip()
            except (TypeError, ValueError, KeyError, AttributeError):
                raise ValueError('Riga non valida')
            if type(line_id) is not int or not math.isfinite(quantity) or not 0 < quantity <= 1000000 or len(notes) > 2000:
                raise ValueError('Quantita positiva e note massimo 2000 caratteri richieste')
            lines.append((line_id, quantity, notes))
        if not lines or len({l[0] for l in lines}) != len(lines):
            raise ValueError('L\'ordine deve avere almeno una riga: per toglierlo usa Elimina')
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            if not conn.execute('SELECT 1 FROM materiali_ordini WHERE id = ?', (order_id,)).fetchone():
                raise ValueError('Ordine non trovato')
            existing = {r[0] for r in conn.execute('SELECT id FROM materiali_ordini_righe WHERE ordine_id = ?', (order_id,))}
            if not {l[0] for l in lines} <= existing:
                raise ValueError('Riga non appartenente all\'ordine')
            conn.execute('UPDATE materiali_ordini SET data_ordine=?, stato=?, data_ricezione=? WHERE id=?',
                (order_date, status, receipt, order_id))
            for line_id, quantity, notes in lines:
                conn.execute('UPDATE materiali_ordini_righe SET quantita=?, note=? WHERE id=?', (quantity, notes, line_id))
            keep = [l[0] for l in lines]
            conn.execute('DELETE FROM materiali_ordini_righe WHERE ordine_id=? AND id NOT IN (' + ','.join('?' for _ in keep) + ')',
                [order_id] + keep)

    def ordine_elimina(self, order_id):
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            conn.execute('DELETE FROM materiali_ordini_righe WHERE ordine_id = ?', (order_id,))
            if not conn.execute('DELETE FROM materiali_ordini WHERE id = ?', (order_id,)).rowcount:
                raise ValueError('Ordine non trovato')

    def transition(self, order_id, action):
        if action not in ('ricevuto', 'annullato'):
            raise ValueError('Stato non valido')
        with self.db.get_connection() as conn, conn:
            self._schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            cursor = conn.execute("UPDATE materiali_ordini SET stato=?, data_ricezione=? WHERE id=? AND stato='ordinato'",
                (action, date.today().isoformat() if action == 'ricevuto' else None, order_id))
            if not cursor.rowcount:
                raise ValueError('Ordine inesistente o già chiuso')
            if action == 'ricevuto':
                conn.execute('''UPDATE materiali_acquisti SET terminato=0 WHERE da_ordinare=0 AND materiale_id IN
                    (SELECT materiale_id FROM materiali_ordini_righe WHERE ordine_id=?)''', (order_id,))
            else:
                conn.execute('''UPDATE materiali_acquisti SET da_ordinare=1, prossimo_ordine=NULL WHERE materiale_id IN
                    (SELECT materiale_id FROM materiali_ordini_righe WHERE ordine_id=?)''', (order_id,))
