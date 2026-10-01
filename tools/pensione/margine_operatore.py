"""Documented collaborator costs and comparable-period differences, not net profit."""
import argparse
import csv
import json
import logging
import os
from pathlib import Path
import re
import sqlite3
import tempfile
from datetime import datetime, timezone
from datetime import date as calendar_date
from decimal import Decimal

try:
    from . import produzione_personale as production
    from . import produzione_collaboratori as collaborators
except ImportError:
    import produzione_personale as production
    import produzione_collaboratori as collaborators

SUPPLIERS = {'ZZZZXJ': '2', 'ZZZZUC': '5', 'ZZZZWB': '3', 'ZZZZXP': '4', 'ZZZZRL': '6'}
FIELDS = {
    'FORNITOR': ['DB_CODE', 'DB_FONOME'],
    'SPESAFOR': ['DB_CODE', 'DB_SPFOCOD', 'DB_SPDATA', 'DB_SPNUMER', 'DB_SPCOSTO',
                'DB_SPCOIVA', 'DB_SPXMLTD', 'DB_SPPRIMP', 'DB_SPPRIVA', 'DB_SPBOLLO', 'DB_SPVALRI'],
    'VOCISPES': ['DB_VOSPCOD', 'DB_VODESCR', 'DB_VOQUANT', 'DB_VOPREZZ', 'DB_VOSCONT'],
}
MONTHS = {name: f'{i:02}' for i, name in enumerate([
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'], 1)}


def period(descriptions):
    # DBF descriptions wrap mid-word/year. Concatenation restores those fragments.
    text = ''.join(descriptions).casefold()
    match = re.search(r'mese di ([a-z]+)\s+(20\d{2})(?!\d)', text)
    if match and match[1] in MONTHS:
        return [match[2] + MONTHS[match[1]]]
    marker = re.search(r'igiene dentale\s*-\s*', text)
    if marker:
        phrase = text[marker.end():].split('bolli', 1)[0].strip()
        result = []
        for part in re.split(r'\s+e\s+', phrase):
            match = re.fullmatch(r'([a-z/ ]+)\s+(20\d{2})', part.strip())
            if not match:
                return []
            words = [word.strip() for word in match[1].split('/')]
            if any(word not in MONTHS for word in words):
                return []
            result.extend(match[2] + MONTHS[word] for word in words)
        return sorted(set(result))
    return []


def acquire(db, source):
    paths = {name: source/(name+'.DBF') for name in FIELDS}
    before = {name: production.signature(path) for name, path in paths.items()}
    hashes = {name: production.digest(path) for name, path in paths.items()}
    db.execute('BEGIN IMMEDIATE')
    try:
        db.execute('CREATE TABLE IF NOT EXISTS manifest(name PRIMARY KEY, hash)')
        old = dict(db.execute('SELECT name,hash FROM manifest'))
        for name, fields in FIELDS.items():
            schema = [r[1] for r in db.execute(f'PRAGMA table_info({name})')]
            if old.get(name) != hashes[name] or schema != ['record', *fields]:
                db.execute(f'DROP TABLE IF EXISTS {name}')
                db.execute(f'CREATE TABLE {name}(record INTEGER PRIMARY KEY,' + ','.join(f'{f} TEXT' for f in fields) + ')')
                placeholders = ','.join('?' for _ in range(len(fields)+1))
                db.executemany(f'INSERT INTO {name} VALUES ({placeholders})',
                    production.records(paths[name], fields, encoding='cp1252'))
                db.execute('INSERT OR REPLACE INTO manifest VALUES (?,?)', (name, hashes[name]))
                logging.info('%s reloaded', name)
            else:
                logging.info('%s reused', name)
        if any(production.signature(paths[name]) != before[name] for name in paths):
            raise RuntimeError('Sources changed during acquisition')
        db.execute('CREATE UNIQUE INDEX IF NOT EXISTS supplier_key ON FORNITOR(DB_CODE)')
        db.execute('CREATE UNIQUE INDEX IF NOT EXISTS document_key ON SPESAFOR(DB_CODE)')
        db.execute('CREATE INDEX IF NOT EXISTS supplier_lines ON VOCISPES(DB_VOSPCOD)')
        db.commit()
    except Exception:
        db.rollback()
        raise
    return hashes


def extract(db, production_result, start_year, end_year, output, comparison_end=None):
    comparison_end = comparison_end or end_year+'12'
    monthly = {(r['month'], r['operator']): production.money(r['amount']) for r in production_result['monthly']}
    annual = {(r['year'], r['operator']): r['amount'] for r in production_result['annual']}
    documents, totals = [], {}
    for row in db.execute('SELECT ' + ','.join(FIELDS['SPESAFOR']) + ' FROM SPESAFOR ORDER BY DB_SPDATA,DB_CODE'):
        doc = dict(zip(FIELDS['SPESAFOR'], row))
        operator = SUPPLIERS.get(doc['DB_SPFOCOD'])
        if not operator:
            continue
        if not db.execute('SELECT 1 FROM FORNITOR WHERE DB_CODE=?', (doc['DB_SPFOCOD'],)).fetchone():
            raise ValueError('Mapped supplier missing')
        date = doc['DB_SPDATA']
        datetime.strptime(date, '%Y%m%d')
        lines = list(db.execute('SELECT DB_VODESCR,DB_VOQUANT,DB_VOPREZZ,DB_VOSCONT '
                               'FROM VOCISPES WHERE DB_VOSPCOD=? ORDER BY record', (doc['DB_CODE'],)))
        months = period([line[0] for line in lines]) if operator in ('2', '5') else []
        if not (start_year <= date[:4] <= end_year or any(start_year <= m[:4] <= end_year for m in months)
                or end_year < date[:4] <= str(int(end_year)+1)):
            continue
        base = production.money(doc['DB_SPCOSTO']) + production.money(doc['DB_SPCOIVA'])
        xml = production.money(doc['DB_SPXMLTD'])
        professional = Decimal(0)
        line_total = Decimal(0)
        valid_lines = bool(lines)
        for description, quantity, price, discount in lines:
            amount = production.money(quantity) * production.money(price)
            line_total += amount
            if production.money(discount or '0') != 0:
                valid_lines = False
            if 'boll' not in description.casefold():
                professional += amount
        if line_total != production.money(doc['DB_SPCOSTO']):
            valid_lines = False
        item = {'invoice_id': doc['DB_CODE'], 'supplier_id': doc['DB_SPFOCOD'],
            'operator': operator, 'name': collaborators.NAMES[operator], 'date': date,
            'number': doc['DB_SPNUMER'], 'months': months,
            'base_plus_vat': str(base), 'document_total': str(xml) if xml != 0 else None,
            'professional_lines': str(professional) if valid_lines else None,
            'additional_registered': str(production.money(doc['DB_SPPRIMP']) + production.money(doc['DB_SPPRIVA'])),
            'withholding_registered': doc['DB_SPVALRI'],
            'production_same_months': None, 'difference_before_other_costs': None,
            'status': 'period_not_identified' if not months else 'outside_production_window',
            'period_text': ' | '.join(line[0] for line in lines[:2]) if operator in ('2', '5') else '',
        }
        documents.append(item)
        if start_year <= date[:4] <= end_year:
            aggregate = totals.setdefault((date[:4], operator), [Decimal(0), Decimal(0), 0, 0])
            aggregate[0] += base
            aggregate[1] += xml
            aggregate[2] += int(xml == 0)
            aggregate[3] += 1
    # Compare cross-year invoices as one intact period, never prorate into annual costs.
    usages = {}
    for item in documents:
        for month in item['months']:
            key = (month, item['operator'])
            usages[key] = usages.get(key, 0) + 1
    for item in documents:
        months, operator = item['months'], item['operator']
        if (not months or not any(start_year <= m[:4] <= end_year for m in months)
                or not all(start_year+'01' <= m <= comparison_end for m in months)):
            continue
        if any(usages[(m, operator)] != 1 for m in months):
            item['status'] = 'overlapping_documents'
            continue
        value = sum((monthly.get((m, operator), Decimal(0)) for m in months), Decimal(0))
        item['production_same_months'] = str(value)
        if item['document_total'] is None:
            item['status'] = 'document_total_missing'
        else:
            item['difference_before_other_costs'] = str(value - production.money(item['document_total']))
            item['status'] = 'period_matched_production_proxy_only'
    summary = []
    for year in map(str, range(int(start_year), int(end_year)+1)):
        for operator, name in collaborators.NAMES.items():
            base, total, missing, count = totals.get((year, operator), [Decimal(0), Decimal(0), 0, 0])
            summary.append({'year': year, 'operator': operator, 'name': name,
                'production': annual.get((year, operator), '0'), 'invoice_base_plus_vat': str(base),
                'invoice_totals_available': str(total), 'missing_totals': missing, 'documents': count,
                'net_margin': None, 'status': 'different_time_basis_do_not_subtract'})
    for name, rows in [('fatture', documents), ('confronto_annuale', summary)]:
        if rows:
            with (output/(name+'.csv')).open('w', encoding='utf-8', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
    return {'annual': summary, 'documents': documents, 'net_margin_available': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--start-year', default='2021')
    parser.add_argument('--end-year', default='2025')
    parser.add_argument('--use-staging', action='store_true',
                        help='Explicitly reuse existing local snapshots without reading current source files')
    args = parser.parse_args()
    if not (args.start_year.isdigit() and args.end_year.isdigit() and len(args.start_year)==len(args.end_year)==4
            and args.start_year <= args.end_year):
        parser.error('Invalid year interval')
    args.output.mkdir(parents=True, exist_ok=True)
    prior_manifest = None
    if args.use_staging:
        for filename in ('produzione.sqlite', 'costi.sqlite', 'LATEST'):
            if not (args.output/filename).is_file():
                parser.error('Existing complete staging and latest report required')
        previous = args.output/(args.output/'LATEST').read_text(encoding='utf-8')/'riepilogo.json'
        prior_manifest = json.loads(previous.read_text(encoding='utf-8'))['manifest']
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
        handlers=[logging.StreamHandler(), logging.FileHandler(args.output/'extractor.log', encoding='utf-8')])
    run = Path(tempfile.mkdtemp(prefix='run-', dir=args.output))
    base_path = run/'base_produzione'
    base_path.mkdir()
    collaborator_path = run/'base_collaboratori'
    collaborator_path.mkdir()
    # Context-only executions allow comparison of a whole invoice crossing year end.
    # Only fully elapsed months enter a comparison; current month may be incomplete.
    today = datetime.now()
    previous_month = (today.replace(day=1).date().toordinal()-1)
    comparison_end = min(str(int(args.end_year)+1)+'12', calendar_date.fromordinal(previous_month).strftime('%Y%m'))
    context_end = min(str(int(args.end_year)+1)+'1231', today.strftime('%Y%m%d'))
    with sqlite3.connect(args.output/'produzione.sqlite') as db:
        if args.use_staging:
            production_hashes = dict(db.execute('SELECT name,hash FROM manifest'))
        else:
            production_hashes, _ = production.stage(db, args.source)
        base = production.extract(db, args.start_year+'0101', context_end, base_path)
        collaborator_data = collaborators.summarize(base, base_path/'dettaglio.csv', collaborator_path)
    with sqlite3.connect(args.output/'costi.sqlite') as db:
        hashes = dict(db.execute('SELECT name,hash FROM manifest')) if args.use_staging else acquire(db, args.source)
        result = extract(db, collaborator_data, args.start_year, args.end_year, run, comparison_end)
    if args.use_staging and (prior_manifest['production_hashes'] != production_hashes
                            or prior_manifest['cost_hashes'] != hashes):
        raise ValueError('Cached sources differ from the last published acquisition')
    origin = prior_manifest
    while origin and origin.get('prior_report_manifest'):
        origin = origin['prior_report_manifest']
    result['calvisi_date_candidates'] = calvisi_candidates(
        result['documents'], collaborator_path/'dettaglio.csv', args.start_year, args.end_year)
    result['manifest'] = {'version': '1.1', 'utc': datetime.now(timezone.utc).isoformat(),
        'production_version': production.VERSION, 'production_hashes': production_hashes,
        'cost_hashes': hashes, 'suppliers': SUPPLIERS, 'start_year': args.start_year, 'end_year': args.end_year,
        'comparison_end_month': comparison_end, 'production_context_end': context_end,
        'source_mode': 'existing_local_staging' if args.use_staging else 'live_read',
        'staging_origin_report_utc': (origin.get('staging_origin_report_utc') or origin['utc']) if origin else None,
        'limits': 'production proxy versus documented costs; no cash reconciliation, full direct costs or net margin',
        'consistency': 'separate stable acquisitions; no common transaction across source files',
        'invoice_total': 'DB_SPXMLTD when nonzero; missing totals explicit, no automatic fallback',
        'privacy': 'invoice descriptions may contain personal information; restrict access'}
    (run/'riepilogo.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
    readable(result, run)
    pointer = args.output/(run.name+'.tmp')
    pointer.write_text(run.name, encoding='utf-8')
    os.replace(pointer, args.output/'LATEST')
    logging.info('Published %s; documents=%s', run.name, len(result['documents']))


def calvisi_candidates(documents, detail, start_year, end_year):
    days = {}
    with detail.open(encoding='utf-8', newline='') as stream:
        for row in csv.DictReader(stream):
            if row['attributed_operator'] != '3' or not start_year <= row['date'][:4] <= end_year:
                continue
            group = days.setdefault(row['date'], {'amount': Decimal(0), 'rows': 0})
            group['amount'] += production.money(row['amount'])
            group['rows'] += 1
    counts = {}
    relevant = [d for d in documents if d['operator']=='3' and start_year <= d['date'][:4] <= end_year]
    for doc in relevant:
        counts[doc['date']] = counts.get(doc['date'], 0) + 1
    result = []
    for doc in relevant:
        group = days.get(doc['date'])
        result.append({'date': doc['date'], 'number': doc['number'], 'invoice_id': doc['invoice_id'],
            'invoice_total': doc['document_total'], 'production_same_day': str(group['amount']) if group else None,
            'rows': group['rows'] if group else 0,
            'status': 'same_day_candidate_not_confirmed' if group and counts[doc['date']]==1
                      else 'ambiguous_or_missing_day'})
    for day, group in sorted(days.items()):
        if day not in counts:
            result.append({'date': day, 'number': '', 'invoice_id': '', 'invoice_total': None,
                'production_same_day': str(group['amount']), 'rows': group['rows'],
                'status': 'execution_day_without_same_day_invoice'})
    return result


def readable(result, output):
    def euros(value):
        return format(value, ',.2f').replace(',', '_').replace('.', ',').replace('_', '.')
    groups, cross_year = {}, []
    for document in result['documents']:
        if document['status'] != 'period_matched_production_proxy_only':
            continue
        years = {m[:4] for m in document['months']}
        if len(years) != 1:
            cross_year.append(document)
            continue
        key = (next(iter(years)), document['name'])
        values = groups.setdefault(key, [Decimal(0), Decimal(0), set()])
        values[0] += production.money(document['production_same_months'])
        values[1] += production.money(document['document_total'])
        values[2].update(m[4:] for m in document['months'])
    lines = ['# Cure eseguite e fatture dei collaboratori', '',
        'Confrontiamo il lavoro e le fatture che indicano gli stessi mesi. La differenza non e il guadagno: '
        'mancano materiali, dipendenti, spese dello studio e verifica degli incassi.', '',
        '| Anno | Collaboratore | Mesi coperti | Valore cure | Totale fatture per quei mesi | Differenza prima degli altri costi |',
        '| --- | --- | --- | ---: | ---: | ---: |']
    if result.get('manifest', {}).get('source_mode') == 'existing_local_staging':
        lines[2:2] = ['Fonte: ultima copia locale disponibile. Nessuna nuova lettura del server in questa esecuzione.', '']
    for (year, name), (work, cost, months) in sorted(groups.items()):
        lines.append(f"| {year} | {name} | {', '.join(sorted(months))} | {euros(work)} | {euros(cost)} | {euros(work-cost)} |")
    if cross_year:
        lines += ['', '## Fatture che coprono due anni: confronto del periodo intero', '',
            'Questi importi non sono aggiunti ai totali annuali e non vengono divisi in quote uguali.', '',
            '| Collaboratore | Mesi | Valore cure | Fattura intera | Differenza prima degli altri costi |',
            '| --- | --- | ---: | ---: | ---: |']
        for doc in cross_year:
            lines.append(f"| {doc['name']} | {', '.join(doc['months'])} | {euros(production.money(doc['production_same_months']))} | {euros(production.money(doc['document_total']))} | {euros(production.money(doc['difference_before_other_costs']))} |")
    if result.get('calvisi_date_candidates'):
        lines += ['', '## Calvisi: date da verificare', '',
            'Una fattura nello stesso giorno delle cure e un collegamento possibile, ancora da confermare. '
            'Non calcoliamo un margine da questa sola coincidenza.', '',
            '| Data | Fattura | Valore cure dello stesso giorno | Totale fattura | Riscontro |',
            '| --- | --- | ---: | ---: | --- |']
        for row in result['calvisi_date_candidates']:
            if row['date'][:4] != result['manifest']['end_year']:
                continue
            work = euros(production.money(row['production_same_day'])) if row['production_same_day'] is not None else 'Non trovato'
            cost = euros(production.money(row['invoice_total'])) if row['invoice_total'] is not None else 'Non disponibile'
            status = 'Stessa data, da confermare' if row['status']=='same_day_candidate_not_confirmed' else 'Da controllare'
            lines.append(f"| {row['date']} | {row['number']} | {work} | {cost} | {status} |")
    lines += ['', 'I mesi sono indicati da 01 (gennaio) a 12 (dicembre). Non vengono inventati costi per i mesi senza documenti collegabili.', '',
        '## Cosa resta separato', '',
        '- Fatture con periodo non scritto chiaramente, periodi sovrapposti o totale documento mancante.',
        '- Ripartizione annuale delle fatture che comprendono anni diversi: confronto solo del periodo intero.',
        '- Calvisi: serve il collegamento con le sedute/cure pertinenti e i materiali.',
        '- D\'Orlandi: il compenso dipende dagli incassi; non va confrontato automaticamente con le cure eseguite nello stesso anno.', '',
        'Le fatture sono costi documentati, non bonifici verificati. Il totale documento usato comprende gia le componenti presenti: '
        'non aggiungiamo una seconda volta bolli o contributi e non sottraiamo nuovamente le ritenute. '
        'Le fatture dei collaboratori erano gia incluse nel riepilogo fornitori generale: non vanno aggiunte di nuovo.', '',
        'confronto_annuale.csv affianca produzione e documenti per anno di emissione, senza sottrarli. '
        'fatture.csv mostra i periodi individuati e quelli ancora da collegare.', '']
    (output/'LEGGIMI.md').write_text('\n'.join(lines), encoding='utf-8')


if __name__ == '__main__':
    main()
