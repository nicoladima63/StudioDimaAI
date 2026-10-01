"""Fourth pensione extractor: executed treatment value by attributed collaborator."""
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
    from . import produzione_personale as personal
except ImportError:
    import produzione_personale as personal

VERSION = '1.0'
NAMES = {'2': 'Lara', '5': 'Anet', '3': 'Calvisi', '4': "D'Orlandi", '6': 'Rossella'}
BRANCHES = {'1': 'Parte generale', '2': 'Conservativa', '3': 'Endodonzia',
            '4': 'Parodontologia', '5': 'Chirurgia', '6': 'Implantologia',
            '7': 'Protesi fissa', '8': 'Protesi mobile', '9': 'Ortodonzia'}


def summarize(base, detail, output):
    """Read the shared attribution result, never classify the same execution twice."""
    annual, monthly, activities = {}, {}, {}
    years = sorted(base['totals'])
    control = {year: {'owner': Decimal(0), 'collaborators': Decimal(0),
                      'unresolved': Decimal(0), 'count': 0} for year in years}
    for year in years:
        for operator in NAMES:
            annual[(year, operator)] = [Decimal(0), 0]
    with detail.open(encoding='utf-8', newline='') as stream, \
            (output / 'dettaglio.csv').open('w', encoding='utf-8', newline='') as target, \
            (output / 'da_chiarire.csv').open('w', encoding='utf-8', newline='') as pending:
        reader = csv.DictReader(stream)
        writer = csv.DictWriter(target, fieldnames=reader.fieldnames)
        unknown = csv.DictWriter(pending, fieldnames=reader.fieldnames)
        writer.writeheader()
        unknown.writeheader()
        for row in reader:
            year = row['date'][:4]
            value = personal.money(row['amount'])
            operator = row['attributed_operator']
            control[year]['count'] += 1
            if row['group'] in ('collaborator_recorded', 'collaborator_declared'):
                if operator not in NAMES:
                    raise ValueError('Unknown attributed collaborator')
                control[year]['collaborators'] += value
                writer.writerow(row)
                for collection, key in (
                    (annual, (year, operator)), (monthly, (row['date'][:6], operator)),
                    (activities, (year, operator, row['branch'], row['catalogue_id'], row['short_code']))):
                    entry = collection.setdefault(key, [Decimal(0), 0])
                    entry[0] += value
                    entry[1] += 1
            elif row['group'] == 'owner_declared':
                if operator != '1':
                    raise ValueError('Owner attribution mismatch')
                control[year]['owner'] += value
            elif row['group'] in ('owner_recorded_pending', 'unresolved'):
                control[year]['unresolved'] += value
                unknown.writerow(row)
            else:
                raise ValueError('Unknown attribution group')
    for year, values in control.items():
        expected_collaborators = sum((personal.money(r['amount']) for r in base['annual']
            if r['year'] == year and r['group'] in ('collaborator_recorded', 'collaborator_declared')), Decimal(0))
        if values['collaborators'] != expected_collaborators:
            raise ValueError('Collaborator total differs from shared extraction')
        if sum(values[k] for k in ('owner', 'collaborators', 'unresolved')) != personal.money(base['totals'][year]):
            raise ValueError('Studio total does not reconcile')
        if values['count'] != base['counts'][year]:
            raise ValueError('Execution count does not reconcile')
    def rows(collection, fields):
        result = []
        for key, (amount, count) in sorted(collection.items()):
            row = dict(zip(fields, key), amount=str(amount), count=count)
            row['name'] = NAMES[row['operator']]
            if 'branch' in row:
                row['branch_name'] = BRANCHES.get(row['branch'], 'Non classificata')
            result.append(row)
        return result
    result = {
        'annual': rows(annual, ['year', 'operator']),
        'monthly': rows(monthly, ['month', 'operator']),
        'activities': rows(activities, ['year', 'operator', 'branch', 'catalogue_id', 'short_code']),
        'control': [{ 'year': year, **{k: str(v) if isinstance(v, Decimal) else v for k, v in values.items()},
                     'total': base['totals'][year]} for year, values in control.items()],
        'diagnostics': base['diagnostics'],
    }
    for filename, key, columns in [
        ('riepilogo', 'annual', ['year', 'operator', 'name', 'amount', 'count']),
        ('mensile', 'monthly', ['month', 'operator', 'name', 'amount', 'count']),
        ('attivita', 'activities', ['year', 'operator', 'name', 'branch', 'branch_name', 'catalogue_id', 'short_code', 'amount', 'count']),
        ('controllo', 'control', ['year', 'owner', 'collaborators', 'unresolved', 'count', 'total'])]:
        with (output / (filename + '.csv')).open('w', encoding='utf-8', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=columns)
            writer.writeheader()
            writer.writerows(result[key])
    return result


def readable(result, output):
    def euros(value):
        return format(personal.money(value), ',.2f').replace(',', '_').replace('.', ',').replace('_', '.')
    years = [r['year'] for r in result['control']]
    annual = {(r['year'], r['operator']): r['amount'] for r in result['annual']}
    lines = ['# Produzione dei collaboratori', '',
        'Importi in euro: valore delle cure segnate come eseguite, non compensi da pagare ne incassi.', '',
        '| Collaboratore | ' + ' | '.join(years) + ' |', '| --- | ' + ' | '.join('---:' for _ in years) + ' |']
    for operator, name in NAMES.items():
        lines.append('| ' + name + ' | ' + ' | '.join(euros(annual[(y, operator)]) for y in years) + ' |')
    lines.append('| Totale collaboratori | ' + ' | '.join(euros(r['collaborators']) for r in result['control']) + ' |')
    lines += ['', '## Importi dello studio ancora da attribuire', '',
        'Questi importi restano separati: non sono stati distribuiti ai collaboratori o al titolare.', '',
        '| Anno | Da chiarire |', '| --- | ---: |']
    for row in result['control']:
        lines.append(f"| {row['year']} | {euros(row['unresolved'])} |")
    lines += ['', 'Si usano le stesse assegnazioni gia verificate per la produzione personale: '
        'listino corretto, operatore dell\'eseguito per le voci condivise, regole ortodontiche e conferme puntuali. '
        'Le conferme specifiche del 2025 non vengono estese automaticamente agli anni precedenti.', '',
        'Le sigle delle cure e il loro valore per collaboratore sono in attivita.csv; '
        'il dettaglio delle registrazioni in dettaglio.csv. I conteggi sono righe di prestazioni, non pazienti o sedute.', '',
        'Le cure senza data valida rimangono nella cartella base_attribuzioni e non entrano negli anni. '
        'Il prospetto dipendenti atteso dal consulente servira al successivo lavoro sui costi.', '']
    (output / 'LEGGIMI.md').write_text('\n'.join(lines), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--start', default='20210101')
    parser.add_argument('--end', default='20251231')
    args = parser.parse_args()
    for date in (args.start, args.end):
        if len(date) != 8:
            parser.error('Dates must use YYYYMMDD')
        datetime.strptime(date, '%Y%m%d')
    if args.start > args.end:
        parser.error('start must precede end')
    args.output.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
        handlers=[logging.StreamHandler(), logging.FileHandler(args.output/'extractor.log', encoding='utf-8')])
    with sqlite3.connect(args.output/'staging.sqlite') as db:
        hashes, counts = personal.stage(db, args.source)
        run = Path(tempfile.mkdtemp(prefix='run-', dir=args.output))
        base_path = run/'base_attribuzioni'
        base_path.mkdir()
        base = personal.extract(db, args.start, args.end, base_path)
        result = summarize(base, base_path/'dettaglio.csv', run)
        result['manifest'] = {'version': VERSION, 'attribution_version': personal.VERSION,
            'start': args.start, 'end': args.end, 'utc': datetime.now(timezone.utc).isoformat(),
            'hashes': hashes, 'counts': counts, 'owner_codes': personal.OWNER_CODES,
            'dorlandi_codes': personal.DORLANDI_CODES, 'confirmed_executions': personal.CONFIRMED_EXECUTIONS,
            'shared_orthodontic_codes': personal.SHARED_ORTHODONTIC_CODES,
            'corrected_orthodontic_codes': personal.CORRECTED_ORTHODONTIC_CODES,
            'catalogue_correction_date': personal.CATALOGUE_CORRECTION_DATE,
            'measure': 'executed DB_PRSPESA by date, signed; not income or collaborator fees',
            'consistency': 'files stable during acquisition; cross-table snapshot not guaranteed',
            'privacy': 'detail contains internal identifiers; restrict access'}
        (run/'riepilogo.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
        readable(result, run)
        pointer = args.output/(run.name+'.tmp')
        pointer.write_text(run.name, encoding='utf-8')
        os.replace(pointer, args.output/'LATEST')
        logging.info('Published %s; control=%s', run.name, result['control'])


if __name__ == '__main__':
    main()
