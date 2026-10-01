from pathlib import Path
import sqlite3
import tempfile
import unittest

from tools.pensione import margine_operatore as margins


class MarginTests(unittest.TestCase):
    def test_period_text_wrapping_and_no_guessed_cross_year_allocation(self):
        self.assertEqual(margins.period(['Prestazioni - mese di dicembre 2025', 'M02 art. 2014']), ['202512'])
        self.assertEqual(margins.period(['Prestazioni di igiene dentale - Ottobre/Novembre/Dicembre 202', '4', 'Bolli in fattura']),
                         ['202410', '202411', '202412'])
        self.assertEqual(margins.period(['Prestazioni di igiene dentale - Novembre/Dicembre 2025 e Genn', 'aio 2026', 'Bolli']), ['202511','202512','202601'])
        self.assertEqual(margins.period(['Prestazioni di igiene dentale - Novembre/Dicembre e Gennaio 2026']), [])
        self.assertEqual(margins.period(['Consulenza ortodontica fino a 11 2025']), [])

    def test_invoice_year_vs_work_year_missing_totals_and_overlap(self):
        with tempfile.TemporaryDirectory() as temp, sqlite3.connect(':memory:') as db:
            root = Path(temp)
            for name, fields in margins.FIELDS.items():
                db.execute(f'CREATE TABLE {name}(record INTEGER PRIMARY KEY,' + ','.join(f'{f} TEXT' for f in fields) + ')')
            db.execute("INSERT INTO FORNITOR VALUES (1,'ZZZZUC','Anet')")
            def add(rec, code, date, text, total):
                values = [code, 'ZZZZUC', date, str(rec), '40', '0', total, '0', '0', '0', '0']
                db.execute('INSERT INTO SPESAFOR VALUES ('+','.join('?' for _ in range(len(values)+1))+')', [rec,*values])
                db.execute('INSERT INTO VOCISPES VALUES (?,?,?,?,?,?)', (rec,code,text,'1','40','0'))
            add(1,'A','20260110','mese di dicembre 2025','40')
            data = {'monthly':[{'month':'202512','operator':'5','amount':'100'}], 'annual':[]}
            result = margins.extract(db,data,'2025','2025',root)
            self.assertEqual(result['documents'][0]['difference_before_other_costs'],'60')
            self.assertTrue(all(row['documents']==0 for row in result['annual']))
            db.execute("UPDATE SPESAFOR SET DB_SPXMLTD='0'")
            result = margins.extract(db,data,'2025','2025',root)
            self.assertIsNone(result['documents'][0]['difference_before_other_costs'])
            add(2,'B','20260111','mese di dicembre 2025','40')
            result = margins.extract(db,data,'2025','2025',root)
            self.assertTrue(all(row['status']=='overlapping_documents' for row in result['documents']))
            db.execute("DELETE FROM SPESAFOR WHERE DB_CODE='B'")
            db.execute("UPDATE SPESAFOR SET DB_SPXMLTD='40'")
            db.execute("UPDATE VOCISPES SET DB_VODESCR='Prestazioni di igiene dentale - Novembre/Dicembre 2025 e Gennaio 2026' WHERE DB_VOSPCOD='A'")
            data['monthly'] += [{'month':'202511','operator':'5','amount':'50'},
                                {'month':'202601','operator':'5','amount':'60'}]
            result = margins.extract(db,data,'2025','2025',root)
            self.assertIsNone(result['documents'][0]['difference_before_other_costs'])
            result = margins.extract(db,data,'2025','2025',root,comparison_end='202601')
            self.assertEqual(result['documents'][0]['difference_before_other_costs'], '170')
            self.assertTrue(all(row['net_margin'] is None for row in result['annual']))

    def test_same_day_is_only_candidate_and_next_day_is_not_auto_linked(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'detail.csv'
            path.write_text('date,attributed_operator,amount\n20251016,3,100\n20251017,3,850\n', encoding='utf-8')
            doc = {'operator':'3','date':'20251016','number':'1','invoice_id':'I','document_total':'50'}
            result = margins.calvisi_candidates([doc],path,'2025','2025')
            self.assertEqual(result[0]['status'], 'same_day_candidate_not_confirmed')
            self.assertEqual(result[1]['status'], 'execution_day_without_same_day_invoice')
            self.assertEqual(result[1]['production_same_day'], '850')


if __name__ == '__main__':
    unittest.main()
