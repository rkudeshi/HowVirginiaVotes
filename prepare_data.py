import zipfile,csv,io,json,re,pathlib,urllib.request,datetime
root=pathlib.Path(__file__).parent;parent=root/'sources'
z=zipfile.ZipFile(parent/'metrics.zip');geo=json.load(open(parent/'precincts-full.geojson'));norm=lambda s:re.sub('[^A-Z0-9]','',s.upper())
canon={norm(str(f['properties']['PREC_IDENT'])+f['properties']['PREC_NAME']):f['properties']['PREC_IDENT'] for f in geo['features']};history={};dates=set();keys=['ON_MACHINE','MAIL_IN','PROVISIONAL','FWAB','ISSUED','ACTIVE_VOTERS','INACTIVE_VOTERS']
for p in z.namelist():
 if not(p.startswith('byLOCALITY_PRECINCT_NAME/FAIRFAX COUNTY ') and p.endswith('.csv')):continue
 label=p.split('/')[1].removeprefix('FAIRFAX COUNTY ')
 if norm(label) not in canon:continue
 ident=canon[norm(label)];history[ident]={}
 for row in list(csv.DictReader(io.StringIO(z.read(p).decode())))[1:]:
  date=row['FILEDATE'][:10];dates.add(date);history[ident][date]={k:int(row[k]) for k in keys};history[ident][date]['sourceTimestamp']=row['FILEDATE']
localpath=next(p for p in z.namelist() if p.startswith('byLOCALITY_NAME/FAIRFAX COUNTY/') and p.endswith('.csv'))
localrows=list(csv.DictReader(io.StringIO(z.read(localpath).decode())))[1:]
for r in localrows:
 date=r['FILEDATE'][:10]
 for k in keys: assert sum(h[date][k] for h in history.values())==int(r[k]),(date,k)
assert len(history)==265
(root/'dist/precincts.geojson').write_text(json.dumps(geo,separators=(',',':')))
(root/'dist/history.json').write_text(json.dumps({'year':2026,'hasRegistration':True,'dates':sorted(dates),'history':history,'source':'https://digitalpollwatchers.org/2026-va-november-general-election-dal-file-metrics/','retrieved':'2026-09-20','statewideRegisteredPrecinctEntries':2521},separators=(',',':')))
(root/'dist/d3.min.js').write_bytes(urllib.request.urlopen('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js').read())
print('Validated every snapshot against locality totals; saved',len(dates),'dates and',len(history),'precinct histories')
