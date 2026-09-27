"""Validate aggregate invariants without requiring network access."""
import json
from pathlib import Path
r=Path(__file__).resolve().parent/'dist';d=json.loads((r/'region.json').read_text())
for y,e in d['elections'].items():
 for l in e['localities']:
  h=l['history'];assert [v['date'] for v in h]==sorted(set(v['date'] for v in h)),(y,l['id'])
  for v in h:assert v['total']==v['early']+v['mail'],(y,l['id'],v['date'])
for id,ys in d.get('siteReports',{}).items():
 for y,o in ys.items():
  assert o['source'] and o['siteKeys']
  for v in o['history']:
   assert sum(n for n in v['sites'].values() if n is not None)==v['early']
   assert set(v['sites'])<=set(o['siteKeys'])
   if 'countyCumulative' in v:assert v['early']<=v['countyCumulative']
for p in (r/'precinct-data').glob('2026-*.json'):
 x=json.loads(p.read_text());assert x['dates']==sorted(set(x['dates']))
 for pr in x['precincts'].values():
  for day,v in pr['history'].items():assert day in x['dates'] and len(v)==3 and all(n>=0 for n in v)
print('PASS aggregate totals, site coverage, daily ordering, and current precinct records')
