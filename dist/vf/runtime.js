/* VoteFlow page runtime.
 * Renders the design's HTML templates with Preact:
 *   {{path}}             dotted lookup into the page's renderVals() (whole-attribute holes pass raw values)
 *   <sc-for list as>     repeat children for each item ($index available)
 *   <sc-if value>        render children when the value is truthy
 *   onClick="{{fn}}"     event handlers (any on* attribute)
 *   <helmet>             <style>/<link> moved into <head>
 * Pages register with VF.page(name, Logic); templates live in /vf/templates/<name>.html.
 */
(function () {
  'use strict';
  const { h, render, Component, Fragment } = window.preact;

  /* <vf-combo items="{{list}}" value="{{v}}" onpick="{{fn}}" placeholder="…" search="true" label="…">
     A custom dropdown: opens the whole list on click/focus, typing filters it (search="true"),
     arrow keys + Enter pick, Escape or a click elsewhere closes. items: [{ value, text, sub }]. */
  const COMBO_CSS = `.vfc{position:relative;min-width:0}.vfc-btn{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;min-height:46px;padding:0 40px 0 16px;background:#FFFFFF;border:2px solid #121417;border-radius:999px;font:700 15px 'Hanken Grotesk',sans-serif;color:#121417;cursor:pointer;text-align:left;position:relative}
.vfc-btn input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;color:inherit;padding:0}
.vfc-btn input::placeholder{color:#6B7380;font-weight:600}.vfc-btn:focus-within{box-shadow:0 0 0 3px #C9D2EC}
.vfc-car{position:absolute;right:16px;top:50%;width:9px;height:9px;cursor:pointer;border-right:2.5px solid #121417;border-bottom:2.5px solid #121417;transform:translateY(-70%) rotate(45deg);transition:transform .15s}
.vfc.open .vfc-car{transform:translateY(-25%) rotate(-135deg)}
.vfc-list{position:absolute;top:calc(100% + 6px);left:0;right:0;min-width:240px;z-index:90;background:#FFFFFF;border:2px solid #121417;border-radius:16px;max-height:340px;overflow-y:auto;box-shadow:0 22px 40px -24px rgba(20,32,43,.6);padding:4px;scrollbar-width:thin;scrollbar-color:#9AA9C4 transparent}
.vfc-list::-webkit-scrollbar{width:10px}.vfc-list::-webkit-scrollbar-thumb{background:#9AA9C4;border-radius:999px;border:3px solid #FFFFFF}.vfc-list::-webkit-scrollbar-track{background:transparent}
.vfc-opt{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;font:600 15px 'Hanken Grotesk',sans-serif;color:#121417}
.vfc-opt small{font-size:12.5px;font-weight:500;color:#4A5260;text-align:right}.vfc-opt.hi{background:#EEF1F8}.vfc-opt.on{font-weight:800}.vfc-opt.on::before{content:"✓";margin-right:-4px;color:#41557F}
.vfc-none{padding:12px;color:#4A5260;font:500 14px 'Hanken Grotesk',sans-serif}.vfc-big .vfc-btn{min-height:52px;font-size:17px}`;
  class Combo extends Component {
    constructor(p) { super(p); this.state = { open: false, q: '', idx: 0 }; this.root = null;
      this.away = (ev) => { if (this.state.open && this.root && !this.root.contains(ev.target)) this.setState({ open: false, q: '' }); }; }
    componentDidMount() { document.addEventListener('mousedown', this.away); document.addEventListener('touchstart', this.away, { passive: true }); }
    componentWillUnmount() { document.removeEventListener('mousedown', this.away); document.removeEventListener('touchstart', this.away); }
    list() { const q = this.state.q.trim().toLowerCase(), items = this.props.items || [];
      if (!q) return items;
      return items.filter((o) => o.text.toLowerCase().includes(q)).sort((a, b) => (b.text.toLowerCase().startsWith(q) - a.text.toLowerCase().startsWith(q))); }
    pick(o) { this.setState({ open: false, q: '' }); const a = document.activeElement; if (a && this.root && this.root.contains(a)) a.blur(); if (this.props.onpick) this.props.onpick(o.value); }
    componentDidUpdate(pp, ps) { if (this.state.open && !ps.open && this.root) { const el = this.root.querySelector('.vfc-opt.on'); if (el) el.scrollIntoView({ block: 'nearest' }); } }
    render(p, st) {
      const items = this.list(), cur = (p.items || []).find((o) => o.value === p.value), search = p.search === 'true' || p.search === true;
      const idx = Math.min(st.idx, Math.max(0, items.length - 1));
      const key = (ev) => {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); this.setState({ open: true, idx: Math.max(0, Math.min(items.length - 1, idx + (ev.key === 'ArrowDown' ? 1 : -1))) }); }
        else if (ev.key === 'Enter') { ev.preventDefault(); if (st.open && items[idx]) this.pick(items[idx]); else this.setState({ open: true }); }
        else if (ev.key === 'Escape') this.setState({ open: false, q: '' });
      };
      const open = () => this.setState({ open: true, idx: Math.max(0, items.findIndex((o) => o.value === p.value)) });
      const field = search
        ? h('input', { type: 'text', 'aria-label': p.label || p.placeholder, placeholder: cur && !st.open ? cur.text : p.placeholder, value: st.q, autocomplete: 'off',
            onFocus: open, onInput: (ev) => this.setState({ q: ev.target.value, open: true, idx: 0 }), onKeyDown: key })
        : h('span', { style: 'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, cur ? cur.text : p.placeholder);
      return h('div', { class: 'vfc' + (st.open ? ' open' : '') + (p.big === 'true' ? ' vfc-big' : ''), ref: (r) => { this.root = r; } },
        h('div', { class: 'vfc-btn', role: 'combobox', 'aria-expanded': st.open ? 'true' : 'false', 'aria-label': p.label || p.placeholder, tabIndex: search ? -1 : 0,
          // The whole box (arrow included) opens the list; the arrow closes it again.
          onClick: (ev) => { const car = ev.target.classList && ev.target.classList.contains('vfc-car');
            if (st.open && (car || !search)) { this.setState({ open: false, q: '' }); return; }
            if (search) { const inp = this.root && this.root.querySelector('input'); if (inp && document.activeElement !== inp) inp.focus(); }
            open(); },
          onKeyDown: search ? null : key },
          p.icon === 'search' ? h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: '#4A5260', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'aria-hidden': 'true' }, h('circle', { cx: 11, cy: 11, r: 7 }), h('path', { d: 'M20 20l-4-4' })) : null,
          field, h('span', { class: 'vfc-car', 'aria-hidden': 'true' })),
        st.open ? h('div', { class: 'vfc-list', role: 'listbox' },
          items.length ? items.map((o, i) => h('div', { role: 'option', 'aria-selected': o.value === p.value ? 'true' : 'false', class: 'vfc-opt' + (i === idx ? ' hi' : '') + (o.value === p.value ? ' on' : ''),
            onMouseDown: (ev) => { ev.preventDefault(); this.pick(o); }, onMouseEnter: () => this.setState({ idx: i }) }, h('span', null, o.text), o.sub ? h('small', null, o.sub) : null))
            : h('div', { class: 'vfc-none' }, 'No match')) : null);
    }
  }
  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
    let v = scope;
    for (const k of path.split('.')) { if (v == null) return undefined; v = v[k]; }
    return v;
  }
  const str = (v) => (v == null || v === false ? '' : String(v));

  function compileValue(text) {
    const whole = text.match(WHOLE);
    if (whole) { const p = whole[1]; return (s) => lookup(s, p); }
    if (text.indexOf('{{') < 0) return () => text;
    const parts = []; let last = 0;
    text.replace(HOLE, (all, p, idx) => { parts.push(text.slice(last, idx), { p }); last = idx + all.length; return all; });
    parts.push(text.slice(last));
    return (s) => parts.map((x) => (typeof x === 'string' ? x : str(lookup(s, x.p)))).join('');
  }

  function compileChildren(node) {
    return Array.from(node.childNodes).map(compileNode).filter(Boolean);
  }
  const renderAll = (fns, s) => fns.map((f) => f(s));

  function compileNode(node) {
    if (node.nodeType === 3) {
      const t = node.nodeValue;
      if (!t.trim()) return /\n/.test(t) ? null : () => ' ';
      const v = compileValue(t.trim()), lead = /^\s/.test(t) ? ' ' : '', trail = /\s$/.test(t) ? ' ' : '';
      return (s) => lead + str(v(s)) + trail;
    }
    if (node.nodeType !== 1) return null;
    const tag = node.localName;
    if (tag === 'helmet') return null;
    if (tag === 'vf-combo') {
      const attrs = Array.from(node.attributes).map((a) => [a.name, compileValue(a.value)]);
      return (s) => { const props = {}; for (const [n, f] of attrs) props[n] = f(s); return h(Combo, props); };
    }
    if (tag === 'sc-for') {
      const list = compileValue(node.getAttribute('list') || ''), as = node.getAttribute('as') || 'item';
      const kids = compileChildren(node);
      return (s) => (list(s) || []).map((item, i) => { const sc = Object.create(s); sc[as] = item; sc.$index = i; return renderAll(kids, sc); });
    }
    if (tag === 'sc-if') {
      const cond = compileValue(node.getAttribute('value') || '');
      const kids = compileChildren(node);
      return (s) => (cond(s) ? renderAll(kids, s) : null);
    }
    const attrs = [];
    for (const a of Array.from(node.attributes)) {
      if (a.name.indexOf('hint-') === 0) continue;
      attrs.push([a.name, compileValue(a.value)]);
    }
    let kids = compileChildren(node);
    /* <select sc-options="{{list}}">: the HTML parser drops <sc-for> inside <select>, so options come from a list of {value, text}. */
    const optAttr = attrs.find(([n]) => n === 'sc-options');
    if (optAttr) {
      const list = optAttr[1];
      attrs.splice(attrs.indexOf(optAttr), 1);
      kids = [(s) => (list(s) || []).map((o) => h('option', { value: o.value }, o.text))];
    }
    return (s) => {
      const props = {};
      for (const [n, f] of attrs) {
        const v = f(s);
        if (n.indexOf('on') === 0) { if (typeof v === 'function') props[n] = v; continue; }
        props[n] = v;
      }
      return h(tag, props, renderAll(kids, s));
    };
  }

  function compileTemplate(html) {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + html + '</body>', 'text/html');
    const helmet = doc.body.querySelector('helmet');
    if (helmet) {
      helmet.querySelectorAll('style, link').forEach((n) => {
        if (n.tagName === 'LINK' && document.head.querySelector('link[href="' + n.getAttribute('href') + '"]')) return;
        document.head.appendChild(document.importNode(n, true));
      });
      helmet.remove();
    }
    const fns = compileChildren(doc.body);
    return (vals) => renderAll(fns, vals);
  }

  class DCLogic extends Component {
    render() { const v = this.renderVals(); return h(Fragment, null, this.constructor.__tpl(v)); }
  }

  const pages = {};
  window.DCLogic = DCLogic;
  /* The brand bar starts tall at the top of the page and slims down once you scroll. */
  const onScrollBand = () => document.body.classList.toggle('vf-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScrollBand, { passive: true }); document.addEventListener('DOMContentLoaded', onScrollBand); onScrollBand();
  /* In-page menu jumps: boxes slide in as they scroll into view, which shifts where the browser
     thinks they are. Jump to the real layout position instead, just below the sticky bar. */
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey) return;
    const el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
    ev.preventDefault();
    let top = 0; for (let n = el; n; n = n.offsetParent) top += n.offsetTop;
    const band = document.querySelector('.vf-band'), off = (band ? band.getBoundingClientRect().height : 0) + 16;
    window.scrollTo({ top: Math.max(0, top - off), behavior: 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
  });
  { const st = document.createElement('style'); st.textContent = COMBO_CSS; document.head.appendChild(st); }
  window.VF = {
    page(name, Logic) { pages[name] = Logic; },
    /* Mail ballots must arrive by noon on the 3rd day after Election Day; a weekend or
       state holiday (Veterans Day, Nov 11) moves it to the next business day. */
    deadline(eday) {
      let d = VF.addDays(eday, 3);
      const off = (iso) => { const x = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)).getDay(); return x === 0 || x === 6 || iso.slice(5) === '11-11'; };
      while (off(d)) d = VF.addDays(d, 1);
      return d;
    },
    /* "In person vs. mail" map colors: a place's in-person share of early votes minus the
       overall share. Green = leans in person, purple = leans mail, gray = near the average. */
    LEAN: ['#4E2A9E', '#8E6ADF', '#CDBCF3', '#E3E6EB', '#BDEBD6', '#4CC49B', '#00694F'],
    leanColor(e, m, base) {
      if (!(e + m)) return '#F1F2F5';
      const d = e / (e + m) - base, a = Math.abs(d), k = a < 0.03 ? 0 : a < 0.08 ? 1 : a < 0.15 ? 2 : 3;
      return VF.LEAN[3 + (d < 0 ? -k : k)];
    },
    leanBins() {
      return [['≥15 pts more mail', 0], ['8–15', 1], ['3–8', 2], ['near avg', 3], ['3–8', 4], ['8–15', 5], ['≥15 pts more in person', 6]].map(([l, i]) => ({ c: VF.LEAN[i], l }));
    },
    /* Series index (0 = 46 days before Election Day) of a date. */
    idxOf(eday, iso) {
      const p = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
      return 46 + Math.round((p(iso) - p(eday)) / 864e5);
    },
    /* 'YYYY-MM-DD' + n days, in local calendar terms */
    addDays(iso, n) {
      const d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    async mount(name, props, el) {
      const Logic = pages[name];
      const html = await fetch('/vf/templates/' + name + '.html').then((r) => r.text());
      Logic.__tpl = compileTemplate(html);
      el.innerHTML = '';
      const draw = () => render(h(Logic, props), el);
      draw();
    },
    /* Path routing: /, /status, /<election>, /<election>/<locality>[/scenarios] */
    route(pathname) {
      const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
      if (parts[0] === 'status' || parts[0] === 'about') return { page: parts[0], props: {} };
      const eid = /^20\d\d(-special)?$/.test(parts[0] || '') ? parts[0] : '2026';
      if (parts[1]) return { page: 'locality', props: { eid, lid: parts[1] } };
      return { page: 'home', props: { eid } };
    }
  };
})();
