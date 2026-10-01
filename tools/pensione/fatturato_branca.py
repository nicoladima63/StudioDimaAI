"""Fatturato per branca: direct list-price identifiers only, no text inference."""
import argparse
import csv
import json
import logging
import os
from pathlib import Path
import sqlite3
import tempfile
from datetime import datetime, timezone
from decimal import Decimal
try:
    from .fatturato_operatore import FIELDS, money, stage
except ImportError:
    from fatturato_operatore import FIELDS, money, stage

SCHEMA = {k: list(FIELDS[k]) for k in ('FATTURE', 'VOCIFA')}
SCHEMA['FATTURE'] += ['DB_FAPACOD']
SCHEMA['ONORARIO'] = ['DB_CODE', 'DB_ONTIPO']
BRANCHE = dict(zip(map(str, range(1, 10)), [
    'Parte generale', 'Conservativa', 'Endodonzia', 'Parodontologia',
    'Chirurgia', 'Implantologia', 'Protesi fissa', 'Protesi mobile', 'Ortodonzia']))
UNKNOWN = 'NON_ATTRIBUITO'
DEDUCTION = 'DETRAZIONI_PRECEDENTI_NON_RIPARTITE'


def reference_branch(db, invoice, code, value):
    """Resolve a deduction only against a distinct prior invoice of same plan/patient.

    Mixed/unknown originals stay in a dedicated signed bucket. No pro-rata,
    no inference backwards from the final invoice, no shifting between years.
    """
    if value >= 0 or not code:
        return None
    pair = db.execute('''SELECT f.DB_FAELCOD,f.DB_FAPACOD,f.DB_FADATA,
               r.DB_FAELCOD,r.DB_FAPACOD,r.DB_FADATA,r.DB_FAIMPON,r.DB_CODE
        FROM FATTURE f JOIN FATTURE r ON r.DB_CODE=?
        WHERE f.DB_CODE=? AND r.DB_CODE<>f.DB_CODE''',
                      (code.upper(), invoice)).fetchone()
    if not pair:
        return None
    plan, patient, date, rp, rpatient, rd, amount, ref = pair
    if not plan or not patient or plan != rp or patient != rpatient or rd >= date:
        return None
    if money(amount) != -value:
        return None
    branches, total = set(), Decimal(0)
    for qty, price, branch in db.execute('''SELECT v.DB_VOQUANT,v.DB_VOPREZZ,o.DB_ONTIPO
        FROM VOCIFA v LEFT JOIN ONORARIO o ON o.DB_CODE=v.DB_VOONCOD
        WHERE v.DB_VOFACOD=?''', (ref,)):
        part = money(qty) * money(price)
        total += part
        if part:
            if part < 0 or branch not in BRANCHE:
                return DEDUCTION
            branches.add(branch)
    if total == money(amount) and len(branches) == 1:
        return next(iter(branches))
    return DEDUCTION


def extract(db, start, end, output):
    sums, totals, reasons = {}, {}, {}
    absolute_total, absolute_classified = Decimal(0), Decimal(0)
    with (output / 'dettaglio.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['invoice_id', 'date', 'line', 'branch', 'amount', 'method'])
        def emit(invoice, date, line, branch, amount, method):
            nonlocal absolute_total, absolute_classified
            absolute_total += abs(amount)
            if branch in BRANCHE:
                absolute_classified += abs(amount)
            key = date[:4], branch
            sums[key] = sums.get(key, Decimal(0)) + amount
            reasons[method] = reasons.get(method, 0) + 1
            writer.writerow([invoice, date, line, branch, str(amount), method])
        for invoice, date, raw in db.execute('''SELECT DB_CODE,DB_FADATA,DB_FAIMPON
                FROM FATTURE WHERE DB_FADATA>=? AND DB_FADATA<=?
                ORDER BY DB_FADATA,DB_CODE''', (start, end)):
            datetime.strptime(date, '%Y%m%d')
            amount = money(raw)
            totals[date[:4]] = totals.get(date[:4], Decimal(0)) + amount
            line_sum = Decimal(0)
            for line, code, qty, price, found, branch in db.execute('''
                    SELECT v.record,v.DB_VOONCOD,v.DB_VOQUANT,v.DB_VOPREZZ,
                           o.DB_CODE,o.DB_ONTIPO
                    FROM VOCIFA v LEFT JOIN ONORARIO o ON o.DB_CODE=v.DB_VOONCOD
                    WHERE v.DB_VOFACOD=?''', (invoice,)):
                value = money(qty) * money(price)
                line_sum += value
                reference = reference_branch(db, invoice, code, value)
                if reference is not None:
                    emit(invoice, date, line, reference, value,
                         'prior_invoice_deduction_unallocated' if reference == DEDUCTION
                         else 'prior_invoice_single_branch')
                    continue
                if not code:
                    method = 'missing_service_code'
                elif found is None:
                    method = 'service_not_found'
                elif branch not in BRANCHE:
                    method = 'unknown_branch'
                else:
                    method = 'direct_current_catalogue'
                emit(invoice, date, line,
                     branch if method == 'direct_current_catalogue' else UNKNOWN,
                     value, method)
            if amount != line_sum:
                emit(invoice, date, '', UNKNOWN, amount - line_sum, 'header_line_residual')
    rows = []
    for year, total in sorted(totals.items()):
        if sum(v for (y, _), v in sums.items() if y == year) != total:
            raise ValueError('Aggregate reconciliation failed')
        for (y, branch), value in sorted(sums.items()):
            if y == year:
                rows.append({'year': y, 'branch': branch,
                             'name': BRANCHE.get(branch, 'Detrazioni fatture precedenti non ripartite'
                                                if branch == DEDUCTION else 'Non attribuito'),
                             'amount': str(value)})
    with (output / 'riepilogo.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=['year', 'branch', 'name', 'amount'])
        writer.writeheader()
        writer.writerows(rows)
    return {'totals': {y: str(v) for y, v in totals.items()},
            'branches': rows, 'detail_counts': reasons,
            'absolute_line_coverage': str(absolute_classified / absolute_total)
            if absolute_total else None}


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
    with sqlite3.connect(args.output / 'branca_staging.sqlite') as db:
        hashes, counts = stage(db, args.source, SCHEMA)
        run = Path(tempfile.mkdtemp(prefix='run-', dir=args.output))
        result = extract(db, args.start, args.end, run)
        result['manifest'] = {
            'version': '1.1', 'utc': datetime.now(timezone.utc).isoformat(),
            'start': args.start, 'end': args.end, 'hashes': hashes, 'counts': counts,
            'measure': 'signed DB_FAIMPON; document types not normalized',
            'attribution': 'current catalogue exact ID; historical branch changes not validated',
            'consistency': 'stable individual files; not a transactional snapshot',
            'privacy': 'detail contains internal invoice identifiers; restrict access'}
        (run / 'riepilogo.json').write_text(json.dumps(result, indent=2, ensure_ascii=False),
                                          encoding='utf-8')
        pointer = args.output / 'latest.tmp'
        pointer.write_text(run.name, encoding='utf-8')
        os.replace(pointer, args.output / 'LATEST')
        logging.info('Published %s; totals=%s; detail=%s', run.name,
                     result['totals'], result['detail_counts'])


if __name__ == '__main__':
    main()
