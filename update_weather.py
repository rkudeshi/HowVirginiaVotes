"""Fetch locality weather estimates; incomplete archive days remain absent."""
import json, urllib.request, urllib.parse, concurrent.futures
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'dist/region.json').read_text());geo=json.loads((root/'dist/regional.geojson').read_text())
def flatten(x):
 if len(x)==2 and isinstance(x[0],(int,float)):yield x
 else:
  for v in x:yield from flatten(v)
def fetch(f,year,start,end):
 pts=list(flatten(f['geometry']['coordinates']));lon=(min(x[0] for x in pts)+max(x[0] for x in pts))/2;lat=(min(x[1] for x in pts)+max(x[1] for x in pts))/2
 params={'latitude':lat,'longitude':lon,'start_date':start,'end_date':end,'daily':'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code','temperature_unit':'fahrenheit','precipitation_unit':'inch','timezone':'America/New_York'}
 url='https://archive-api.open-meteo.com/v1/archive?'+urllib.parse.urlencode(params)
 with urllib.request.urlopen(url,timeout=30) as response: obj=json.load(response)
 ident=f['properties']['id'];slug=ident.removesuffix('-county').removesuffix('-city') if ident!='fairfax-city' else ident
 key=f'{slug}-{year}-general';out={};d=obj['daily']
 for i,day in enumerate(d['time']):
  code=d['weather_code'][i];pr=d['precipitation_sum'][i];hi=d['temperature_2m_max'][i];lo=d['temperature_2m_min'][i]
  if any(v is None for v in [code,pr,hi,lo]):continue
  label='Clear' if code==0 else 'Partly cloudy' if code<3 else 'Cloudy' if code==3 else 'Fog' if code<50 else 'Rain' if code<70 else 'Snow' if code<80 else 'Showers' if code<95 else 'Thunderstorms'
  out[day]={'label':label,'tempMax':round(hi),'tempMin':round(lo),'precip':round(pr,2),'wet':pr>=.25,'source':url,'location':'Locality bounding-box center; gridded estimate'}
 return key,out
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 jobs=[pool.submit(fetch,f,y,start,end) for f in geo['features'] for y,start,end in [('2026','2026-09-10','2026-09-19'),('2026-special','2026-03-01','2026-04-25')]]
 for job in concurrent.futures.as_completed(jobs):
  try:
   key,out=job.result();r['weather'][key]=out;print(key,len(out))
  except Exception as e:print('Unavailable',str(e))
(root/'dist/region.json').write_text(json.dumps(r,separators=(',',':')))
(root/'sources/weather-2026.json').write_text(json.dumps({k:v for k,v in r['weather'].items() if '2026' in k},separators=(',',':')))
