"""Add statewide DPW histories without rebuilding existing locality data."""
import csv,io,json,re,zipfile,urllib.request,subprocess
from pathlib import Path
from datetime import datetime,timedelta
from bs4 import BeautifulSoup
R=Path(__file__).parent; P=R/'sources/statewide'; D=R/'dist/region.json';data=json.loads(D.read_text())
URL='https://www.elections.virginia.gov/casting-a-ballot/early-voting-office-locations/'
soup=BeautifulSoup((P/'elect-locations.html').read_text(),'html.parser')
names={o['value']:o.text.replace('&','AND').title() for o in soup.select('#reg-office option') if o['value']}
assert len(names)==133
slug=lambda n:n.lower().replace(' ','-')
def number(v):return int(str(v or 0).replace(',',''))
regs={}
for y in [2023,2024,2025,2026]:
 p=R/f'sources/registration{y}.csv'
 if not p.exists():
  page=urllib.request.urlopen(f'https://www.elections.virginia.gov/resultsreports/registration-statistics/{y}-registration-statistics/').read().decode()
  link=next(x for x in re.findall(r'href="([^"]+)"',page) if f'Daily_Registrant_Count_By_Locality_{y}_11_01' in x)
  p.write_bytes(urllib.request.urlopen('https://www.elections.virginia.gov'+link).read())
  (P/f'registration{y}-source.txt').write_text('https://www.elections.virginia.gov'+link)
 regs[y]={}
 if p.read_bytes().startswith(b'%PDF'):
  text=subprocess.check_output(['pdftotext','-layout',str(p),'-']).decode();current=None
  for line in text.splitlines():
   m=re.search(r'Locality: \d+ (.+)',line)
   if m:current=m[1].strip().replace('&','AND').title()
   if '# of Precincts in the Locality:' in line:
    vals=re.search(r'# of Voters:\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)',line)
    assert vals,line
    a,i,total=map(number,vals.groups());assert a+i==total
    regs[y][current]={'active':a,'inactive':i,'registered':total,'registrationDate':f'{y}-11-01'}
 else:
  for r in csv.DictReader(p.open(encoding='utf-8-sig')):
   name=re.sub(r'^Locality: \d+ ','',r['Locality']).replace('&','AND').title();a=number(r['TotalActiveVotersPrecinctLocality']);i=number(r['TotalInActiveVotersPrecinctLocality']);total=number(r['TotalAllVotersPrecinctLocality']);assert a+i==total
   regs[y][name]={'active':a,'inactive':i,'registered':total,'registrationDate':f'{y}-09-01' if y==2026 else f'{y}-11-01'}
 assert len(regs[y])==133,(y,len(regs[y]))
archives={'2023':'metrics-2023.zip','2024':'metrics-2024.zip','2025':'metrics2025.zip','2026-special':'metrics-2026-special.zip','2026':'dpw-snapshots/2026-09-21-5317da9c06.zip'}
for k,zp in archives.items():
 e=data['elections'][k];saved={l['id'] for l in e['localities']};z=zipfile.ZipFile(R/'sources'/zp)
 for name in sorted(names.values()):
  id=slug(name)
  if id in saved:continue
  path=next(f for f in z.namelist() if f.startswith('byLOCALITY_NAME/'+name.upper()+'/') and f.endswith('.csv'))
  rows=[]
  for r in csv.DictReader(io.StringIO(z.read(path).decode('utf-8-sig'))):
   if r['FILEDATE']=='string':continue
   try:t=datetime.fromisoformat(r['FILEDATE'])
   except ValueError:t=datetime.strptime(r['FILEDATE'],'%d-%b-%Y %H:%M:%S')
   d=(t-timedelta(days=1)).date().isoformat();early=number(r['ON_MACHINE']);mail=number(r['MAIL_IN']);assert mail==number(r['MARKED'])+number(r['PRE_PROCESSED'])
   rows.append({'date':d,'activityDate':d,'reportDate':t.date().isoformat(),'timestamp':t.isoformat(),'early':early,'mail':mail,'total':early+mail,'outstanding':number(r['ISSUED']),'provisional':number(r['PROVISIONAL']),'fwab':number(r['FWAB'])})
  bydate={r['date']:r for r in sorted(rows,key=lambda r:r['timestamp'])}
  reg=regs[int(k[:4])][name].copy()
  if k=='2026-special':
   reg={'active':number(r['ACTIVE_VOTERS']),'inactive':number(r['INACTIVE_VOTERS']),'registrationDate':t.date().isoformat()};reg['registered']=reg['active']+reg['inactive']
  e['localities'].append({'id':id,'name':name,**reg,'history':list(bydate.values())})
 assert len(e['localities'])==133
 e['asOf']=min(l['history'][-1]['date'] for l in e['localities'])
# Broad editorial regions for browsing, not electoral districts.
groups={
'Northern Virginia':'Alexandria City|Arlington County|Fairfax City|Fairfax County|Falls Church City|Loudoun County|Manassas City|Manassas Park City|Prince William County',
'Eastern Shore':'Accomack County|Northampton County',
'Hampton Roads':'Chesapeake City|Hampton City|Newport News City|Norfolk City|Portsmouth City|Suffolk City|Virginia Beach City|Poquoson City|Williamsburg City|James City County|York County|Isle Of Wight County|Southampton County|Franklin City|Surry County|Gloucester County|Mathews County',
'Fredericksburg & Northern Neck':'Fredericksburg City|Stafford County|Spotsylvania County|Caroline County|King George County|Westmoreland County|Richmond County|Northumberland County|Lancaster County|Essex County|Middlesex County|King And Queen County|King William County',
'Northern Piedmont':'Fauquier County|Culpeper County|Rappahannock County|Madison County|Orange County|Greene County',
'Central Virginia':'Richmond City|Henrico County|Chesterfield County|Hanover County|Goochland County|Powhatan County|New Kent County|Charles City County|Louisa County|Fluvanna County|Albemarle County|Charlottesville City|Nelson County|Amherst County|Appomattox County|Buckingham County|Cumberland County|Lynchburg City|Bedford County|Campbell County',
'Shenandoah Valley':'Frederick County|Winchester City|Clarke County|Warren County|Shenandoah County|Page County|Rockingham County|Harrisonburg City|Augusta County|Staunton City|Waynesboro City|Rockbridge County|Lexington City|Buena Vista City|Highland County|Bath County|Alleghany County|Covington City',
'Southside':'Amelia County|Nottoway County|Prince Edward County|Lunenburg County|Charlotte County|Halifax County|Mecklenburg County|Brunswick County|Greensville County|Emporia City|Sussex County|Dinwiddie County|Prince George County|Petersburg City|Hopewell City|Colonial Heights City|Danville City|Pittsylvania County|Henry County|Martinsville City|Patrick County|Franklin County',
'Southwest Virginia':'Roanoke County|Roanoke City|Salem City|Botetourt County|Craig County|Montgomery County|Radford City|Pulaski County|Giles County|Floyd County|Carroll County|Galax City|Grayson County|Wythe County|Bland County|Smyth County|Washington County|Bristol City|Tazewell County|Russell County|Buchanan County|Dickenson County|Wise County|Norton City|Scott County|Lee County'
}
regions={slug(n):g for g,ns in groups.items() for n in ns.split('|')}
assert set(regions)=={slug(n) for n in names.values()},set(slug(n) for n in names.values())-set(regions)
data['names']=[{'id':slug(n),'name':n,'region':regions[slug(n)],'officeSource':'https://vote.elections.virginia.gov/VoterInformation/PublicContactLookup?LocalityUID='+uid} for uid,n in sorted(names.items(),key=lambda x:x[1])]
data['regionLabels']=list(groups)
# Preserve the state's complete text and opening dates, with explicit classification.
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
 locations[id]={'source':URL,'checked':'2026-09-23','sites':sites,'count':sum(s['satellite'] for s in sites),'replacementOffice':id in ['bedford-county','goochland-county','spotsylvania-county']}
for n in data['names']:
 locations.setdefault(n['id'],{'source':URL,'checked':'2026-09-23','sites':[],'count':0})
data['satellites']={'2026':locations}
D.write_text(json.dumps(data,separators=(',',':')))
(P/'satellite-inventory.json').write_text(json.dumps(locations,indent=2))
print('Expanded',[(k,len(e['localities'])) for k,e in data['elections'].items()]);print('Satellites',[(n['name'],locations[n['id']]['count']) for n in data['names'] if locations[n['id']]['count']])
