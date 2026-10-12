"""Exercise the renamed import paths, publication metadata, and DAL refresh writes."""
import csv
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]


class SourceRefreshTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        for name in ('source_attribution.py', 'status_log.py', 'refresh_dal.py', 'import_archived_voting.py'):
            shutil.copy2(ROOT / name, self.root / name)

    def run_script(self, name, *args):
        return subprocess.run(['python3', str(self.root / name), *map(str, args)], capture_output=True, text=True, check=True)

    def test_archived_import_reproduces_published_history(self):
        for name in ('dist/region.json', 'sources/imported/data/registration.json'):
            dest = self.root / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, dest)
        shutil.copytree(ROOT / 'sources/archived-voting', self.root / 'sources/archived-voting')
        (self.root / 'sources/statewide').mkdir()
        for path in (ROOT / 'sources/statewide').glob('registration*'):
            if path.suffix in ('.json', '.txt'):
                shutil.copy2(path, self.root / 'sources/statewide' / path.name)
        self.run_script('import_archived_voting.py')
        self.assertEqual((ROOT / 'dist/archived-voting-history.json').read_bytes(),
                         (self.root / 'dist/archived-voting-history.json').read_bytes())

    def test_dal_refresh_saves_neutral_metadata_and_is_repeatable(self):
        (self.root / 'dist/precinct-data').mkdir(parents=True)
        (self.root / 'sources').mkdir()
        old_day = {'date': '2026-09-17', 'reportDate': '2026-09-18', 'early': 2, 'mail': 1, 'total': 3}
        region = {'elections': {'2026': {'localities': [{
            'id': 'test-city', 'name': 'Test City', 'registered': 500,
            'history': [old_day, {'date': '2026-09-18', 'early': 20, 'mail': 3, 'total': 23}]
        }]}}, 'official': {'2026': {'verified': 'preserve separate official records'}}}
        region_path = self.root / 'dist/region.json'
        region_path.write_text(json.dumps(region))
        precinct_path = self.root / 'dist/precinct-data/2026-test-city.json'
        precinct_path.write_text(json.dumps({'precincts': {'1': {'name': 'ONE', 'history': {'2026-09-17': [2, 1, 500]}}}, 'dates': ['2026-09-17']}))
        row = {'FILEDATE': '2026-09-19T05:00:00', 'ON_MACHINE': 5, 'MAIL_IN': 3,
               'MARKED': 1, 'PRE_PROCESSED': 2, 'ISSUED': 4, 'PROVISIONAL': 0,
               'FWAB': 0, 'ACTIVE_VOTERS': 900, 'INACTIVE_VOTERS': 99}
        csv_text = io.StringIO()
        writer = csv.DictWriter(csv_text, fieldnames=row)
        writer.writeheader()
        writer.writerow(row)
        archive = self.root / 'input.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            for name in ('byLOCALITY_NAME/TEST CITY/metrics.csv', 'byLOCALITY_PRECINCT_NAME/TEST CITY 1 - ONE/metrics.csv'):
                z.writestr(name, csv_text.getvalue())
        first = json.loads(self.run_script('refresh_dal.py', '--zip', archive).stdout)
        self.assertEqual(first['changedFiles'], 2)
        saved = json.loads(region_path.read_text())
        locality = saved['elections']['2026']['localities'][0]
        self.assertEqual(locality['registered'], 500)
        self.assertEqual(locality['history'][0], old_day)
        self.assertEqual(locality['history'][-1]['total'], 8)  # Corrections are preserved.
        self.assertEqual(saved['official'], region['official'])
        self.assertEqual(json.loads(precinct_path.read_text())['precincts']['1']['history']['2026-09-18'], [5, 3, 500])
        self.assertIn('via intermediary reports', saved['elections']['2026']['source'])
        status_path = self.root / 'dist/status.json'
        status = json.loads(status_path.read_text())
        self.assertEqual(status[0]['source'], 'Daily Absentee List')
        self.assertIsNone(status[0]['url'])
        self.assertEqual(len(list((self.root / 'sources/dal-snapshots').glob('*.zip'))), 1)
        private = list((self.root / '.private/source-provenance/acquisitions').glob('*.json'))
        self.assertEqual(len(private), 1)
        self.assertTrue(json.loads(private[0].read_text())['url'].startswith('https://'))
        unchanged_status = status_path.read_bytes()
        second = json.loads(self.run_script('refresh_dal.py', '--zip', archive).stdout)
        self.assertEqual(second['changedFiles'], 0)
        self.assertEqual(status_path.read_bytes(), unchanged_status)


if __name__ == '__main__':
    unittest.main()
