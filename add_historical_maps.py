import json,re
from pathlib import Path
R=Path(__file__).parent;D=R/'dist';g=json.load(open(R/'sources/maps/historical2020.json'));m=json.load(open(D/'map-manifest.json'))
for loc in m:
 name=loc.replace('-',' ').title();fs=[]
 for f in g['features']:
  p=f['properties']
  if p['LOCALITY'].lower()!=name.lower():continue
  code=str(p['VTDST']);code=str(int(code)) if code.isdigit() else code
  fs.append({'type':'Feature','properties':{'code':code,'name':p.get('PRECINCT') or p.get('PrecinctName') or code},'geometry':f['geometry']})
 if fs:
  file=f'maps/{loc}-2020.json';(D/file).write_text(json.dumps({'type':'FeatureCollection','features':fs},separators=(',',':')));m[loc]['historical']['2020']={'file':file,'vintage':'2020 election precincts, University of Richmond archive; daily precinct turnout unavailable','source':'https://services.arcgis.com/ak2bo87wLfUpMrt1/arcgis/rest/services/VA_Presidential_Election_Precincts_2020/FeatureServer'};print(loc,len(fs))
m['prince-william-county']['historical']['2022']={k:m['prince-william-county'][k] for k in ['file','vintage','source']}
(D/'map-manifest.json').write_text(json.dumps(m,separators=(',',':')))
