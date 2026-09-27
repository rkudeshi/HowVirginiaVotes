"""Import saved VPAP chart literals; no network access or execution of page code.

VPAP supplemental histories fill gaps only. Existing locality histories, especially
Fairfax County's official reports, remain authoritative and are never replaced.
"""
import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def parse_snapshot(snapshot, election_date, registration):
    year = snapshot['year']
    assert snapshot['localityId'] != 'fairfax-county', 'Fairfax is excluded'
    assert int(year) == dt.date.fromisoformat(election_date).year
    records = re.findall(
        r'in_person:\s*(-?\d+),\s*mail:\s*(-?\d+),\s*total:\s*(-?\d+),'
        r'\s*date: formatDate\(new Date\((\d+),\s*(\d+),\s*(\d+),\s*0\)\)',
        snapshot['dailyLiteral'])
    points = re.findall(r'days:\s*(-?\d+),\s*election_id:\s*(\d+),\s*total:\s*(-?\d+)', snapshot['cumulativeLiteral'])
    assert records and len(records) == snapshot['dailyLiteral'].count('in_person:') == len(points)
    history, cum = [], {'early': 0, 'mail': 0, 'total': 0}
    for values, point in zip(records, points):
        early, mail, total, y, month, day = map(int, values)
        date = dt.date(y, month + 1, day)
        assert str(y) == year
        assert total == early + mail and min(early, mail) >= 0
        assert date == dt.date.fromisoformat(election_date) - dt.timedelta(days=int(point[0]))
        if history:
            assert date == dt.date.fromisoformat(history[-1]['date']) + dt.timedelta(days=1)
        daily = {'early': early, 'mail': mail, 'total': total}
        for k in cum:
            cum[k] += daily[k]
        assert cum['total'] == int(point[2]), 'Daily series disagrees with cumulative chart'
        history.append({'date': date.isoformat(), **cum, 'daily': daily, 'outstanding': None})
    types = {label: int(value) for value, label in re.findall(r"value:\s*(\d+),\s*label:\s*'([^']+)'", snapshot['typeChartLiteral'])}
    assert types['In Person'] + types['Mail'] == snapshot['headlineTotal']
    rates = [{'area': re.sub('<.*', '', name).strip(), 'per1000': float(value), 'display': label}
             for name, value, label in re.findall(r"name:\s*'([^']*)',\s*value:\s*([\d.]+),\s*label:\s*'([^']+)'", snapshot['ratesLiteral'])]
    as_of = re.search(r'As of (\d+/\d+/\d+)', snapshot['pageText'])[1]
    previous_date = re.search(r'Final total through (\d+/\d+/\d+)', snapshot['pageText'])[1]
    as_of = dt.datetime.strptime(as_of, '%m/%d/%y').date().isoformat()
    previous_date = dt.datetime.strptime(previous_date, '%m/%d/%y').date().isoformat()
    return {
        'id': snapshot['localityId'], 'name': snapshot['localityName'],
        **registration, 'registrationDate': year + '-11-01',
        'registrationSource': 'https://github.com/rkudeshi/novavote/blob/main/data/registration.json',
        'source': snapshot['url'], 'sourceLabel': 'VPAP daily chart', 'history': history,
        'vpap': {'retrievedAt': snapshot['retrievedAt'], 'asOf': as_of,
                 'upstreamSource': 'Virginia Department of Elections',
                 'dailyDateMeaning': 'Dates as labeled by VPAP; not independently verified activity dates.',
                 'headline': {'early': types['In Person'], 'mail': types['Mail'],
                              'total': snapshot['headlineTotal'],
                              'mailApplicationsNotReturned': types['Mail Ballot Applications Not Returned']},
                 'dailySum': dict(cum),
                 'headlineMinusDailySum': {k: {'early': types['In Person'], 'mail': types['Mail'], 'total': snapshot['headlineTotal']}[k] - cum[k] for k in cum},
                 'earlyVotesPer1000Registered': rates,
                 'previousComparableElection': {'date': previous_date, 'total': snapshot['previousComparableElectionTotal']},
                 'sourceSnapshot': f'sources/vpap/{snapshot["localityId"].removesuffix("-county")}-{year}.json'}
    }


def main():
    region = json.loads((ROOT / 'dist/region.json').read_text())
    registration = json.loads((ROOT / 'sources/imported/data/registration.json').read_text())['elections']
    result = {'schemaVersion': 1, 'localities': {}}
    for path in sorted((ROOT / 'sources/vpap').glob('*.json')):
        snapshot = json.loads(path.read_text())
        year, locality = snapshot['year'], snapshot['localityId']
        election = region['elections'][year]
        assert not any(l['id'] == locality for l in election['localities']), 'Existing history must not be replaced'
        parsed = parse_snapshot(snapshot, election['electionDate'], registration[election['electionDate']][snapshot['localityName']])
        result['localities'].setdefault(locality, {})[year] = parsed
        print(year, locality, len(parsed['history']), 'days;', parsed['vpap']['dailySum'], 'headline difference:', parsed['vpap']['headlineMinusDailySum'])
    (ROOT / 'dist/vpap-history.json').write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
