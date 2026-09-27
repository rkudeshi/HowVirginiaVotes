"""Refresh Prince William County's official homepage turnout totals.

The Wix page can update its numbers before its visible cutoff label.  When that
happens, use the latest already-observed DAL activity date rather than assigning
the changed totals to the stale date.  Raw HTML and content-addressed dashboard
snapshots are retained so same-day corrections replace, rather than accumulate.
"""
import hashlib
import html
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
URL = "https://www.pwcvotes.org/"
REGION = ROOT / "dist" / "region.json"
SNAPSHOTS = ROOT / "sources" / "site-snapshots" / "dashboard"
RAW = ROOT / "sources" / "site-snapshots" / "pwc"


def number(text, label):
    match = re.search(label + r"\s*</[^>]+>\s*<[^>]+>\s*([\d,]+)", text, re.I)
    if not match:
        # Wix frequently inserts additional wrappers between the label/value.
        match = re.search(label + r".{0,1200}?>([\d,]+)<", text, re.I | re.S)
    if not match:
        raise ValueError("Missing " + label)
    return int(match.group(1).replace(",", ""))


def main():
    req = urllib.request.Request(URL, headers={"Cache-Control": "no-cache", "User-Agent": "NovaVote data refresh"})
    raw = urllib.request.urlopen(req, timeout=60).read()
    text = raw.decode("utf-8", errors="replace")
    digest = hashlib.sha256(raw).hexdigest()
    values = {
        "registered": number(text, "Total Registered Voters"),
        "early": number(text, "Early Voters"),
        "mailSent": number(text, "Mail Ballots Sent"),
        "mail": number(text, "Mail Ballots Returned"),
        "total": number(text, "Total Turnout"),
    }
    assert values["total"] == values["early"] + values["mail"]
    assert values["mailSent"] >= values["mail"]

    plain = html.unescape(re.sub(r"<[^>]+>", " ", text))
    cutoff = re.search(r"Statistics reflect voter turnout through\s+5:00 PM on\s+(\d{1,2}/\d{1,2}/2026)", plain, re.I)
    displayed_cutoff = datetime.strptime(cutoff.group(1), "%m/%d/%Y").date().isoformat() if cutoff else None

    data = json.loads(REGION.read_text())
    locality = next(row for row in data["elections"]["2026"]["localities"] if row["id"] == "prince-william-county")
    latest_saved_date = locality["history"][-1]["date"]
    activity = max(displayed_cutoff or latest_saved_date, latest_saved_date)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    report_date = now.date().isoformat()

    latest = None
    for path in sorted(SNAPSHOTS.glob("*-prince-william-*.json")):
        candidate = json.loads(path.read_text())
        if latest is None or candidate["retrievedAt"] > latest["retrievedAt"]:
            latest = candidate
    same = latest and all(latest.get(key) == values[key] for key in values)
    # Wix changes runtime markup on nearly every request. Only a change to the
    # published election figures or displayed cutoff is a new observation.
    if same and latest.get("displayedCutoff") == displayed_cutoff:
        print(json.dumps({"changed": False, "activityThrough": latest["activityThrough"], **values}))
        return

    basis = "displayed cutoff"
    if displayed_cutoff and displayed_cutoff < latest_saved_date:
        basis = "latest observed activity date; homepage cutoff label is stale"
    snapshot = {
        "election": "2026",
        "locality": "prince-william-county",
        "source": URL,
        "reportDate": report_date,
        "retrievedAt": now.isoformat().replace("+00:00", "Z"),
        "activityThrough": activity,
        "activityDateBasis": basis,
        "displayedCutoff": displayed_cutoff,
        "contentHash": digest,
        "early": values["early"],
        "mail": values["mail"],
        "mailSent": values["mailSent"],
        "outstanding": values["mailSent"] - values["mail"],
        "registered": values["registered"],
        "total": values["total"],
    }
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    stem = f"{report_date}-prince-william-{digest[:12]}"
    (SNAPSHOTS / f"{stem}.json").write_text(json.dumps(snapshot, indent=2) + "\n")
    (RAW / f"{report_date}-{digest[:12]}.html").write_bytes(raw)
    print(json.dumps({"changed": True, "activityThrough": activity, **values, "displayedCutoff": displayed_cutoff}))


if __name__ == "__main__":
    main()
