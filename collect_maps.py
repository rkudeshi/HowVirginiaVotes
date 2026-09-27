import urllib.request,urllib.parse,json,concurrent.futures,pathlib
R=pathlib.Path(__file__).parent;urls=json.loads((R/'sources/map-services.json').read_text());urls['falls-church-city']='https://services1.arcgis.com/2hmXRAz4ofcdQP6p/arcgis/rest/services/VotingWards_Diss/FeatureServer';out=R/'sources/maps';out.mkdir(exist_ok=True)
def get(it):
 k,u=it
 try:
  if u.endswith('FeatureServer'):u+='/0'
  params=urllib.parse.urlencode({'f':'geojson','where':'1=1','outFields':'*','outSR':4326,'returnGeometry':'true','resultRecordCount':5000})
  d=json.load(urllib.request.urlopen(u+'/query?'+params,timeout=70));(out/(k+'.json')).write_text(json.dumps(d));return k,len(d.get('features',[])),d.get('features',[{}])[0].get('properties',d)
 except Exception as e:return k,str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=7) as ex:print(list(ex.map(get,urls.items())))
(R/'sources/map-services.json').write_text(json.dumps(urls))
