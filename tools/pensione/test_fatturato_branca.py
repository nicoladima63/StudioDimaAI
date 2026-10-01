import sqlite3
import tempfile
import unittest
import struct
from pathlib import Path
from fatturato_branca import SCHEMA, extract, reference_branch, DEDUCTION
from decimal import Decimal


def write_dbf(path, fields, rows):
    """Small ASCII fixture shared with the production extractor tests."""
    width = 32
    header_length = 32 + len(fields) * 32 + 1
    record_length = 1 + len(fields) * width
    header = bytearray(32)
    header[0] = 3
    struct.pack_into('<IHH', header, 4, len(rows), header_length, record_length)
    with path.open('wb') as stream:
        stream.write(header)
        for field in fields:
            descriptor = bytearray(32)
            descriptor[:len(field)] = field.encode('ascii')
            descriptor[11] = ord('C')
            descriptor[16] = width
            stream.write(descriptor)
        stream.write(b'\r')
        for deleted, values in rows:
            stream.write(b'*' if deleted else b' ')
            for value in values:
                stream.write(str(value).encode('ascii').ljust(width))
        stream.write(b'\x1a')


class BranchTests(unittest.TestCase):
    def test_prior_invoice_branch_and_patient_guard(self):
        with sqlite3.connect(':memory:') as db, tempfile.TemporaryDirectory() as tmp:
            for name, fields in SCHEMA.items():
                db.execute(f'CREATE TABLE {name}(record INTEGER PRIMARY KEY,' +
                           ','.join(f'{f} TEXT' for f in fields) + ')')
            db.executemany('INSERT INTO FATTURE VALUES(?,?,?,?,?,?)', [
                (1, 'OLD', 'P', '20231201', '100', 'PAT'),
                (2, 'NEW', 'P', '20240201', '200', 'PAT')])
            db.execute("INSERT INTO ONORARIO VALUES(1,'ORTHO','9')")
            db.executemany('INSERT INTO VOCIFA VALUES(?,?,?,?,?)', [
                (1, 'OLD', 'ORTHO', '1', '100'),
                (2, 'NEW', 'ORTHO', '1', '300'),
                (3, 'NEW', 'old', '1', '-100')])
            result = extract(db, '20240101', '20241231', Path(tmp))
            self.assertEqual(result['totals'], {'2024': '200'})
            self.assertEqual(result['branches'][0]['amount'], '200')
            self.assertEqual(result['detail_counts']['prior_invoice_single_branch'], 1)
            db.execute("UPDATE VOCIFA SET DB_VOONCOD='' WHERE record=1")
            self.assertEqual(reference_branch(db, 'NEW', 'old', Decimal('-100')), DEDUCTION)
            db.execute("UPDATE FATTURE SET DB_FAPACOD='OTHER' WHERE DB_CODE='OLD'")
            self.assertIsNone(reference_branch(db, 'NEW', 'old', Decimal('-100')))

    def test_missing_codes_signed_residual_and_catalogue_change(self):
        with sqlite3.connect(':memory:') as db, tempfile.TemporaryDirectory() as tmp:
            for name, fields in SCHEMA.items():
                db.execute(f'CREATE TABLE {name}(record INTEGER PRIMARY KEY,' +
                           ','.join(f'{f} TEXT' for f in fields) + ')')
            db.executemany('INSERT INTO FATTURE(record,DB_CODE,DB_FAELCOD,DB_FADATA,DB_FAIMPON) VALUES(?,?,?,?,?)', [
                (1, 'A', 'P', '20250101', '200'), (2, 'B', '', '20250201', '-20')])
            db.executemany('INSERT INTO VOCIFA VALUES(?,?,?,?,?)', [
                (1, 'A', 'IG', '1', '80'), (2, 'A', '', '1', '50'),
                (3, 'A', 'OLD', '1', '30'), (4, 'A', 'BAD', '1', '35')])
            db.executemany('INSERT INTO ONORARIO VALUES(?,?,?)',
                           [(1, 'IG', '4'), (2, 'BAD', '99')])
            result = extract(db, '20250101', '20251231', Path(tmp))
            self.assertEqual(result['totals'], {'2025': '180'})
            self.assertEqual({x['branch']: x['amount'] for x in result['branches']},
                             {'4': '80', 'NON_ATTRIBUITO': '100'})
            db.execute("UPDATE ONORARIO SET DB_ONTIPO='2' WHERE DB_CODE='IG'")
            changed = extract(db, '20250101', '20251231', Path(tmp))
            self.assertEqual(changed['branches'][0]['branch'], '2')


if __name__ == '__main__':
    unittest.main()
