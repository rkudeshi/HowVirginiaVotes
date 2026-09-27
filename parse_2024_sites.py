import pdfplumber,json,re
from pathlib import Path
from datetime import datetime
R=Path(__file__).parent
p=pdfplumber.open(R/'sources/imported/data/sources/nov2024.pdf');sites={};totals={};daily={}
def key(s):return re.sub(r'[^a-z]+','_',s.lower()).strip('_').replace('tysons_pimmit','tysons_pimmit')
def n(s):return int(s.replace(',','')) if s and s.strip() else None
for pi in [7,8,9,10,11]:
 t=p.pages[pi].extract_tables()[0];cols=[key(c or '') for c in t[0]][2:];rr=t[1:]
 if pi==11: # visually checked page 12: extraction split October 18 into two rows
  rr[0][0]='17-Oct';rr[0][1]='10,381';rr[1][0]='18-Oct';rr[1][1]='11,477';rr.pop(2)
 for r in rr:
  if r[0]=='Total':
   for k,v in zip(cols,r[2:]):totals[k]=n(v)
   continue
  if not re.match(r'^\d{1,2}-[A-Za-z]{3}$',r[0] or ''):continue
  d=datetime.strptime(r[0]+'-2024','%d-%b-%Y').date().isoformat();daily[d]=n(r[1]);s=sites.setdefault(d,{})
  for k,v in zip(cols,r[2:]):s[k]=n(v)
assert sum(totals.values())==239326
for k,total in totals.items():assert sum(s.get(k) or 0 for s in sites.values())==total,(k,total,sum(s.get(k) or 0 for s in sites.values()))
for d,s in sites.items():assert sum(v or 0 for v in s.values())==(daily[d] or 0),(d,daily[d],s)
data=json.load(open(R/'dist/region.json'));o=data['official']['2024'];o['siteKeys']=list(totals)
for r in o['history']:r['sites']={k:sites.get(r['date'],{}).get(k) for k in totals}
o['source']='https://github.com/rkudeshi/novavote/blob/main/data/sources/nov2024.pdf';(R/'dist/region.json').write_text(json.dumps(data,separators=(',',':')))
(R/'sources/fairfax-2024-sites-verified.json').write_text(json.dumps({'totals':totals,'sites':sites},indent=2));print('Validated all 16 site totals and daily totals:',sum(totals.values()))
