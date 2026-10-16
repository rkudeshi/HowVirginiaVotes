"""Build the compact JSON bundles the VoteFlow front end reads.

Run after the data refresh and before publishing (the Pages workflow does this):

    python3 build_voteflow.py

Reads dist/region.json, dist/archived-voting-history.json, dist/regional.geojson,
dist/weather/2026.json, dist/maps/*.json and dist/precinct-data/2026-*.json, and writes

    dist/data/home-<election>.json   one statewide bundle per election
    dist/data/loc/<locality>.json    one bundle per locality (all elections)

The bundles are generated, not edited by hand; dist/data/ is git-ignored.
"""
import datetime as dt
import json
import math
import re
from fairfax_history import merged_history
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'dist'
OUT = ROOT / 'data'
date = dt.date.fromisoformat

D = json.loads((ROOT / 'region.json').read_text())
ARCH = json.loads((ROOT / 'archived-voting-history.json').read_text())['localities']
W26 = json.loads((ROOT / 'weather' / '2026.json').read_text())
MANIFEST = json.loads((ROOT / 'map-manifest.json').read_text())
NAMES = {n['id']: n for n in D['names']}
ALL_NAMES = [[n['id'], n['name']] for n in sorted(D['names'], key=lambda n: n['name'])]
# Display-only merge. Never write county values over the saved DAL observations.
for locality in D['elections']['2026']['localities']:
    if locality['id'] == 'fairfax-county':
        locality['history'] = merged_history(locality['history'], D.get('official', {}).get('2026', {}))


def monotonic(hist):
    """Display-only: running totals never go down. A missing day or a dip (a bad report, or a
    later downward correction) carries the previous high; the saved data is untouched."""
    out, hi = [], {}
    for h in sorted(hist, key=lambda h: h['date']):
        h = dict(h)
        for key in ('early', 'mail'):
            v = h.get(key)
            hi[key] = max(hi.get(key, 0), v or 0)
            if v is not None or hi[key]:
                h[key] = hi[key]
        if h.get('total') is not None:
            hi['total'] = max(hi.get('total', 0), h['total'], (h.get('early') or 0) + (h.get('mail') or 0))
            h['total'] = hi['total']
        out.append(h)
    return out


for _e in D['elections'].values():
    for _l in _e['localities']:
        _l['history'] = monotonic(_l['history'])
for _lid in ARCH:
    for _eid in ARCH[_lid]:
        if isinstance(ARCH[_lid][_eid], dict) and 'history' in ARCH[_lid][_eid]:
            ARCH[_lid][_eid]['history'] = monotonic(ARCH[_lid][_eid]['history'])
EL = D['elections']
LIVE = '2026'
ORDER = ['2026', '2026-special', '2025', '2024', '2023', '2022', '2021', '2020']
ARCH_META = {'2020': ('2020-11-03', 'Presidential'), '2021': ('2021-11-02', 'State / local'), '2022': ('2022-11-08', 'Midterm')}
# Map positions for sites the geocoded site list does not cover yet (approximate; flagged in the UI).
APPROX_SITES = {'richmond-city': {"Registrar's office": (37.5935, -77.4741), 'Richmond City Hall': (37.5407, -77.4336),
                                  'Hickory Hill Community Center': (37.4987, -77.4573)}}


def tot(h):
    return h.get('total') or ((h.get('early') or 0) + (h.get('mail') or 0))


def election_meta(eid):
    e = EL.get(eid, {})
    if eid in ARCH_META:
        return {'date': ARCH_META[eid][0], 'label': 'November ' + eid, 'type': ARCH_META[eid][1]}
    return {'date': e['electionDate'], 'label': e['label'], 'type': e['type']}


def loc_hist(eid, lid):
    e = EL.get(eid)
    if e:
        for l in e['localities']:
            if l['id'] == lid:
                return l
    if eid in ARCH_META and lid in ARCH and eid in ARCH[lid]:
        return ARCH[lid][eid]
    return None


def points(hist, E):
    pts = {}
    for h in hist:
        k = (E - date(h['date'])).days
        if -6 <= k <= 46:
            pts[k] = (h.get('early') or 0, h.get('mail') or 0, h.get('outstanding'))
    return pts


def series(hist, edate, registered):
    """Cumulative early/mail by index 0..52 (index 0 = E-46, 46 = Election Day, 52 = E+6)."""
    pts = points(hist, date(edate))
    if not pts:
        return None
    first, last = max(pts), min(pts)
    e_, m_ = [], []
    ce = cm = 0
    for k in range(46, -7, -1):
        if k in pts:
            ce = pts[k][0]; cm = pts[k][1]
        if k > first or k < last:
            e_.append(None); m_.append(None)
        else:
            e_.append(ce); m_.append(cm)
    return {'e': e_, 'm': m_, 'r': registered}


def statewide(eid):
    """Statewide series plus daily rows (each locality forward-filled, then summed)."""
    meta = election_meta(eid)
    E = date(meta['date'])
    allpts, reg, active = [], 0, 0
    daily_by_points = []
    for lid in NAMES:
        l = loc_hist(eid, lid)
        if not l:
            continue
        reg += l['registered']; active += l.get('active') or 0
        p = points(l['history'], E)
        if p:
            allpts.append(p)
            daily_by_points.append({(E - date(h['date'])).days: h.get('daily', {}) for h in l['history']})
    glast = min(min(p) for p in allpts)
    agg = {}
    for p, source_daily in zip(allpts, daily_by_points):
        ce = cm = 0; co = None
        for k in range(46, -7, -1):
            prior_e, prior_m = ce, cm
            if k in p:
                ce = p[k][0]; cm = p[k][1]; co = p[k][2] if p[k][2] is not None else co
            if k < glast or k > max(p):
                continue
            a = agg.setdefault(k, [0, 0, 0, 0, 0])
            a[0] += ce; a[1] += cm; a[2] += co or 0
            daily = source_daily.get(k, {})
            a[3] += daily.get('early') if daily.get('early') is not None else ce - prior_e
            a[4] += daily.get('mail') if daily.get('mail') is not None else cm - prior_m
    e_ = [agg[k][0] if k in agg else None for k in range(46, -7, -1)]
    m_ = [agg[k][1] if k in agg else None for k in range(46, -7, -1)]
    rows, prev = [], None
    for k in range(46, -7, -1):
        if k not in agg:
            continue
        a = agg[k]
        d = (E - dt.timedelta(days=k)).isoformat()
        rows.append({'d': d, 'e': a[0], 'm': a[1], 'de': max(0, a[3]), 'dm': max(0, a[4]), 'o': a[2] or None})
        prev = a
    return {'e': e_, 'm': m_, 'r': reg}, rows, reg, active


def at_days_before(hist, E, k):
    """Cumulative total on the last report at least k days before Election Day."""
    found = None
    for h in sorted(hist, key=lambda h: h['date']):
        if (E - date(h['date'])).days >= k:
            found = tot(h)
    return found


# ---------------- schedules ----------------
MONTHS = {'Sept': 9, 'Sep': 9, 'Oct': 10, 'Nov': 11}


def parse_time(s):
    s = s.strip().lower().replace('noon', '12 p.m.')
    m = re.match(r'(\d{1,2})(?::(\d\d))?\s*([ap])\.m\.', s)
    if not m:
        return None
    h = int(m.group(1)) % 12 + (12 if m.group(3) == 'p' else 0)
    return h + int(m.group(2) or 0) / 60


def fmt_t(x):
    h = int(x); m = round((x - h) * 60)
    ap = 'AM' if h < 12 else 'PM'
    h12 = h % 12 or 12
    return f'{h12}:{m:02d} {ap}' if m else f'{h12} {ap}'


def fmt_span(t):
    return fmt_t(t[0]) + ' – ' + fmt_t(t[1]) if t else ''


def parse_rules(rules):
    wk = None; explicit = {}; closed = set()
    for r in rules:
        span = None
        mt = re.search(r':\s*(.+?)\s+to\s+(.+?)(?:\s*\(|$)', r)
        if mt:
            a, b = parse_time(mt.group(1)), parse_time(mt.group(2))
            if a is not None and b is not None:
                span = (a, b)
        for cm in re.finditer(r'CLOSED\s+(Sept|Sep|Oct|Nov)\.?\s*(\d+)', r):
            closed.add(dt.date(2026, MONTHS[cm.group(1)], int(cm.group(2))))
        head = r.split(':')[0]
        if head.startswith('Monday-Friday'):
            wk = span; continue
        for dm in re.finditer(r'(Sept|Sep|Oct|Nov)\.?\s*(\d+)(?:\s*-\s*(\d+))?', head):
            mo = MONTHS[dm.group(1)]; a = int(dm.group(2)); b = int(dm.group(3) or a)
            for dd in range(a, b + 1):
                explicit[dt.date(2026, mo, dd)] = span
    return wk, explicit, closed


DOW3 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
MON3 = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def dlabel(d):
    return f'{DOW3[d.weekday()]} {MON3[d.month]} {d.day}'


def site_schedule(lid, start, end):
    sat = D.get('satellites', {}).get(LIVE, {}).get(lid)
    days, sites = {}, []
    if not sat:
        return days, sites
    for s in sat['sites']:
        wk, ex, closed = parse_rules(s['rules'])
        first = date(s['firstOpen'])
        pretty = []
        if wk:
            pretty.append(f'Weekdays (Mon–Fri) from {dlabel(first)}: {fmt_span(wk)}')
        for d0 in sorted(ex):
            if ex[d0]:
                pretty.append(f'{dlabel(d0)}: {fmt_span(ex[d0])}')
        for d0 in sorted(closed):
            pretty.append(f'Closed {dlabel(d0)}')
        sites.append({'name': s['name'], 'address': s['address'], 'firstOpen': s['firstOpen'], 'satellite': s['satellite'], 'rules': pretty or s['rules']})
        d0 = start
        while d0 <= end:
            span = None
            if d0 >= first and d0 not in closed:
                if d0 in ex:
                    span = ex[d0]
                elif d0.weekday() < 5 and wk:
                    span = wk
            if span:
                x = days.setdefault(d0.isoformat(), {'n': 0, 'h': 0, 'open': []})
                x['n'] += 1; x['h'] += round(span[1] - span[0], 2); x['open'].append([s['name'], fmt_span(span), round(span[1] - span[0], 2)])
            d0 += dt.timedelta(days=1)
    return days, sites


def sat_summary(lid, today):
    sat = D.get('satellites', {}).get(LIVE, {}).get(lid)
    if not sat:
        return 0, None
    sats = [s for s in sat['sites'] if s['satellite']]
    upcoming = sorted(s['firstOpen'] for s in sats if date(s['firstOpen']) > today)
    return len(sats), (upcoming[0] if upcoming else ('open' if sats else None))


# ---------------- geometry ----------------
def rings(g):
    if g['type'] == 'Polygon':
        return [g['coordinates'][0]]
    return [p[0] for p in g['coordinates']]


def projector(features, W=1000):
    lons, lats = [], []
    for f in features:
        for r in rings(f['geometry']):
            for x, y in r:
                lons.append(x); lats.append(y)
    k = math.cos(math.radians((min(lats) + max(lats)) / 2))
    x0, x1, y0, y1 = min(lons), max(lons), min(lats), max(lats)
    s = W / ((x1 - x0) * k)
    return (lambda x, y: ((x - x0) * k * s, (y1 - y) * s)), round((y1 - y0) * s)


def area(r):
    return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2


def path_of(f, P, tol, drop_small=False):
    rs = [[P(*c) for c in r] for r in rings(f['geometry'])]
    big = max(area(r) for r in rs) if rs else 0
    parts = []
    for pts in rs:
        if drop_small and area(pts) < big * 0.02 and area(pts) < 4:
            continue
        kept = [pts[0]]
        for p in pts[1:]:
            if math.dist(p, kept[-1]) >= tol:
                kept.append(p)
        if len(kept) < 3:
            kept = pts[::max(1, len(pts) // 4)]
        parts.append('M' + 'L'.join(f'{x:.0f},{y:.0f}' for x, y in kept) + 'Z')
    return ''.join(parts)


def main():
    OUT.mkdir(exist_ok=True)
    (OUT / 'loc').mkdir(exist_ok=True)
    e26 = EL[LIVE]
    as_of = max(h['date'] for l in e26['localities'] for h in l['history'])
    today = date(as_of)
    # "Today" as days before the live Election Day (series index = 46 - days before)
    tdb = max(-6, min(46, (date(election_meta(LIVE)['date']) - today).days))

    regional = json.loads((ROOT / 'regional.geojson').read_text())
    VP, vh = projector(regional['features'])
    va_paths = {f['properties']['id']: path_of(f, VP, 1.6, drop_small=True) for f in regional['features']}
    # Shared state outline for the locality pages' "where is it" map.
    (OUT / 'va-map.json').write_text(json.dumps({'h': vh, 'p': va_paths}, separators=(',', ':')))

    hist, rows_by, regs = {}, {}, {}
    for eid in ORDER:
        meta = election_meta(eid)
        sr, rows, reg, active = statewide(eid)
        hist[eid] = {'label': meta['label'], 'type': meta['type'], **sr}
        rows_by[eid] = rows; regs[eid] = (reg, active)

    sat_open = {}
    for lid, s in D.get('satellites', {}).get(LIVE, {}).items():
        for site in s['sites']:
            if site['satellite']:
                x = sat_open.setdefault(site['firstOpen'], {'n': 0, 'locs': {}})
                x['n'] += 1; x['locs'][NAMES[lid]['name']] = x['locs'].get(NAMES[lid]['name'], 0) + 1

    # ---- statewide bundles, one per election
    for eid in ORDER:
        meta = election_meta(eid)
        E = date(meta['date'])
        live = eid == LIVE
        locs = []
        for lid, nm in NAMES.items():
            l = loc_hist(eid, lid)
            if not l:
                continue
            h = l['history'][-1]
            c = None
            if live:
                k_last = (E - date(h['date'])).days
                prev = loc_hist('2025', lid)
                if prev:
                    pv = at_days_before(prev['history'], date(election_meta('2025')['date']), k_last)
                    c = round(tot(h) / pv * 100) if pv else None
            n, nxt = sat_summary(lid, today) if live else (0, None)
            v = tot(h)
            locs.append({'id': lid, 'n': nm['name'], 'rg': nm['region'], 'r': l['registered'], 'ac': l.get('active'),
                         'v': v, 'e': h.get('early') or 0, 'm': h.get('mail') or 0, 'o': h.get('outstanding'),
                         'p': round(v / l['registered'] * 100, 2), 'c': c, 'sat': n, 'next': nxt, 'd': va_paths.get(lid, '')})
        rows = rows_by[eid]
        reg, active = regs[eid]
        bundle = {'eid': eid, 'label': meta['label'], 'type': meta['type'], 'date': meta['date'], 'live': live,
                  'asOf': rows[-1]['d'] if rows else meta['date'], 'reg': reg, 'active': active or None,
                  'locs': locs, 'rows': rows, 'satOpen': sat_open if live else {}, 'hist': hist, 'mapH': vh,
                  'elections': [{'id': x, 'label': election_meta(x)['label'], 'type': election_meta(x)['type']} for x in ORDER]}
        (OUT / f'home-{eid}.json').write_text(json.dumps(bundle, separators=(',', ':')))

    # ---- locality bundles
    start, end = dt.date(2026, 9, 18), dt.date(2026, 11, 2)
    by_total = sorted(e26['localities'], key=lambda x: -tot(x['history'][-1]))
    by_pct = sorted(e26['localities'], key=lambda x: -tot(x['history'][-1]) / x['registered'])
    official = {x['date']: x for x in D.get('official', {}).get(LIVE, {}).get('history', [])}
    geocoded = {x['name'].lower(): (x['lat'], x['lon']) for x in D.get('sites', [])}
    for l in e26['localities']:
        lid = l['id']
        days_sched, sites = site_schedule(lid, start, end)
        # Every registrar's office offers early voting from day one. When the schedule source
        # doesn't list it, show it without address or hours (those come from the registrar).
        office_known = any(not s['satellite'] for s in sites)
        if not office_known:
            sites.insert(0, {'name': "Registrar's office", 'address': '', 'firstOpen': start.isoformat(), 'satellite': False,
                             'rules': [], 'placeholder': True, 'url': NAMES[lid].get('officeSource')})
        rows, prev = [], None
        for h in l['history']:
            if h['date'] < '2026-09-18':
                prev = h; continue
            w = W26.get(f'{lid}-2026-general', {}).get(h['date'])
            r = {'d': h['date'], 'e': h['early'], 'm': h['mail'], 'de': h['early'] - (prev['early'] if prev else 0),
                 'dm': h['mail'] - (prev['mail'] if prev else 0), 'o': h.get('outstanding'), 'pv': h.get('provisional') or 0,
                 'w': {'l': w['label'], 'hi': round(w['tempMax']), 'lo': round(w['tempMin']), 'p': round(w.get('precip') or 0, 2), 'wet': bool(w.get('wet'))} if w else None}
            if lid == 'fairfax-county':
                de, dm = h.get('daily', {}).get('early'), h.get('daily', {}).get('mail')
                if de is not None: r['de'] = max(0, de)
                if dm is not None: r['dm'] = max(0, dm)
            if lid == 'fairfax-county' and h['date'] in official:
                x = official[h['date']]
                r['site'] = {k: v for k, v in x['sites'].items() if v}
                r['post'] = x.get('postal'); r['box'] = x.get('dropbox')
            rows.append(r); prev = h
        pm = json.loads((ROOT / MANIFEST[lid]['file']).read_text())
        P, ph = projector(pm['features'])
        tol = 2.2 if len(pm['features']) > 150 else 1.6
        pp = {f['properties']['code']: path_of(f, P, tol) for f in pm['features']}
        precincts, pdates = [], []
        pfile = ROOT / 'precinct-data' / f'2026-{lid}.json'
        if pfile.exists():
            pd = json.loads(pfile.read_text())
            pdates = [x for x in pd['dates'] if x >= '2026-09-18'] or pd['dates'][-1:]
            for code, p in pd['precincts'].items():
                if code in pp:
                    precincts.append({'c': code, 'n': p['name'].title(), 'd': pp[code],
                                      'h': [p['history'].get(x, [0, 0, 0])[:2] for x in pdates], 'r': p['history'].get(pdates[-1], [0, 0, 0])[2]})
        if not precincts:
            precincts = [{'c': c, 'n': c, 'd': d, 'h': [[0, 0]], 'r': 0} for c, d in pp.items()]
            pdates = pdates or [as_of]
        approx = APPROX_SITES.get(lid, {})
        for st in sites:
            ll, flag = None, False
            low = st['name'].lower()
            if lid == 'fairfax-county':
                word = 'government center' if low.startswith('registrar') else low.split()[0].replace('center', 'centre')
                for kname, v in geocoded.items():
                    if kname.startswith(word) or (word == 'government center' and 'fairfax county government center' in kname):
                        ll = v; break
            elif st['name'] in approx:
                ll, flag = approx[st['name']], True
            if ll:
                x, y = P(ll[1], ll[0]); st['xy'] = [round(x, 1), round(y, 1)]; st['approx'] = flag
        elections = []
        for eid in ORDER:
            lh = loc_hist(eid, lid)
            if not lh:
                continue
            meta = election_meta(eid)
            last = lh['history'][-1]
            elections.append({'id': eid, 'label': meta['label'], 'type': meta['type'], 'date': meta['date'],
                              'reg': lh['registered'], 'early': last.get('early') or 0, 'mail': last.get('mail') or 0,
                              'total': tot(last), 'out': last.get('outstanding'), 'through': last['date'],
                              'atT': at_days_before(lh['history'], date(meta['date']), tdb),
                              'final': eid != LIVE, 'series': series(lh['history'], meta['date'], lh['registered'])})
        fx_mail = None
        if lid == 'fairfax-county':
            fx_mail = {}
            for y in ['2020', '2021', '2022', '2023', '2024', '2025', '2026']:
                hh = D.get('official', {}).get(y, {}).get('history')
                if hh:
                    c = hh[-1].get('cumulative') or {}
                    fx_mail[y] = {'through': hh[-1]['date'], 'sent': c.get('sent'), 'post': c.get('postal'), 'box': c.get('dropbox'), 'early': c.get('early')}
        n, nxt = sat_summary(lid, today)
        b = {'id': lid, 'name': l['name'], 'asOf': l['history'][-1]['date'], 'tIdx': 46 - tdb, 'region': NAMES[lid]['region'], 'reg': l['registered'], 'active': l.get('active'),
             'inactive': l.get('inactive'), 'rankV': by_total.index(l) + 1, 'rankP': by_pct.index(l) + 1,
             'rows': rows, 'sched': days_sched, 'officeKnown': office_known, 'sites': sites, 'sat': n, 'next': nxt, 'elections': elections, 'fxMail': fx_mail,
             'names': ALL_NAMES, 'mapH': ph, 'pdates': pdates, 'precincts': precincts, 'boundary': MANIFEST[lid].get('vintage')}
        (OUT / 'loc' / f'{lid}.json').write_text(json.dumps(b, separators=(',', ':')))
    print(f'Built {len(ORDER)} statewide bundles and {len(e26["localities"])} locality bundles in {OUT}')


if __name__ == '__main__':
    main()
