"""Migra `materiali` nel catalogo prodotti/offerte (solo fornitori MATERIALI).

Senza opzioni fa solo il dry-run: legge DBF e database, stampa il riepilogo e scrive i CSV in --out.
Uso (dalla cartella server_v2, con il python del venv):
    venv/Scripts/python.exe -m services.catalogo_materiali_cli --out <cartella>
    venv/Scripts/python.exe -m services.catalogo_materiali_cli --apply [--elimina-fuori-perimetro]
Prima di --apply fare una copia del database.
"""
import argparse
import csv
from collections import Counter
from pathlib import Path

from core.config import Config
from core.database_manager import DatabaseManager
from services.catalogo_materiali_migration import CatalogoMaterialiMigrationService, DbfSource

ROOT = Path(__file__).resolve().parents[1]


def write_csv(path, header, rows):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(header)
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--db', default=str(ROOT / 'instance' / 'studio_dima.db'))
    parser.add_argument('--out', default='.')
    parser.add_argument('--apply', action='store_true', help='scrive nel database (default: solo dry-run)')
    parser.add_argument('--elimina-fuori-perimetro', action='store_true',
                        help='con --apply cancella da materiali le righe di fornitori non MATERIALI')
    args = parser.parse_args()

    db = DatabaseManager(Config(db_path=args.db))
    service = CatalogoMaterialiMigrationService(db, DbfSource())
    plan = service.plan()
    nomi, catalogo = plan['nomi_fornitori'], plan['catalogo']

    print(f"fornitori MATERIALI: {plan['fornitori']}")
    print(f"offerte nel gestionale: {plan['offerte_gestionale']}  (righe escluse: {plan['esclusi']})")
    print(f"offerte nel catalogo da creare: {len(catalogo)}")
    print(f"  di cui solo da riga legacy: {sum(1 for o in catalogo if o['origine'] == 'legacy')}")
    print(f"righe di acquisto collegate: {sum(len(o['acquisti']) for o in catalogo)}")
    print(f"righe legacy fuori perimetro: {len(plan['fuori_perimetro'])}")
    print(f"righe legacy non materiale (non migrate): {len(plan['legacy_non_materiale'])}")
    print('da rivedere: ' + ', '.join(f'{c}={n}' for c, n in sorted(Counter(r[0] for r in plan['da_rivedere']).items())))

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    write_csv(out / 'catalogo_offerte.csv', ['fornitore', 'codice', 'nome', 'acquisti', 'conto', 'branca', 'sottoconto', 'origine'],
              [[nomi.get(o['fornitore_id'], o['fornitore_id']), o['codice'], o['nome'], len(o['acquisti']),
                o['classificazione']['contonome'], o['classificazione']['brancanome'], o['classificazione']['sottocontonome'],
                o['origine']] for o in catalogo])
    write_csv(out / 'da_rivedere.csv', ['categoria', 'fornitore', 'codice', 'descrizione', 'dettaglio'], plan['da_rivedere'])

    if args.apply:
        result = service.apply(plan, elimina_fuori_perimetro=args.elimina_fuori_perimetro)
        print('applicato: ' + ', '.join(f'{k}={v}' for k, v in result.items()))
    else:
        print('dry-run: nessuna modifica al database')
    db.close()


if __name__ == '__main__':
    main()
