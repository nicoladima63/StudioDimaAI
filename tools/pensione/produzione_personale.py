"""Executed treatment value and conservative owner attribution, Python 3.12."""
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
    from .fatturato_operatore import records, digest, signature
except ImportError:
    from fatturato_operatore import records, digest, signature

VERSION = '1.3'
# Specific 2025 executions confirmed by the owner; no blanket historical override.
# Record plus full fingerprint prevents applying a confirmation after row reuse/edit.
CONFIRMED_EXECUTIONS = {
    41437: ('ZZZW47', 'ZZZZOD', '20250430', '50.00', '2'),
    41755: ('ZZZWIR', 'ZZZZOD', '20250625', '50.00', '2'),
    41842: ('ZZZWJ2', 'ZZZZOD', '20250709', '50.00', '2'),
    42259: ('ZZZPWD', 'ZZZZXG', '20251016', '80.00', '3'),
    42190: ('ZZZPDP', 'ZZZZZM', '20251030', '80.00', '3'),
    42462: ('ZZZTRE', 'ZZZZZD', '20251113', '280.00', '3'),
    42553: ('ZZZP8I', 'ZZZZWU', '20251127', '0.00', '4'),
}
CATALOGUE_CORRECTION_DATE = '20260924'
SHARED_ORTHODONTIC_CODES = {'ZZZZKD': 'plss', 'ZZZZKC': 'plsi'}
CORRECTED_ORTHODONTIC_CODES = {'ZZZZKJ': 'vitr', 'ZZZZED': 'bott'}
FIELDS = {
    'PREVENT': ['DB_PRELCOD', 'DB_PRONCOD', 'DB_PRDATA', 'DB_PRSPESA', 'DB_PRMEDIC', 'DB_GUARDIA'],
    'ELENCO': ['DB_CODE'],
    'ONORARIO': ['DB_CODE', 'DB_ONCODIC', 'DB_ONTIPO', 'DB_ONMEDIC'],
}
# Exact IDs verified in docs/pensione/VERIFICA_DATI.md, owner declarations 17/09/2026.
# No case folding: AXEL and axel are distinct items; a010 remains unmapped.
OWNER_CODES = {
    'ZZZZOE': 'PIP', 'ZZZZKI': 'ria5', 'ZZZZJC': 'ria6', 'ZZZZHR': 'alor',
    'ZZZZEH': 'aaor', 'ZZZZJE': 'aorA', 'ZZZZUP': 'nuvA', 'ZZZZUO': 'nuvB',
    'ZZZZRF': 'nuvP', 'ZZZZIH': 'Norm', 'ZZZZHE': 'norm', 'ZZZZES': 'onfc',
    'ZZZZRG': 'AXEL', 'ZZZZUN': 'nuvC',
}
DORLANDI_CODES = {
    'ZZZZXI': 'plco', 'ZZZZIC': 'est2', 'ZZZZXH': 'ret', 'ZZZZOC': 'invi',
    'ZZZZNG': 'INVA', 'ZZZZYH': 'orto', 'ZZZZY9': 'orto', 'ZZZZSJ': 'orto',
    'ZZZZSI': 'orto', 'ZZZZSH': 'orto', 'ZZZZMQ': 'orto',
}
LABELS = {
    'owner_declared': 'Cure attribuite a te secondo le tue indicazioni',
    'owner_recorded_pending': 'Ortodonzia a tuo nome ancora da distinguere',
    'collaborator_recorded': 'Cure attribuite ai collaboratori da listino o eseguito',
    'collaborator_declared': "Cure attribuite a D'Orlandi secondo le tue indicazioni",
    'unresolved': 'Cure con dati mancanti o indicazioni contrastanti',
}


def money(value):
    result = Decimal(value)
    if not result.is_finite():
        raise ValueError('Non-finite treatment value')
    return result


def stage(db, source):
    paths = {name: source / (name + '.DBF') for name in FIELDS}
    before = {name: signature(path) for name, path in paths.items()}
    hashes = {name: digest(path) for name, path in paths.items()}
    db.execute('BEGIN IMMEDIATE')
    try:
        db.execute('CREATE TABLE IF NOT EXISTS manifest(name PRIMARY KEY, hash)')
        old = dict(db.execute('SELECT name,hash FROM manifest'))
        counts = {}
        for name, fields in FIELDS.items():
            schema = [row[1] for row in db.execute(f'PRAGMA table_info({name})')]
            if old.get(name) != hashes[name] or schema != ['record', *fields]:
                db.execute(f'DROP TABLE IF EXISTS {name}')
                db.execute(f'CREATE TABLE {name}(record INTEGER PRIMARY KEY,' +
                           ','.join(f'{field} TEXT' for field in fields) + ')')
                placeholders = ','.join('?' for _ in range(len(fields) + 1))
                db.executemany(f'INSERT INTO {name} VALUES ({placeholders})', records(paths[name], fields))
                db.execute('INSERT OR REPLACE INTO manifest VALUES (?,?)', (name, hashes[name]))
                logging.info('%s reloaded including edits and deletions', name)
            else:
                logging.info('%s unchanged; staging reused', name)
            counts[name] = db.execute(f'SELECT COUNT(*) FROM {name}').fetchone()[0]
        if any(signature(paths[name]) != before[name] for name in paths):
            raise RuntimeError('Sources changed during acquisition; retry')
        db.execute('CREATE INDEX IF NOT EXISTS execution_date ON PREVENT(DB_GUARDIA,DB_PRDATA)')
        db.commit()
    except Exception:
        db.rollback()
        raise
    return hashes, counts


def classify(code, operator, plan_count, catalogue_count, short_code, branch,
             catalogue_operator='', date=''):
    if plan_count != 1:
        return 'unresolved', '', 'missing_or_ambiguous_plan'
    if catalogue_count != 1:
        return 'unresolved', '', 'missing_or_ambiguous_catalogue'
    if code in SHARED_ORTHODONTIC_CODES or code in CORRECTED_ORTHODONTIC_CODES:
        expected = SHARED_ORTHODONTIC_CODES.get(code, CORRECTED_ORTHODONTIC_CODES.get(code))
        if branch != '9' or short_code != expected:
            return 'unresolved', '', 'declared_code_changed'
        if code in SHARED_ORTHODONTIC_CODES:
            selected, method = operator, 'shared_orthodontics_execution_operator'
        elif catalogue_operator in ('', '0'):
            selected, method = operator, 'corrected_orthodontics_execution_operator'
        else:
            selected, method = catalogue_operator, 'corrected_orthodontics_catalogue_operator'
        if selected not in ('1', '2', '3', '4', '5', '6'):
            return 'unresolved', '', 'unknown_orthodontic_operator'
        return ('owner_declared' if selected == '1' else 'collaborator_recorded', selected, method)
    if branch in ('4', '6'):
        # igj starts now, not a retroactive replacement of historical ig records.
        if code == 'ZZZZBG' and date and date < CATALOGUE_CORRECTION_DATE:
            return 'unresolved', '', 'new_igj_with_historical_date'
        if (code == 'ZZZZZI' and date and date < CATALOGUE_CORRECTION_DATE
                and operator in ('5', '6')):
            return 'collaborator_recorded', operator, 'historical_shared_hygiene_execution'
        if catalogue_operator in ('1', '2', '3', '4', '5', '6'):
            group = 'owner_declared' if catalogue_operator == '1' else 'collaborator_recorded'
            return group, catalogue_operator, 'corrected_catalogue_operator'
        if catalogue_operator not in ('', '0'):
            return 'unresolved', '', 'unknown_catalogue_operator'
        if operator in ('1', '2', '3', '4', '5', '6'):
            group = 'owner_declared' if operator == '1' else 'collaborator_recorded'
            return group, operator, 'execution_operator_selected'
        return 'unresolved', '', 'unknown_execution_operator'
    declared = '1' if code in OWNER_CODES else '4' if code in DORLANDI_CODES else None
    if declared:
        expected = OWNER_CODES.get(code, DORLANDI_CODES.get(code))
        if branch != '9' or short_code != expected:
            return 'unresolved', '', 'declared_code_changed'
        if operator not in ('', '1', declared):
            return 'unresolved', '', 'operator_conflicts_with_declaration'
        return ('owner_declared' if declared == '1' else 'collaborator_declared',
                declared, 'owner_declared_exact_id' if declared == '1' else 'dorlandi_declared_exact_id')
    # Owner clarification 24/09/2026: other catalogue activities belong to him.
    # Orthodontics retains its separately declared split; categories 4/6 are excluded.
    if branch in ('1', '2', '3', '5', '7', '8'):
        if operator not in ('', '1'):
            return 'unresolved', '', 'operator_conflicts_with_owner_branch'
        return 'owner_declared', '1', 'owner_declared_branch'
    if branch not in ('4', '6', '9'):
        return 'unresolved', '', 'unknown_branch'
    if operator == '1':
        return 'owner_recorded_pending', '', 'default_operator_not_validated'
    if operator in ('2', '3', '4', '5', '6'):
        return 'collaborator_recorded', operator, 'recorded_operator_not_individually_verified'
    return 'unresolved', '', 'unknown_operator'


def extract(db, start, end, output):
    for table in ('catalogue', 'plans'):
        db.execute(f'DROP TABLE IF EXISTS temp.{table}')
    db.execute('''CREATE TEMP TABLE catalogue AS SELECT DB_CODE,COUNT(*) AS n,
        MIN(DB_ONCODIC) AS short_code,MIN(DB_ONTIPO) AS branch,
        MIN(DB_ONMEDIC) AS catalogue_operator FROM ONORARIO GROUP BY DB_CODE''')
    db.execute('CREATE UNIQUE INDEX catalogue_key ON catalogue(DB_CODE)')
    db.execute('CREATE TEMP TABLE plans AS SELECT DB_CODE,COUNT(*) AS n FROM ELENCO GROUP BY DB_CODE')
    db.execute('CREATE UNIQUE INDEX plans_key ON plans(DB_CODE)')
    annual, monthly, breakdown, recorded = {}, {}, {}, {}
    totals, counts, diagnostics = {}, {}, {'executed_invalid_date_count': 0, 'executed_invalid_date_amount': Decimal(0)}
    # Invalid dates cannot be assigned to a year; preserve them separately, across all dates.
    with (output / 'date_non_valide.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['record', 'date', 'amount'])
        for rec, date, amount in db.execute("SELECT record,DB_PRDATA,DB_PRSPESA FROM PREVENT WHERE DB_GUARDIA='3'"):
            try:
                if len(date) != 8:
                    raise ValueError('Invalid date length')
                datetime.strptime(date, '%Y%m%d')
            except ValueError:
                value = money(amount)
                diagnostics['executed_invalid_date_count'] += 1
                diagnostics['executed_invalid_date_amount'] += value
                writer.writerow([rec, date, str(value)])
    with (output / 'dettaglio.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['record', 'plan_id', 'catalogue_id', 'date', 'amount', 'recorded_operator',
                         'attributed_operator', 'group', 'method', 'branch', 'short_code', 'catalogue_operator'])
        query = '''SELECT p.record,p.DB_PRELCOD,p.DB_PRONCOD,p.DB_PRDATA,p.DB_PRSPESA,
            p.DB_PRMEDIC,e.n,c.n,c.short_code,c.branch,c.catalogue_operator
            FROM PREVENT p LEFT JOIN plans e ON e.DB_CODE=p.DB_PRELCOD AND p.DB_PRELCOD<>''
            LEFT JOIN catalogue c ON c.DB_CODE=p.DB_PRONCOD AND p.DB_PRONCOD<>''
            WHERE p.DB_GUARDIA='3' AND p.DB_PRDATA>=? AND p.DB_PRDATA<=?
            ORDER BY p.DB_PRDATA,p.record'''
        for rec, plan, code, date, amount, operator, pn, cn, short, branch, catalogue_operator in db.execute(query, (start, end)):
            try:
                if len(date) != 8:
                    raise ValueError('Invalid date length')
                datetime.strptime(date, '%Y%m%d')
            except ValueError:
                continue
            value = money(amount)
            group, attributed, method = classify(code, operator, pn, cn, short, branch, catalogue_operator, date)
            if (pn == 1 and cn == 1 and CONFIRMED_EXECUTIONS.get(rec)
                    == (plan, code, date, str(value), operator)):
                group, attributed, method = 'collaborator_recorded', operator, 'owner_confirmed_specific_execution'
            year, month = date[:4], date[:6]
            totals[year] = totals.get(year, Decimal(0)) + value
            counts[year] = counts.get(year, 0) + 1
            for destination, key in ((annual, (year, group)), (monthly, (month, group)),
                                     (breakdown, (year, group, branch or '', method)),
                                     (recorded, (year, operator))):
                entry = destination.setdefault(key, [Decimal(0), 0])
                entry[0] += value
                entry[1] += 1
            writer.writerow([rec, plan, code, date, str(value), operator, attributed, group, method, branch, short, catalogue_operator])
    for year, total in totals.items():
        if sum(v[0] for (y, _), v in annual.items() if y == year) != total:
            raise ValueError('Annual reconciliation failed')
    def rows(values, fields):
        return [dict(zip(fields, key), amount=str(value), count=count)
                for key, (value, count) in sorted(values.items())]
    result = {'totals': {y: str(v) for y, v in sorted(totals.items())}, 'counts': counts,
              'annual': rows(annual, ['year', 'group']), 'monthly': rows(monthly, ['month', 'group']),
              'breakdown': rows(breakdown, ['year', 'group', 'branch', 'method']),
              'recorded_operators': rows(recorded, ['year', 'operator']),
              'diagnostics': {k: str(v) if isinstance(v, Decimal) else v for k, v in diagnostics.items()}}
    for name, data, fields in [('riepilogo', result['annual'], ['year', 'group', 'amount', 'count']),
                               ('mensile', result['monthly'], ['month', 'group', 'amount', 'count']),
                               ('metodi', result['breakdown'], ['year', 'group', 'branch', 'method', 'amount', 'count']),
                               ('operatori_registrati', result['recorded_operators'], ['year', 'operator', 'amount', 'count'])]:
        with (output / (name + '.csv')).open('w', encoding='utf-8', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=fields)
            writer.writeheader()
            writer.writerows(data)
    return result


def readable(result, output):
    def euros(value):
        return format(money(value), ',.2f').replace(',', '_').replace('.', ',').replace('_', '.')
    years = sorted(result['totals'])
    values = {(r['year'], r['group']): r['amount'] for r in result['annual']}
    lines = ['# Produzione personale: primo riepilogo', '',
             'Produzione significa valore delle cure segnate come eseguite. Non indica quanto e stato incassato o guadagnato.', '',
             '| Cure | ' + ' | '.join(years) + ' |', '| --- | ' + ' | '.join('---:' for _ in years) + ' |']
    for group, label in LABELS.items():
        lines.append('| ' + label + ' | ' + ' | '.join(euros(values.get((y, group), '0')) for y in years) + ' |')
    lines.append('| Totale cure eseguite registrate | ' + ' | '.join(euros(result['totals'][y]) for y in years) + ' |')
    lines += ['', 'La prima riga usa la tua indicazione: le attivita del listino sono tue, escluse parodontologia e implantologia; '
              'per ortodonzia si applica la divisione gia concordata con D\'Orlandi. '
              'Per parodontologia e implantologia vale l\'operatore nel listino corretto; se non e specificato, vale chi ha eseguito la cura. '
              'Le vecchie igieni registrate ad Anet e Rossella mantengono quell\'operatore. '
              'Per plss/plsi vale l\'esecutore; vitr/bott seguono il listino corretto. '
              'Le sette esecuzioni 2025 confermate dal titolare seguono il loro operatore registrato. '
              'Eventuali contrasti nelle altre branche restano separati. '
              'Le righe sono separate e si sommano al totale.', '',
              'Gli importi dei collaboratori sono mostrati per controllare il totale dello studio; '
              'le singole registrazioni non sono tutte confermate. Non sono i compensi da pagare.', '',
              'Cure senza data valida escluse dai totali annuali e conservate nel file date_non_valide.csv. '
              'La data di esecuzione e quella registrata in Windent; completezza dello storico non certificata.', '']
    (output / 'LEGGIMI.md').write_text('\n'.join(lines), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--start', default='20210101')
    parser.add_argument('--end', default='20251231')
    args = parser.parse_args()
    for value in (args.start, args.end):
        if len(value) != 8:
            parser.error('Dates must use YYYYMMDD')
        datetime.strptime(value, '%Y%m%d')
    if args.start > args.end:
        parser.error('start must precede end')
    args.output.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
                        handlers=[logging.StreamHandler(), logging.FileHandler(args.output / 'extractor.log', encoding='utf-8')])
    with sqlite3.connect(args.output / 'staging.sqlite') as db:
        hashes, counts = stage(db, args.source)
        run = Path(tempfile.mkdtemp(prefix='run-', dir=args.output))
        result = extract(db, args.start, args.end, run)
        result['manifest'] = {'version': VERSION, 'utc': datetime.now(timezone.utc).isoformat(),
            'start': args.start, 'end': args.end, 'hashes': hashes, 'counts': counts,
            'owner_codes': OWNER_CODES, 'dorlandi_codes': DORLANDI_CODES,
            'measure': 'DB_PRSPESA once per undeleted PREVENT row with DB_GUARDIA=3, by DB_PRDATA',
            'consistency': 'files stable during acquisition; cross-table snapshot not guaranteed',
            'owner_branch_rule': ['1', '2', '3', '5', '7', '8'],
            'catalogue_correction_date': CATALOGUE_CORRECTION_DATE,
            'shared_orthodontic_codes': SHARED_ORTHODONTIC_CODES,
            'corrected_orthodontic_codes': CORRECTED_ORTHODONTIC_CODES,
            'confirmed_executions': CONFIRMED_EXECUTIONS,
            'operator_rule_4_6': 'explicit corrected catalogue operator; otherwise executed operator including 1; historic ig retains Anet/Rossella',
            'limits': 'corrected catalogue applied to history per owner instruction; category 9 retains explicit split; history completeness not certified',
            'privacy': 'internal plan and record identifiers only; restrict detail access'}
        (run / 'riepilogo.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
        readable(result, run)
        pointer = args.output / (run.name + '.tmp')
        pointer.write_text(run.name, encoding='utf-8')
        os.replace(pointer, args.output / 'LATEST')
        logging.info('Published %s; totals=%s; diagnostics=%s', run.name, result['totals'], result['diagnostics'])


if __name__ == '__main__':
    main()
