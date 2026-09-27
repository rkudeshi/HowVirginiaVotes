"""Build a shoreline-clipped Virginia overview from Census cartographic KML."""
import json, re, sys, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parent
ns={'k':'http://www.opengis.net/kml/2.2'}
archive=zipfile.ZipFile(sys.argv[1])
root=ET.fromstring(archive.read(next(n for n in archive.namelist() if n.endswith('.kml'))))
names={n['id']:n for n in json.loads((ROOT/'dist/region.json').read_text())['names']}
features=[]
for p in root.findall('.//k:Placemark',ns):
 d={x.attrib['name']:x.text for x in p.findall('.//k:SimpleData',ns)}
 if d.get('STATEFP')!='51':continue
 key=re.sub('[^a-z0-9]+','-',d['NAMELSAD'].lower().replace('&','and')).strip('-')
 assert key in names,key
 polygons=[]
 for polygon in p.findall('.//k:Polygon',ns):
  rings=[]
  for tag in ['outerBoundaryIs','innerBoundaryIs']:
   for ring in polygon.findall('k:'+tag+'/k:LinearRing/k:coordinates',ns):
    rings.append([[round(float(v),6) for v in coord.split(',')[:2]] for coord in ring.text.split()])
  polygons.append(rings)
 assert polygons
 features.append({'type':'Feature','properties':{'id':key,'name':names[key]['name'],'landSqMiles':round(int(d['ALAND'])/2589988.110336,4)},'geometry':{'type':'MultiPolygon','coordinates':polygons}})
assert len(features)==133 and len({f['properties']['id'] for f in features})==133
(ROOT/'dist/regional.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
(ROOT/'sources/overview-map.json').write_text(json.dumps({'url':'https://www2.census.gov/geo/tiger/GENZ2024/kml/cb_2024_us_county_500k.zip','vintage':'2024','scale':'1:500,000','method':'Shoreline-clipped cartographic county boundaries; Virginia only. Land area used for registered-voter density comparisons.'},indent=2)+'\n')
print('Built 133 shoreline-clipped county and city shapes')
