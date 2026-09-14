import sqlite3
import unittest
from contextlib import contextmanager
from datetime import date, timedelta
from server_v2.services.ordini_service import OrdiniService


class TestOrdini(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(':memory:', isolation_level=None)
        self.conn.execute('CREATE TABLE materiali (id INTEGER PRIMARY KEY, nome TEXT, codicearticolo TEXT)')
        self.conn.executemany('INSERT INTO materiali VALUES (?, ?, ?)', [(1, 'Guanti', 'G1'), (2, 'Mascherine', 'M1'), (3, 'Garze', 'G2')])
        self.service = OrdiniService(self)

    @contextmanager
    def get_connection(self):
        yield self.conn

    def tearDown(self):
        self.conn.close()

    def plan(self, id=1, supplier='A', **kwargs):
        self.service.save(id, dict(fornitore_id=supplier, fornitore_nome=f'Fornitore {supplier}',
            quantita=2, unita='confezioni', frequenza_giorni=30, note='Senza lattice', **kwargs))

    def test_grouping_history_and_receipt(self):
        for id, supplier in [(1, 'A'), (2, 'A'), (3, 'B')]:
            self.plan(id, supplier)
            self.service.queue(id, 'terminato')
        ids = self.service.create_order([1, 2, 3])
        result = self.service.list()
        self.assertEqual(len(ids), 2)
        self.assertEqual(sorted(len(o['righe']) for o in result['ordini']), [1, 2])
        self.assertTrue(all(p['in_arrivo'] and not p['da_ordinare'] for p in result['piani']))
        self.assertEqual(result['piani'][0]['prossimo_ordine'], (date.today() + timedelta(days=30)).isoformat())
        self.service.transition(ids[0], 'ricevuto')
        self.assertFalse(self.service.list()['piani'][0]['terminato'])
        self.assertEqual(self.service.list()['ordini'][1]['data_ricezione'], date.today().isoformat())

    def test_duplicate_and_pending_orders_rejected(self):
        self.plan()
        self.service.queue(1, 'aggiungi')
        self.service.create_order([1])
        with self.assertRaises(ValueError):
            self.service.create_order([1])
        self.service.queue(1, 'terminato')
        with self.assertRaises(ValueError):
            self.service.create_order([1])
        self.assertEqual(len(self.service.list()['ordini']), 1)

    def test_cancel_requeues_and_cannot_close_twice(self):
        self.plan()
        self.service.queue(1, 'terminato')
        id = self.service.create_order([1])[0]
        self.service.transition(id, 'annullato')
        plan = self.service.list()['piani'][0]
        self.assertTrue(plan['da_ordinare'])
        self.assertTrue(plan['terminato'])
        with self.assertRaises(ValueError):
            self.service.transition(id, 'ricevuto')
        self.assertEqual(len(self.service.create_order([1])), 1)

    def test_edit_preserves_queue_and_historical_snapshot(self):
        self.plan()
        self.service.queue(1, 'terminato')
        self.plan(supplier='B')
        self.assertTrue(self.service.list()['piani'][0]['da_ordinare'])
        self.service.create_order([1])
        self.plan(supplier='C')
        self.assertEqual(self.service.list()['ordini'][0]['fornitore_nome'], 'Fornitore B')

    def test_invalid_input_and_missing_material(self):
        for value in [0, -1, float('nan'), float('inf'), 'bad']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.service.save(1, {'quantita': value})
        with self.assertRaises(ValueError):
            self.plan(999)
        for ids in [[], [True], [999], '1']:
            with self.assertRaises(ValueError):
                self.service.create_order(ids)

    def test_order_is_atomic_on_failure(self):
        self.plan()
        self.service.queue(1, 'terminato')
        self.conn.execute("CREATE TRIGGER fail_line BEFORE INSERT ON materiali_ordini_righe BEGIN SELECT RAISE(ABORT, 'test failure'); END")
        with self.assertRaises(sqlite3.IntegrityError):
            self.service.create_order([1])
        self.assertEqual(self.service.list()['ordini'], [])
        self.assertTrue(self.service.list()['piani'][0]['da_ordinare'])


if __name__ == '__main__':
    unittest.main()
