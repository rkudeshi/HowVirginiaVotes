"""Append only actual successful imports; timestamps are retrieval time in UTC."""
import json, argparse
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parent
def record(source, message, through=None, url=None):
    path=ROOT/'dist/status.json'
    events=json.loads(path.read_text()) if path.exists() else []
    events.append({'at':datetime.now(timezone.utc).isoformat(), 'source':source,
                   'message':message, 'through':through, 'url':url})
    path.write_text(json.dumps(events,indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('message');p.add_argument('--through');p.add_argument('--url');a=p.parse_args()
    record(a.source,a.message,a.through,a.url)
