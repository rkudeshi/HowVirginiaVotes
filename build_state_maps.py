"""ELECT current precinct boundaries and vetted DPW joins for all localities."""
import concurrent.futures,io,json,re,zipfile,urllib.request,hashlib,csv
from pathlib import Path
import shapefile
from shapely.geometry import shape,mapping
from shapely.ops import transform,unary_union
from pyproj import CRS,Transformer
from refresh_dpw import read_rows,number
R=Path(__file__).resolve().parent;D=R/'dist';S=R/'sources/state-maps';S.mkdir(exist_ok=True)
base=json.loads((D/'region.json').read_text());manifest=json.loads((D/'map-manifest.json').read_text())
original={'fairfax-county','arlington-county','alexandria-city','fairfax-city','falls-church-city','loudoun-county','manassas-city','manassas-park-city','prince-william-county'}
page=urllib.request.urlopen('https://www.elections.virginia.gov/casting-a-ballot/redistricting/gis/').read().decode()
links=re.findall(r'href="([^"]+\.zip)"',page)
registration={}
for r in csv.DictReader(open(R/'sources/registration2026.csv',encoding='utf-8-sig')):
    if r['PrecinctCode'].isdigit():registration[(re.sub(r'^Locality: \d+ ','',r['Locality']),str(int(r['PrecinctCode'])))]=re.sub(r'^\d+\s*-\s*','',r['PrecinctName'])
def norm(s):return re.sub('[^A-Z0-9]','',s.upper().replace('SAINT','ST'))
raw=max((R/'sources/dpw-snapshots').glob('*.zip'),key=lambda p:p.stat().st_mtime).read_bytes();z=zipfile.ZipFile(io.BytesIO(raw))
def get(n):
    key=n['id'];name=n['name'].upper();link=next(u for u in links if u.split('/')[-1].startswith(name.replace(' ','_')));url='https://www.elections.virginia.gov'+link;p=S/(key+'.zip')
    if not p.exists():p.write_bytes(urllib.request.urlopen(url,timeout=90).read())
    archive=zipfile.ZipFile(p);stem=next(f[:-4] for f in archive.namelist() if f.endswith('.shp'))
    reader=shapefile.Reader(shp=io.BytesIO(archive.read(stem+'.shp')),dbf=io.BytesIO(archive.read(stem+'.dbf')))
    project=Transformer.from_crs(CRS.from_wkt(archive.read(stem+'.prj').decode()),4326,always_xy=True).transform
    polygons={};props={}
    for rec in reader.iterShapeRecords():
        pr=rec.record.as_dict();code=str(int(pr['PrecinctFI']));g=transform(project,shape(rec.shape.__geo_interface__))
        polygons.setdefault(code,[]).append(g);props[code]={'code':code,'name':pr['PrecinctNa'],'pollingPlace':pr.get('PollingLoc','')}
    features=[{'type':'Feature','properties':props[c],'geometry':mapping(unary_union(gs).simplify(.000015,preserve_topology=True))} for c,gs in polygons.items()]
    assert features,key
    # Preserve the already verified local layers for the original nine.
    if key in manifest and not '2022 published' in manifest[key]['vintage']:
        features=json.loads((D/manifest[key]['file']).read_text())['features']
    else:
        file='maps/'+key+'.json';(D/file).write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
        manifest[key]={'file':file,'source':url,'vintage':'Current ELECT precinct boundaries, retrieved September 2026','count':len(features),'historical':{}}
    boundary={'type':'Feature','properties':{'id':key,'name':n['name']},'geometry':mapping(unary_union([shape(f['geometry']) for f in features]).simplify(.00015,preserve_topology=True))}
    pp=D/'precinct-data'/('2026-'+key+'.json')
    if pp.exists() and key in original:return boundary,{'id':key,'existing':True,'count':len(features)}
    codes={f['properties']['code'] for f in features};candidates={};unmatched=[]
    for f in z.namelist():
        prefix='byLOCALITY_PRECINCT_NAME/'+name+' '
        if not f.startswith(prefix) or not f.endswith('.csv'):continue
        m=re.match(r'(\d+)\s*-\s*(.*)',f.split('/')[1][len(name)+1:])
        if m:candidates.setdefault(str(int(m[1])),[]).append((m[2],f))
    matched={}
    for code,entries in candidates.items():
        expected=registration.get((name,code)) or props.get(code,{}).get('name','')
        entries=[(nm,f) for nm,f in entries if norm(nm)==norm(expected)]
        if not entries:continue
        if code not in codes or len(entries)!=1:
            unmatched.extend({'name':code+' '+name,'total':sum([number(list(read_rows(z,f).values())[-1][1],k) for k in ['ON_MACHINE','MAIL_IN']])} for name,f in entries);continue
        precinct_name,f=entries[0];rows=read_rows(z,f);registered=number(list(rows.values())[0][1],'ACTIVE_VOTERS')+number(list(rows.values())[0][1],'INACTIVE_VOTERS')
        matched[code]={'name':precinct_name,'history':{day:[number(r,'ON_MACHINE'),number(r,'MAIL_IN'),registered] for day,(_,r) in sorted(rows.items())}}
    dates=sorted({day for v in matched.values() for day in v['history']})
    pp.write_text(json.dumps({'dates':dates,'precincts':matched,'unmatched':unmatched,'boundary':manifest[key],'registeredAvailable':True},separators=(',',':')))
    return boundary,{'id':key,'count':len(features),'matched':len(matched),'unmatched':unmatched,'source':url,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
if __name__=='__main__':
    boundaries=[];audit=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futures={ex.submit(get,n):n for n in base['names']}
        for f in concurrent.futures.as_completed(futures):
            n=futures[f]
            try:b,a=f.result();boundaries.append(b);audit.append(a);print(n['id'],a.get('matched','existing'),flush=True)
            except Exception as e:audit.append({'id':n['id'],'error':str(e)});print(n['id'],'ERROR',e,flush=True)
    (S/'audit.json').write_text(json.dumps(audit,indent=2))
    (D/'map-manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
    assert len(boundaries)==133,('Missing boundaries',len(boundaries))
    # Keep the shoreline-clipped overview and land areas used by community comparisons.
    # Rebuild that layer separately with build_overview_map.py.
    overview=D/'regional.geojson'
    if not overview.exists():
        overview.write_text(json.dumps({'type':'FeatureCollection','features':boundaries},separators=(',',':')))
