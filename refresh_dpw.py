"""Incrementally refresh aggregate 2026 DPW histories; never rebuild historical data.
Run: python refresh_dpw.py [--zip PATH]. Downloads public aggregate metrics only.
All input is validated before replacing files. Existing days and corrections are
retained in Git; absent upstream dates do not delete saved observations.
"""
import argparse,csv,io,json,re,zipfile,urllib.request,hashlib
from pathlib import Path
from datetime import datetime,timedelta
ROOT=Path(__file__).resolve().parent
URL='https://digitalpollwatchers.org/files/DALTracker/2026_November_General/metrics/2026_November_General-DAL-metrics.zip'
def stamp(s):
 try:return datetime.fromisoformat(s)
 except ValueError:return datetime.strptime(s,'%d-%b-%Y %H:%M:%S')
def number(r,k):
 value=r[k].strip().replace(',','')
 if not value:raise ValueError('Missing '+k)
 n=int(value)
 if n<0:raise ValueError('Negative '+k)
 return n
def read_rows(z,p):
 out={}
 for r in csv.DictReader(io.StringIO(z.read(p).decode('utf-8-sig'))):
  if r['FILEDATE']=='string':continue
  t=stamp(r['FILEDATE']);report_date=t.date();activity_date=report_date-timedelta(days=1);d=activity_date.isoformat()
  assert 2026==t.year and d<='2026-12-31'
  assert number(r,'MAIL_IN')==number(r,'MARKED')+number(r,'PRE_PROCESSED')
  if d not in out or t>out[d][0]:out[d]=(t,r)
 if not out:raise ValueError('Empty metrics file: '+p)
 return out

def main():
 a=argparse.ArgumentParser();a.add_argument('--zip',type=Path);args=a.parse_args()
 raw=args.zip.read_bytes() if args.zip else urllib.request.urlopen(URL,timeout=90).read()
 z=zipfile.ZipFile(io.BytesIO(raw));p=ROOT/'dist/region.json';base=json.loads(p.read_text());e=base['elections']['2026'];changes=[];prepared={}
 for l in e['localities']:
  prefix='byLOCALITY_NAME/'+l['name'].upper()+'/'
  matches=[p for p in z.namelist() if p.startswith(prefix) and p.endswith('.csv')]
  assert len(matches)==1,(l['id'],matches)
  incoming=read_rows(z,matches[0]);days={r['date']:r for r in l['history']}
  # Locality dashboards contribute site rows only. Remove aggregate rows they
  # previously normalized so the DAL series is the single non-Fairfax source.
  if l['id']!='fairfax-county':
   days={d:r for d,r in days.items() if not r.get('source')}
  # Migrate the earlier importer, which used FILEDATE as the activity date.
  # Every 5 AM snapshot reports cumulative activity through the prior day.
  report_dates={t.date().isoformat() for t,_ in incoming.values()}
  days={d:r for d,r in days.items() if r.get('source') or r.get('reportDate') or d not in report_dates}
  # A site dashboard may already contain a newer site-level activity date than
  # DPW. Merge every DPW aggregate date that is present; dashboards are not an
  # alternate countywide source. Fairfax's separate PDF series remains
  # authoritative at display time for every field/date it supplies.
  for d,(t,r) in incoming.items():
   v={'date':d,'timestamp':t.isoformat(),'activityDate':d,'reportDate':t.date().isoformat(),'early':number(r,'ON_MACHINE'),'mail':number(r,'MAIL_IN'),'outstanding':number(r,'ISSUED'),'provisional':number(r,'PROVISIONAL'),'fwab':number(r,'FWAB')};v['total']=v['early']+v['mail']
   if days.get(d)!=v:changes.append([l['id'],d])
   days[d]=v
  l['history']=[days[d] for d in sorted(days)]
  # Keep the previously vetted precinct ID/name joins and denominators.
  pp=ROOT/'dist/precinct-data'/('2026-'+l['id']+'.json')
  if not pp.exists():continue
  pd=json.loads(pp.read_text());prefix='byLOCALITY_PRECINCT_NAME/'+l['name'].upper()+' '
  candidates={}
  for f in z.namelist():
   if not f.startswith(prefix) or not f.endswith('.csv'):continue
   m=re.match(r'(\d+)\s*-\s*(.*)',f.split('/')[1][len(l['name'])+1:])
   if m:candidates.setdefault(str(int(m[1])),[]).append((m[2],f))
  for code,saved in pd['precincts'].items():
   matches=[f for name,f in candidates.get(code,[]) if name==saved['name']]
   if len(matches)!=1:continue
   precinct_incoming=read_rows(z,matches[0])
   fixed_registered=next((v[2] for _,v in sorted(saved['history'].items()) if v[2]),None)
   precinct_report_dates={t.date().isoformat() for t,_ in precinct_incoming.values()}
   saved['history']={d:v for d,v in saved['history'].items() if d not in precinct_report_dates}
   for d,(t,r) in precinct_incoming.items():
    saved['history'][d]=[number(r,'ON_MACHINE'),number(r,'MAIL_IN'),fixed_registered or number(r,'ACTIVE_VOTERS')+number(r,'INACTIVE_VOTERS')]
   saved['history']=dict(sorted(saved['history'].items()))
  pd['dates']=sorted(set(d for v in pd['precincts'].values() for d in v['history']))
  prepared[pp]=json.dumps(pd,separators=(',',':'))
 e['asOf']=min(l['history'][-1]['date'] for l in e['localities'])
 e['reportDate']=min(l['history'][-1].get('reportDate',l['history'][-1]['date']) for l in e['localities'])
 e['source']=URL
 prepared[p]=json.dumps(base,separators=(',',':'))
 changed=0
 for path,content in prepared.items():
  if path.read_text()!=content:
   temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(content);temp.replace(path);changed+=1
 if changed:
  archive=ROOT/'sources/dpw-snapshots';archive.mkdir(exist_ok=True)
  (archive/(e['asOf']+'-'+hashlib.sha256(raw).hexdigest()[:10]+'.zip')).write_bytes(raw)
 if changed:
  from status_log import record
  record('Digital Poll Watchers',f'Loaded absentee voting data for {len(e["localities"])} localities and updated matched precinct histories.',e['asOf'],URL)
 print(json.dumps({'changedFiles':changed,'reportDate':e['asOf'],'changedLocalityDays':changes}))
if __name__=='__main__':main()
