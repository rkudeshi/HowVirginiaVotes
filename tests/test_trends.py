import datetime as dt
import unittest

from trends import trend_notes


def series(daily_e, daily_m, n=53):
    e, m, ce, cm = [], [], 0, 0
    for i in range(n):
        if i < len(daily_e):
            ce += daily_e[i]; cm += daily_m[i]
            e.append(ce); m.append(cm)
        else:
            e.append(None); m.append(None)
    return {'e': e, 'm': m, 'r': 100000}


class TrendNotesTest(unittest.TestCase):
    def setUp(self):
        self.edate = dt.date(2026, 11, 3)
        self.today = self.edate - dt.timedelta(days=20)   # index 26

    def test_picks_up_names_locality_and_stays_short(self):
        cur = series([300] * 20 + [900] * 7, [100] * 27)
        ref = series([300] * 47, [100] * 47)
        text = trend_notes('Sample County', self.edate, cur, ref, cur, ref, self.today, [], 10, 12)
        self.assertIn('Early voting in Sample County picked up this past week', text)
        self.assertIn('November 2025 election', text)
        self.assertLessEqual(text.count('. ') + 1, 5)

    def test_upcoming_satellite_and_holiday_mail_dip(self):
        cur = series([400] * 27, [300] * 20 + [100] * 7)
        ref = series([400] * 30 + [1200] * 17, [300] * 47)
        sat = [self.today + dt.timedelta(days=4)]
        text = trend_notes('Sample City', self.edate, cur, ref, cur, ref, self.today, sat, 50, 50)
        self.assertIn('satellite site opens here on', text)
        self.assertNotIn('0 days before Election Day', text)  # Election Day itself is not an early-voting day

    def test_holiday_mail_dip(self):
        cur = series([400] * 27, [300] * 20 + [100] * 7)
        ref = series([400] * 47, [300] * 47)
        text = trend_notes('Sample City', self.edate, cur, ref, cur, ref, self.today, [], 50, 50)
        self.assertIn("Indigenous Peoples' Day", text)

    def test_too_early_returns_nothing(self):
        cur = series([300] * 10, [100] * 10)
        ref = series([300] * 47, [100] * 47)
        self.assertEqual(trend_notes('Sample', self.edate, cur, ref, cur, ref, self.today, [], 1, 1), '')


if __name__ == '__main__':
    unittest.main()
