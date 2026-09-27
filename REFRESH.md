# VA Vote data refresh

## URLs, charts, and weather
Use clean routes such as `/2022/loudoun-county/`. The publishing workflow runs
`python build_routes.py` to generate entry pages for every supported route;
keep `<base href="/">` in the shared HTML so deep-link assets resolve correctly.
Existing hash links are upgraded automatically. Do not commit generated route copies.
Daily-chart ticks use the exact same noon-UTC date positions as the columns.
Trim only leading/trailing days without daily ballot activity; preserve interior
zero days and negative reporting corrections. Comparison charts use a taller view.
Run `python refresh_weather.py` after importing ballot data. It resumes cached
downloads and respects rate limits. Commit `dist/weather/*.json` and its manifest.
Weather keys use complete locality IDs: Richmond City and Richmond County, for
example, must not share observations. Daily high/low temperature, precipitation,
snow, wind, and weather code are saved in local time for each tracked election.

## Recovered historical daily data
`dist/vpap-history.json` supplements missing locality/election histories. The app
merges it with `region.json` without replacing existing histories. Fairfax is
explicitly excluded. Do not delete this supplemental file during future refreshes.
Saved chart literals are in `sources/vpap/`; regenerate with `python import_vpap.py`.
The importer validates daily in-person + mail totals against the cumulative chart,
preserves zero days, and retains headline totals separately when they differ.
Unreturned applications are final snapshots only, never invented daily observations.
Registration uses the existing November 1 registration series, not a denominator
inferred from rounded turnout rates. Source metadata stays in the saved files;
do not add source labels or attribution to the voting-data display.

After validation, commit data and any display changes to `main` in
`rkudeshi/HowVirginiaVotes`. `.github/workflows/pages.yml` automatically validates
and publishes `dist` on every push to `main`. Verify the workflow succeeds and the
live GitHub Pages site shows the new data. Do not publish to ChatGPT Sites.

## Public update status
Successful changed-data imports automatically append retrieval timestamps and source
details to `dist/status.json` through `status_log.py`. Publish that file with every
data update. Do not fabricate past retrieval times or log unchanged checks as imports.
For a manual verified import, run `python status_log.py "Source name" "What changed"
--through YYYY-MM-DD --url SOURCE_URL` immediately after saving the data.
Also log substantive site changes. The Status page formats UTC timestamps in the
visitor's local timezone. Preserve its existing event history.
Precinct maps are displayed only for the current November 2026 election.

This is a static GitHub Pages project in rkudeshi/HowVirginiaVotes. Start from
the latest main branch before editing. Preserve all historical data/UI. Do not rebuild
with build_data.py or prepare_region.py: those older builders predate enrichment.

1. Run `python refresh_dpw.py`. It downloads aggregate metrics, merges current
   locality and vetted precinct histories, preserves registration denominators,
   validates mail component totals and saves changed source snapshots. It prints
   changedFiles. A second run with the same ZIP must report zero changed files.
2. Use DPW for non-Fairfax countywide aggregates. Run site-level dashboard
   refreshers only while one or more satellite early-voting locations are open
   and the source reports per-site turnout. Dashboards are for site counts, not
   an alternate countywide series. For Loudoun, `python refresh_sites.py`
   archives per-site days as published; the live ArcGIS feed exposes only the
   latest day. Preserve gaps, partial site coverage and prior verified site
   counts. Do not let its EV_Total, Ballots_Returned or Ballots_Mailed fields
   replace DPW aggregates. If a site feed fails, keep its previous data and
   continue the DPW update.
3. Run `python refresh_fairfax.py`. Fetch the linked PDF contents every time,
   even if its filename, URL, report date or HTTP metadata is unchanged. The
   September 19 filename was serving September 21 content. Parse the internal
   report date and compare content hashes. Reconcile every daily table to the
   cover totals before replacing data. The parser fails closed on a new layout;
   inspect and adapt it, then continue other sources if recovery is blocked.
   Fairfax PDF values take precedence everywhere they exist. app.js applies
   preferCountyReports() for the homepage, locality cards and comparison charts;
   daily charts use official history and projections already use official rows.
   Raw DPW data remains for fields unavailable in the PDF, especially precincts.
   Never offer a source selector or competing Fairfax totals to visitors.
4. When Alexandria or Arlington satellite sites are open, check the live
   Tableau or Power BI site/day views. Save a content snapshot under
   `sources/site-snapshots/dashboard/`, then run
   `python refresh_dashboard_snapshots.py` after `refresh_dpw.py`. Dashboard
   snapshots keep activity dates separate from report and retrieval dates; a
   corrected snapshot replaces the affected site/day observation. Skip these
   dashboards while only the main office is open.
5. When Prince William satellite sites are open, check its official site-level
   feed or dashboard. `python refresh_pwc.py` currently captures countywide Wix
   figures and therefore should not run as the aggregate source. Retain its raw
   snapshots and prior verified observations, but let DPW supply current
   countywide totals.
6. Arlington's public Power BI workbook currently reuses 2024 internal field
   names with a 2026 visible calendar. The verified September18 counts are saved
   in siteReports. Do not rerun import_arlington_sites.py as a live updater: it is
   a reproducible importer for the preserved September19 snapshot. A future
   update must verify the displayed date-to-field mapping and reporting cutoff.
   Never import future calendar zeros, an unused site template, or assume the
   date embedded in a field name is its actual activity date.
7. Preserve source dates and coverage markers. siteReports is distinct from
   official (which carries full Fairfax mail composition). Do not fill site
   counts from precinct-of-residence data. Do not invent daily history from
   cumulative totals or allocate county totals across multiple sites.
8. Run `node --check dist/app.js` and `python validate_data.py` before publishing.
   Commit and push only actual changes to the GitHub main branch. The Pages
   workflow validates and publishes dist/; confirm the deployment succeeds.

The previous Sites refresh instructions used hourly checks at :30, America/New_York.
The active schedule is managed separately by the user in ChatGPT; follow that
scheduled task's timing rather than creating another schedule here. Check DPW for all 133 Virginia
localities and Fairfax's PDF every run. Check a locality dashboard or linked feed
only while satellite early-voting locations are open and it can add per-site
turnout. Use sources/site-audit/coverage.json as the starting source list, not a
permanent availability verdict. Same-day and same-URL corrections count,
including downward changes of one or two ballots.
Replace corrected observations, do not add a correction as another day's ballots.
Keep raw content-addressed snapshots and Git history. Do not enforce monotonic
counts or suppress small changes. Publish data changes only. If one source fails,
retain its last valid observations and continue all other checks.

## Statewide expansion

The homepage and five DPW election histories now cover all 133 localities.
Run `python refresh_satellites.py` to recheck ELECT's official schedule contents.
`dist/region.json` satellites.2026 contains verified listed locations, opening
rules, and additional-site counts. Counts exclude the main voting office, even
when that office is offsite. The satellite list currently contains 17 multi-site
localities. Regions are editorial browsing groups; Northern Virginia is exactly
the original nine. No new precinct layers were created for this expansion.

DPW refresh iterates all 133 current localities. Keep all fixed denominators and
historical series. New 2023/2024 localities use official November 1 registration
reports archived in sources; existing denominators are preserved. Some official
CSV URLs return PDF content; the expansion importer detects the content type.

For satellite jurisdictions with no verified site-level feed yet, consult the
source registry and official election office links. Do not claim a dashboard was
checked merely because its schedule was downloaded. Never manufacture site
counts or treat an incomplete set of site hours as a complete calendar for the
projection model. Verified textual schedules are shown separately when a full
calendar has not been reconstructed. Election-relative forecasts remain available
from DPW histories without unverified site-hours assumptions.
