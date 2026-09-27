"""Restore verified manual enrichments after an offline data rebuild."""
import json
from pathlib import Path
R=Path(__file__).parent;path=R/'dist/region.json';d=json.load(open(path));e=json.load(open(R/'sources/enrichment-verified.json'))
d['calendars']=e['calendars'];d['historicalEndpoints']=e['historicalEndpoints'];d['official']['2026']['extras']=e['official2026extras'];d['elections']['2026-special']['registrationSource']=d['elections']['2026-special']['source']
r=d['official']['2026']['history'][0];r['postal']=r['dropbox']=r['sent']=None
for y,o in d['official'].items():
 if y=='2026':continue
 l=next((l for l in d['elections'][y]['localities'] if l['id']=='fairfax-county'),None);c=o['history'][-1]['cumulative']
 if l:o['differenceFromDAL']={'early':c['early']-l['history'][-1]['early'],'mail':c['postal']+c['dropbox']-l['history'][-1]['mail']}
weather=R/'sources/weather-2026.json'
if weather.exists():d['weather'].update(json.loads(weather.read_text()))
summary=R/'sources/fairfax-2025-mail-summary.json'
if summary.exists():d['official']['2025']['extras']=json.loads(summary.read_text())
path.write_text(json.dumps(d,separators=(',',':')))
