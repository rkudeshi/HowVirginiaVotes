"""Reproducible aggregate-only NovaVote build from preserved public source files."""
import json,csv,io,zipfile,re
from pathlib import Path
from datetime import datetime,date
R=Path(__file__).parent;P=R/'sources/imported/data';D=R/'dist'
base=json.loads((D/'region.json').read_text());regs=json.loads((P/'registration.json').read_text())['elections']
names=[l['name'] for l in base['elections']['2026']['localities']]
DATES={'2020':'2020-11-03','2021':'2021-11-02','2022':'2022-11-08','2023':'2023-11-07','2024':'2024-11-05','2025':'2025-11-04','2026':'2026-11-03','2026-special':'2026-04-21'}
def n(s):return int(float(str(s or '0').replace(',','')))
def rows(f):return list(csv.DictReader(f.open(encoding='utf-8-sig'))) if f.exists() else []
for k,folder,file in [('2023','2023_General_Election','2023-DAL-metrics.zip'),('2024','2024_November_General','2024_November_General-DAL-metrics.zip'),('2026-special','2026_April_21_Special','2026_April_21_Special-DAL-metrics.zip')]:
 z=zipfile.ZipFile(R/f'sources/metrics-{k}.zip');e={'year':int(k[:4]),'registrationDate':k[:4]+'-11-01' if k!='2026-special' else None,'source':f'https://digitalpollwatchers.org/files/DALTracker/{folder}/metrics/{file}','registrationSource':'https://github.com/rkudeshi/novavote/blob/main/data/registration.json','localities':[]}
 for name in names:
  fs=[p for p in z.namelist() if p.startswith('byLOCALITY_NAME/'+name.upper()+'/') and p.endswith('.csv')];assert len(fs)==1,(name,fs)
  days={}
  for r in list(csv.DictReader(io.StringIO(z.read(fs[0]).decode('utf-8-sig'))))[1:]:
   try:stamp=datetime.fromisoformat(r['FILEDATE'])
   except:stamp=datetime.strptime(r['FILEDATE'],'%d-%b-%Y %H:%M:%S')
   row={'date':stamp.date().isoformat(),'timestamp':stamp.isoformat(),'early':n(r['ON_MACHINE']),'mail':n(r['MAIL_IN']),'outstanding':n(r['ISSUED'])};row['total']=row['early']+row['mail'];days[row['date']]=row
  if k=='2026-special':
   rr={'active':n(r.get('ACTIVE_VOTERS')),'registered':n(r.get('ACTIVE_VOTERS'))+n(r.get('INACTIVE_VOTERS'))};rd=stamp.date().isoformat()
  else:rr=regs[DATES[k]][name];rd=e['registrationDate']
  e['localities'].append({'id':name.lower().replace(' ','-'),'name':name,**rr,'registrationDate':rd,'history':sorted(days.values(),key=lambda x:x['date'])})
 e['asOf']=min(l['history'][-1]['date'] for l in e['localities']);base['elections'][k]=e
base['sites']=json.loads((P/'site_locations.json').read_text())['sites'];base['schedules']=json.loads((P/'site_schedules.json').read_text())['cycles'];base['weather']=json.loads((P/'weather.json').read_text())['cycles'];base['official']={}
for y in range(2020,2026):
 k=str(y);p=P if y==2025 else P/'parsed';prefix='' if y==2025 else f'fairfax-{y}-general_'
 files={'early':('early_in_person_by_site','total'),'postal':('returned_by_mail','total_returned'),'dropbox':('returned_by_dropbox','total_returned_dropbox'),'sent':('mailed_absentee_ballots','total_mailed')};by={};keys=[]
 for metric,(stem,col) in files.items():
  rr=rows(p/(prefix+stem+'.csv'))
  if metric=='early' and rr:keys=[x for x in rr[0] if x not in ['date','total']]
  for r in rr:
   if not re.match(r'^\d{4}-\d{2}-\d{2}$',r['date']):continue
   d=by.setdefault(r['date'],{'date':r['date'],'sites':{}});d[metric]=n(r[col]) if r.get(col)!='' else None
   if metric=='early':d['sites']={s:n(r[s]) if r[s]!='' else None for s in keys}
 history=[];tot={x:0 for x in files}
 for day,r in sorted(by.items()):
  for m in tot:tot[m]+=r.get(m) or 0
  history.append({**r,'cumulative':dict(tot)})
 base['official'][k]={'history':history,'siteKeys':keys,'source':'https://github.com/rkudeshi/novavote/tree/main/data','note':'Fairfax County daily report, preserved and parsed in NovaVote repository.'}
 if y<=2022:
  rr=regs[DATES[k]]['Fairfax County'];h=[{'date':r['date'],'early':r['cumulative']['early'],'mail':r['cumulative']['postal']+r['cumulative']['dropbox'],'total':r['cumulative']['early']+r['cumulative']['postal']+r['cumulative']['dropbox'],'outstanding':None} for r in history]
  base['elections'][k]={'year':y,'asOf':h[-1]['date'],'registrationDate':f'{y}-11-01','registrationSource':'https://github.com/rkudeshi/novavote/blob/main/data/registration.json','source':'https://github.com/rkudeshi/novavote/tree/main/data/sources','localities':[{'id':'fairfax-county','name':'Fairfax County',**rr,'history':h}]}
base['official']['2026']={'source':base['fairfaxOfficial']['url'],'siteKeys':['government_center','mt_vernon','north_county'],'history':[{'date':'2026-09-18','early':2408,'postal':4294,'dropbox':532,'sent':75913,'sites':{'government_center':1338,'mt_vernon':457,'north_county':613},'cumulative':{'early':2408,'postal':4294,'dropbox':532,'sent':75913}}], 'userReport':{'date':'2026-09-19','early':2121,'sites':{'government_center':1035,'mt_vernon':477,'north_county':609},'source':'User-provided message screenshot; preliminary, not added to official totals.'}}
for k,e in base['elections'].items():
 e['electionDate']=DATES[k];e['label']=('April 2026 special' if k=='2026-special' else 'November '+k);e['type']='Special' if k=='2026-special' else ('Presidential' if k in ['2020','2024'] else 'Midterm' if k in ['2022','2026'] else 'State / local')
 for l in e['localities']:l.setdefault('registrationDate',e.get('registrationDate'))
base['names']=[{'id':x.lower().replace(' ','-'),'name':x} for x in names]
(D/'region.json').write_text(json.dumps(base,separators=(',',':')))
print('Elections',[(k,len(v['localities'])) for k,v in base['elections'].items()]);print('official',[(k,len(v['history']),len(v['siteKeys'])) for k,v in base['official'].items()])
