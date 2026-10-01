import csv
from pathlib import Path
import tempfile
import unittest

from tools.pensione.produzione_collaboratori import summarize


class CollaboratorTests(unittest.TestCase):
    def fixture(self, root):
        path = root/'source.csv'
        fields = ['date', 'amount', 'recorded_operator', 'attributed_operator', 'group',
                  'branch', 'catalogue_id', 'short_code']
        with path.open('w', newline='', encoding='utf-8') as stream:
            writer = csv.writer(stream)
            writer.writerow(fields)
            writer.writerows([
                ['20250101', '100', '1', '4', 'collaborator_declared', '9', 'O', 'orto'],
                ['20250201', '-20', '4', '4', 'collaborator_recorded', '9', 'O', 'orto'],
                ['20250301', '50', '1', '1', 'owner_declared', '2', 'C', 'cura'],
                ['20250401', '30', '1', '', 'unresolved', '9', 'X', 'x'],
            ])
        base = {'totals': {'2025': '160'}, 'counts': {'2025': 4},
                'annual': [{'year': '2025', 'group': 'collaborator_declared', 'amount': '100'},
                           {'year': '2025', 'group': 'collaborator_recorded', 'amount': '-20'}],
                'diagnostics': {}}
        return base, path

    def test_attributed_operator_signed_values_and_separate_unknowns(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            base, path = self.fixture(root)
            result = summarize(base, path, root)
            annual = {r['operator']: r for r in result['annual']}
            self.assertEqual(annual['4']['amount'], '80')
            self.assertEqual(annual['4']['count'], 2)
            self.assertEqual(annual['2']['amount'], '0')
            self.assertEqual(result['control'][0]['unresolved'], '30')
            self.assertEqual(result['activities'][0]['amount'], '80')
            self.assertEqual(len(result['monthly']), 2)
            with (root/'dettaglio.csv').open(encoding='utf-8') as stream:
                self.assertEqual(len(list(csv.DictReader(stream))), 2)

    def test_reconciliation_rejects_missing_or_misallocated_records(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            base, path = self.fixture(root)
            base['counts']['2025'] = 5
            with self.assertRaises(ValueError):
                summarize(base, path, root)
            base['counts']['2025'] = 4
            base['annual'][0]['amount'] = '110'
            with self.assertRaises(ValueError):
                summarize(base, path, root)


if __name__ == '__main__':
    unittest.main()
