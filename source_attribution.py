"""Public source wording and local-only acquisition provenance.

Only dist/ is deployed. Exact intermediary attribution belongs in the ignored
.private/ directory, never in public JSON or a tracked provenance document.
"""
import hashlib
import json
from pathlib import Path

DAL_LABEL = 'Daily Absentee List'
DAL_DESCRIPTION = 'Compiled from Virginia Daily Absentee List records via intermediary reports'
ARCHIVED_LABEL = 'Archived voting data'
ARCHIVED_DESCRIPTION = 'Historical voting totals compiled from archived reports'


def preserve_provenance(root, details):
    """Keep an exact audit record without publishing it or affecting data output."""
    content = json.dumps(details, sort_keys=True, indent=2) + '\n'
    directory = Path(root) / '.private/source-provenance/acquisitions'
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / (hashlib.sha256(content.encode()).hexdigest() + '.json')
    if not path.exists():
        path.write_text(content)
