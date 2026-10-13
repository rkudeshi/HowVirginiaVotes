class Status extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { log: null, now: Date.now() };
  }
  componentDidMount() {
    document.title = 'Status · VoteFlow';
    this.clock = setInterval(() => this.setState({ now: Date.now() }), 1000);
    fetch('/status.json').then((r) => r.json()).then((log) => this.setState({ log })).catch(() => this.setState({ log: [] }));
  }
  componentWillUnmount() { clearInterval(this.clock); }
  renderVals() {
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const parse = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const dmd = (s) => { const d = parse(s); return DOW[d.getDay()] + ' ' + MON[d.getMonth()] + ' ' + d.getDate(); };
    const et = (iso, opts) => new Date(iso).toLocaleString('en-US', Object.assign({ timeZone: 'America/New_York' }, opts));
    const target = Date.UTC(2026, 10, 3, 11, 0, 0); // 6 AM Eastern on Nov 3
    const left = Math.max(0, target - this.state.now), cdS = Math.floor(left % 6e4 / 1000);
    const cd = { label: left > 0 ? 'Election Day polls open in' : 'Polls are open', days: Math.floor(left / 864e5), h: String(Math.floor(left % 864e5 / 36e5)).padStart(2, '0'),
      m: String(Math.floor(left % 36e5 / 6e4)).padStart(2, '0'), s: String(cdS).padStart(2, '0'), anim: cdS % 2 ? 'fx-pa' : 'fx-pb' };
    const L = this.state.log;
    if (!L) return { ready: false, cd, band: { asOf: '…' }, log: [] };
    const sorted = L.slice().sort((a, b) => b.at.localeCompare(a.at));
    const loads = sorted.filter((r) => r.source === 'Daily Absentee List' && r.through);
    const through = loads.length ? loads.map((r) => r.through).sort().pop() : null;
    const last = sorted[0];
    const hrs = last ? Math.round((this.state.now - new Date(last.at)) / 36e5) : null;
    const COL = { 'Daily Absentee List': ['#D3F1E6', '#00694F'], 'VA Vote': ['#EDE6FC', '#4E2A9E'] };
    return {
      ready: true, cd, band: { asOf: through ? dmd(through) : '—' },
      through: through ? dmd(through) : '—',
      lastLoad: loads.length ? 'Loaded ' + et(loads[0].at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : 'No ballot loads yet',
      lastAt: last ? et(last.at, { month: 'short', day: 'numeric' }) : '—',
      lastAgo: last ? (hrs < 1 ? 'Less than an hour ago' : hrs < 48 ? hrs + (hrs === 1 ? ' hour ago' : ' hours ago') : Math.round(hrs / 24) + ' days ago') + ' · ' + last.source : '',
      log: sorted.map((r) => { const c = COL[r.source] || ['#F1F2F5', '#4A5260']; return { at: et(r.at, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), source: r.source, message: r.message,
        through: r.through ? dmd(r.through) : '', url: r.url || '', bg: c[0], fg: c[1] }; })
    };
  }
}
VF.page('status', Status);
