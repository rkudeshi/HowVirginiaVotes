class Locality extends DCLogic {
  constructor(props) {
    super(props);
    this.SRC = '/data/loc/' + props.lid + '.json';
    this.state = { narrow: window.innerWidth < 600, data: null, t: 0, now: Date.now(), eid: props.eid, method: 'all', measure: 'count', win: 'today', show: {}, chTick: 0, hi: null, cal: null, calM: 'all', calTick: 0, tip: null, pIdx: null, pMeasure: 'p', pMethod: 'all', pHover: null, playing: false };
  }
  componentDidMount() {
    this.clock = setInterval(() => this.setState({ now: Date.now() }), 60000);
    this.onScroll = () => { if (this.state.tip || this.state.hi != null) this.setState({ tip: null, hi: null }); };
    this.onResize = () => { const nw = window.innerWidth < 600; if (nw !== this.state.narrow) this.setState({ narrow: nw, hi: null }); };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);

    fetch(this.SRC).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((data) => {
      const show = {}; data.elections.forEach((x) => { show[x.id] = true; });
      const eid = data.elections.some((x) => x.id === this.state.eid) ? this.state.eid : '2026';
      this.setState({ data, show, eid, pIdx: data.pdates.length - 1 });
      const s = performance.now();
      const step = (n) => { const t = Math.min(1, (n - s) / 1800); this.setState({ t }); if (t < 1) this.raf = requestAnimationFrame(step); };
      this.raf = requestAnimationFrame(step);
    }).catch(() => { location.replace('/' + this.props.eid); });
  }
  componentDidUpdate() {
    const D = this.state.data; if (!D) return;
    const cur = D.elections.find((x) => x.id === this.state.eid);
    const path = '/' + this.state.eid + '/' + D.id;
    if (location.pathname.replace(/\/scenarios$|\/$/, '') !== path) history.replaceState(null, '', path);
    const title = D.name + (cur && this.state.eid !== '2026' ? ' · ' + cur.label : '') + ' · VoteFlow';
    if (document.title !== title) document.title = title;
  }
  componentWillUnmount() { cancelAnimationFrame(this.raf); clearInterval(this.clock); clearInterval(this.player); window.removeEventListener('scroll', this.onScroll); window.removeEventListener('resize', this.onResize); }
  tipAt(ev, kind, key) {
    const W = window.innerWidth, H = window.innerHeight;
    let x = ev.clientX + 18, y = ev.clientY + 18;
    if (x + 310 > W) x = ev.clientX - 318;
    if (y + 360 > H) y = Math.max(8, ev.clientY - 370);
    return { kind, key, x: Math.max(8, x), y };
  }
  renderVals() {
    const D = this.state.data;
    const f = (n) => n == null ? '—' : Math.round(n).toLocaleString('en-US');
    const fz = (n) => !n ? '–' : Math.round(n).toLocaleString('en-US');
    const short = (n) => n >= 1e6 ? (n / 1e6).toFixed(2).replace(/0$/, '') + 'M' : n >= 1e4 ? Math.round(n / 1000) + 'K' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(Math.round(n));
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const parse = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const md = (s) => { const d = parse(s); return MON[d.getMonth()] + ' ' + d.getDate(); };
    const dmd = (s) => { const d = parse(s); return DOW[d.getDay()] + ' ' + MON[d.getMonth()] + ' ' + d.getDate(); };
    const pill = (cur, v) => ({ pressed: cur === v ? 'true' : 'false', bg: cur === v ? '#121417' : '#FFFFFF', fg: cur === v ? '#FFFFFF' : '#121417' });
    const hideTip = () => this.setState({ tip: null });

    const target = Date.UTC(2026, 10, 3, 11, 0, 0); // 6 AM Eastern (EST, UTC−5) on Nov 3
    const left = Math.max(0, target - this.state.now);
    const evStart = new Date(2026, 8, 18).getTime();
    const frac = Math.min(1, Math.max(0, (this.state.now - evStart) / (target - evStart)));
    const cdS = Math.floor(left % 6e4 / 1000);
    const cd = { label: left > 0 ? 'Election Day polls open in' : 'Polls are open', days: Math.floor(left / 864e5), h: String(Math.floor(left % 864e5 / 36e5)).padStart(2, '0'), m: String(Math.floor(left % 36e5 / 6e4)).padStart(2, '0'), s: String(cdS).padStart(2, '0'), anim: cdS % 2 ? 'fx-pa' : 'fx-pb', offset: (339.3 * (1 - frac)).toFixed(1) };
    if (!D) return { loading: true, ready: false, ticker: [], tip: { on: false }, cd, band: { asOf: '…' }, hdr: { elections: [], locs: [] } };

    const e = this.state.t >= 1 ? 1 : 1 - Math.pow(2, -10 * this.state.t);
    const { eid } = this.state;
    const T = D.tIdx, TL = 'E–' + (46 - T);
    const EL = D.elections;
    const cur = EL.find((x) => x.id === eid) || EL[0];
    const live = cur.id === '2026';
    const COLORS = { '2026': '#00A37A', '2026-special': '#6B7F1A', '2025': '#7C4DDB', '2024': '#121417', '2023': '#B7791F', '2022': '#8C5A00', '2021': '#8A8F99', '2020': '#A68A00' };
    const L = { name: D.name, region: D.region, rankV: D.rankV, rankP: D.rankP };
    const eDate = parse(cur.date);
    const typeLabel = cur.type + ' election · ' + DOWL[eDate.getDay()] + ', ' + MON[eDate.getMonth()] + ' ' + eDate.getDate() + ', ' + eDate.getFullYear();

    const elChips = EL.map((x) => { const on = x.id === eid; return { label: x.label.replace('November ', 'Nov ').replace('April 2026 special', 'Apr 2026 · special'), sub: f(x.total) + (x.final ? ' final' : ' so far'), sub2: (x.total / x.reg * 100).toFixed(1) + '% turnout',
      pressed: on ? 'true' : 'false', border: on ? '#121417' : '#D3D7DE', bg: on ? '#121417' : '#FFFFFF', fg: on ? '#FFFFFF' : '#121417',
      pick: () => this.setState({ eid: x.id, show: Object.assign({}, this.state.show, { [x.id]: true }), cal: null, hi: null, tip: null, calTick: this.state.calTick + 1, chTick: this.state.chTick + 1 }) }; });

    const tot = cur.total, k = live ? e : 1;
    // Size both hero numbers so they share one line when the card is wide enough (Unbounded 700 glyph widths, in em).
    const emW = (s) => Array.from(s).reduce((a, ch) => a + (ch === ',' || ch === '.' ? 0.3 : ch === '%' ? 1.29 : ch === '1' ? 0.52 : 0.9) - 0.04, 0);
    const heroFs = (pct, n) => 'clamp(28px, calc((100cqi - 52px) / ' + (emW(pct + '%') + emW(f(n))).toFixed(2) + '), 96px)';
    const hero = { pctLbl: live ? 'turnout so far' : 'early turnout', fs: heroFs((tot / cur.reg * 100).toFixed(1), tot), live, past: !live, kicker: live ? 'Early votes cast · through ' + dmd(D.rows[D.rows.length - 1].d) : cur.label + ' · final early vote',
      votes: f(tot * k), pct: (tot / cur.reg * 100 * k).toFixed(1), reg: f(cur.reg), regNote: '.',
      ip: f(cur.early * k), m: f(cur.mail * k), ipW: (cur.early / tot * 100).toFixed(1), mW: (cur.mail / tot * 100).toFixed(1),
      dateLabel: MON[eDate.getMonth()] + ' ' + eDate.getDate() + ', ' + eDate.getFullYear(), typeLabel, atT: f(cur.atT), TL };
    // Pace chips, newest election first. The live election compares at today's point; a past
    // election compares with the live one at today's point and with other past ones in total.
    const refOrder = ['2026', '2026-special', '2025', '2024', '2022', '2021', '2020'];
    const ref = refOrder.map((id) => EL.find((x) => x.id === id)).filter((x) => x && x.id !== eid
      && (live ? x.atT : x.id === '2026' ? cur.atT && x.atT : x.total)).slice(0, 4);
    const paceChips = ref.map((x) => { const sameDay = live || x.id === '2026';
      const ratio = sameDay ? cur.atT / x.atT : cur.total / x.total;
      return { ratio: Math.round(ratio * 100) + '%', label: 'of ' + x.label.replace(' special', '') + (sameDay ? ' at this point' : ' overall'), border: COLORS[x.id] }; });
    const satLine = D.sat ? D.sat + (D.sat === 1 ? ' satellite site · ' : ' satellite sites · ') + (D.next === 'open' ? 'all open' : 'next open ' + dmd(D.next)) : 'Registrar’s office only, no satellites';

    // flow
    const reg = cur.reg, ip = cur.early, ret = cur.mail;
    const fx = D.fxMail && D.fxMail[cur.id];
    const out = cur.out != null ? cur.out : (fx && fx.sent ? Math.max(0, fx.sent - ret) : null);
    const req = out != null ? ret + out : null;
    const pc = (a, b) => (a / b * 100).toFixed(a / b < 0.1 ? 1 : 0) + '%';
    const engaged = ip + (req != null ? req : ret), none = reg - engaged;
    const noneName = live ? 'No early ballot yet' : 'Did not vote early';
    const hasPBflow = req != null && fx && fx.through === cur.through && fx.post != null && fx.box != null && fx.post + fx.box === ret;
    const flow = [
      { kicker: 'Registered voters', title: f(reg), hasRib: true, a: 0, b: (engaged / reg * 100).toFixed(2), ribDelay: '.6s',
        segs: [
          { name: 'Voted early in person', val: f(ip), of: pc(ip, reg) + ' of registered', w: (ip / reg * 100).toFixed(2), bg: '#00A37A', fg: '#FFFFFF', inside: '', delay: '0s', outline: 'none' },
          { name: req != null ? 'Requested a mail ballot' : 'Returned a mail ballot', val: f(req != null ? req : ret), of: pc(req != null ? req : ret, reg) + ' of registered', w: ((req != null ? req : ret) / reg * 100).toFixed(2), bg: '#7C4DDB', fg: '#121417', inside: '', delay: '.15s', outline: 'none' },
          { name: noneName, val: f(none), of: pc(none, reg) + ' of registered', w: (none / reg * 100).toFixed(2), bg: '#DCDFE5', fg: '#121417', inside: noneName + ' · ' + pc(none, reg), delay: '.3s', outline: 'none' }
        ] },
      { kicker: 'Voted in person or asked for a mail ballot', title: f(engaged), hasRib: req != null, a: (ip / engaged * 100).toFixed(2), b: 100, ribDelay: '1.2s',
        segs: [
          { name: 'In person', val: f(ip), of: pc(ip, engaged) + ' of this group', w: (ip / engaged * 100).toFixed(2), bg: '#00A37A', fg: '#FFFFFF', inside: 'In person · ' + pc(ip, engaged), delay: '.8s', outline: 'none' },
          { name: 'Mail', val: f(engaged - ip), of: pc(engaged - ip, engaged) + ' of this group', w: ((engaged - ip) / engaged * 100).toFixed(2), bg: '#7C4DDB', fg: '#121417', inside: 'Mail · ' + pc(engaged - ip, engaged), delay: '.95s', outline: req != null ? '2px solid #121417' : 'none' }
        ] }
    ];
    if (req != null) {
      const r3 = ret / req * 100;
      flow.push({ kicker: 'Mail ballots requested', title: f(req), hasRib: hasPBflow, a: 0, b: r3.toFixed(2), ribDelay: '1.8s',
        segs: [
          { name: 'Returned', val: f(ret), of: pc(ret, req) + ' of requested · ' + pc(ret, reg) + ' of registered', w: r3.toFixed(2), bg: '#5B2FB8', fg: '#FFFFFF', inside: 'Returned · ' + pc(ret, req), delay: '1.5s', outline: hasPBflow ? '2px solid #121417' : 'none' },
          { name: live ? 'Outstanding' : 'Never returned', val: f(out), of: pc(out, req) + ' of requested', w: (100 - r3).toFixed(2), bg: '#E4D9FA', fg: '#121417', inside: (live ? 'Outstanding · ' : 'Not returned · ') + pc(out, req), delay: '1.65s', outline: 'none' }
        ] });
      if (hasPBflow) {
        const pb = fx.post + fx.box;
        flow.push({ kicker: 'How returned ballots came back · county report', title: f(pb), hasRib: false,
          segs: [
            { name: 'By post', val: f(fx.post), of: pc(fx.post, pb) + ' of returned', w: (fx.post / pb * 100).toFixed(2), bg: '#121417', fg: '#FFFFFF', inside: 'By post · ' + pc(fx.post, pb), delay: '2.1s', outline: 'none' },
            { name: 'Drop box', val: f(fx.box), of: pc(fx.box, pb) + ' of returned', w: (fx.box / pb * 100).toFixed(2), bg: '#FFD23F', fg: '#121417', inside: 'Drop box · ' + pc(fx.box, pb), delay: '2.25s', outline: 'none' }
          ] });
      }
    }
    const flowNote = 'Each step zooms into the outlined slice above it.' + (fx ? ' County mail details are through ' + dmd(fx.through) + '; the latest totals use DAL until county figures are available for the same date.' : '') + (cur.out == null && fx ? ' Mail requests use the county’s count of ballots sent.' : '');

    const fcView = this.state.flowView || 'chart';
    const fcOpts = [['chart', 'Flow chart'], ['bars', 'Bars']].map(([v, label]) => Object.assign({ label, pick: () => this.setState({ flowView: v }) }, pill(fcView, v)));
    const fcW = (a, b) => Math.max(1.5, Math.min(100, a / b * 100)).toFixed(1);
    const fcTot = ip + ret;
    const fcPB = hasPBflow ? fx.post + fx.box : 1;
    const fcBig = !!this.state.fcBig;
    const fc = { bigCls: fcBig ? 'fx-big' : '', tapHint: fcBig ? 'Tap to go back to the flow chart' : 'Tap the chart for big numbers',
      tap: () => { if (window.innerWidth <= 760) this.setState({ fcBig: !fcBig }); }, on: fcView === 'chart', off: fcView !== 'chart', hasReq: req != null, hasPB: !!hasPBflow,
      total: { title: 'Total voters', val: f(reg), w: fcW(fcTot, reg), pct: pc(fcTot, reg), cap: 'have already voted early · ' + f(fcTot) + ' ballots' },
      ip: { title: 'Voted early in person', val: f(ip), w: fcW(ip, reg), pct: pc(ip, reg), cap: 'of registered voters' },
      mail: { title: req != null ? 'Requested a mail ballot' : 'Returned a mail ballot', val: f(req != null ? req : ret), w: fcW(req != null ? req : ret, reg), pct: pc(req != null ? req : ret, reg), cap: 'of registered voters' },
      ret: { title: 'Returned', val: f(ret), w: req ? fcW(ret, req) : 0, pct: req ? pc(ret, req) : '', cap: 'of mail requests' },
      out: { title: live ? 'Outstanding' : 'Never returned', val: f(out), w: req ? fcW(out || 0, req) : 0, pct: req ? pc(out || 0, req) : '', cap: 'of mail requests' },
      post: { title: 'By mail', val: hasPBflow ? f(fx.post) : '', w: hasPBflow ? fcW(fx.post, fcPB) : 0, pct: hasPBflow ? pc(fx.post, fcPB) : '', cap: 'of returned mail ballots' },
      box: { title: 'By dropbox', val: hasPBflow ? f(fx.box) : '', w: hasPBflow ? fcW(fx.box, fcPB) : 0, pct: hasPBflow ? pc(fx.box, fcPB) : '', cap: 'of returned mail ballots' } };
    flow.forEach((lv) => lv.segs.forEach((sg) => { const fits = parseFloat(sg.w) >= 26; const share = (sg.of || '').split(' ')[0];
      sg.inside = fits ? sg.name + ' · ' + sg.val + ' · ' + share : ''; sg.legCls = fits ? 'fx-leg-opt' : ''; }));
    // comparison
    const { method, measure, win, show, hi } = this.state;
    const visEl = EL.filter((x) => x.series && (show[x.id] || x.id === eid));
    const val = (x, i) => { const s = x.series; if (!s || s.e[i] == null) return null; const v = method === 'all' ? s.e[i] + s.m[i] : method === 'early' ? s.e[i] : s.m[i]; return measure === 'pct' ? v / s.r * 100 : v; };
    const n = win === 'today' ? T + 1 : win === 'election' ? 47 : 53;
    const e26 = EL.find((x) => x.id === '2026'), e25 = EL.find((x) => x.id === '2025');
    const projVal = (i) => { const r23 = val(e25, T), ri = val(e25, i), b = val(e26, T); return r23 && ri != null && b != null ? b * ri / r23 : null; };
    const hasProj = win !== 'today' && e25 && visEl.includes(e26) && !!val(e25, T);
    let peak = 0; visEl.forEach((x) => { for (let i = 0; i < n; i++) { const v = val(x, i); if (v != null) peak = Math.max(peak, v); } });
    if (hasProj) for (let i = T; i < n; i++) { const v = projVal(i); if (v != null) peak = Math.max(peak, v); }
    const units = measure === 'pct' ? [0.25, 0.5, 1, 2, 2.5, 5, 10, 12.5] : [250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
    const top = Math.min(...units.map((u) => Math.ceil(Math.max(peak, 1) * 1.04 / (8 * u)) * 8 * u));
    // Taller chart on phones; a right gutter holds the line-end election labels.
    const narrow = this.state.narrow, CB = narrow ? 1000 : 500, XR = narrow ? 830 : 905;
    const X = (i) => 60 + i / (n - 1) * (XR - 60);
    const Y = (v) => CB - v / top * (CB - 20);
    const fmtV = (v) => v == null ? '—' : measure === 'pct' ? v.toFixed(2) + '%' : f(v);
    const fmtT = (v) => measure === 'pct' ? (+v.toFixed(2)) + '%' : short(v);
    const pathOf = (fn) => { let d = ''; let pen = false; for (let i = 0; i < n; i++) { const v = fn(i); if (v == null) { pen = false; continue; } d += (pen ? ' L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); pen = true; } return d; };
    const lines = visEl.slice().sort((a, b) => (a.id === eid) - (b.id === eid)).map((x) => ({ d: pathOf((i) => val(x, i)), color: COLORS[x.id], w: x.id === eid ? (narrow ? 10 : 6) : (narrow ? 5 : 3) }));
    const proj = hasProj ? pathOf((i) => i < T ? null : projVal(i)) : '';
    const yt = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => ({ y: CB - j * (CB - 20) / 8, ty: CB + 4 - j * (CB - 20) / 8, l: fmtT(top * j / 8), stroke: j === 0 ? '#121417' : '#ECEEF2' }));
    const dset = win === 'today' ? [45, 40, 35, 30, 25].filter((d) => 46 - d <= T) : win === 'election' ? [40, 30, 20, 10, 0] : [40, 30, 20, 10, 0, -6];
    const xt = dset.map((d) => ({ x: X(46 - d).toFixed(1), l: d === 0 ? 'Election Day' : d < 0 ? (-d) + ' days after' : d + ' days' }));
    const todayX = X(T);
    const hits = Array.from({ length: n }, (_, i) => ({ x: (X(i) - (XR - 60) / (n - 1) / 2).toFixed(1), w: ((XR - 60) / (n - 1)).toFixed(1), enter: () => this.setState({ hi: i }) }));
    const hasHi = hi != null && hi < n;
    let hiRows = [], hiDots = [], hiTitle = '';
    if (hasHi) {
      const dd = new Date(eDate); dd.setDate(dd.getDate() - (46 - hi));
      hiTitle = (hi <= 46 ? 'E–' + (46 - hi) : 'E+' + (hi - 46)) + ' · ' + DOW[dd.getDay()] + ' ' + MON[dd.getMonth()] + ' ' + dd.getDate() + ', ' + dd.getFullYear();
      const base = val(cur, hi);
      visEl.forEach((x) => { const v = val(x, hi); hiRows.push({ color: COLORS[x.id], label: x.label, val: fmtV(v), rel: x.id !== eid && base != null && v ? Math.round(base / v * 100) + '%' : '' }); if (v != null) hiDots.push({ y: Y(v).toFixed(1), color: COLORS[x.id] }); });
      if (hasProj && hi > T) { const pv = projVal(hi); if (pv != null) { hiRows.unshift({ color: '#00A37A', label: '2026 projected', val: fmtV(pv), rel: '' }); hiDots.push({ y: Y(pv).toFixed(1), color: '#00A37A' }); } }
    }
    const ends = [];
    visEl.map((x) => ({ k: x.id, label: x.label, color: COLORS[x.id], cur: x.id === eid, v: (i) => val(x, i) })).forEach((L0) => { let li = -1; for (let i = 0; i < n; i++) if (L0.v(i) != null) li = i;
      if (li >= 0) ends.push({ x: X(li) + 10, y: Y(L0.v(li)), t: L0.label.replace('November ', 'Nov ').replace('April ', 'Apr ').replace(' special', ''), color: L0.color, fw: L0.cur ? 700 : 500 }); });
    // Spread labels that end at the same x so they don't overlap.
    const lgap = narrow ? 32 : 15;
    const groups = {}; ends.forEach((e2) => { (groups[Math.round(e2.x / 40)] = groups[Math.round(e2.x / 40)] || []).push(e2); });
    Object.values(groups).forEach((g) => { g.sort((a, b) => a.y - b.y);
      for (let i = 1; i < g.length; i++) if (g[i].y - g[i - 1].y < lgap) g[i].y = g[i - 1].y + lgap;
      const over = g[g.length - 1].y - CB; if (over > 0) { g[g.length - 1].y = CB; for (let i = g.length - 2; i >= 0; i--) if (g[i + 1].y - g[i].y < lgap) g[i].y = g[i + 1].y - lgap; } });
    ends.forEach((e2) => { e2.x = e2.x.toFixed(1); e2.y = e2.y.toFixed(1); });
    const ch = { todayY: narrow ? 28 : 12, ends, vb: '-20 0 1020 ' + (CB + 40), b: CB, b6: CB + 6, b26: CB + (narrow ? 40 : 26), b10: CB + 10, todayLbl: 'THROUGH ' + md(D.asOf).toUpperCase(), lines, hasProj, proj, yt, xt, hits, anim: this.state.chTick % 2 ? 'fx-a' : 'fx-b',
      todayX: todayX.toFixed(1), todayLX: (win === 'today' ? todayX - 8 : todayX + 8).toFixed(1), todayAnchor: win === 'today' ? 'end' : 'start',
      yTitle: measure === 'pct' ? 'Share of registered voters' : 'Early ballots (running total)',
      hasHi, hiX: hasHi ? X(hi).toFixed(1) : 0, hiRows, hiDots, hiTitle, tipLeft: hasHi ? ((X(hi) + 20) / 10.2).toFixed(1) : 0, tipShift: hasHi && X(hi) > 560 ? 'calc(-100% - 16px)' : '16px',
      leave: () => this.setState({ hi: null }),
      note: 'Thick line: ' + cur.label + '. Tooltip’s right column: ' + cur.label + ' as a share of that election on the same day.' + (hasProj ? ' Dotted green line: where 2026 lands if it follows 2025’s pace from today.' : '') };
    const bump = { hi: null, chTick: this.state.chTick + 1 };
    const opt = (label, key, cur2, list) => ({ label, opts: list.map(([v, l]) => Object.assign({ label: l, pick: () => this.setState(Object.assign({ [key]: v }, key.startsWith('p') ? {} : bump)) }, pill(cur2, v))) });
    const ctrls = [
      opt('Method', 'method', method, [['all', 'All early'], ['early', 'In person'], ['mail', 'By mail']]),
      opt('Measure', 'measure', measure, [['count', 'Ballots'], ['pct', '% of registered']]),
      opt('Timeline', 'win', win, [['today', live ? 'Through today' : 'Through same point'], ['election', 'Through Election Day'], ['deadline', 'Through mail deadline']])
    ];
    const years = EL.filter((x) => x.series).map((x) => { const on = show[x.id] || x.id === eid; return { label: (x.label).replace('November ', 'Nov ').replace('April 2026 special', 'Apr 2026'), type: x.type, color: COLORS[x.id], on, locked: x.id === eid, border: on ? COLORS[x.id] : '#D3D7DE', bg: on ? '#FFFFFF' : '#F5F6F8', op: on ? 1 : 0.6,
      toggle: () => { if (x.id !== eid) this.setState(Object.assign({ show: Object.assign({}, show, { [x.id]: !show[x.id] }) }, bump)); } }; });

    // daily rows
    let drows = [];
    if (live) drows = D.rows.map((r) => Object.assign({}, r));
    else {
      const s = cur.series;
      for (let i = 0; i <= 52; i++) {
        if (s.e[i] == null) continue;
        const dd = new Date(eDate); dd.setDate(dd.getDate() - (46 - i));
        const pe = i > 0 && s.e[i - 1] != null ? s.e[i - 1] : 0, pmm = i > 0 && s.m[i - 1] != null ? s.m[i - 1] : 0;
        drows.push({ d: iso(dd), de: s.e[i] - pe, dm: s.m[i] - pmm, e: s.e[i], m: s.m[i] });
      }
    }
    const byDate = {}; drows.forEach((r) => { byDate[r.d] = r; });
    const satOpens = {}; D.sites.forEach((s) => { if (s.satellite) satOpens[s.firstOpen] = (satOpens[s.firstOpen] || 0) + 1; });
    const SITE_NAMES = { government_center: 'Government Center', north_county: 'North County', mt_vernon: 'Mount Vernon', burke: 'Burke Centre', centreville: 'Centreville', franconia: 'Franconia', great_falls: 'Great Falls', herndon_fortnightly: 'Herndon Fortnightly', jim_scott: 'Jim Scott', lorton: 'Lorton', mason: 'Mason', mclean: 'McLean', sully: 'Sully', thomas_jefferson: 'Thomas Jefferson', tysons_pimmit: 'Tysons-Pimmit', west_springfield: 'West Springfield' };
    const keyFor = (name) => { const low = name.toLowerCase(); if (low.startsWith('registrar') && D.id === 'fairfax-county') return 'government_center'; const ks = Object.keys(SITE_NAMES).filter((kk) => kk !== 'government_center'); return ks.find((kk) => low.includes(SITE_NAMES[kk].toLowerCase())) || ks.find((kk) => low.startsWith(SITE_NAMES[kk].toLowerCase().split(/[ -]/)[0])); };
    const wxOf = (w) => w ? w.l + ', ' + w.hi + '°/' + w.lo + '°' + (w.p >= 0.01 ? ' · ' + w.p.toFixed(2) + '″' : '') : '—';
    const isWet = (w) => !!(w && (w.wet || w.p >= 0.25 || /rain|drizzle|shower|storm/i.test(w.l)));

    // calendar
    const calM = this.state.calM;
    const dv = (r) => calM === 'all' ? r.de + r.dm : calM === 'early' ? r.de : r.dm;
    const startE = new Date(eDate); startE.setDate(startE.getDate() - 46);
    const endK = (() => { const x = new Date(eDate); x.setDate(x.getDate() + 6); return iso(x); })();
    const calStart = new Date(startE); calStart.setDate(calStart.getDate() - calStart.getDay());
    const maxDay = Math.max(1, ...drows.map(dv));
    const ramp = calM === 'mail' ? ['#FFFFFF', '#E9E1FB', '#BBA2F0', '#7C4DDB', '#4E2A9E'] : calM === 'early' ? ['#FFFFFF', '#D3F1E6', '#86D9BA', '#00A37A', '#006B50'] : ['#FFFFFF', '#DDE3EE', '#9AA9C4', '#41557F', '#1B2A6B'];
    const firstK = iso(startE), eK = cur.date;
    const defaultK = live ? D.asOf : eK;
    const selK = this.state.cal || defaultK;
    const cal = [];
    for (let i = 0; i < 63; i++) {
      const d = new Date(calStart); d.setDate(calStart.getDate() + i);
      const k2 = iso(d), r = byDate[k2];
      const inWin = k2 >= firstK && k2 <= endK, isE = k2 === eK, afterE = k2 > eK;
      const sc = live ? D.sched[k2] : null;
      let bg = '#FFFFFF', fg = '#121417', border = '2px solid #ECEEF2', kText = '';
      if (r) { const v = dv(r); const q = v / maxDay; const lv = q < 0.02 ? 0 : q < 0.35 ? 1 : q < 0.65 ? 2 : q < 0.9 ? 3 : 4;
        bg = ramp[lv]; fg = lv >= 3 ? '#FFFFFF' : '#121417'; border = afterE ? '2px dashed #5B2FB8' : lv === 0 ? '2px solid #D3D7DE' : '2px solid transparent'; kText = v ? f(v) : '–'; }
      else if (isE) { bg = '#FFD23F'; border = '2px solid #121417'; kText = 'Vote'; }
      else if (afterE) { bg = '#F8F9FB'; border = '2px dashed #B7BCC6'; kText = 'Mail'; }
      else if (inWin) { bg = '#F5F6F8'; border = '2px dashed #C6CBD4'; }
      if (selK === k2) border = '3px solid #121417';
      cal.push({ day: d.getDate() === 1 || k2 === firstK ? MON[d.getMonth()] + ' ' + d.getDate() : String(d.getDate()), k: kText,
        mark: this.state.narrow ? (isE ? '★' : sc ? sc.n + (satOpens[k2] ? '▲' : '') : '') : isE ? '★ Election Day' : sc ? sc.n + (sc.n === 1 ? ' site' : ' sites') + (satOpens[k2] ? ' ▲' : '') : afterE ? 'mail arriving' : '', wet: !!(r && isWet(r.w)),
        bg, fg, border, vis: inWin ? 'visible' : 'hidden', display: i >= 56 && !inWin ? 'none' : 'flex', pressed: selK === k2 ? 'true' : 'false',
        anim: this.state.calTick % 2 ? 'fx-pa' : 'fx-pb', delay: (i * 10) + 'ms', aria: dmd(k2) + (r ? ': ' + f(dv(r)) + ' ballots' : ''),
        move: (ev) => { if (inWin) this.setState({ cal: k2, tip: this.tipAt(ev, 'cal', k2) }); } });
    }
    const calInfo0 = (kk) => {
      const sd = parse(kk), sr = byDate[kk], ssc = live ? D.sched[kk] : null;
      const dayN = Math.round((sd - startE) / 864e5) + 1;
      const openList = ssc ? ssc.open.map(([nm, hrs]) => { const key = keyFor(nm); const cnt = sr && sr.site && key && sr.site[key] != null ? f(sr.site[key]) : ''; return { k: nm + ' (' + hrs + ')', v: cnt }; }) : [];
      const base = { hasList: openList.length > 0, listHead: openList.length === 1 ? '1 site open' : openList.length + ' sites open', list: openList };
      const eLabel = sd > eDate ? 'E+' + Math.round((sd - eDate) / 864e5) : 'E–' + Math.round((eDate - sd) / 864e5);
      if (sr) {
        const rows = [{ k: 'In person', v: fz(sr.de) }, { k: 'By mail', v: fz(sr.dm) }];
        if (sr.post != null) rows.push({ k: 'Post · drop box (county)', v: fz(sr.post) + ' · ' + fz(sr.box) });
        rows.push({ k: 'Total that day', v: fz(sr.de + sr.dm) }, { k: 'Running total', v: f(sr.e + sr.m) }, { k: 'Turnout so far', v: ((sr.e + sr.m) / cur.reg * 100).toFixed(2) + '%' });
        if (sr.o != null) rows.push({ k: 'Mail outstanding', v: f(sr.o) });
        if (sr.pv) rows.push({ k: 'Provisional', v: f(sr.pv) });
        if (live) rows.push({ k: 'Weather', v: wxOf(sr.w) });
        return Object.assign(base, { kicker: eLabel + ' · ' + cur.label, title: DOWL[sd.getDay()] + ', ' + md(kk), sub: live ? (ssc ? 'In-person voting open' : 'No in-person voting') : 'Derived from running totals', rows,
          listHead: base.hasList ? base.listHead + (sr.site ? ' · ballots' : '') : '' });
      }
      if (kk === eK) return Object.assign(base, { kicker: 'Election Day', title: DOWL[sd.getDay()] + ', ' + md(kk), sub: 'Polls open 6 AM – 7 PM at every precinct', rows: [] });
      if (kk > eK) return Object.assign(base, { kicker: eLabel, title: DOWL[sd.getDay()] + ', ' + md(kk), sub: 'Mail ballots postmarked by Election Day still count', rows: [{ k: 'Mail deadline', v: dmd(endK) }] });
      return Object.assign(base, { kicker: 'Upcoming · ' + eLabel, title: DOWL[sd.getDay()] + ', ' + md(kk), sub: ssc ? 'Scheduled in-person voting' : 'No in-person voting scheduled',
        rows: [{ k: 'Satellites opening', v: satOpens[kk] ? String(satOpens[kk]) : '—' }, { k: 'Days until Election Day', v: String(Math.round((eDate - sd) / 864e5)) }] });
    };
    const pieOf = (r) => { if (!r || !(r.de + r.dm)) return { hasPie: false }; const pE = r.de / (r.de + r.dm) * 100; return { hasPie: true, pieE: pE.toFixed(1), pieRest: (100 - pE).toFixed(1), pctE: Math.round(pE) + '%', pctM: Math.round(100 - pE) + '%' }; };
    const calInfo = (k) => Object.assign(calInfo0(k), pieOf(byDate[k]));
    const sel = calInfo(selK);
    const calOpts = [['all', 'All'], ['early', 'In person'], ['mail', 'By mail']].map(([v, label]) => Object.assign({ label, pick: () => this.setState({ calM: v, calTick: this.state.calTick + 1 }) }, pill(calM, v)));

    // sites
    const siteTotals = {};
    D.rows.forEach((r) => { if (r.site) Object.keys(r.site).forEach((kk) => { siteTotals[kk] = (siteTotals[kk] || 0) + r.site[kk]; }); });
    const asOf = parse(D.rows[D.rows.length - 1].d);
    const sites = D.sites.map((s) => {
      const fo = parse(s.firstOpen); const open = fo <= asOf; const days = Math.round((fo - asOf) / 864e5);
      const kk = keyFor(s.name); const bal = kk && siteTotals[kk] != null ? f(siteTotals[kk]) + ' in-person ballots so far' : (open ? 'Per-site counts not published' : 'Opens ' + dmd(s.firstOpen));
      return { name: s.name, address: s.address, rules: s.rules, ballots: bal, status: open ? (s.satellite ? 'OPEN' : 'MAIN OFFICE') : 'IN ' + days + ' DAYS',
        chipBg: open ? '#D3F1E6' : '#E4D9FA', chipFg: open ? '#00694F' : '#4E2A9E', border: open ? '#00A37A' : '#ECEEF2', bg: open ? '#FFFFFF' : '#F8F9FB' };
    });
    const openNow = D.sites.filter((s) => parse(s.firstOpen) <= asOf).length;
    const siteSummary = D.sites.length + ' locations: ' + openNow + ' open now' + (D.next && D.next !== 'open' ? ', ' + (D.sites.length - openNow) + ' more from ' + dmd(D.next) : '') + '. Tap a site for its hours.';
    const heatKeys = Object.keys(siteTotals);
    const heatDates = D.rows.filter((r) => r.site !== undefined).map((r) => r.d);
    let heatMax = 1; D.rows.forEach((r) => { if (r.site) Object.values(r.site).forEach((v) => { heatMax = Math.max(heatMax, v); }); });
    const heat = { has: heatKeys.length > 0, n: heatDates.length, first: heatDates.length ? dmd(heatDates[0]) : '', last: heatDates.length ? dmd(heatDates[heatDates.length - 1]) : '',
      rows: heatKeys.sort((a, b) => siteTotals[b] - siteTotals[a]).map((kk, ri) => ({ name: SITE_NAMES[kk] || kk, total: f(siteTotals[kk]),
        cells: heatDates.map((d, ci) => { const rr = D.rows.find((r) => r.d === d); const v = (rr && rr.site && rr.site[kk]) || 0; const q = v / heatMax;
          return { bg: v === 0 ? '#F1F2F5' : q < 0.25 ? '#D3F1E6' : q < 0.5 ? '#86D9BA' : q < 0.75 ? '#00A37A' : '#00694F', tip: (SITE_NAMES[kk] || kk) + ' · ' + dmd(d) + ': ' + fz(v), delay: (ri * 60 + ci * 15) + 'ms' }; }) })) };

    // daily table
    const hasPB = live && D.rows.some((r) => r.post != null);
    const shade = this.state.shade !== false;
    const maxDT = Math.max(1, ...drows.map((r) => r.de + r.dm));
    const SH = ['#FFFFFF', '#F2FAF7', '#E2F5EC', '#CDEEDF', '#B4E5D0'];
    const maxDe = Math.max(1, ...drows.map((r) => r.de)), maxDm = Math.max(1, ...drows.map((r) => r.dm));
    const lvlOf = (v, m) => { const q = v / m; return !v ? 0 : q < 0.25 ? 1 : q < 0.5 ? 2 : q < 0.75 ? 3 : 4; };
    const GSH = ['transparent', '#E3F5ED', '#BDEBD6', '#86D9BA', '#4CC49B'], PSH = ['transparent', '#F0EAFC', '#DCCEF7', '#BFA6F0', '#9E7DE6'], TSH = ['transparent', '#EEF0F3', '#DDE1E7', '#C7CDD6', '#AAB2BF'];
    const tRows = drows.slice().reverse().map((r) => {
      const sc = live ? D.sched[r.d] : null; const w = r.w;
      const heavy = !!(w && w.p >= 0.25), wetish = isWet(w), sunny = !!(w && !wetish && /clear|sun/i.test(w.l));
      const q = (r.de + r.dm) / maxDT; const lv = q < 0.02 ? 0 : q < 0.3 ? 1 : q < 0.55 ? 2 : q < 0.8 ? 3 : 4;
      return { date: dmd(r.d), dateS: DOW[parse(r.d).getDay()].slice(0, 2) + ' ' + (parse(r.d).getMonth() + 1) + '/' + parse(r.d).getDate(), wxS: w ? w.hi + '°' : '', de: fz(r.de), dm: fz(r.dm), pb: r.post != null ? fz(r.post) + ' · ' + fz(r.box) : '–', day: fz(r.de + r.dm), run: f(r.e + r.m),
        pct: ((r.e + r.m) / cur.reg * 100).toFixed(2) + '%', out: fz(r.o), sites: sc ? String(sc.n) : '–', wx: w ? wxOf(w) : '',
        icoRain: wetish, icoSun: sunny, icoCloud: !!(w && !wetish && !sunny),
        wBg: heavy ? '#EEF0F3' : 'transparent', wFg: heavy ? '#121417' : '#8A93A3', wPad: '3px 10px', wW: heavy ? 700 : 500, bg: '#FFFFFF',
        deBg: shade ? GSH[lvlOf(r.de, maxDe)] : 'transparent', dmBg: shade ? PSH[lvlOf(r.dm, maxDm)] : 'transparent', dayBg: shade ? TSH[lvlOf(r.de + r.dm, maxDT)] : 'transparent' };
    });
    const narrowT = this.state.narrow;
    const tbl = { rows: tRows, hasPB, live, minW: narrowT ? '0' : '980px',
      shadePressed: shade ? 'true' : 'false', shadeBg: shade ? '#121417' : '#FFFFFF', shadeFg: shade ? '#FFFFFF' : '#121417', toggleShade: () => this.setState({ shade: !shade }),
      grid: narrowT ? (live ? '1.1fr 1fr 1fr 1fr 0.95fr 0.75fr' : '1.1fr 1fr 1fr 1fr 0.95fr') : live ? (hasPB ? '1fr 0.8fr 0.8fr 1fr 0.8fr 0.9fr 0.7fr 0.8fr 0.5fr 1.8fr' : '1fr 0.8fr 0.8fr 0.8fr 0.9fr 0.7fr 0.8fr 0.5fr 1.8fr') : '1.2fr 1fr 1fr 1fr 1fr 0.8fr' };

    // ---- ballots by day (+ planning)
    const bdView = this.state.bdView || 'daily', bdM = this.state.bdM || 'all', bdWin = this.state.bdWin || 'today';
    const ser = cur.series;
    let lastI = -1; for (let i = 0; i < 53; i++) if (ser.e[i] != null) lastI = i;
    const dayDate = (i) => { const x = new Date(eDate); x.setDate(x.getDate() - (46 - i)); return x; };
    const act = Array.from({ length: 53 }, (_, i) => { if (ser.e[i] == null) return null; const pe = i > 0 && ser.e[i - 1] != null ? ser.e[i - 1] : 0, pmm = i > 0 && ser.m[i - 1] != null ? ser.m[i - 1] : 0; return { de: ser.e[i] - pe, dm: ser.m[i] - pmm, e: ser.e[i], m: ser.m[i] }; });
    if (live && D.id === 'fairfax-county') D.rows.forEach((r) => { const i = Math.round((parse(r.d) - parse(cur.date)) / 864e5) + 46; if (act[i]) { act[i].de = r.de; act[i].dm = r.dm; } });
    const refs = live ? EL.filter((x) => ['2025', '2024', '2023', '2022', '2021'].includes(x.id) && x.series && x.series.e[lastI]) : [];
    const med = (arr) => { const q = arr.slice().sort((x, y) => x - y); const L2 = q.length; return !L2 ? null : L2 % 2 ? q[(L2 - 1) / 2] : (q[L2 / 2 - 1] + q[L2 / 2]) / 2; };
    const estFor = (key, i) => { const v = refs.map((r) => { const s2 = r.series; if (s2[key][i] == null || s2[key][i - 1] == null || !s2[key][lastI]) return null; return Math.max(0, s2[key][i] - s2[key][i - 1]) * ser[key][lastI] / s2[key][lastI]; }).filter((x) => x != null); return med(v); };
    const plan = Array.from({ length: 53 }, (_, i) => {
      if (!live || i <= lastI || !refs.length) return null;
      const k3 = iso(dayDate(i)); const open = D.sched[k3];
      const pe = (i < 46 && open ? estFor('e', i) : 0) || 0, pmail = estFor('m', i) || 0;
      const err = i <= 36 ? 0.21 : 0.30;
      return { e: pe, m: pmail, eLo: pe * Math.exp(-err), eHi: pe * Math.exp(err), mLo: pmail * Math.exp(-err), mHi: pmail * Math.exp(err) };
    });
    const N = bdWin === 'today' ? (live ? lastI + 1 : T + 1) : bdWin === 'election' ? 47 : 53;
    const usePlan = live && bdWin !== 'today' && refs.length > 0;
    const pick3 = (o, ke, km) => bdM === 'all' ? o[ke] + o[km] : bdM === 'early' ? o[ke] : o[km];
    const BX = (i) => 60 + (i + 0.5) / N * 940;
    const bw = 940 / N * 0.72;
    const cumAct = (i) => act[i] ? (bdM === 'all' ? act[i].e + act[i].m : bdM === 'early' ? act[i].e : act[i].m) : null;
    const cumLo = [], cumHi = [], cumMid = [];
    if (usePlan) { let c = cumAct(lastI), lo = c, hi = c; for (let i = lastI + 1; i < 53; i++) { const p = plan[i]; c += pick3(p, 'e', 'm'); lo += pick3(p, 'eLo', 'mLo'); hi += pick3(p, 'eHi', 'mHi'); cumMid[i] = c; cumLo[i] = lo; cumHi[i] = hi; } }
    let bdPeak = 1;
    if (bdView === 'daily') { for (let i = 0; i < N; i++) { if (act[i]) bdPeak = Math.max(bdPeak, pick3(act[i], 'de', 'dm')); if (usePlan && plan[i]) bdPeak = Math.max(bdPeak, pick3(plan[i], 'eHi', 'mHi')); } }
    else { for (let i = 0; i < N; i++) { const v = cumAct(i); if (v != null) bdPeak = Math.max(bdPeak, v); if (usePlan && cumHi[i]) bdPeak = Math.max(bdPeak, cumHi[i]); } }
    const bunits = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
    const btop = Math.min(...bunits.map((u) => Math.ceil(bdPeak * 1.05 / (4 * u)) * 4 * u));
    const BY = (v) => 400 - v / btop * 380;
    const bars = [], planBars = [];
    for (let i = 0; i < N; i++) { const r = act[i]; if (!r) continue; const ve = bdM === 'mail' ? 0 : r.de, vm = bdM === 'early' ? 0 : r.dm; const hE = ve / btop * 380, hM = vm / btop * 380;
      bars.push({ x: (BX(i) - bw / 2).toFixed(1), w: bw.toFixed(1), yE: (400 - hE).toFixed(1), hE: hE.toFixed(1), yM: (400 - hE - hM).toFixed(1), hM: hM.toFixed(1), delay: (i * 18) + 'ms' }); }
    if (usePlan) for (let i = lastI + 1; i < N; i++) { const p = plan[i]; if (!p) continue; const v = pick3(p, 'e', 'm'); if (!v) continue; const hh = v / btop * 380;
      planBars.push({ x: (BX(i) - bw / 2).toFixed(1), w: bw.toFixed(1), y: (400 - hh).toFixed(1), h: hh.toFixed(1), cx: BX(i).toFixed(1), lo: BY(pick3(p, 'eLo', 'mLo')).toFixed(1), hi: BY(pick3(p, 'eHi', 'mHi')).toFixed(1), delay: (300 + (i - lastI) * 25) + 'ms' }); }
    const linePts = (fnv, from, to) => { let d = '', pen = false; for (let i = from; i <= to; i++) { const v = fnv(i); if (v == null) { pen = false; continue; } d += (pen ? ' L' : 'M') + BX(i).toFixed(1) + ',' + BY(v).toFixed(1); pen = true; } return d; };
    const bline = linePts(cumAct, 0, N - 1);
    const eLine = bdM === 'all' ? linePts((i) => act[i] ? act[i].e : null, 0, N - 1) : '';
    const mLine = bdM === 'all' ? linePts((i) => act[i] ? act[i].m : null, 0, N - 1) : '';
    let band = '', projLine = '';
    if (usePlan) {
      const up = [], dn = []; for (let i = lastI; i < N; i++) { const hi2 = i === lastI ? cumAct(i) : cumHi[i], lo2 = i === lastI ? cumAct(i) : cumLo[i]; up.push(BX(i).toFixed(1) + ',' + BY(hi2).toFixed(1)); dn.unshift(BX(i).toFixed(1) + ',' + BY(lo2).toFixed(1)); }
      band = 'M' + up.join(' L') + ' L' + dn.join(' L') + ' Z';
      projLine = linePts((i) => i === lastI ? cumAct(i) : i > lastI ? cumMid[i] : null, lastI, N - 1);
    }
    const rnd = (v) => v >= 10000 ? Math.round(v / 1000) + 'K' : v >= 1000 ? (Math.round(v / 100) / 10) + 'K' : v >= 100 ? String(Math.round(v / 10) * 10) : String(Math.round(v));
    const sumPlan = (key) => plan.reduce((acc, p) => p ? acc + p[key] : acc, 0);
    const curE = lastI >= 0 ? act[lastI].e : 0, curM = lastI >= 0 ? act[lastI].m : 0;
    const remE = sumPlan('e'), remELo = sumPlan('eLo'), remEHi = sumPlan('eHi'), remM = sumPlan('m');
    let busiest = null; plan.forEach((p, i) => { if (p && (!busiest || p.e > busiest.v)) busiest = { i, v: p.e }; });
    const futX = BX(lastI) + 940 / N / 2;
    const bdOpt = (label, key, curv, list) => ({ label, opts: list.map(([v, l]) => Object.assign({ label: l, pick: () => this.setState({ [key]: v, tip: null }) }, pill(curv, v))) });
    const xs = []; for (let i = 0; i < N; i += (N > 30 ? 7 : 4)) xs.push(i);
    const bd = {
      daily: bdView === 'daily', cum: bdView !== 'daily', hasPlan: usePlan, showE: N > 46, showToday: live && N > lastI + 1,
      ctrls: [bdOpt('View', 'bdView', bdView, [['daily', 'Daily ballots'], ['cum', 'Cumulative']]), bdOpt('Method', 'bdM', bdM, [['all', 'All early'], ['early', 'In person'], ['mail', 'By mail']]),
        bdOpt('Timeline', 'bdWin', bdWin, [['today', live ? 'Through today' : 'Through same point'], ['election', 'Through Election Day'], ['deadline', 'Through mail deadline']])],
      yTitle: bdView === 'daily' ? 'Ballots per day' : 'Ballots, running total',
      yt: [0, 1, 2, 3, 4].map((j) => ({ y: 400 - j * 95, ty: 404 - j * 95, l: short(btop * j / 4), stroke: j === 0 ? '#121417' : '#ECEEF2' })),
      xt: xs.map((i) => { const x = dayDate(i); return { x: BX(i).toFixed(1), l: MON[x.getMonth()] + ' ' + x.getDate() }; }),
      eX: BX(46).toFixed(1), todayX: futX.toFixed(1), todayLX: (futX - 6).toFixed(1), futX: futX.toFixed(1), futW: Math.max(0, 1000 - futX).toFixed(1), futLX: (futX + 8).toFixed(1),
      bars, plan: planBars, line: bline, eLine, mLine, band, projLine,
      hits: Array.from({ length: N }, (_, i) => ({ x: (BX(i) - 940 / N / 2).toFixed(1), w: (940 / N).toFixed(1), fill: this.state.tip && this.state.tip.kind === 'bar' && this.state.tip.key === i ? 'rgba(18,20,23,.06)' : 'transparent', move: (ev) => this.setState({ tip: this.tipAt(ev, 'bar', i) }) })),
      chips: usePlan ? [
        { k: 'In-person ballots to come', v: '≈ ' + rnd(remE), sub: 'Range ' + rnd(remELo) + '–' + rnd(remEHi) + ' · ≈ ' + rnd(curE + remE) + ' total in person', bg: '#F1FAF6', border: '#00A37A' },
        { k: 'Mail ballots to arrive', v: '≈ ' + rnd(remM), sub: '≈ ' + rnd(curM + remM) + ' total by mail, through ' + dmd(iso(dayDate(52))), bg: '#F4EFFD', border: '#7C4DDB' },
        { k: 'All early ballots, projected', v: '≈ ' + rnd(curE + curM + remE + remM), sub: rnd(curE + curM) + ' so far · ≈ ' + ((curE + curM + remE + remM) / cur.reg * 100).toFixed(0) + '% of registered', bg: '#FFFFFF', border: '#121417' },
        { k: 'Busiest in-person day ahead', v: busiest ? dmd(iso(dayDate(busiest.i))) : '—', sub: busiest ? '≈ ' + rnd(busiest.v) + ' ballots expected' : '', bg: '#FFFFFF', border: '#121417' }
      ] : [],
      legend: [{ l: 'In person', bg: '#00A37A', border: '0' }, { l: 'By mail', bg: '#7C4DDB', border: '0' }].concat(usePlan ? [{ l: 'Estimate (bar = middle, line = range)', bg: '#FFFFFF', border: '1.5px dashed #7C4DDB' }] : []),
      note: live ? (usePlan ? 'Shaded area shows planning estimates: how ' + refs.map((r) => r.label.replace('November ', '')).join(', ') + ' unfolded from this point, scaled to 2026’s pace and the site schedule. A staffing guide, not a forecast of results.' : 'Ballots added each day. Switch the timeline to see planning estimates for the days ahead.') : 'Ballots added each day, derived from the running totals.'
    };
    const barInfo = (i) => {
      const dd = dayDate(i), r = act[i], p = plan[i], k5 = iso(dd), sc = live ? D.sched[k5] : null;
      const eL = i <= 46 ? 'E–' + (46 - i) : 'E+' + (i - 46);
      const rowsB = [];
      if (r) rowsB.push({ k: 'In person', v: fz(r.de) }, { k: 'By mail', v: fz(r.dm) }, { k: 'Total that day', v: fz(r.de + r.dm) }, { k: 'Running total', v: f(r.e + r.m) }, { k: 'Turnout so far', v: ((r.e + r.m) / cur.reg * 100).toFixed(2) + '%' });
      if (!r && p) rowsB.push({ k: 'Est. in person', v: '≈ ' + rnd(p.e) + (p.e ? ' (' + rnd(p.eLo) + '–' + rnd(p.eHi) + ')' : '') }, { k: 'Est. mail returns', v: '≈ ' + rnd(p.m) }, { k: 'Est. running total', v: '≈ ' + rnd((cumMid[i] || 0)) });
      return { kicker: eL + (r ? ' · reported' : ''), title: DOWL[dd.getDay()] + ', ' + MON[dd.getMonth()] + ' ' + dd.getDate(), sub: cur.label, rows: rowsB,
        hasBadge: !r && !!p, badge: 'Planning estimate · not reported yet',
        hasList: !!(sc && sc.open.length), listHead: sc ? (sc.n === 1 ? '1 site open' : sc.n + ' sites open') : '', list: sc ? sc.open.map(([nm, hrs]) => ({ k: nm + ' (' + hrs + ')', v: '' })) : [] };
    };

    // ---- site map + table
    const hoursBy = {}; Object.keys(D.sched).forEach((d5) => { D.sched[d5].open.forEach(([nm, sp, hh]) => { if (!hoursBy[nm]) hoursBy[nm] = {}; hoursBy[nm][d5] = hh; }); });
    const totAll = Object.values(siteTotals).reduce((x, y) => x + y, 0);
    const maxSite = Math.max(1, ...Object.values(siteTotals));
    const siteRows = D.sites.map((s5, i) => {
      const key = keyFor(s5.name); const tot2 = key && siteTotals[key] != null ? siteTotals[key] : null;
      const hrs = Object.entries(hoursBy[s5.name] || {}).filter(([d6]) => parse(d6) <= asOf).reduce((x, [, hh]) => x + hh, 0);
      const open = parse(s5.firstOpen) <= asOf; const days = Math.round((parse(s5.firstOpen) - asOf) / 864e5);
      return { s5, i, key, tot2, hrs, open, days };
    });
    const siteAll = !!this.state.siteAll, siteOpen = this.state.siteOpen || {};
    const siteTable = siteRows.map(({ s5, i, tot2, hrs, open, days }) => { const shown = siteAll || !!siteOpen[i]; return { n: i + 1, name: s5.name, kind: s5.satellite ? '' : 'Main office',
      status: open ? 'Open' : days === 1 ? 'In 1 day' : 'In ' + days + ' days', opens: open ? 'since ' + dmd(s5.firstOpen) : dmd(s5.firstOpen),
      chipBg: open ? '#D3F1E6' : '#EDE6FC', chipFg: open ? '#00694F' : '#4E2A9E',
      ballots: tot2 != null ? f(tot2) : '—', share: tot2 != null && totAll ? (tot2 / totAll * 100).toFixed(1) + '%' : '—', w: tot2 != null && totAll ? (tot2 / totAll * 100).toFixed(1) : 0,
      rate: tot2 != null && hrs ? String(Math.round(tot2 / hrs)) : '—', hrs: hrs ? f(hrs) : '—',
      dotBg: open ? '#00A37A' : '#FFFFFF', dotFg: open ? '#FFFFFF' : '#5B2FB8', dotBorder: open ? '#00A37A' : '#7C4DDB',
      showDetail: shown, expanded: shown ? 'true' : 'false', caret: shown ? '▴' : '▾', rowBg: siteOpen[i] ? '#F1FAF6' : 'transparent', address: s5.address + (s5.approx ? ' (map position approximate)' : ''), rules: s5.rules,
      toggle: () => this.setState({ siteOpen: Object.assign({}, siteOpen, { [i]: !siteOpen[i] }) }) }; });
    const scaleR = D.mapH / 1000;
    const sm = { base: D.precincts.map((p) => p.d), sizeNote: totAll ? 'Circle size = in-person ballots so far' : (D.sites.some((x) => x.approx) ? 'Positions approximate' : ''),
      dots: siteRows.filter(({ s5 }) => s5.xy).map(({ s5, i, tot2, open }) => { const r = (tot2 ? 16 + Math.sqrt(tot2 / maxSite) * 26 : 18) * Math.max(1, scaleR * 0.9);
        return { x: s5.xy[0], y: s5.xy[1], r: r.toFixed(1), ty: (s5.xy[1] + r * 0.35).toFixed(1), fs: Math.round(r * 0.9), n: i + 1, fill: open ? '#00A37A' : '#FFFFFF', stroke: open ? '#FFFFFF' : '#7C4DDB', tc: open ? '#FFFFFF' : '#5B2FB8',
          ringCls: open ? 'fx-ring2' : '', delay: (300 + i * 70) + 'ms', move: (ev) => this.setState({ tip: this.tipAt(ev, 'site', i) }), click: () => this.setState({ siteOpen: Object.assign({}, siteOpen, { [i]: !siteOpen[i] }) }) }; }) };
    const siteInfo = (i) => { const { s5, tot2, hrs, open, days } = siteRows[i]; return { kicker: (s5.satellite ? 'Site ' + (i + 1) : 'Main office') + ' · ' + (open ? 'open' : 'opens in ' + days + ' days'), title: s5.name, sub: s5.address + (s5.approx ? ' · position approximate' : ''),
      rows: [{ k: 'In-person ballots', v: tot2 != null ? f(tot2) : 'not published' }, { k: 'Scheduled hours so far', v: hrs ? f(hrs) : '—' }, { k: 'Ballots per hour', v: tot2 != null && hrs ? String(Math.round(tot2 / hrs)) : '—' }],
      hasList: true, listHead: 'Hours', list: s5.rules.slice(0, 8).map((x) => ({ k: x, v: '' })) }; };
    const siteTableNote = (totAll ? 'Per-site counts from the county daily report through ' + dmd(heatDates[heatDates.length - 1]) + '. Per hour uses scheduled site-hours. ' : 'This locality does not publish per-site ballot counts. ') + 'Click a row for its address and hours.';
    const siteAllToggle = () => this.setState({ siteAll: !siteAll });

    // ---- site rhythm: every site, every early-voting day
    const rhM = this.state.rhM || 'daily', rhFit = !!this.state.rhFit, rhSwap = !!this.state.rhSwap;
    const schedDates = Object.keys(D.sched).sort();
    const lastData = heatDates.length ? heatDates[heatDates.length - 1] : '';
    const allDates = []; if (schedDates.length) { const d0 = parse(schedDates[0]), d1 = parse(schedDates[schedDates.length - 1]); for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) allDates.push(iso(d)); }
    const rSites = siteRows.slice().sort((a, b) => ((b.tot2 || 0) - (a.tot2 || 0)) || a.s5.firstOpen.localeCompare(b.s5.firstOpen));
    const shortName = (s5) => { const kk = keyFor(s5.name); return kk && SITE_NAMES[kk] ? SITE_NAMES[kk] : s5.name.replace(/ (Governmental|Government|Regional|Community) .*$/, '').replace(/ Library$/, ''); };
    let rMax = 0; const rVal = {};
    rSites.forEach(({ s5, key }) => { let run = 0; rVal[s5.name] = allDates.map((d7) => {
      const h = (hoursBy[s5.name] || {})[d7] || 0; const past = d7 <= lastData;
      const rr = past ? D.rows.find((r) => r.d === d7) : null; const raw = rr && rr.site && key ? (rr.site[key] || 0) : 0; run += raw;
      const v = !past ? null : rhM === 'daily' ? raw : rhM === 'cum' ? run : (h ? raw / h : null);
      if (v != null) rMax = Math.max(rMax, v);
      return { v, raw, h, d: d7, past, run }; }); });
    const fmtR = (v) => rhM === 'rate' ? String(Math.round(v)) : v >= 1000 ? (v / 1000).toFixed(1) + 'K' : String(Math.round(v));
    const cellOf = (s5, j, ri, ci) => { const c = rVal[s5.name][j]; let bg, fg = '#121417', border = '0', txt = '';
      if (!c.past) { if (c.h) { bg = '#FFFFFF'; border = '1.5px dashed #C6CBD4'; } else bg = '#F8F9FB'; }
      else if (!c.h && !c.raw) bg = '#F1F2F5';
      else { const q = (c.v || 0) / (rMax || 1); if (!c.v) bg = '#F1F2F5'; else if (q < 0.25) bg = '#D3F1E6'; else if (q < 0.5) bg = '#86D9BA'; else if (q < 0.75) { bg = '#00A37A'; fg = '#FFFFFF'; } else { bg = '#006B50'; fg = '#FFFFFF'; } if (!rhFit && c.v) txt = fmtR(c.v); }
      return { bg, fg, border, txt, delay: (ri * 30 + ci * 6) + 'ms',
        tip: shortName(s5) + ' · ' + dmd(c.d) + ': ' + (!c.past ? (c.h ? 'scheduled, ' + c.h + ' h' : 'closed') : !c.h && !c.raw ? 'closed' : fz(c.raw) + ' ballots' + (c.h ? ' in ' + c.h + ' h (' + Math.round(c.raw / c.h) + '/h)' : '')) }; };
    const totOf = (arr) => { const pastA = arr.filter((c) => c.past); const sum = pastA.reduce((x, c) => x + c.raw, 0); const hh = pastA.reduce((x, c) => x + c.h, 0);
      return rhM === 'rate' ? (hh && sum ? String(Math.round(sum / hh)) : '—') : sum ? f(sum) : '—'; };
    let rhHead, rhRows;
    if (!rhSwap) {
      rhHead = allDates.map((d7) => { const x = parse(d7); return { l: rhFit ? '' : DOW[x.getDay()].slice(0, 2) + ' ' + (x.getMonth() + 1) + '/' + x.getDate(), full: dmd(d7) }; });
      rhRows = rSites.map(({ s5 }, ri) => ({ name: shortName(s5), total: totOf(rVal[s5.name]), cells: allDates.map((_, j) => cellOf(s5, j, ri, j)) }));
    } else {
      rhHead = rSites.map(({ s5 }) => ({ l: rhFit ? '' : shortName(s5), full: s5.name }));
      rhRows = allDates.map((d7, j) => { const pastD = d7 <= lastData; const daySum = rSites.reduce((x, { s5 }) => x + rVal[s5.name][j].raw, 0); const dayH = rSites.reduce((x, { s5 }) => x + rVal[s5.name][j].h, 0);
        return { name: dmd(d7), total: !pastD ? '' : rhM === 'rate' ? (dayH && daySum ? String(Math.round(daySum / dayH)) : '—') : rhM === 'cum' ? f(rSites.reduce((x, { s5 }) => x + rVal[s5.name][j].run, 0)) : (daySum ? f(daySum) : '—'), cells: rSites.map(({ s5 }, ri) => cellOf(s5, j, j, ri)) }; });
    }
    const nCols = rhHead.length;
    const rhOpt = (label, key, curv, list) => ({ label, opts: list.map(([v, l]) => Object.assign({ label: l, pick: () => this.setState({ [key]: v, rhTick: (this.state.rhTick || 0) + 1 }) }, pill(curv, v))) });
    const nameW = rhSwap ? 100 : 150, cellW = rhFit ? 0 : rhSwap ? 84 : 46;
    const rh = { has: Object.keys(siteTotals).length > 0 && allDates.length > 0, head: rhHead, rows: rhRows, swapped: rhSwap ? 'true' : 'false', swapBg: rhSwap ? '#121417' : '#FFFFFF', swapFg: rhSwap ? '#FFFFFF' : '#121417',
      swap: () => this.setState({ rhSwap: !rhSwap, rhTick: (this.state.rhTick || 0) + 1 }), anim: (this.state.rhTick || 0) % 2 ? 'fx-pa' : 'fx-pb',
      grid: nameW + 'px 64px repeat(' + nCols + ', minmax(' + (rhFit ? '4px' : cellW + 'px') + ', 1fr))',
      minW: rhFit ? '0' : (nameW + 64 + nCols * (cellW + 3)) + 'px', cellH: rhFit ? '20px' : '30px',
      totLabel: rhM === 'rate' ? 'Avg/hr' : 'Total',
      ctrls: [rhOpt('Metric', 'rhM', rhM, [['daily', 'Daily ballots'], ['cum', 'Cumulative ballots'], ['rate', 'Ballots/hour']]), rhOpt('Display', 'rhFit', rhFit, [[false, 'Readable numbers'], [true, rhSwap ? 'Fit all sites' : 'Fit all dates']])] };

    // ---- precinct maps (three)
    const P = D.precincts; const lastIdx = D.pdates.length - 1; const pIdx = this.state.pIdx == null ? lastIdx : this.state.pIdx;
    const { pMeasure, pHover } = this.state;
    const GRN = ['#F0FAF6', '#C2EBDB', '#7DD3B2', '#00A37A', '#006B50'], PUR = ['#F4EFFD', '#D9CBF6', '#AE90EB', '#7C4DDB', '#4E2A9E'];
    const pdefs = [['all', 'All early votes', (h) => h[0] + h[1], GRN, '#00A37A'], ['e', 'In person', (h) => h[0], GRN, '#00A37A'], ['m', 'By mail', (h) => h[1], PUR, '#7C4DDB']];
    const pmaps = pdefs.map(([id, title, get, pal, border]) => {
      const mv = (p, j) => pMeasure === 'p' ? (p.r ? get(p.h[j]) / p.r * 100 : 0) : get(p.h[j]);
      const vs = P.map((p) => mv(p, lastIdx)).sort((x, y) => x - y);
      const qs = [0.2, 0.4, 0.6, 0.8].map((q) => vs[Math.floor(q * (vs.length - 1))]);
      const bin = (v) => { let i = 0; while (i < 4 && v > qs[i]) i++; return i; };
      const fq = (v) => pMeasure === 'p' ? v.toFixed(1) + '%' : short(v);
      const sum = P.reduce((x, p) => x + get(p.h[pIdx]), 0), regSum = P.reduce((x, p) => x + p.r, 0);
      return { id, title, border, total: pMeasure === 'p' ? (sum / regSum * 100).toFixed(1) + '%' : f(sum),
        bins: pal.map((c, i) => ({ c, l: i === 0 ? '≤' + fq(qs[0]) : i === 4 ? '>' + fq(qs[3]) : fq(qs[i]) })),
        paths: P.map((p) => { const h = p.c === pHover; return { d: p.d, fill: h ? '#FFD23F' : pal[bin(mv(p, pIdx))], stroke: h ? '#121417' : '#FFFFFF', sw: h ? 3 : 0.7, delay: Math.round(parseFloat(p.d.slice(1)) * 0.6) + 'ms', move: (ev) => this.setState({ pHover: p.c, tip: this.tipAt(ev, 'prec', p.c) }) }; }) };
    });
    const precInfo = (p) => ({ kicker: 'Precinct ' + p.c, title: p.n, sub: (p.r ? (p.h[pIdx][0] + p.h[pIdx][1]) / p.r * 100 : 0).toFixed(1) + '% turnout as of ' + dmd(D.pdates[pIdx]), hasList: false, list: [],
      rows: [{ k: 'Registered', v: f(p.r) }, { k: 'In person', v: fz(p.h[pIdx][0]) + ' · ' + (p.r ? (p.h[pIdx][0] / p.r * 100).toFixed(1) : 0) + '%' }, { k: 'By mail', v: fz(p.h[pIdx][1]) + ' · ' + (p.r ? (p.h[pIdx][1] / p.r * 100).toFixed(1) : 0) + '%' }, { k: 'Total', v: fz(p.h[pIdx][0] + p.h[pIdx][1]) }] });
    const ph = P.find((p) => p.c === pHover);
    const pSel = this.state.pSel || 'all';
    const pLay = this.state.pLay || (typeof window !== 'undefined' && window.innerWidth < 1000 ? 'one' : 'all');
    const pFull = !!this.state.pFull;
    const pm = {
      lay: pLay, one: pLay === 'one', cols: pLay === 'one' ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(300px, 1fr))',
      lays: [['all', 'All 3 maps'], ['one', 'One map']].map(([v, label]) => Object.assign({ label, pick: () => this.setState({ pLay: v }) }, pill(pLay, v))),
      fs: pFull ? 'position: fixed; inset: 0; z-index: 70; border-radius: 0; overflow: auto; margin: 0; translate: none !important; scale: none !important; transform: none !important; animation: none !important; box-shadow: none' : '',
      mapMax: pFull ? '78vh' : pLay === 'one' ? '720px' : '560px',
      fullLabel: pFull ? 'Exit full screen' : 'Full screen', fullPressed: pFull ? 'true' : 'false', fullBg: pFull ? '#121417' : '#FFFFFF', fullFg: pFull ? '#FFFFFF' : '#121417',
      toggleFull: () => this.setState({ pFull: !pFull, tip: null }),
      maps: pmaps, sel: pSel, max: lastIdx, idx: pIdx, dateLabel: dmd(D.pdates[pIdx]),
      pick: [['all', 'All'], ['e', 'In person'], ['m', 'Mail']].map(([k6, label]) => Object.assign({ label, pick: () => this.setState({ pSel: k6 }) }, pill(pSel, k6))),
      onSlide: (ev) => this.setState({ pIdx: +ev.target.value }),
      playLabel: this.state.playing ? 'Pause' : '▶ Play',
      play: () => {
        if (this.state.playing) { clearInterval(this.player); this.setState({ playing: false }); return; }
        this.setState({ playing: true, pIdx: 0 });
        this.player = setInterval(() => { const nx = (this.state.pIdx || 0) + 1; if (nx > lastIdx) { clearInterval(this.player); this.setState({ playing: false }); } else this.setState({ pIdx: nx }); }, 450);
      },
      ctrls: [opt('Measure', 'pMeasure', pMeasure, [['p', '% of registered'], ['v', 'Ballots']])],
      note: P.length + ' precincts · ' + (D.boundary || 'current boundaries') + '. Precinct counts run through ' + dmd(D.pdates[lastIdx]) + '. Hover one to find it on all three maps.',
      hov: ph ? precInfo(ph) : { kicker: 'Hover a precinct', title: D.name, sub: (P.reduce((x, p) => x + p.h[pIdx][0] + p.h[pIdx][1], 0) / P.reduce((x, p) => x + p.r, 0) * 100).toFixed(1) + '% turnout as of ' + dmd(D.pdates[pIdx]),
        rows: [{ k: 'Precincts', v: String(P.length) }, { k: 'In person', v: f(P.reduce((x, p) => x + p.h[pIdx][0], 0)) }, { k: 'By mail', v: f(P.reduce((x, p) => x + p.h[pIdx][1], 0)) }] }
    };

    const tp = this.state.tip;
    let tip = { on: false };
    if (tp) {
      const info = tp.kind === 'cal' ? calInfo(tp.key) : tp.kind === 'bar' ? barInfo(tp.key) : tp.kind === 'site' ? siteInfo(tp.key) : precInfo(P.find((p) => p.c === tp.key));
      tip = Object.assign({ on: true, x: tp.x, y: tp.y }, info, { list: (info.list || []).slice(0, 10) });
    }

    const lastRow = D.rows[D.rows.length - 1];
    const lastW = D.rows.slice().reverse().find((r) => r.w);
    const ticker0 = [
      { name: D.name + ' early votes', val: f(lastRow.e + lastRow.m), dot: '#00A37A' },
      { name: 'Registered voters', val: f(D.reg), dot: '#FFD23F' },
      { name: 'Mail outstanding', val: f(lastRow.o), dot: '#7C4DDB' },
      { name: 'Satellites', val: D.sat ? D.sat + (D.next && D.next !== 'open' ? ' · next ' + dmd(D.next) : ' open') : 'none', dot: '#00A37A' },
      { name: 'Weather ' + (lastW ? dmd(lastW.d) : ''), val: lastW ? wxOf(lastW.w) : '—', dot: '#FFD23F' }
    ];

    return {
      fc, fcOpts,
      hdr: { eid, lid: D.id,
        elections: EL.map((x) => ({ value: x.id, text: x.label.replace('April 2026 special', 'April 2026') + ' · ' + x.type })),
        locs: [{ value: '', text: 'All of Virginia' }].concat(D.names.map(([id, nm]) => ({ value: id, text: nm }))),
        pickE: (ev) => { const v = ev.target.value; this.setState({ eid: v, show: Object.assign({}, this.state.show, { [v]: true }), cal: null, hi: null, tip: null, calTick: this.state.calTick + 1, chTick: this.state.chTick + 1 }); },
        pickL: (ev) => { const v = ev.target.value; location.href = v ? '/' + eid + '/' + v : (eid === '2026' ? '/' : '/' + eid); } },
      showSites: live && D.sites.length > 0, showPrecincts: live && D.precincts.some((p) => p.r),
      loading: false, ready: true, backHref: eid === '2026' ? '/' : '/' + eid, L, elChips, hero, cd, paceChips, satLine, backToNow: () => this.setState({ eid: '2026', cal: null, hi: null, calTick: this.state.calTick + 1, chTick: this.state.chTick + 1 }),
      flow, flowNote, ctrls, years, ch, elLabel: cur.label, cal, sel, calOpts, calRamp: ramp.slice(1), sites, siteSummary, heat, tbl, pm, tip, hideTip, bd, sm, siteTable, siteTableNote, rh, pmView: '0 0 1000 ' + D.mapH, band: { asOf: dmd(D.rows[D.rows.length - 1].d) }, siteAllToggle, siteAllPressed: siteAll ? 'true' : 'false', siteAllBg: siteAll ? '#121417' : '#FFFFFF', siteAllFg: siteAll ? '#FFFFFF' : '#121417', siteAllLabel: siteAll ? 'Hide addresses & hours' : 'Show addresses & hours',
      ticker: ticker0.concat(ticker0, ticker0)
    };
  }
}

VF.page('locality', Locality);
