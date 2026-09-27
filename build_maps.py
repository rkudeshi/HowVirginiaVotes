import json,pathlib,re,zipfile,csv,io
from datetime import datetime
R=pathlib.Path(__file__).parent;D=R/'dist';M=R/'sources/maps';(D/'maps').mkdir(exist_ok=True);(D/'precinct-data').mkdir(exist_ok=True)
base=json.load(open(D/'region.json'));manifest={}
registration={}
for r in csv.DictReader(open(R/'sources/registration2026.csv',encoding='utf-8-sig')):
 if not r['PrecinctCode'].isdigit():continue
 name=re.sub(r'^Locality: \d+ ','',r['Locality']);code=str(int(r['PrecinctCode']));registration.setdefault(name,{})[code]=re.sub(r'^\d+\s*-\s*','',r['PrecinctName']).strip()
fields={'fairfax-county':('PREC_IDENT','PREC_NAME'),'alexandria-city':('PRECINCTID','PRECINCT'),'arlington-county':('PRECINCT','PREC_NAME'),'fairfax-city':('PRECINCT','NAME'),'falls-church-city':('PropWard11',None),'loudoun-county':('PR_NUMBER','PR_NAME'),'manassas-city':('Dist_Num','Dist_Name'),'manassas-park-city':('Voting_Dist',None),'prince-william-county':('PrecinctDistrict','PrecinctDistrictName')}
services=json.load(open(R/'sources/map-services.json'));services.update({'arlington-county':'https://arlgis.arlingtonva.us/arcgis/rest/services/Open_Data/od_Voter_Precinct_Polygons/FeatureServer/0','manassas-city':'https://services1.arcgis.com/3wpOgOChiWXPeFWB/arcgis/rest/services/Voting_Districts_Updated/FeatureServer/0','fairfax-county':'https://data-fairfaxcountygis.opendata.arcgis.com/'})
def simple(src,k,fs):
 g=json.load(open(src));out=[]
 for f in g.get('features',[]):
  p=f['properties'];v=str(p.get(fs[0],''));match=re.search(r'\d+',v)
  if not match:continue
  code=str(int(match.group()));name=str(p.get(fs[1]) or ('Precinct '+code))
  if k=='manassas-city':
   clean=name.upper().replace(' ELEMENTARY','').replace(' MIDDLE','');found=[c for c,n in registration.get('MANASSAS CITY',{}).items() if n==clean]
   if len(found)==1:code=found[0]
  canonical=registration.get(k.replace('-',' ').upper(),{}).get(code)
  if canonical:name=canonical
  out.append({'type':'Feature','properties':{'code':code,'name':name},'geometry':f['geometry']})
 return {'type':'FeatureCollection','features':out}
for l in base['names']:
 k=l['id'];src=D/'precincts.geojson' if k=='fairfax-county' else M/(k+'.json');vintage='Current published layer, retrieved September 2026';fs=fields[k];source=services.get(k,'')
 if not src.exists() and k=='prince-william-county':src=M/'pwc2022.json';fs=('PRECINCT_D',None);vintage='2022 published boundaries; current version not verified';source='https://services2.arcgis.com/0Q7l03Ls62VG0fy4/arcgis/rest/services/Voting_Precincts_2022/FeatureServer'
 if not src.exists():continue
 g=simple(src,k,fs)
 if not g['features']:continue
 (D/'maps'/f'{k}.json').write_text(json.dumps(g,separators=(',',':')));manifest[k]={'file':f'maps/{k}.json','source':source,'vintage':vintage,'count':len(g['features']),'historical':{}}
 if k=='loudoun-county':
  for y in ['2023','2024','2025']:
   src=M/f'loudoun{y}map.json';h=simple(src,k,('PR_NUMBER','PR_NAME'))
   if h['features']:
    file=f'maps/loudoun-{y}.json';(D/file).write_text(json.dumps(h,separators=(',',':')));manifest[k]['historical'][y]={'file':file,'vintage':f'{y} official election precinct layer','source':f'https://services1.arcgis.com/MxjRokvPm7bjslyR/arcgis/rest/services/Election_Data_{y}_11/FeatureServer'}
g=json.load(open(M/'regional.json'))
for f in g['features']:
 name=f['properties']['NAMELSAD'];f['properties']={'name':name,'id':name.lower().replace(' ','-')}
(D/'regional.geojson').write_text(json.dumps(g,separators=(',',':')))
# Match precinct IDs AND names. Ignore ambiguous same-number records imported from other localities.
def norm(s):return re.sub('[^A-Z0-9]','',s.upper().replace('SAINT','ST'))
roman={'1':'ONE','2':'TWO','3':'THREE','4':'FOUR','5':'FIVE','6':'SIX'}
for year,zfile in [('2026','metrics.zip'),('2025','metrics2025.zip'),('2024','metrics-2024.zip'),('2023','metrics-2023.zip'),('2026-special','metrics-2026-special.zip')]:
 z=zipfile.ZipFile(R/'sources'/zfile)
 for l in base['names']:
  k=l['id']
  if k not in manifest:continue
  info=manifest[k]['historical'].get(year,manifest[k]);g=json.load(open(D/info['file']));features={f['properties']['code']:f['properties'] for f in g['features']};candidates={};unmatched=[]
  for p in z.namelist():
   pre='byLOCALITY_PRECINCT_NAME/'+l['name'].upper()+' '
   if not p.startswith(pre) or not p.endswith('.csv'):continue
   s=p.split('/')[1][len(l['name'])+1:];m=re.match(r'(\d+)\s*-\s*(.*)',s)
   if not m:continue
   code=str(int(m[1]));name=m[2];rs=list(csv.DictReader(io.StringIO(z.read(p).decode('utf-8-sig'))))[1:];h={}
   if not rs or 'FILEDATE' not in rs[0]:continue
   for r in rs:
    try:t=datetime.fromisoformat(r['FILEDATE'])
    except:t=datetime.strptime(r['FILEDATE'],'%d-%b-%Y %H:%M:%S')
    def n(key):return int(float(r.get(key) or 0))
    h[t.date().isoformat()]=[n('ON_MACHINE'),n('MAIL_IN'),n('ACTIVE_VOTERS')+n('INACTIVE_VOTERS')]
   if code not in features:unmatched.append({'name':s,'total':sum(list(h.values())[-1][:2])});continue
   expected=features[code]['name'];ok=norm(name)==norm(expected)
   if k=='fairfax-city':ok=norm(name)==roman.get(code,'')
   if k=='falls-church-city':ok=norm(name)=={'1':'FIRSTWARD','2':'SECONDWARD','3':'THIRDWARD'}.get(code,'')
   if k=='manassas-park-city':ok=norm(name)=='PRECINCT'+roman.get(code,'')
   
   candidates.setdefault(code,[]).append({'name':name,'history':h,'ok':ok})
  matched={}
  for code,cc in candidates.items():
   valid=[c for c in cc if c['ok']]
   if len(valid)==1:matched[code]=valid[0]
   elif len(cc)==1 and k in ['manassas-city','prince-william-county','alexandria-city']:matched[code]=cc[0] # Unique ID in locality, source name retained for review
   for c in cc:
    if c is not matched.get(code):unmatched.append({'name':code+' - '+c['name'],'total':sum(list(c['history'].values())[-1][:2])})
  dates=sorted(set(d for c in matched.values() for d in c['history']));data={'dates':dates,'precincts':matched,'unmatched':unmatched,'boundary':info,'registeredAvailable':year.startswith('2026')};f=f'precinct-data/{year}-{k}.json';(D/f).write_text(json.dumps(data,separators=(',',':')));print(year,k,len(matched),'/',len(features),'unmatched ballots',sum(x['total'] for x in unmatched))
(D/'map-manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
