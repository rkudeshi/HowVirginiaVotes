import copy
import unittest
from fairfax_history import merged_history

class FairfaxHistoryTests(unittest.TestCase):
    def test_county_replaces_matching_day_but_keeps_newer_dal(self):
        dal = [{'date': '2026-10-09', 'early': 10, 'mail': 6}, {'date': '2026-10-10', 'early': 12, 'mail': 8}, {'date': '2026-10-11', 'early': 13, 'mail': 9}]
        county = {'history': [{'date': '2026-10-10', 'early': 4, 'postal': 3, 'dropbox': 1, 'cumulative': {'early': 15, 'postal': 7, 'dropbox': 3}}]}
        original = copy.deepcopy(dal)
        rows = merged_history(dal, county)
        self.assertEqual(rows[1]['total'], 25)
        self.assertEqual(rows[1]['daily'], {'early': 4, 'mail': 4})
        self.assertEqual((rows[2]['early'], rows[2]['mail']), (13, 9))
        self.assertEqual(rows[2]['daily'], {'early': 1, 'mail': 1})
        self.assertEqual(dal, original)

    def test_later_county_day_and_downward_correction(self):
        dal = [{'date': '2026-10-10', 'early': 12, 'mail': 8}]
        county = {'history': [{'date': '2026-10-10', 'early': 0, 'postal': 0, 'dropbox': 0, 'cumulative': {'early': 11, 'postal': 5, 'dropbox': 2}}, {'date': '2026-10-11', 'early': 2, 'postal': 1, 'dropbox': 0, 'cumulative': {'early': 13, 'postal': 6, 'dropbox': 2}}]}
        rows = merged_history(dal, county)
        self.assertEqual(rows[0]['total'], 18)
        self.assertEqual(rows[1]['date'], '2026-10-11')
        self.assertEqual(rows[1]['total'], 21)

    def test_missing_county_field_retains_dal(self):
        rows = merged_history([{'date': '2026-10-10', 'early': 12, 'mail': 8, 'outstanding': 20}], {'history': [{'date': '2026-10-10', 'early': None, 'postal': 1, 'dropbox': None, 'cumulative': {'postal': 1}}]})
        self.assertEqual((rows[0]['early'], rows[0]['mail'], rows[0]['outstanding']), (12, 8, 20))

    def test_generated_series_preserves_source_switch_and_corrections(self):
        import build_voteflow as build
        history = [{'date': '2026-10-10', 'early': 15, 'mail': 10}, {'date': '2026-10-11', 'early': 13, 'mail': 9}]
        result = build.series(history, '2026-11-03', 100)
        self.assertEqual(result['e'][22:24], [15, 13])
        self.assertEqual(result['m'][22:24], [10, 9])
