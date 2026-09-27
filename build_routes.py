"""Generate real GitHub Pages entry files so deep links return HTTP 200."""
import json
from pathlib import Path
root=Path(__file__).resolve().parent/'dist'
data=json.loads((root/'region.json').read_text())
shell=(root/'index.html').read_bytes()
paths=['status']
for year in data['elections']:
 paths.append(year)
 for loc in data['names']:
  paths.append(f'{year}/{loc["id"]}')
  if year=='2026':paths.append(f'{year}/{loc["id"]}/scenarios')
for route in paths:
 directory=root/route;directory.mkdir(parents=True,exist_ok=True)
 (directory/'index.html').write_bytes(shell)
print('Generated',len(paths),'clean routes')
