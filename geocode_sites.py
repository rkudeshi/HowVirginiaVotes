import json,urllib.request,urllib.parse,concurrent.futures
from pathlib import Path
from shapely.geometry import shape,Point
R=Path(__file__).parent;d=json.load(open(R/'dist/region.json'));geo=json.load(open(R/'dist/regional.geojson'));bounds={f['properties']['id']:shape(f['geometry']) for f in geo['features']};jobs={}
for loc,ys in d['calendars'].items():
 for y,sc in ys.items():
  for s in sc['sites']:
   if not s.get('lat') and s.get('address'):
    addr=s['address']
    if s['key']=='franconia':addr+=' Alexandria VA 22315'
    jobs[(loc,s['key'])]=addr
out={}
def get(it):
 (loc,key),address=it;u='https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?'+urllib.parse.urlencode({'address':address,'benchmark':'Public_AR_Current','format':'json'})
 try:
  r=json.load(urllib.request.urlopen(u,timeout=25));matches=r['result']['addressMatches']
  for m in matches:
   xy=m['coordinates']
   if bounds[loc].buffer(.0005).contains(Point(xy['x'],xy['y'])):return (loc,key),{'lat':xy['y'],'lon':xy['x'],'matchedAddress':m['matchedAddress'],'geocodeSource':u}
  return (loc,key),None
 except Exception:return (loc,key),None
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
 for (loc,key),v in ex.map(get,jobs.items()):
  print(loc,key,'matched' if v else 'no verified match')
  if v:
   for sc in d['calendars'][loc].values():
    for s in sc['sites']:
     if s['key']==key and not s.get('lat'):s.update(v)
(R/'dist/region.json').write_text(json.dumps(d,separators=(',',':')))
