"""Build the nine-locality dataset from preserved source snapshots.
Refresh source ZIPs separately before running. No voter-level records are used.
"""
import csv,io,json,zipfile,re
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).parent
NAMES=['Alexandria City','Arlington County','Fairfax City','Fairfax County','Falls Church City','Loudoun County','Manassas City','Manassas Park City','Prince William County']
REG={2025:('2025-11-01','https://www.elections.virginia.gov/media/registration-statistics/2025/10/csv/Daily_Registrant_Count_By_Locality_2025_11_01_053246.csv'),2026:('2026-09-01','https://www.elections.virginia.gov/media/registration-statistics/2026/08/csv/Daily_Registrant_Count_By_Locality_2026_09_01_053022.csv')}
def n(s):return int(str(s or '0').replace(',',''))
output={'elections':{}}
for year,zname in [(2025,'metrics2025.zip'),(2026,'metrics.zip')]:
 regs={}
 for r in csv.DictReader((ROOT/'sources'/f'registration{year}.csv').open(encoding='utf-8-sig')):
  name=re.sub(r'^Locality: \d+ ','',r['Locality'])
  vals=[n(r[k]) for k in ['TotalActiveVotersPrecinctLocality','TotalInActiveVotersPrecinctLocality','TotalAllVotersPrecinctLocality']]
  assert vals[0]+vals[1]==vals[2]
  if name in regs:assert regs[name]==vals
  regs[name]=vals
 z=zipfile.ZipFile(ROOT/'sources'/zname)
 election={'year':year,'registrationDate':REG[year][0],'registrationSource':REG[year][1],'source':f'https://digitalpollwatchers.org/files/DALTracker/{year}_November_General/metrics/{year}_November_General-DAL-metrics.zip','localities':[]}
 for name in NAMES:
  matches=[p for p in z.namelist() if p.startswith('byLOCALITY_NAME/'+name.upper()+'/') and p.endswith('.csv')];assert len(matches)==1,(name,matches)
  records=list(csv.DictReader(io.StringIO(z.read(matches[0]).decode('utf-8-sig'))))[1:]
  days={}
  for r in records:
   stamp=datetime.fromisoformat(r['FILEDATE']) if year==2026 else datetime.strptime(r['FILEDATE'],'%d-%b-%Y %H:%M:%S')
   day=stamp.date().isoformat()
   row={'date':day,'timestamp':stamp.isoformat(),'early':n(r['ON_MACHINE']),'mail':n(r['MAIL_IN']),'outstanding':n(r['ISSUED']),'provisional':n(r['PROVISIONAL']),'fwab':n(r['FWAB'])}
   assert row['mail']==n(r['MARKED'])+n(r['PRE_PROCESSED'])
   row['total']=row['early']+row['mail']
   if day not in days or row['timestamp']>days[day]['timestamp']:days[day]=row
  a,i,total=regs[name.upper()]
  locality={'id':name.lower().replace(' ','-'),'name':name,'registered':total,'active':a,'inactive':i,'history':sorted(days.values(),key=lambda r:r['date'])}
  election['localities'].append(locality)
  print(year,name,total,len(days),locality['history'][-1]['total'])
 dates=set.intersection(*(set(r['date'] for r in l['history']) for l in election['localities']))
 election['asOf']=max(dates)
 output['elections'][str(year)]=election
output['fairfaxOfficial']={'date':'2026-09-19','registered':820199,'sent':75913,'postal':4294,'dropbox':532,'early':2408,'returned':4826,'total':7234,'switched':73,'url':'https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/AB%20Daily%20Report/AB%20Daily%20Report%20-%20Nov%203%202026%20-%2009192026.pdf'}
(ROOT/'dist'/'region.json').write_text(json.dumps(output,separators=(',',':')))
