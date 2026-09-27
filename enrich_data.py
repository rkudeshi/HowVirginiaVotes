import json,csv,re,calendar
from datetime import date,datetime,timedelta
from pathlib import Path
R=Path(__file__).parent;D=R/'dist';data=json.load(open(D/'region.json'));calendars={}
def daterange(a,b):
 x=date.fromisoformat(a);z=date.fromisoformat(b)
 while x<=z:yield x;x+=timedelta(days=1)
# Repository schedules are applied only within documented site-operation windows.
# Blank count cells are not translated into closures; positive first/last reports bound a known site window.
for y in range(2020,2026):
 k=str(y);o=data['official'][k];sc=data['schedules'].get(f'fairfax-{y}-general');hours={};sites=[]
 if not sc:continue
 for key in o['siteKeys']:
  active=[r['date'] for r in o['history'] if (r['sites'].get(key) or 0)>0]
  if not active:continue
  sites.append(next((s for s in data['sites'] if s['key']==key),{'key':key,'name':key.replace('_',' ').title()}));hh={}
  for d in daterange(min(active),max(active)):
   ds=d.isoformat();matched=None
   for g in sc['groups']:
    if g['from']<=ds<=g['to'] and (g['sites']=='*' or key in g['sites']):matched=g
   if matched:
    typ='sat' if d.weekday()==5 else 'sun' if d.weekday()==6 else 'weekday';b=matched.get(typ)
    if b:hh[ds]=b
  hours[key]=hh
 calendars.setdefault('fairfax-county',{})[k]={'sites':sites,'hours':hours,'source':'https://github.com/rkudeshi/novavote/blob/main/data/site_schedules.json','note':'Historical schedule rules preserved in NovaVote, bounded by first and last reported activity at each site. Blank report cells are not proof of closure; unverified exceptions may remain.'}
# Current schedules transcribed from official locality pages retrieved September 2026.
keys=[s['key'] for s in data['sites'] if s['key'] not in ['providence','gerry_hyland','laurel_hill']]
keys=['government_center','mt_vernon','north_county','burke','centreville','franconia','great_falls','herndon_fortnightly','jim_scott','lorton','mason','mclean','sully','thomas_jefferson','tysons_pimmit','west_springfield']
sites=[dict(next(s for s in data['sites'] if s['key']==k)) for k in keys];hours={}
for s in sites:
 if s['key']=='franconia':s['address']='7130 Silver Lake Boulevard';s['lat']=None;s['lon']=None # moved location, old geocode must not be reused
 k=s['key'];hh={};first='2026-09-18' if k in keys[:3] else '2026-10-22'
 for d in daterange(first,'2026-10-31'):
  ds=d.isoformat();b=None
  if d.weekday()<5:b=['08:00','16:30'] if k=='government_center' else ['13:00','19:00']
  elif ds in ['2026-09-19','2026-10-24','2026-10-31']:b=['09:00','17:00']
  elif ds in ['2026-10-18','2026-10-25']:b=['12:00','17:00']
  if b:hh[ds]=b
 hours[k]=hh
calendars.setdefault('fairfax-county',{})['2026']={'sites':sites,'hours':hours,'source':'https://www.fairfaxcounty.gov/elections/early-voting','note':'Official November 2026 schedule. Three sites open September 18; 13 additional sites open October 22. Hours are local time. Franconia moved; its old map coordinate is omitted.'}
sites=[{'key':'leesburg','name':'Office of Elections, Leesburg','address':'750 Miller Drive, Suite 150, Leesburg, VA 20175'},{'key':'ashburn','name':'Ashburn Recreation and Community Center','address':'21105 Coopers Hawk Drive, Ashburn, VA 20148'},{'key':'sterling','name':'Claude Moore Recreation Center','address':'46105 Loudoun Park Lane, Sterling, VA 20164'},{'key':'dulles_south','name':'Dulles South Recreation Center','address':'24950 Riding Center Drive, Chantilly, VA 20152'}];hours={}
for s in sites:
 k=s['key'];hh={}
 for d in daterange('2026-09-18' if k=='leesburg' else '2026-10-18','2026-10-31'):
  ds=d.isoformat();b=None
  if k=='leesburg' and d.weekday()<5 and ds!='2026-10-12':b=['08:30','17:00']
  if ds>='2026-10-18':
   if d.weekday()==6:b=['11:00','16:00']
   elif d.weekday()==5:b=['09:00','17:00']
   elif d.weekday() in [1,3]:b=['08:30','19:00'] if k=='leesburg' else ['12:00','19:00']
   elif k!='leesburg':b=['10:00','17:00']
  if b:hh[ds]=b
 hours[k]=hh
calendars.setdefault('loudoun-county',{})['2026']={'sites':sites,'hours':hours,'source':'https://www.loudoun.gov/earlyvoting','note':'Official November 2026 schedule. Leesburg closes October 12; satellite locations open October 18. Hours are local time.'}
data['calendars']=calendars
# First local report is cumulative for mail channels, not a daily baseline.
r=data['official']['2026']['history'][0];r['postal']=r['dropbox']=r['sent']=None
# Keep the screenshot as its own report with explicit provenance.
data['official']['2026']['userReport']['note']='Screenshot names Ffx co / mt vernon / noco; totals 1,035 + 477 + 609 = 2,121. Interpreted as September 19, 2026 based on user description of yesterday, Saturday.'
data['elections']['2026-special']['registrationSource']=data['elections']['2026-special']['source']
# Independent official 2022 Loudoun endpoint, not a fabricated daily history.
early=json.load(open(R/'sources/maps/loudoun2022early.json'))['features'][0]['properties']['Total_Ballots_Cast'];mail=json.load(open(R/'sources/maps/loudoun2022mail.json'))['features'][0]['properties']['Total_Ballots_Cast']
data['historicalEndpoints']={'loudoun-county':{'2022':{'early':early,'mail':mail,'total':early+mail,'source':'https://services1.arcgis.com/MxjRokvPm7bjslyR/arcgis/rest/services/Election_Data_2022_11/FeatureServer','note':'Final official early/mail totals only; no daily trajectory recovered.'}}}
(D/'region.json').write_text(json.dumps(data,separators=(',',':')))
print('calendar counts',[(l,list(ys)) for l,ys in calendars.items()])
