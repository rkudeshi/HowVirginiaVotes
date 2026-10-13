"""Generate real GitHub Pages entry files so deep links return HTTP 200.

The current site (dist/index.html) and the previous design (dist/old/v2/index.html)
both use clean paths: /2026/fairfax-county and /old/v2/2026/fairfax-county.
"""
import json
from pathlib import Path
root=Path(__file__).resolve().parent/'dist'
data=json.loads((root/'region.json').read_text())
paths=['status']
for year in data['elections']:
 paths.append(year)
 for loc in data['names']:
  paths.append(f'{year}/{loc["id"]}')
  if year=='2026':paths.append(f'{year}/{loc["id"]}/scenarios')
for base in (root,root/'old'/'v2'):
 shell=(base/'index.html').read_bytes()
 for route in paths:
  directory=base/route;directory.mkdir(parents=True,exist_ok=True)
  (directory/'index.html').write_bytes(shell)
# Unknown paths fall back to the current site, which redirects to the nearest valid page.
(root/'404.html').write_bytes((root/'index.html').read_bytes())
print('Generated',2*len(paths),'clean routes')
