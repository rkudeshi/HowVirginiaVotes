class Home extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { narrow: window.innerWidth < 600, data: null, t: 0, now: Date.now(), method: 'all', measure: 'count', show: {}, chTick: 0, hi: null, cal: null, win: props.eid === '2026' ? 'today' : 'deadline', calM: 'all', calTick: 0, mapMeasure: 'p', hover: null, tip: null, sortKey: 'p', sortDir: -1, all: false, q: '', region: '' };
  }
  componentDidMount() {
    this.clock = setInterval(() => this.setState({ now: Date.now() }), 60000);
    this.onScroll = () => { if (this.state.tip || this.state.hi != null) this.setState({ tip: null, hi: null }); };
    this.onResize = () => { const nw = window.innerWidth < 600; if (nw !== this.state.narrow) this.setState({ narrow: nw, hi: null }); };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);

    fetch('/data/home-' + this.props.eid + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((data) => {
      this.setState({ data, cal: data.live ? data.asOf : VF.addDays(data.date, -1) });
      document.title = (data.live ? 'Virginia early voting' : 'Virginia early voting · ' + data.label) + ' · VoteFlow';
      const s = performance.now();
      const step = (n) => { const t = Math.min(1, (n - s) / 1800); this.setState({ t }); if (t < 1) this.raf = requestAnimationFrame(step); };
      this.raf = requestAnimationFrame(step);
    }).catch(() => { location.replace('/'); });
  }
  componentWillUnmount() { cancelAnimationFrame(this.raf); clearInterval(this.clock); window.removeEventListener('scroll', this.onScroll); window.removeEventListener('resize', this.onResize); }
  tipAt(ev, kind, key) {
    const W = window.innerWidth, H = window.innerHeight;
    let x = ev.clientX + 18, y = ev.clientY + 18;
    if (x + 300 > W) x = ev.clientX - 308;
    if (y + 320 > H) y = Math.max(8, ev.clientY - 330);
    return { kind, key, x: Math.max(8, x), y };
  }
  renderVals() {
    const D = this.state.data;
    const f = (n) => n == null ? '—' : Math.round(n).toLocaleString('en-US');
    const short = (n) => n >= 1e6 ? (n / 1e6).toFixed(2).replace(/0$/, '') + 'M' : n >= 1e4 ? Math.round(n / 1000) + 'K' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(Math.round(n));
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const parse = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const md = (s) => { const d = parse(s); return MON[d.getMonth()] + ' ' + d.getDate(); };
    const dmd = (s) => { const d = parse(s); return DOW[d.getDay()] + ' ' + MON[d.getMonth()] + ' ' + d.getDate(); };
    const pill = (cur, v) => ({ pressed: cur === v ? 'true' : 'false', bg: cur === v ? '#121417' : '#FFFFFF', fg: cur === v ? '#FFFFFF' : '#121417' });
    const hideTip = () => this.setState({ tip: null });

    // countdown (live)
    const target = Date.UTC(2026, 10, 3, 11, 0, 0); // 6 AM Eastern (EST, UTC−5) on Nov 3
    const left = Math.max(0, target - this.state.now);
    const cdDays = Math.floor(left / 864e5), cdH = Math.floor(left % 864e5 / 36e5), cdM = Math.floor(left % 36e5 / 6e4), cdS = Math.floor(left % 6e4 / 1000);
    const evStart = new Date(2026, 8, 18).getTime();
    const frac = Math.min(1, Math.max(0, (this.state.now - evStart) / (target - evStart)));
    const cd = { label: left > 0 ? 'Election Day polls open in' : 'Polls are open', days: cdDays, h: String(cdH).padStart(2, '0'), m: String(cdM).padStart(2, '0'), s: String(cdS).padStart(2, '0'), anim: cdS % 2 ? 'fx-pa' : 'fx-pb', offset: (339.3 * (1 - frac)).toFixed(1), dayN: Math.min(46, Math.floor((this.state.now - evStart) / 864e5) + 1) };

    if (!D) return { loading: true, ready: false, ticker: [], tip: { on: false }, cd, band: { asOf: '…' }, mini: [], hdr: { elections: [], locs: [] }, box: {}, eid: this.props.eid };
    const e = this.state.t >= 1 ? 1 : 1 - Math.pow(2, -10 * this.state.t);
    const EID = D.eid, live = D.live, EDATE = D.date, EYR = EDATE.slice(0, 4);
    const start = parse(VF.addDays(EDATE, -46)), eDay = parse(EDATE), dead = VF.addDays(EDATE, 6);
    const rows = D.rows, last = rows[rows.length - 1];
    const tIdx = live ? Math.round((parse(D.asOf) - start) / 864e5) : 52;
    const total = last.e + last.m;
    const H = D.hist;
    const at = (k, i) => { const s = H[k]; return s.e[i] == null ? null : s.e[i] + s.m[i]; };

    // Size both hero numbers so they share one line when the card is wide enough (Unbounded 700 glyph widths, in em).
    const emW = (s) => Array.from(s).reduce((a, ch) => a + (ch === ',' || ch === '.' ? 0.3 : ch === '%' ? 1.29 : ch === '1' ? 0.52 : 0.9) - 0.04, 0);
    const heroFs = (pct, n) => 'clamp(28px, calc((100cqi - 52px) / ' + (emW(pct + '%') + emW(f(n))).toFixed(2) + '), 96px)';
    const hero = { fs: heroFs((total / D.reg * 100).toFixed(1), total), kicker: live ? 'Early votes cast · statewide · through ' + dmd(D.asOf) : 'Early votes cast · statewide · final', pctLbl: live ? 'turnout so far' : 'early turnout', votes: f(total * e), pct: (total / D.reg * 100 * e).toFixed(1), reg: f(D.reg), active: f(D.active), ip: f(last.e * e), m: f(last.m * e), ipW: (last.e / total * 100).toFixed(1), mW: (last.m / total * 100).toFixed(1) };
    const COLORS = { '2026': '#00A37A', '2026-special': '#6B7F1A', '2025': '#7C4DDB', '2024': '#121417', '2023': '#B7791F', '2022': '#8C5A00', '2021': '#8A8F99', '2020': '#A68A00' };
    // Pace chips, newest election first. The live election compares at today's point; a past
    // election compares with the live one at today's point and with other past ones in total.
    const finalOf = (k) => { let v = null; for (let i = 0; i < 53; i++) { const x = at(k, i); if (x != null) v = x; } return v; };
    let liveT = -1; if (H['2026']) for (let i = 0; i < 53; i++) if (H['2026'].e[i] != null) liveT = i;
    const paceKeys = ['2026', '2026-special', '2025', '2024', '2022', '2021', '2020'].filter((k) => H[k] && k !== EID
      && (live ? at(k, tIdx) : k === '2026' ? at(EID, liveT) && at(k, liveT) : finalOf(k))).slice(0, 4);
    const paceChips = paceKeys.map((k) => { const sameDay = live || k === '2026';
      const ratio = live ? total / at(k, tIdx) : k === '2026' ? at(EID, liveT) / at(k, liveT) : total / finalOf(k);
      return { ratio: Math.round(ratio * 100) + '%', label: H[k].label.replace(' special', ''), border: COLORS[k], tail: sameDay ? 'at this point' : 'overall' }; });
    const satDates = Object.keys(D.satOpen).filter((d) => d > D.asOf).sort();
    const nextSat = satDates[0];
    const satLine = !live ? 'Mail ballots counted through ' + dmd(dead) : nextSat ? D.satOpen[nextSat].n + (D.satOpen[nextSat].n === 1 ? ' satellite site opens ' : ' satellite sites open ') + dmd(nextSat) : 'All satellite sites are open';

    const evDays = 46;
    const box = live ? { big: cdDays, small: cdDays === 1 ? 'day left' : 'days left', offset: cd.offset, title: 'Election Day · ' + dmd(EDATE), sub: '' }
      : { big: evDays, small: 'early-vote days', offset: 0, title: 'Election Day · ' + dmd(EDATE) + ', ' + EYR, sub: 'Final early-vote totals for ' + D.label + '.' };

    // flow
    const reg = D.reg, ip = last.e, ret = last.m, out = last.o, req = ret + out, none = reg - ip - req;
    const pc = (a, b) => (a / b * 100).toFixed(a / b < 0.1 ? 1 : 0) + '%';
    const eng = ip + req;
    const flow = [
      { kicker: 'Registered voters', title: f(reg), hasRib: true, a: 0, b: (eng / reg * 100).toFixed(2), ribDelay: '.6s',
        segs: [
          { name: 'Voted early in person', val: f(ip), of: pc(ip, reg) + ' of registered', w: (ip / reg * 100).toFixed(2), bg: '#00A37A', fg: '#FFFFFF', inside: '', delay: '0s', outline: 'none' },
          { name: 'Requested a mail ballot', val: f(req), of: pc(req, reg) + ' of registered', w: (req / reg * 100).toFixed(2), bg: '#7C4DDB', fg: '#121417', inside: '', delay: '.15s', outline: 'none' },
          { name: 'No early ballot yet', val: f(none), of: pc(none, reg) + ' of registered', w: (none / reg * 100).toFixed(2), bg: '#DCDFE5', fg: '#121417', inside: 'Not yet · ' + pc(none, reg), delay: '.3s', outline: 'none' }
        ] },
      { kicker: 'Voted in person or asked for a mail ballot', title: f(eng), hasRib: true, a: (ip / eng * 100).toFixed(2), b: 100, ribDelay: '1.2s',
        segs: [
          { name: 'Voted in person', val: f(ip), of: pc(ip, eng) + ' of this group', w: (ip / eng * 100).toFixed(2), bg: '#00A37A', fg: '#FFFFFF', inside: 'In person · ' + pc(ip, eng), delay: '.8s', outline: 'none' },
          { name: 'Mail ballot requested', val: f(req), of: pc(req, eng) + ' of this group', w: (req / eng * 100).toFixed(2), bg: '#7C4DDB', fg: '#121417', inside: 'Mail · ' + pc(req, eng), delay: '.95s', outline: '2px solid #121417' }
        ] },
      { kicker: 'Mail ballots requested', title: f(req), hasRib: false,
        segs: [
          { name: 'Returned', val: f(ret), of: pc(ret, req) + ' of requested · ' + pc(ret, reg) + ' of registered', w: (ret / req * 100).toFixed(2), bg: '#5B2FB8', fg: '#FFFFFF', inside: 'Returned · ' + pc(ret, req), delay: '1.5s', outline: 'none' },
          { name: 'Outstanding', val: f(out), of: pc(out, req) + ' of requested', w: (out / req * 100).toFixed(2), bg: '#E4D9FA', fg: '#121417', inside: 'Outstanding · ' + pc(out, req), delay: '1.65s', outline: 'none' }
        ] }
    ];

    const fcView = this.state.flowView || 'chart';
    const fcOpts = [['chart', 'Flow chart'], ['bars', 'Bars']].map(([v, label]) => Object.assign({ label, pick: () => this.setState({ flowView: v }) }, pill(fcView, v)));
    const fcW = (a, b) => Math.max(1.5, Math.min(100, a / b * 100)).toFixed(1);
    const fcTot = ip + ret;
    const fcBig = !!this.state.fcBig;
    const fc = { bigCls: fcBig ? 'fx-big' : '', tapHint: fcBig ? 'Tap to go back to the flow chart' : 'Tap the chart for big numbers',
      tap: () => { if (window.innerWidth <= 760) this.setState({ fcBig: !fcBig }); }, on: fcView === 'chart', off: fcView !== 'chart', hasReq: true, hasPB: false,
      total: { title: 'Total voters', val: f(reg), w: fcW(fcTot, reg), pct: pc(fcTot, reg), cap: 'have already voted early · ' + f(fcTot) + ' ballots' },
      ip: { title: 'Voted early in person', val: f(ip), w: fcW(ip, reg), pct: pc(ip, reg), cap: 'of registered voters' },
      mail: { title: 'Requested a mail ballot', val: f(req), w: fcW(req, reg), pct: pc(req, reg), cap: 'of registered voters' },
      ret: { title: 'Returned', val: f(ret), w: fcW(ret, req), pct: pc(ret, req), cap: 'of mail requests' },
      out: { title: 'Outstanding', val: f(out), w: fcW(out, req), pct: pc(out, req), cap: 'of mail requests' },
      post: { title: '', val: '', w: 0, pct: '', cap: '' }, box: { title: '', val: '', w: 0, pct: '', cap: '' } };
    flow.forEach((lv) => lv.segs.forEach((sg) => { const fits = parseFloat(sg.w) >= 26; const share = (sg.of || '').split(' ')[0];
      sg.inside = fits ? sg.name + ' · ' + sg.val + ' · ' + share : ''; sg.legCls = fits ? 'fx-leg-opt' : ''; }));
    // comparison
    const { method, measure, win, show, hi } = this.state;
    const order = ['2026', '2026-special', '2025', '2024', '2023', '2022', '2021', '2020'];
    const val = (k, i) => { const s = H[k]; if (s.e[i] == null) return null; const v = method === 'all' ? s.e[i] + s.m[i] : method === 'early' ? s.e[i] : s.m[i]; return measure === 'pct' ? v / s.r * 100 : v; };
    const n = win === 'today' ? tIdx + 1 : win === 'election' ? 47 : 53;
    const vis = order.filter((k) => show[k] !== false || k === EID);
    const projVal = (i) => { const r23 = val('2025', tIdx), ri = val('2025', i), b = val(EID, tIdx); return r23 && ri != null ? b * ri / r23 : null; };
    let peak = 0;
    vis.forEach((k) => { for (let i = 0; i < n; i++) { const v = val(k, i); if (v != null) peak = Math.max(peak, v); } });
    if (live && win !== 'today') for (let i = tIdx; i < n; i++) { const v = projVal(i); if (v != null) peak = Math.max(peak, v); }
    const units = measure === 'pct' ? [0.25, 0.5, 1, 2, 2.5, 5, 10, 12.5] : [2500, 5000, 10000, 25000, 50000, 100000, 125000, 150000, 250000, 500000, 750000];
    const top = Math.min(...units.map((u) => Math.ceil(peak * 1.04 / (8 * u)) * 8 * u));
    // Taller chart on phones; a right gutter holds the line-end election labels.
    const narrow = this.state.narrow, CB = narrow ? 1000 : 500, XR = narrow ? 830 : 905;
    const X = (i) => 60 + i / (n - 1) * (XR - 60);
    const Y = (v) => CB - v / top * (CB - 20);
    const fmtV = (v) => v == null ? '—' : measure === 'pct' ? v.toFixed(2) + '%' : f(v);
    const fmtT = (v) => measure === 'pct' ? (+v.toFixed(2)) + '%' : short(v);
    const pathOf = (fn) => { let d = ''; let pen = false; for (let i = 0; i < n; i++) { const v = fn(i); if (v == null) { pen = false; continue; } d += (pen ? ' L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); pen = true; } return d; };
    const lines = vis.slice().reverse().map((k) => ({ d: pathOf((i) => val(k, i)), color: COLORS[k], w: k === EID ? (narrow ? 10 : 6) : (narrow ? 5 : 3) }));
    const hasProj = live && win !== 'today' && !!val('2025', tIdx);
    const proj = hasProj ? pathOf((i) => i < tIdx ? null : projVal(i)) : '';
    const yt = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => ({ y: CB - j * (CB - 20) / 8, ty: CB + 4 - j * (CB - 20) / 8, l: fmtT(top * j / 8), stroke: j === 0 ? '#121417' : '#ECEEF2' }));
    const dset = win === 'today' ? [45, 40, 35, 30, 25].filter((d) => 46 - d <= tIdx) : win === 'election' ? [40, 30, 20, 10, 0] : [40, 30, 20, 10, 0, -6];
    const xt = dset.map((d) => ({ x: X(46 - d).toFixed(1), l: d === 0 ? 'Election Day' : d < 0 ? (-d) + ' days after' : d + ' days' }));
    const todayX = X(tIdx);
    const hits = Array.from({ length: n }, (_, i) => ({ x: (X(i) - (XR - 60) / (n - 1) / 2).toFixed(1), w: ((XR - 60) / (n - 1)).toFixed(1), enter: () => this.setState({ hi: i }) }));
    const hasHi = hi != null && hi < n;
    let hiRows = [], hiDots = [], hiTitle = '';
    if (hasHi) {
      const d26 = new Date(start); d26.setDate(d26.getDate() + hi);
      hiTitle = (hi <= 46 ? 'E–' + (46 - hi) : 'E+' + (hi - 46)) + ' · ' + DOW[d26.getDay()] + ' ' + MON[d26.getMonth()] + ' ' + d26.getDate() + ', ' + EYR;
      const base = val(EID, hi);
      vis.forEach((k) => { const v = val(k, hi); hiRows.push({ color: COLORS[k], label: H[k].label, val: fmtV(v), rel: k !== EID && base != null && v ? Math.round(base / v * 100) + '%' : '' }); if (v != null) hiDots.push({ y: Y(v).toFixed(1), color: COLORS[k] }); });
      if (hasProj && hi > tIdx) { const pv = projVal(hi); if (pv != null) { hiRows.unshift({ color: '#00A37A', label: EYR + ' projected', val: fmtV(pv), rel: '' }); hiDots.push({ y: Y(pv).toFixed(1), color: '#00A37A' }); } }
    }
    const ends = [];
    vis.map((k) => ({ k, label: H[k].label, color: COLORS[k], cur: k === EID, v: (i) => val(k, i) })).forEach((L0) => { let li = -1; for (let i = 0; i < n; i++) if (L0.v(i) != null) li = i;
      if (li >= 0) ends.push({ x: X(li) + 10, y: Y(L0.v(li)), t: L0.label.replace('November ', 'Nov ').replace('April ', 'Apr ').replace(' special', ''), color: L0.color, fw: L0.cur ? 700 : 500 }); });
    // Spread labels that end at the same x so they don't overlap.
    const lgap = narrow ? 32 : 15;
    const groups = {}; ends.forEach((e2) => { (groups[Math.round(e2.x / 40)] = groups[Math.round(e2.x / 40)] || []).push(e2); });
    Object.values(groups).forEach((g) => { g.sort((a, b) => a.y - b.y);
      for (let i = 1; i < g.length; i++) if (g[i].y - g[i - 1].y < lgap) g[i].y = g[i - 1].y + lgap;
      const over = g[g.length - 1].y - CB; if (over > 0) { g[g.length - 1].y = CB; for (let i = g.length - 2; i >= 0; i--) if (g[i + 1].y - g[i].y < lgap) g[i].y = g[i + 1].y - lgap; } });
    ends.forEach((e2) => { e2.x = e2.x.toFixed(1); e2.y = e2.y.toFixed(1); });
    const ch = { todayY: narrow ? 28 : 12, ends, vb: '-20 0 1020 ' + (CB + 40), b: CB, b6: CB + 6, b26: CB + (narrow ? 40 : 26), b10: CB + 10, hasToday: live, todayLbl: 'THROUGH ' + md(D.asOf).toUpperCase(), lines, hasProj, proj, yt, xt, hits, anim: this.state.chTick % 2 ? 'fx-a' : 'fx-b',
      todayX: todayX.toFixed(1), todayLX: (win === 'today' ? todayX - 8 : todayX + 8).toFixed(1), todayAnchor: win === 'today' ? 'end' : 'start',
      yTitle: measure === 'pct' ? 'Share of registered voters' : 'Early ballots (running total)',
      hasHi, hiX: hasHi ? X(hi).toFixed(1) : 0, hiRows, hiDots, hiTitle, tipLeft: hasHi ? ((X(hi) + 20) / 10.2).toFixed(1) : 0, tipShift: hasHi && X(hi) > 560 ? 'calc(-100% - 16px)' : '16px',
      leave: () => this.setState({ hi: null }),
      note: 'Tooltip’s right column: ' + H[EID].label + ' as a share of that election on the same day.' + (hasProj ? ' Dotted green line: where ' + EYR + ' lands if it follows 2025’s pace from today.' : '') + (measure === 'pct' ? ' Shares use each election’s registered voters.' : '') };
    const bump = { hi: null, chTick: this.state.chTick + 1 };
    const opt = (label, key, cur, list) => ({ label, opts: list.map(([v, l]) => Object.assign({ label: l, pick: () => this.setState(Object.assign({ [key]: v }, bump)) }, pill(cur, v))) });
    const ctrls = [
      opt('Method', 'method', method, [['all', 'All early'], ['early', 'In person'], ['mail', 'By mail']]),
      opt('Measure', 'measure', measure, [['count', 'Ballots'], ['pct', '% of registered']]),
      opt('Timeline', 'win', win, (live ? [['today', 'Through today']] : []).concat([['election', 'Through Election Day'], ['deadline', 'Through mail deadline']]))
    ];
    const years = order.map((k) => { const on = show[k] !== false || k === EID; return { label: (H[k].label).replace('November ', 'Nov ').replace('April 2026 special', 'Apr 2026'), type: H[k].type, color: COLORS[k], on, locked: k === EID, border: on ? COLORS[k] : '#D3D7DE', bg: on ? '#FFFFFF' : '#F5F6F8', op: on ? 1 : 0.6,
      toggle: () => { if (k !== EID) this.setState(Object.assign({ show: Object.assign({}, show, { [k]: !on }) }, bump)); } }; });

    // calendar
    const calM = this.state.calM;
    const byDate = {}; rows.forEach((r) => { byDate[r.d] = r; });
    const dv = (r) => calM === 'all' ? r.de + r.dm : calM === 'early' ? r.de : r.dm;
    const maxDay = Math.max(1, ...rows.map(dv));
    const ramp = calM === 'mail' ? ['#FFFFFF', '#E9E1FB', '#BBA2F0', '#7C4DDB', '#4E2A9E'] : calM === 'early' ? ['#FFFFFF', '#D3F1E6', '#86D9BA', '#00A37A', '#006B50'] : ['#FFFFFF', '#DDE3EE', '#9AA9C4', '#41557F', '#1B2A6B'];
    const startCal = new Date(start); startCal.setDate(start.getDate() - start.getDay());
    const cal = [];
    for (let i = 0; i < 63; i++) {
      const d = new Date(startCal); d.setDate(startCal.getDate() + i);
      const k = iso(d), r = byDate[k];
      const inWin = k >= iso(start) && k <= dead;
      const isE = k === EDATE, afterE = k > EDATE;
      const sat = D.satOpen[k];
      let bg = '#FFFFFF', fg = '#121417', border = '2px solid #ECEEF2', kText = '';
      if (r) { const v = dv(r); const q = v / maxDay; const lv = q < 0.02 ? 0 : q < 0.35 ? 1 : q < 0.65 ? 2 : q < 0.9 ? 3 : 4;
        bg = ramp[lv]; fg = lv >= 3 ? '#FFFFFF' : '#121417'; border = lv === 0 ? '2px solid #D3D7DE' : '2px solid transparent'; kText = v ? f(v) : '–'; }
      else if (isE && live) { bg = '#FFD23F'; border = '2px solid #121417'; kText = 'Vote'; }
      else if (afterE && live) { bg = '#F8F9FB'; border = '2px dashed #B7BCC6'; kText = 'Mail'; }
      else if (inWin) { bg = '#F5F6F8'; border = '2px dashed #C6CBD4'; }
      const selected = this.state.cal === k; if (selected) border = '3px solid #121417';
      cal.push({ day: d.getDate() === 1 || k === iso(start) ? MON[d.getMonth()] + ' ' + d.getDate() : String(d.getDate()), k: kText,
        mark: isE ? '★' : sat ? '▲' + sat.n : '', bg, fg, border, vis: inWin ? 'visible' : 'hidden', display: i >= 56 && !inWin ? 'none' : 'flex',
        pressed: selected ? 'true' : 'false', anim: this.state.calTick % 2 ? 'fx-pa' : 'fx-pb', delay: (i * 10) + 'ms',
        aria: dmd(k) + (r ? ': ' + f(dv(r)) + ' ballots' : ''),
        move: (ev) => { if (inWin) this.setState({ cal: k, tip: this.tipAt(ev, 'cal', k) }); } });
    }
    const calInfo0 = (k) => {
      const sd = parse(k), sr = byDate[k], so = D.satOpen[k];
      const dayN = Math.round((sd - start) / 864e5) + 1;
      const list = so ? Object.keys(so.locs).sort().map((nm) => ({ k: nm, v: so.locs[nm] + (so.locs[nm] === 1 ? ' site' : ' sites') })) : [];
      const base = { hasList: list.length > 0, listHead: 'Satellites opening this day', list };
      if (sr) return Object.assign(base, { kicker: dayN > 47 ? 'E+' + (dayN - 47) : dayN === 47 ? 'Election Day' : 'E–' + (47 - dayN), title: dmd(k), sub: 'Statewide ballots added this day',
        rows: [{ k: 'In person', v: f(sr.de) }, { k: 'By mail', v: f(sr.dm) }, { k: 'Total that day', v: f(sr.de + sr.dm) }, { k: 'Running total', v: f(sr.e + sr.m) }, { k: 'Turnout so far', v: ((sr.e + sr.m) / D.reg * 100).toFixed(2) + '%' }, { k: 'Mail outstanding', v: f(sr.o) }] });
      if (k === EDATE) return Object.assign(base, { kicker: 'Election Day', title: dmd(EDATE), sub: 'Polls open 6 AM – 7 PM', rows: [] });
      if (k > EDATE) return Object.assign(base, { kicker: 'After Election Day', title: dmd(k), sub: 'Mail ballots postmarked by Election Day still count', rows: [{ k: 'Deadline', v: dmd(dead) }] });
      return Object.assign(base, { kicker: 'Upcoming · E–' + (47 - dayN), title: dmd(k), sub: 'No ballots reported yet', rows: [{ k: 'Satellite sites opening', v: so ? String(so.n) : '—' }, { k: 'Days until Election Day', v: String(Math.round((eDay - sd) / 864e5)) }] });
    };
    const pieOf = (r) => { if (!r || !(r.de + r.dm)) return { hasPie: false }; const pE = r.de / (r.de + r.dm) * 100; return { hasPie: true, pieE: pE.toFixed(1), pieRest: (100 - pE).toFixed(1), pctE: Math.round(pE) + '%', pctM: Math.round(100 - pE) + '%' }; };
    const calInfo = (k) => Object.assign(calInfo0(k), pieOf(byDate[k]));
    const sel = calInfo(this.state.cal || D.asOf);
    const calOpts = [['all', 'All'], ['early', 'In person'], ['mail', 'By mail']].map(([v, label]) => Object.assign({ label, pick: () => this.setState({ calM: v, calTick: this.state.calTick + 1 }) }, pill(calM, v)));

    // maps (three small multiples)
    const mm = this.state.mapMeasure === 'v' ? 'v' : 'p';
    const GR = ['#E6F6F0', '#B3E6D3', '#5CC9A3', '#00A37A', '#006B50'], PU = ['#F1ECFC', '#D6C7F5', '#A98BE8', '#7C4DDB', '#4E2A9E'];
    const mdefs = [['all', 'All early votes', (o) => o.v, GR, '#00A37A'], ['e', 'In person', (o) => o.e, GR, '#00A37A'], ['m', 'By mail', (o) => o.m, GR, '#00A37A']];
    const maps = mdefs.map(([id, title, get, pal, border]) => {
      const mv = (o) => mm === 'p' ? get(o) / o.r * 100 : get(o);
      const vs = D.locs.map(mv).sort((a, b) => a - b);
      const qs = [0.2, 0.4, 0.6, 0.8].map((q) => vs[Math.floor(q * (vs.length - 1))]);
      const bin = (v) => { let i = 0; while (i < 4 && v > qs[i]) i++; return i; };
      const fq = (v) => mm === 'p' ? v.toFixed(1) + '%' : short(v);
      const sum = D.locs.reduce((a, o) => a + get(o), 0);
      return { id, title, border, aria: title + ' by locality', total: mm === 'p' ? (sum / D.reg * 100).toFixed(1) + '% statewide' : f(sum) + ' statewide',
        bins: pal.map((c, i) => ({ c, l: i === 0 ? '≤' + fq(qs[0]) : i === 4 ? '>' + fq(qs[3]) : fq(qs[i]) })),
        paths: D.locs.map((o) => { const h = this.state.hover === o.id; return { d: o.d, fill: h ? '#FFD23F' : pal[bin(mv(o))], stroke: h ? '#121417' : '#FFFFFF', sw: h ? 2.5 : 0.8,
          delay: Math.round(parseFloat(o.d.slice(1)) * 0.9) + 'ms', move: (ev) => this.setState({ hover: o.id, tip: this.tipAt(ev, 'map', o.id) }) }; }) };
    });
    const mapOpts = [['p', '% of registered'], ['v', 'Ballots']].map(([k, label]) => Object.assign({ label, pick: () => this.setState({ mapMeasure: k }) }, pill(mm, k)));
    const mapSel = this.state.mapSel || 'all';
    const mapPick = [['all', 'All'], ['e', 'In person'], ['m', 'Mail']].map(([k, label]) => Object.assign({ label, pick: () => this.setState({ mapSel: k }) }, pill(mapSel, k)));
    const nextTxt = (x) => x === 'open' ? 'Open now' : x ? dmd(x) : '—';
    const linkOf = (id) => '/' + EID + '/' + id;
    const locInfo = (ho) => ({ kicker: ho.rg, title: ho.n, sub: ho.p.toFixed(1) + (live ? '% turnout so far' : '% early turnout'), hasLink: true, href: linkOf(ho.id), hasList: false, list: [],
      rows: [{ k: 'Registered voters', v: f(ho.r) }, { k: 'Active voters', v: f(ho.ac) }, { k: 'Early ballots', v: f(ho.v) }, { k: 'In person', v: f(ho.e) + ' · ' + (ho.e / ho.r * 100).toFixed(1) + '%' }, { k: 'By mail', v: f(ho.m) + ' · ' + (ho.m / ho.r * 100).toFixed(1) + '%' }, { k: 'Mail outstanding', v: f(ho.o) } ].concat(live ? [{ k: 'vs. 2025, same day', v: ho.c ? ho.c + '%' : '—' }, { k: 'Satellite sites', v: ho.sat ? String(ho.sat) : 'None' }, { k: 'Next satellites open', v: nextTxt(ho.next) }] : []) });
    const ho = D.locs.find((o) => o.id === this.state.hover);
    const hov = ho ? locInfo(ho) : { kicker: 'Statewide', title: 'Virginia', sub: (total / D.reg * 100).toFixed(1) + (live ? '% turnout so far' : '% early turnout'), hasLink: false, href: '#',
      rows: [{ k: 'Registered voters', v: f(D.reg) }, { k: 'Active voters', v: f(D.active) }, { k: 'Early ballots', v: f(total) }, { k: 'In person · by mail', v: f(last.e) + ' · ' + f(last.m) }, { k: 'Mail outstanding', v: f(last.o) } ].concat(live ? [{ k: 'Satellite sites', v: String(D.locs.reduce((a, o) => a + o.sat, 0)) }, { k: 'Next satellites open', v: nextSat ? dmd(nextSat) : '—' }] : []) };

    // floating tooltip
    const tp = this.state.tip;
    let tip = { on: false };
    if (tp) {
      const info = tp.kind === 'cal' ? calInfo(tp.key) : locInfo(D.locs.find((o) => o.id === tp.key));
      tip = Object.assign({ on: true, x: tp.x, y: tp.y }, info, { list: (info.list || []).slice(0, 8) });
    }

    // table
    const { sortKey, sortDir, all, q, region } = this.state;
    const L2 = D.locs.map((o) => Object.assign({}, o, { ep: o.e / o.r * 100, mp: o.m / o.r * 100, rr: o.m + o.o ? o.m / (o.m + o.o) * 100 : null }));
    const colDefs = [['n', 'Locality', 'left'], ['r', 'Registered', 'right'], ['p', 'Turnout', 'right'], ['ep', 'In person', 'right'], ['mp', 'By mail', 'right'], ['rr', 'Mail return rate', 'right'], ['c', live ? 'vs. 2025' : 'vs. 2025', 'right'], ['sat', 'Satellites', 'center'], ['next', 'Next opens', 'right']];
    const cols = colDefs.map(([k, label, align]) => ({ label, align, arrow: sortKey === k ? (sortDir < 0 ? '↓' : '↑') : '', pick: () => this.setState({ sortKey: k, sortDir: sortKey === k ? -sortDir : (k === 'n' || k === 'next' ? 1 : -1) }) }));
    const quick = [['n', 1, 'A–Z'], ['r', -1, 'Size'], ['p', -1, 'Turnout']].map(([k, dir, label]) => Object.assign({ label, pick: () => this.setState({ sortKey: k, sortDir: dir }) }, pill(sortKey, k)));
    const filtered = L2.filter((o) => (!q || o.n.toLowerCase().includes(q.toLowerCase())) && (!region || o.rg === region));
    const keyOf = (o) => sortKey === 'next' ? (o.next === 'open' ? '0' : o.next || 'z') : o[sortKey];
    const sorted = filtered.slice().sort((a, b) => { const av = keyOf(a), bv = keyOf(b); if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * sortDir; return ((av ?? -1) - (bv ?? -1)) * sortDir; });
    const maxP = Math.max(...L2.map((o) => o.p));
    const shown = all || q || region ? sorted : sorted.slice(0, 15);
    const trows = shown.map((o) => ({ name: o.n, region: o.rg, reg: f(o.r), p: o.p.toFixed(1), v: f(o.v), w: (o.p / maxP * 100).toFixed(1), ep: o.ep.toFixed(1), e: f(o.e), mp: o.mp.toFixed(1), m: f(o.m),
      rr: o.rr == null ? '—' : o.rr.toFixed(0) + '%', out: f(o.o), c: o.c ? o.c + '%' : '—',
      cbg: o.c == null ? '#F1F2F5' : o.c >= 100 ? '#D3F1E6' : '#E4D9FA', cfg: o.c == null ? '#4A5260' : o.c >= 100 ? '#00694F' : '#4E2A9E',
      sat: o.sat ? String(o.sat) : '—', next: live ? nextTxt(o.next) : '—', href: linkOf(o.id) }));

    const top6 = D.locs.slice().sort((a, b) => b.v - a.v).slice(0, 6);
    const ticker0 = top6.map((o, i) => ({ name: o.n, val: f(o.v) + ' · ' + o.p.toFixed(1) + '%', dot: i % 2 ? '#7C4DDB' : '#00A37A' }));
    if (nextSat) ticker0.splice(3, 0, { name: 'Satellites opening ' + dmd(nextSat), val: String(D.satOpen[nextSat].n), dot: '#FFD23F' });
    ticker0.push({ name: 'Mail ballots outstanding', val: f(last.o), dot: '#7C4DDB' });

    const pqs = D.locs.map((o) => o.p).sort((a, b) => a - b), pq = [0.25, 0.5, 0.75].map((x) => pqs[Math.floor(x * (pqs.length - 1))]);
    return {
      eid: EID, label: D.label, box,
      hdr: { eid: EID, lid: '',
        elections: D.elections.map((o) => ({ value: o.id, text: o.label.replace('April 2026 special', 'April 2026') + ' · ' + o.type })),
        locs: [{ value: '', text: 'All of Virginia' }].concat(D.locs.slice().sort((a, b) => a.n.localeCompare(b.n)).map((o) => ({ value: o.id, text: o.n }))),
        pickE: (ev) => { location.href = ev.target.value === '2026' ? '/' : '/' + ev.target.value; },
        pickL: (ev) => { if (ev.target.value) location.href = linkOf(ev.target.value); } },
      band: { asOf: dmd(D.asOf) },
      mini: D.locs.map((o) => { const q = o.p; return { d: o.d, fill: q < pq[0] ? '#B3E6D3' : q < pq[1] ? '#5CC9A3' : q < pq[2] ? '#00A37A' : '#006B50', delay: Math.round(parseFloat(o.d.slice(1)) * 1.4 + 300) + 'ms' }; }),
      fc, fcOpts,
      loading: false, ready: true, asOf: dmd(D.asOf), hero, cd, paceChips, satLine, flow, ctrls, years, ch, cal, sel, calOpts, calRamp: ramp.slice(1),
      maps, mapOpts, mapSel, mapPick, hov, tip, hideTip, cols, quick, rows: trows,
      countLabel: 'Showing ' + trows.length + ' of ' + filtered.length, allLabel: all ? 'Show top 15' : 'Show all 133', toggleAll: () => this.setState({ all: !all }),
      onSearch: (ev) => this.setState({ q: ev.target.value }), onRegion: (ev) => this.setState({ region: ev.target.value }),
      ticker: ticker0.concat(ticker0, ticker0)
    };
  }
}

VF.page('home', Home);
