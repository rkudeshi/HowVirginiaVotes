"""Import the verified September 19 Arlington public Power BI snapshot.
The workbook retained 2024 column names while its visible calendar was relabeled
2026. The date mapping was checked against calendar labels and page election title.
Only dates through the source's reporting cutoff are imported, never future zeros.
"""
import json
from pathlib import Path
R=Path(__file__).resolve().parent;S=R/'sources/site-audit'
cols=json.loads((S/'arlington-query-columns.json').read_text());mapping=json.loads((S/'arlington-date-map.json').read_text())
assert mapping['9/20/2024']=='2026-09-18'
data=json.loads((S/'arlington-daily-query.json').read_text())['results'][0]['result']['data']['dsr']['DS'][0]
rows=data['PH'][0]['DM0'];schema=rows[0]['S'];prev=[None]*len(cols);decoded=[]
for row in rows:
 values=iter(row.get('C',[]));current=[]
 for i,col in enumerate(cols):
  if row.get('R',0)&(1<<i):v=prev[i]
  elif row.get('Ø',0)&(1<<i):v=None
  else:v=next(values)
  current.append(v)
 prev=current
 decoded.append({col:(data['ValueDicts'][schema[i]['DN']][current[i]] if current[i] is not None and 'DN' in schema[i] else current[i]) for i,col in enumerate(cols)})
keys={'EV1 - Courthouse':'courthouse','EV2 - Langston Brown':'langston_brown','EV3 - Walter Reed':'walter_reed'}
# Long Bridge is an unused template row, not a location in the official 2026 schedule.
assert next(r for r in decoded if r['Site']=='EV4 - Long Bridge')['Total']==0
sites={keys[r['Site']]:r['9/20/2024'] for r in decoded if r['Site'] in keys}
assert sum(sites.values())==next(r for r in decoded if r['Site']=='Total')['Total']==808
p=R/'dist/region.json';d=json.loads(p.read_text());d.setdefault('siteReports',{}).setdefault('arlington-county',{})['2026']={'source':'https://vote.arlingtonva.gov/Elections/Results-Data','siteKeys':list(keys.values()),'coverageStart':'2026-09-18','history':[{'date':'2026-09-18','early':808,'sites':sites,'reportedAt':'2026-09-19T12:45:05.860Z'}]}
p.write_text(json.dumps(d,separators=(',',':')));print(sites)
(S/'arlington-decoded.json').write_text(json.dumps(decoded,indent=2))
