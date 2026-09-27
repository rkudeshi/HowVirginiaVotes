import json
from pathlib import Path
from datetime import date,timedelta
R=Path(__file__).parent;data=json.load(open(R/'dist/region.json'));c=data['calendars']
def dates(a,b):
 d=date.fromisoformat(a)
 while d<=date.fromisoformat(b):yield d;d+=timedelta(days=1)
# Falls Church, published November 2026 schedule.
h={}
for d in dates('2026-09-18','2026-10-31'):
 s=d.isoformat();b=['08:00','17:00'] if d.weekday()<5 and s!='2026-10-12' else None
 if s=='2026-10-29':b=['08:00','19:00']
 if s in ['2026-10-24','2026-10-31']:b=['09:00','17:00']
 if s=='2026-10-18':b=['11:00','16:00']
 if s=='2026-10-25':b=['12:00','15:00']
 if b:h[s]=b
c.setdefault('falls-church-city',{})['2026']={'source':'https://www.fallschurchva.gov/1970/Early-Voting','sites':[{'key':'city_hall','name':'Falls Church City Hall','address':'300 Park Ave, Falls Church, VA 22046'}],'hours':{'city_hall':h},'note':'Published November 2026 schedule; closed October 12. Hours are local time.'}
# Prince William published 2026 schedule.
sites=[{'key':'pwc_office','name':'Office of Elections','address':'9250 Lee Ave, Suite 1, Manassas, VA 20110'},{'key':'dmv_woodbridge','name':'DMV Woodbridge','address':'2731 Caton Hill Rd, Woodbridge, VA 22191'},{'key':'ferlazzo','name':'AJ Ferlazzo Building','address':'15941 Donald Curtis Dr, Woodbridge, VA 22191'},{'key':'brentsville','name':'Brentsville Courthouse','address':'12229 Bristow Rd, Bristow, VA 20136'},{'key':'dumfries','name':'Dumfries Community Center','address':'17757 Main St, Dumfries, VA 22026'},{'key':'haymarket','name':'Haymarket Gainesville Library','address':'14870 Lightner Rd, Haymarket, VA 20169'}];hh={}
for site in sites:
 h={}
 for d in dates('2026-09-18' if site['key'] in ['pwc_office','dmv_woodbridge'] else '2026-10-18','2026-10-31'):
  s=d.isoformat();b=['08:30','19:00' if d.weekday()==2 else '16:30'] if d.weekday()<5 else None
  if s in ['2026-10-18','2026-10-25']:b=['11:00','17:00']
  if s in ['2026-10-24','2026-10-31']:b=['08:30','17:00']
  if b:h[s]=b
 hh[site['key']]=h
c.setdefault('prince-william-county',{})['2026']={'sites':sites,'hours':hh,'source':'https://www.pwcvotes.org/earlyvoting','note':'Published November 2026 schedule. Two locations open September 18; all six open October 18. Hours are local time.'}
# Manassas page is explicitly for 2025. Do not relabel it 2026.
h={}
for d in dates('2025-09-19','2025-11-01'):
 s=d.isoformat();b=['08:30','17:00'] if d.weekday()<5 else None
 if s in ['2025-10-25','2025-11-01']:b=['09:00','17:00']
 if s=='2025-10-19':b=['11:00','17:00']
 if b:h[s]=b
c.setdefault('manassas-city',{})['2025']={'sites':[{'key':'manassas_office','name':'Voter Registration Office','address':'9025 Center Street, Manassas, VA 20110'}],'hours':{'manassas_office':h},'source':'https://www.manassasva.gov/voter_registration_and_elections/early_voting.php','note':'Published November 2025 schedule. Holiday exceptions not specified on the preserved page. Hours are local time.'}
(R/'dist/region.json').write_text(json.dumps(data,separators=(',',':')))
print('Added Falls Church and Prince William 2026, Manassas 2025 schedules')
