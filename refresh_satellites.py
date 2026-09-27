"""Refresh official November 2026 satellite inventory; do not touch vote counts."""
import json,re,hashlib,urllib.request
from pathlib import Path
from bs4 import BeautifulSoup
R=Path(__file__).parent;D=R/'dist/region.json';P=R/'sources/statewide'
URL='https://www.elections.virginia.gov/casting-a-ballot/early-voting-office-locations/'
raw=urllib.request.urlopen(URL,timeout=60).read()
soup=BeautifulSoup(raw,'html.parser')
assert 'Nov. 3' in soup.get_text() and 'Sept. 18' in soup.get_text(), 'Unrecognized election schedule; review before ingesting'
names={o['value']:o.text.replace('&','AND').title() for o in soup.select('#reg-office option') if o['value']}
assert len(names)==133
slug=lambda n:n.lower().replace(' ','-')
data=json.loads(D.read_text());before=json.dumps(data,separators=(',',':'))
locations={}
for div in soup.select('.sat-info'):
 name=names[div['id'][1:]];id=slug(name);sites=[];start='2026-09-18'
 for el in div.find_all(['h3','h4']):
  text=el.get_text(' ',strip=True)
  if el.name=='h3':
   m=re.search(r'(Sept|Oct)\. (\d+)',text);assert m,text;start=f'2026-{9 if m[1]=="Sept" else 10:02d}-{int(m[2]):02d}';continue
  rules=[li.get_text(' ',strip=True) for li in el.find_next_sibling('ul').find_all('li')]
  nm,addr=re.split(r' [–-] ',text,maxsplit=1)
  opening=start
  # Without a recurring weekday rule, first explicit date is the first opening.
  if not any(re.match(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)',x) for x in rules):
   m=re.search(r'Oct\. (\d+)',rules[0]);opening=f'2026-10-{int(m[1]):02d}'
  if id=='newport-news-city' and 'Fountain' in nm:opening='2026-09-22'
  if id=='nottoway-county':opening='2026-09-22' # first Tuesday in stated Tue/Thu schedule
  main='registrar' in nm.lower() or (id=='chesterfield-county' and nm=='Central Library') or id in ['bedford-county','goochland-county','spotsylvania-county']
  sites.append({'name':nm,'address':addr,'firstOpen':opening,'satellite':not main,'rules':rules})
 locations[id]={'source':URL,'sites':sites,'count':sum(s['satellite'] for s in sites),'replacementOffice':id in ['bedford-county','goochland-county','spotsylvania-county']}
for n in data['names']:
 locations.setdefault(n['id'],{'source':URL,'sites':[],'count':0})
data['satellites']={'2026':locations}
after=json.dumps(data,separators=(',',':'))
if before!=after:
 D.write_text(after)
 P.mkdir(exist_ok=True)
 (P/('elect-locations-'+hashlib.sha256(raw).hexdigest()[:12]+'.html')).write_bytes(raw)
 (P/'satellite-inventory.json').write_text(json.dumps(locations,indent=2))
if before!=after:
 from status_log import record
 record('Virginia ELECT','Updated satellite locations and opening schedules.',url=URL)
print(json.dumps({'changed':before!=after,'multiSiteLocalities':sum(x['count']>0 for x in locations.values())}))
