import json,zipfile,csv,io,re,datetime,pathlib,shutil
root=pathlib.Path(__file__).parent
raw=json.load(open(root/'sources/precincts-full.geojson'))
# Preserve county coordinates exactly, dropping only irrelevant attributes.
for f in raw['features']:
 f['properties']={k:f['properties'][k] for k in ['PREC_IDENT','PREC_NAME','DISTRICT']};f['id']=f['properties']['PREC_IDENT']
(root/'sources/precincts-full.geojson').write_text(json.dumps(raw,separators=(',',':')))
(root/'dist/precincts.geojson').write_text(json.dumps(raw,separators=(',',':')))
norm=lambda s:re.sub('[^A-Z0-9]','',s.upper());canon={norm(str(f['properties']['PREC_IDENT'])+f['properties']['PREC_NAME']):f['properties']['PREC_IDENT'] for f in raw['features']}
z=zipfile.ZipFile(root/'sources/metrics2025.zip');h={};keys=['ON_MACHINE','MAIL_IN','PROVISIONAL','FWAB','ISSUED'];unmatched=[]
def records(p):
 out={}
 for r in list(csv.DictReader(io.StringIO(z.read(p).decode())))[1:]:
  date=datetime.datetime.strptime(r['FILEDATE'],'%d-%b-%Y %H:%M:%S').date().isoformat();out[date]={k:int(r[k]) for k in keys};out[date]['ACTIVE_VOTERS']=None;out[date]['INACTIVE_VOTERS']=None
 return out
for p in z.namelist():
 if p.startswith('byLOCALITY_PRECINCT_NAME/FAIRFAX COUNTY ') and p.endswith('.csv'):
  label=p.split('/')[1].removeprefix('FAIRFAX COUNTY ')
  if norm(label) in canon:h[str(canon[norm(label)])]=records(p)
  else:unmatched.append(records(p))
p=next(p for p in z.namelist() if p.startswith('byLOCALITY_NAME/FAIRFAX COUNTY/') and p.endswith('.csv'));county=records(p);dates=sorted(county);unmapped={}
for day in dates:
 unmapped[day]={k:county[day][k]-sum(v[day][k] for v in h.values()) for k in keys}
 for k in keys:assert unmapped[day][k]==sum(v.get(day,{}).get(k,0) for v in unmatched),(day,k)
assert len(h)==265
out={'year':2025,'dates':dates,'history':h,'county':county,'unmapped':unmapped,'hasRegistration':False,'source':'https://digitalpollwatchers.org/files/DALTracker/2025_November_General/metrics/','retrieved':'2026-09-20'}
(root/'dist/history2025.json').write_text(json.dumps(out,separators=(',',':')))
p=root/'dist/history.json';d=json.loads(p.read_text());d.update(year=2026,hasRegistration=True);p.write_text(json.dumps(d,separators=(',',':')))
print('2025 validated',len(h),'precincts',len(dates),'dates; final unmapped',unmapped[dates[-1]])
