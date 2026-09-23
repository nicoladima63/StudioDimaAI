"""First pensione extractor. Python 3.12+, standard library only.

Conservative candidate allocation, NOT a certified operator attribution.
Persistent SQLite staging detects edits/deletions by reloading changed files.
"""
import argparse
import csv
import hashlib
import json
import logging
import os
from pathlib import Path
import sqlite3
import struct
import tempfile
from datetime import datetime, timezone
from decimal import Decimal

VERSION = '1.0'
FIELDS = {
    'FATTURE': ['DB_CODE', 'DB_FAELCOD', 'DB_FADATA', 'DB_FAIMPON'],
    'VOCIFA': ['DB_VOFACOD', 'DB_VOONCOD', 'DB_VOQUANT', 'DB_VOPREZZ'],
    'PREVENT': ['DB_PRELCOD', 'DB_PRONCOD', 'DB_PRDATA', 'DB_PRSPESA',
                'DB_PRMEDIC', 'DB_GUARDIA'],
    'ELENCO': ['DB_CODE'],
}
NAMES = {'1': 'Nicola', '2': 'Lara', '3': 'Calvisi', '4': "D’Orlandi",
         '5': 'Anet', '6': 'Rossella', 'NON_ATTRIBUITO': 'Non attribuito'}


def money(value):
    return Decimal(value or '0')


def signature(path):
    st = path.stat()
    return st.st_size, st.st_mtime_ns


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def records(path, wanted):
    # Only identifiers, numeric fields and dates are needed: strict ASCII.
    # Text/memo decoding is intentionally outside this extractor's scope.
    with path.open('rb') as stream:
        header = stream.read(32)
        if len(header) != 32:
            raise ValueError('Truncated DBF header')
        count, length, width = struct.unpack_from('<IHH', header, 4)
        if length < 33 or width < 2 or path.stat().st_size < length + count * width:
            raise ValueError('Invalid/truncated DBF')
        descriptors = stream.read(length - 32)
        fields, offset = {}, 1
        for i in range(0, len(descriptors), 32):
            if descriptors[i] == 13:
                break
            item = descriptors[i:i + 32]
            if len(item) != 32:
                raise ValueError('Invalid descriptor')
            name = item[:11].split(b'\0')[0].decode('ascii')
            fields[name] = offset, item[16]
            offset += item[16]
        if offset > width or not set(wanted) <= fields.keys():
            raise ValueError('Unexpected schema')
        for number in range(1, count + 1):
            row = stream.read(width)
            if len(row) != width or row[:1] not in (b' ', b'*'):
                raise ValueError('Invalid record')
            if row[:1] == b'*':
                continue
            values = [row[fields[k][0]:sum(fields[k])].decode('ascii').strip()
                      for k in wanted]
            yield (number, *values)


def stage(db, source):
    paths = {name: source / (name + '.DBF') for name in FIELDS}
    before = {name: signature(path) for name, path in paths.items()}
    hashes = {name: digest(path) for name, path in paths.items()}
    db.execute('CREATE TABLE IF NOT EXISTS manifest(name PRIMARY KEY, hash)')
    old = dict(db.execute('SELECT name,hash FROM manifest'))
    counts = {}
    with db:
        for name, fields in FIELDS.items():
            if old.get(name) != hashes[name]:
                db.execute(f'DROP TABLE IF EXISTS {name}')
                db.execute(f'CREATE TABLE {name}(record INTEGER PRIMARY KEY,' +
                           ','.join(f'{f} TEXT' for f in fields) + ')')
                db.executemany(f'INSERT INTO {name} VALUES (' +
                               ','.join('?' for _ in range(len(fields) + 1)) + ')',
                               records(paths[name], fields))
                db.execute('INSERT OR REPLACE INTO manifest VALUES (?,?)',
                           (name, hashes[name]))
                logging.info('%s reloaded (edits and deletions included)', name)
            else:
                logging.info('%s unchanged; staging reused', name)
            counts[name] = db.execute(f'SELECT COUNT(*) FROM {name}').fetchone()[0]
        if any(signature(paths[k]) != before[k] for k in paths):
            raise RuntimeError('Sources changed during staging: retry acquisition')
        db.execute('CREATE UNIQUE INDEX IF NOT EXISTS invoice_id ON FATTURE(DB_CODE)')
        db.execute('CREATE UNIQUE INDEX IF NOT EXISTS plan_id ON ELENCO(DB_CODE)')
        db.execute('CREATE INDEX IF NOT EXISTS invoice_lines ON VOCIFA(DB_VOFACOD)')
        db.execute('CREATE INDEX IF NOT EXISTS performance ON PREVENT'
                   '(DB_PRELCOD,DB_PRONCOD,DB_PRDATA,DB_GUARDIA)')
    return hashes, counts


def extract(db, start, end, output):
    # Full-domain uniqueness prevents reusing one performance across invoices,
    # including invoices outside the requested reporting interval.
    db.execute('DROP TABLE IF EXISTS temp.matches')
    db.execute('CREATE TEMP TABLE matches(line INTEGER, perf INTEGER, operator TEXT)')
    query = '''SELECT v.record,v.DB_VOQUANT,v.DB_VOPREZZ,
                      p.record,p.DB_PRSPESA,p.DB_PRMEDIC
               FROM VOCIFA v JOIN FATTURE f ON f.DB_CODE=v.DB_VOFACOD
               JOIN ELENCO e ON e.DB_CODE=f.DB_FAELCOD
               JOIN PREVENT p ON p.DB_PRELCOD=f.DB_FAELCOD
                 AND p.DB_PRONCOD=v.DB_VOONCOD AND p.DB_PRDATA=f.DB_FADATA
               WHERE v.DB_VOONCOD<>'' AND p.DB_GUARDIA='3' '''
    cursor = db.execute(query)
    for line, quantity, price, perf, amount, operator in cursor:
        if money(quantity) == 1 and money(price) == money(amount):
            db.execute('INSERT INTO matches VALUES (?,?,?)', (line, perf, operator))
    db.execute('CREATE INDEX match_line ON matches(line)')
    db.execute('CREATE INDEX match_perf ON matches(perf)')
    db.execute('DROP TABLE IF EXISTS temp.unique_matches')
    db.execute('''CREATE TEMP TABLE unique_matches AS SELECT m.line,m.operator
        FROM matches m WHERE (SELECT COUNT(*) FROM matches x WHERE x.line=m.line)=1
        AND (SELECT COUNT(*) FROM matches x WHERE x.perf=m.perf)=1''')
    db.execute('CREATE UNIQUE INDEX unique_line ON unique_matches(line)')
    sums, totals = {}, {}
    columns = ['invoice_id', 'date', 'line', 'operator', 'amount', 'method']
    with (output / 'dettaglio.csv').open('w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        def emit(invoice, date, line, operator, amount, method):
            key = (date[:4], operator)
            sums[key] = sums.get(key, Decimal(0)) + amount
            writer.writerow([invoice, date, line, operator, str(amount), method])
        for invoice, plan, date, amount in db.execute(
                'SELECT DB_CODE,DB_FAELCOD,DB_FADATA,DB_FAIMPON FROM FATTURE '
                'WHERE DB_FADATA>=? AND DB_FADATA<=? ORDER BY DB_FADATA,DB_CODE',
                (start, end)):
            datetime.strptime(date, '%Y%m%d')
            total = money(amount)
            totals[date[:4]] = totals.get(date[:4], Decimal(0)) + total
            line_sum = Decimal(0)
            for line, quantity, price, operator in db.execute('''
                SELECT v.record,v.DB_VOQUANT,v.DB_VOPREZZ,m.operator
                FROM VOCIFA v LEFT JOIN unique_matches m ON m.line=v.record
                WHERE v.DB_VOFACOD=?''', (invoice,)):
                value = money(quantity) * money(price)
                line_sum += value
                # Operator default 1 is deliberately never assigned automatically.
                accepted = operator in ('2', '3', '4', '5', '6')
                emit(invoice, date, line, operator if accepted else 'NON_ATTRIBUITO',
                     value, 'candidate_unique_execution' if accepted else 'unresolved')
            if total != line_sum:
                emit(invoice, date, '', 'NON_ATTRIBUITO', total - line_sum,
                     'header_line_residual')
    result = []
    for year, total in sorted(totals.items()):
        assert sum(v for (y, _), v in sums.items() if y == year) == total
        for (y, operator), value in sorted(sums.items()):
            if y == year:
                result.append({'year': year, 'operator': operator,
                               'name': NAMES[operator], 'amount': str(value),
                               'status': 'unresolved' if operator == 'NON_ATTRIBUITO'
                               else 'candidate_not_certified'})
    with (output / 'riepilogo.csv').open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['year', 'operator', 'name', 'amount', 'status'])
        writer.writeheader()
        writer.writerows(result)
    return {'totals': {y: str(v) for y, v in totals.items()}, 'operators': result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--start', default='20210101')
    parser.add_argument('--end', default='20251231')
    args = parser.parse_args()
    for value in (args.start, args.end):
        datetime.strptime(value, '%Y%m%d')
    if args.start > args.end:
        parser.error('start must precede end')
    args.output.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
                        handlers=[logging.StreamHandler(), logging.FileHandler(
                            args.output / 'extractor.log', encoding='utf-8')])
    with sqlite3.connect(args.output / 'staging.sqlite') as db:
        hashes, counts = stage(db, args.source)
        run = Path(tempfile.mkdtemp(prefix='run-', dir=args.output))
        result = extract(db, args.start, args.end, run)
        result['manifest'] = {
            'version': VERSION, 'utc': datetime.now(timezone.utc).isoformat(),
            'start': args.start, 'end': args.end, 'hashes': hashes, 'counts': counts,
            'measure': 'DB_FAIMPON signed as stored; document types not normalized',
            'consistency': 'individual files stable; cross-table snapshot not guaranteed',
            'attribution': 'candidate only; default operator 1 never assigned',
            'privacy': 'detail contains internal invoice identifiers; restrict access',
        }
        (run / 'riepilogo.json').write_text(json.dumps(result, indent=2, ensure_ascii=False),
                                          encoding='utf-8')
        pointer = args.output / 'latest.tmp'
        pointer.write_text(run.name, encoding='utf-8')
        os.replace(pointer, args.output / 'LATEST')
        logging.info('Published %s; totals=%s', run.name, result['totals'])


if __name__ == '__main__':
    main()
