# VA Vote

Static, nonpartisan Northern Virginia early-voting dashboard. Open the deployed site or serve `dist/` through any static web host. Hash-based routes and relative asset paths make `dist/` portable to GitHub Pages, including a project subdirectory. No server, database, API key, third-party runtime map service, or build step is required for the published application. D3 is served locally.

The existing Sites deployment remains private. This change does not modify the user's separate public rkudeshi/novavote repository or enable automatic updates.

## Data coverage

- Nine localities, November 2023, 2024, 2025, 2026 and April 2026: saved Digital Poll Watchers/EPEC aggregate DAL snapshots.
- Fairfax November 2020–2022: daily county spreadsheets preserved in the user's public repository.
- Fairfax November 2020–2025: county daily reports, site records, schedules and weather. 2024's 16-site table was newly extracted and checked against each site total and every daily total.
- Current calendar coverage: Fairfax, Loudoun, Prince William, Arlington, Alexandria, Falls Church, Manassas Park. Manassas has a recovered 2025 schedule; its current and Fairfax City's schedules remain unverified.
- Fairfax September 19, 2026 site report: user screenshot, preliminary. 1,035 Government Center + 477 Mt. Vernon + 609 North County = 2,121. Aggregate reconciles with DAL early total increasing 2,408 to 4,529. Never added again to DAL turnout.
- Loudoun November 2022: separate official final early/mail totals recovered. No daily history inferred from the endpoint.

## Geography

All nine locality pages have precinct boundary maps, with 2023 onward daily playback where aggregate precinct reports are available. Sources and join limitations appear with each map. Prince William currently uses the county's published 2022 layer because the current service query timed out. Do not label that layer as verified current.

Loudoun has election-specific precinct layers for 2023–2025. University of Richmond's 2020 archive supplies precinct boundaries for all nine localities. A historical map does not imply daily precinct returns are available: 2020 maps are uncolored references. Other historical returns use explicitly labeled current/retrieved boundary references. Maps are not claims that boundaries never changed.

Precinct joins use locality, precinct ID and name, cross-checked against state registration. Manassas GIS identifiers repeat; names are cross-walked to the official state IDs. Duplicate geometry fragments share a precinct record. Unmatched source records remain visible in coverage notes and are never allocated geographically. Counts and rates use fixed color domains across dates.

## Definitions and limitations

Turnout is early in-person + vote-by-mail divided by all registered voters, excluding election day ballots, provisional ballots and separately classified federal write-in ballots. Do not interpret it as full-election turnout. Registration is a dated fixed denominator for locality comparisons. April uses DAL active + inactive registration at the final available report. Other historical counts are from state counts preserved in the public repository, with provenance disclosed.

Daily DAL values are report-to-report changes, not necessarily activity on the report date. Missing reports are not zeros, first reports are baselines, negative corrections are preserved. County activity series are separate and are not silently substituted into the DAL series. Fairfax 2023 has a material unresolved mail difference: county workbook 36,773 vs final DAL 47,771. Its two sources remain distinct and labeled.

Weather is locality-level Open-Meteo ERA5, CC BY 4.0, preserved in the original repository. Rain highlighting begins at 0.25 inches, with no causal claim. Historical site hours use preserved rules bounded by observed site activity; schedule exceptions can remain unverified. Ballots/hour totals are sum(ballots)/sum(documented site-hours), not means of daily rates.

The pattern explorer transforms historical observations with adjustable method scaling and timing, and displays the historical min/max envelope. It does **not** forecast election outcomes, estimate probabilities, or claim a calibrated prediction interval. The current observed line ends at the latest report.

## Rebuild from saved inputs

Python dependencies for data preparation: pdfplumber, shapely (only geocoding validation), and the standard library. Site runtime has no Python dependency.

Run in order:

1. `python build_data.py`
2. `python parse_2024_sites.py`
3. `python finalize_data.py`
4. `python build_maps.py`
5. `python add_historical_maps.py`

`collect_maps.py` and `geocode_sites.py` are optional network acquisition helpers. The current verified calendar/geocode enrichment is cached in `sources/enrichment-verified.json`. The downloaded raw source archives and PDFs are preserved under `sources/`; downloaded unrelated page scaffolding is retained for provenance and is not part of the published `dist/`.

## Validation

2,414 locality-date records checked for sorted unique dates, positive denominators and ballot arithmetic. Current precinct matches leave zero nonzero ballots in unmatched source records. All 45 precinct series were checked for geometry ID references. Fairfax 2024 PDF extraction checked all daily and 16 site totals (239,326). Older workbook grand totals spot-checked against the imported series. Schedule dates/hours validated.

DOM interaction checks cover 48 locality/election dashboards, eight regional pages, nine reference explorers, data totals, chart modes, independent timeline playback, maps, and heatmap controls. Full browser visual QA was unavailable for this plain static project in the managed preview environment; responsive behavior needs real-device review. No automated daily refresh, email alerts, CSV download page, or GitHub migration was enabled.


September 2026 interface revision: geographic normalization now handles each polygon ring independently, including multipart county shapes and holes. Desktop precinct comparison uses three method-specific maps; mobile and expanded views use a visible method switch. Map scales remain fixed across playback dates. Archive links only represent recovered daily series. The historical range is an envelope of past observed registration-normalized turnout, not a calibrated forecast, probability interval, or projected election outcome. No forecast totals are manufactured.

2026 weather is cached in sources/weather-2026.json and merged by finalize_data.py. update_weather.py retrieves Open-Meteo archive estimates at locality bounding-box centers (not individual site observations); incomplete days remain unavailable. Historical weather provenance remains in the original imported data.


## Administrative daily ballot planning (September revision)

`dist/planning.js` implements a conditional daily in-person workload estimator. It has no candidate, party, or vote-choice data. All earlier elections remain eligible; election type, recency, and fit to observed daily activity determine reference weights. Registration scaling, relative election dates, nearby-day smoothing with weekday preference, and scheduled site-hours (only when both schedules exist) determine reference paths. Closed days in a saved current schedule receive zero future volume. Historical schedules derived from observed activity are imperfect retrospective inputs, not independently verified advance schedules.

The level adjustment is `(current observed / reference expected)^q`, with `q = positive activity days / (positive activity days + shrink)`. Its effect grows with current observations. `calibrate-planning.cjs` evaluates site-hours exponents 0, 0.5, 1 and shrink constants 3, 7, 14 at six checkpoints, using only earlier election activity as references and target activity through each checkpoint. The selection is pooled retrospective tuning, not an independent test. Range construction combines reference disagreement and the 80th percentile of absolute log errors for remaining volume. The resulting envelope has no claimed coverage probability; checkpoints overlap and localities share election events. Do not present the tuning error as independent forecast accuracy. Historical registration denominators and reconstructed schedules further limit retrospective validation.

Fairfax model inputs use county daily activity plus the reconciled September 19 user-supplied observation until an official report replaces it. Elsewhere, DAL snapshot deltas are allocated to preceding dates; reporting delays, interval gaps, and negative corrections limit day-level interpretation. Model-only allocation does not change source observations in public tables. Negative DAL deltas are excluded from model activity, not interpreted as negative voting demand. The early in-person planning horizon is E−46 to E−3. Demand and site-hours adjustments affect future rows only. Missing calendars remain missing.

Recompute `node calibrate-planning.cjs` after changing model methodology or the historical dataset. The result is a static JSON asset. Model execution in the browser uses only local aggregate files. The site still uses saved reporting snapshots; the 7 AM Eastern banner is explicitly an update target, not a claim that an automated daily refresh exists.

Navigation saves route, controls, map position, and scroll in browser storage. New locality/election navigation starts at the top. Height-only viewport changes do not redraw charts; visibility changes save state without re-rendering. Actual iPhone Notification Center behavior needs device confirmation because browser suspension is controlled by the host.


## Statewide edition (September 23, 2026)
All 133 localities are loaded for November 2023–2026 and April 2026; Fairfax's
2020–2022 histories remain. Home table supports all-metric sorting, region and
name filtering, separate count/rate columns, satellite counts, and next opening
dates. Current precinct maps are preserved for the original nine only. Schedule
coverage is explicit; incomplete new schedules are textual, not fed into the
model as complete hours. Hourly refresh now covers all 133 DPW aggregate series,
Fairfax PDF, and per-site sources where relevant. Native mobile browser visual
QA is unavailable in this static preview environment; DOM interactions are tested.
