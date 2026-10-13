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
def record_check(source, through):
    """Log a completed check that found no newer data, at most once per Eastern day per source."""
    from zoneinfo import ZoneInfo
    path=ROOT/'dist/status.json'
    events=json.loads(path.read_text()) if path.exists() else []
    et=ZoneInfo('America/New_York'); today=datetime.now(et).date()
    for e in events:
        if (e.get('source')==source and e.get('check') and e.get('through')==through
                and datetime.fromisoformat(e['at']).astimezone(et).date()==today):
            return False
    events.append({'at':datetime.now(timezone.utc).isoformat(), 'source':source,
                   'message':f'Checked for new data. The latest published file still runs through {through}; nothing new to load.',
                   'through':through, 'url':None, 'check':True})
    path.write_text(json.dumps(events,indent=2)+'\n')
    return True
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('message');p.add_argument('--through');p.add_argument('--url');a=p.parse_args()
    record(a.source,a.message,a.through,a.url)
