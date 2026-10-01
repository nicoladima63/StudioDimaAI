from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from tools.pensione import produzione_personale as production
from tools.pensione.test_fatturato_branca import write_dbf


class ProductionTests(unittest.TestCase):
    def test_specific_confirmations_do_not_extend_to_changed_rows(self):
        with tempfile.TemporaryDirectory() as temp, sqlite3.connect(':memory:') as db:
            root = Path(temp)
            for name, fields in production.FIELDS.items():
                write_dbf(root/(name+'.DBF'), fields, [])
            production.stage(db, root)
            rec, (plan, code, date, amount, operator) = next(iter(production.CONFIRMED_EXECUTIONS.items()))
            db.execute('INSERT INTO ELENCO VALUES (?,?)', (1, plan))
            db.execute('INSERT INTO ONORARIO VALUES (?,?,?,?,?)', (1, code, 'clik', '1', '0'))
            db.execute('INSERT INTO PREVENT VALUES (?,?,?,?,?,?,?)', (rec, plan, code, date, amount, operator, '3'))
            result = production.extract(db, '20250101', '20251231', root)
            self.assertEqual(result['annual'][0]['group'], 'collaborator_recorded')
            db.execute("UPDATE PREVENT SET DB_PRSPESA='60.00'")
            result = production.extract(db, '20250101', '20251231', root)
            self.assertEqual(result['annual'][0]['group'], 'unresolved')

    def test_shared_and_corrected_orthodontics(self):
        for code, short in production.SHARED_ORTHODONTIC_CODES.items():
            for operator in ('1', '4'):
                self.assertEqual(production.classify(code, operator, 1, 1, short, '9', '1')[1], operator)
            self.assertEqual(production.classify(code, '', 1, 1, short, '9', '1')[0], 'unresolved')
        for code, short in production.CORRECTED_ORTHODONTIC_CODES.items():
            self.assertEqual(production.classify(code, '4', 1, 1, short, '9', '1')[1], '1')
            self.assertEqual(production.classify(code, '4', 1, 1, short, '9', '0')[1], '4')
            self.assertEqual(production.classify(code, '1', 1, 1, 'changed', '9', '1')[0], 'unresolved')

    def test_owner_branches_and_exceptions(self):
        for branch in ('1', '2', '3', '5', '7', '8'):
            self.assertEqual(production.classify('P', '1', 1, 1, 'x', branch)[0], 'owner_declared')
            self.assertEqual(production.classify('P', '2', 1, 1, 'x', branch)[0], 'unresolved')
        for branch in ('9',):
            self.assertEqual(production.classify('P', '1', 1, 1, 'x', branch)[0], 'owner_recorded_pending')
            self.assertEqual(production.classify('P', '3', 1, 1, 'x', branch)[0], 'collaborator_recorded')

    def test_corrected_catalogue_and_selected_execution(self):
        for branch in ('4', '6'):
            self.assertEqual(production.classify('P', '3', 1, 1, 'x', branch, '1')[1], '1')
            self.assertEqual(production.classify('P', '1', 1, 1, 'x', branch, '3')[1], '3')
            self.assertEqual(production.classify('P', '1', 1, 1, 'x', branch, '0')[1], '1')
            self.assertEqual(production.classify('P', '5', 1, 1, 'x', branch, '')[1], '5')
            self.assertEqual(production.classify('P', '', 1, 1, 'x', branch, '0')[0], 'unresolved')
            self.assertEqual(production.classify('P', '1', 1, 1, 'x', branch, '99')[0], 'unresolved')

    def test_hygiene_history_and_new_igj(self):
        for operator in ('5', '6'):
            self.assertEqual(production.classify('ZZZZZI', operator, 1, 1, 'ig', '4', '2', '20250101')[1], operator)
        self.assertEqual(production.classify('ZZZZZI', '1', 1, 1, 'ig', '4', '2', '20250101')[1], '2')
        self.assertEqual(production.classify('ZZZZBG', '1', 1, 1, 'igj', '4', '5', '20260924')[1], '5')
        self.assertEqual(production.classify('ZZZZBG', '1', 1, 1, 'igj', '4', '5', '20250101')[0], 'unresolved')

    def test_orthodontic_rules_conflicts_and_case(self):
        self.assertEqual(production.classify('ZZZZUN', '1', 1, 1, 'nuvC', '9')[0], 'owner_declared')
        self.assertEqual(production.classify('ZZZZUN', '4', 1, 1, 'nuvC', '9')[0], 'unresolved')
        self.assertEqual(production.classify('ZZZZOC', '1', 1, 1, 'invi', '9')[1], '4')
        self.assertEqual(production.classify('ZZZZRE', '1', 1, 1, 'axel', '9')[0], 'owner_recorded_pending')
        self.assertEqual(production.classify('ZZZZRG', '1', 1, 1, 'axel', '9')[0], 'unresolved')

    def test_missing_and_ambiguous_links(self):
        for plans, catalogue in [(None, 1), (2, 1), (1, None), (1, 2)]:
            self.assertEqual(production.classify('P', '1', plans, catalogue, 'x', '2')[0], 'unresolved')

    def test_execution_filter_signed_values_and_dates(self):
        with tempfile.TemporaryDirectory() as temp, sqlite3.connect(':memory:') as db:
            root = Path(temp)
            rows = {
                'ONORARIO': [('P', 'x', '2', '0')], 'ELENCO': [('PLAN',)],
                'PREVENT': [('PLAN', 'P', '20250101', '120', '1', '3'),
                            ('PLAN', 'P', '20250201', '-20', '1', '3'),
                            ('PLAN', 'P', '20250101', '900', '1', '1'),
                            ('PLAN', 'P', '', '40', '1', '3'),
                            ('PLAN', 'P', '20250230', '50', '1', '3'),
                            ('MISSING', 'P', '20250301', '30', '1', '3')],
            }
            def write():
                for name, values in rows.items():
                    write_dbf(root/(name+'.DBF'), production.FIELDS[name], [(False, r) for r in values])
            write()
            production.stage(db, root)
            report = production.extract(db, '20250101', '20251231', root)
            self.assertEqual(report['totals'], {'2025': '130'})
            self.assertEqual(report['counts'], {'2025': 3})
            self.assertEqual(report['diagnostics']['executed_invalid_date_count'], 2)
            self.assertEqual(report['diagnostics']['executed_invalid_date_amount'], '90')
            self.assertEqual({r['group']:r['amount'] for r in report['annual']},
                             {'owner_declared': '100', 'unresolved': '30'})
            with patch.object(production, 'records', side_effect=AssertionError('unexpected reload')):
                production.stage(db, root)
            rows['PREVENT'][0] = ('PLAN', 'P', '20250101', '150', '1', '3')
            write()
            production.stage(db, root)
            self.assertEqual(production.extract(db, '20250101', '20251231', root)['totals']['2025'], '160')
            write_dbf(root/'PREVENT.DBF', production.FIELDS['PREVENT'], [(True, rows['PREVENT'][0])])
            production.stage(db, root)
            self.assertEqual(production.extract(db, '20250101', '20251231', root)['totals'], {})

    def test_bad_reload_rolls_back(self):
        with tempfile.TemporaryDirectory() as temp, sqlite3.connect(':memory:') as db:
            root = Path(temp)
            for name, fields in production.FIELDS.items():
                write_dbf(root/(name+'.DBF'), fields, [])
            hashes, _ = production.stage(db, root)
            (root/'ONORARIO.DBF').write_bytes(b'broken')
            with self.assertRaises(ValueError):
                production.stage(db, root)
            self.assertEqual(dict(db.execute('SELECT name,hash FROM manifest')), hashes)


if __name__ == '__main__':
    unittest.main()
