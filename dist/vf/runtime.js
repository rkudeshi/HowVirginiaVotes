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

  /* Look settings (the "?" panel): theme (auto / light / dark) and border style (soft gray or bold
     black). Both are applied by rewriting colors as the templates render, so the templates keep
     their light-mode colors as written:
       - tc(str) rewrites every UPPERCASE #RRGGBB and rgb()/rgba() in a style string or SVG color.
       - Lowercase hex is left alone on purpose: use it for colors that must not change in dark
         mode (data ramps on maps, the brand bar). An all-digit color needs a letter to opt out,
         so the near-black is written #12141a there. */
  const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const THEME = pref('vf-theme', 'auto'), BORDERS = pref('vf-borders', 'soft');
  const DARK = THEME === 'dark' || (THEME === 'auto' && !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches));
  const SOFT = BORDERS === 'soft';
  document.documentElement.classList.toggle('vf-dark', DARK);
  document.documentElement.classList.toggle('vf-soft', SOFT);
  document.documentElement.style.colorScheme = DARK ? 'dark' : 'light';
  const DARK_MAP = { FFFFFF: '1B1E24', E6E8EC: '0F1115', '121417': 'E9EBEF', '4A5260': 'A4ABB7', '3A3F48': '5A616D', ECEEF2: '2A2E36', F1F2F5: '23272E',
    F5F6F8: '20242B', F8F9FB: '1F2329', D3D7DE: '3A3F48', DCDFE5: '343943', E4D9FA: '3B2F5C', EEEEEE: '2A2E36', '2A2F38': 'D3D7DE', '5F6775': 'A4ABB7',
    '8A93A3': '8A93A3', B7BCC6: '5F6775', FFD23F: 'C9A227', FFF6D1: '2E2814', F0D27A: '6B5A22', '5B2FB8': 'B49BF2', '4E2A9E': 'C4AEF6', '7C4DDB': '9673E6',
    '00A37A': '1DB98C', '00694F': '5CD3AA', '41557F': '8EA2CC', '1B2A6B': 'AFC0EA', '121A3A': 'C9D2EA' };
  const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let hh = 0, ss = 0;
    if (mx !== mn) { const d = mx - mn; ss = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh /= 6; } return [hh, ss, l]; };
  const rgbOf = (hh, ss, l) => { if (!ss) return [l, l, l].map((v) => Math.round(v * 255)); const q = l < 0.5 ? l * (1 + ss) : l + ss - l * ss, pp = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; }; return [f(hh + 1 / 3), f(hh), f(hh - 1 / 3)].map((v) => Math.round(v * 255)); };
  const darkRGB = (r, g, b) => {
    const [hh, ss, l] = hsl(r, g, b); let l2 = l, s2 = ss;
    if (ss < 0.12) l2 = Math.min(0.94, Math.max(0.08, 1.02 - l * 0.93));          // grays flip
    else if (l >= 0.85) { l2 = 0.15 + (1 - l) * 0.7; s2 = ss * 0.5; }               // pale tints → dark tints
    else if (l <= 0.3) l2 = 0.74;                                                    // dark ink → light ink
    return rgbOf(hh, s2, l2);
  };
  const memo = {};
  const darkHex = (hx) => { if (DARK_MAP[hx]) return '#' + DARK_MAP[hx]; if (memo[hx]) return memo[hx];
    const c = darkRGB(parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16));
    return (memo[hx] = '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()); };
  const SOFT_RE = /(border(?:-top|-right|-bottom|-left)?\s*:\s*[^;"]*?)#(3A3F48|121417|D3D7DE)\b/g;
  const tc = (v) => {
    if (typeof v !== 'string' || (!DARK && !SOFT)) return v;
    if (SOFT) v = v.replace(SOFT_RE, '$1#EEEEEE');
    if (DARK) v = v.replace(/#([0-9A-F]{6})\b/g, (m, hx) => darkHex(hx))
      .replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)((?:,\s*[\d.]+)?)\)/g, (m, r, g, b, a) => { const c = darkRGB(+r, +g, +b); return (a ? 'rgba(' : 'rgb(') + c.join(',') + a + ')'; });
    return v;
  };
  const COLOR_ATTRS = { style: 1, fill: 1, stroke: 1, 'stop-color': 1, color: 1 };
  /* The secret look panel, opened with "?" (Shift+/) anywhere outside a text field. */
  const LOOK_CSS = '.vf-look{position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:rgba(18,20,23,.35);backdrop-filter:blur(6px)}'
    + '.vf-look>div{width:min(420px,calc(100vw - 32px));background:rgba(255,255,255,.82);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.6);border-radius:22px;padding:22px 22px 18px;box-shadow:0 30px 60px -20px rgba(18,20,23,.5);font-family:"Hanken Grotesk",sans-serif;color:#121417}'
    + '.vf-look h2{margin:0 0 2px;font:700 18px "Unbounded",sans-serif;letter-spacing:-.02em}.vf-look p{margin:0 0 16px;color:#4A5260;font-size:14px}'
    + '.vf-look .row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-top:1px solid rgba(18,20,23,.08)}.vf-look .row b{font-size:15px}'
    + '.vf-look .seg{display:inline-flex;gap:3px;padding:4px;border-radius:999px;background:rgba(18,20,23,.07)}'
    + '.vf-look .seg button{border:0;border-radius:999px;background:transparent;color:#4A5260;font:600 13px "Hanken Grotesk",sans-serif;padding:7px 12px;cursor:pointer}'
    + '.vf-look .seg button[aria-pressed=true]{background:#FFFFFF;color:#121417;box-shadow:0 1px 3px rgba(18,20,23,.18)}.vf-look small{display:block;margin-top:12px;color:#4A5260;font-size:12px}';
  const openLook = () => {
    if (document.querySelector('.vf-look')) return;
    const st = document.createElement('style'); st.textContent = tc(LOOK_CSS) + '.vf-look{background:rgba(10,12,15,' + (DARK ? '.55' : '.3') + ')}'; st.id = 'vf-look-css'; document.head.appendChild(st);
    const wrap = document.createElement('div'); wrap.className = 'vf-look'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Look settings');
    const row = (label, key, cur, opts) => '<div class="row"><b>' + label + '</b><span class="seg">' + opts.map(([v, t]) => '<button data-k="' + key + '" data-v="' + v + '" aria-pressed="' + (cur === v) + '">' + t + '</button>').join('') + '</span></div>';
    wrap.innerHTML = '<div><h2>Super secret mode</h2><p>Look settings for this browser.</p>'
      + row('Borders', 'vf-borders', BORDERS, [['soft', 'Soft gray'], ['bold', 'Bold black']])
      + row('Theme', 'vf-theme', THEME, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])
      + '<small>Press ? or Esc to close.</small></div>';
    const close = () => { wrap.remove(); st.remove(); };
    wrap.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-k]');
      if (b) { try { localStorage.setItem(b.dataset.k, b.dataset.v); } catch (e) { /* storage off */ } location.reload(); return; }
      if (ev.target === wrap) close(); });
    document.body.appendChild(wrap); openLook.close = close;
  };
  document.addEventListener('keydown', (ev) => {
    const t = ev.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (ev.key === '?' && !typing) { ev.preventDefault(); if (document.querySelector('.vf-look')) openLook.close(); else openLook(); }
    else if (ev.key === 'Escape' && document.querySelector('.vf-look')) openLook.close();
  });
  if (THEME === 'auto' && window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => location.reload());

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
        props[n] = COLOR_ATTRS[n] ? tc(v) : v;
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
        const c = document.importNode(n, true); if (c.tagName === 'STYLE') c.textContent = tc(c.textContent);
        document.head.appendChild(c);
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
  /* The brand bar starts tall at the top of the page and slims down once you scroll. The bar is
     fixed and the page keeps a constant gap for its tall height, so slimming it never moves the
     page (a moving page used to flip the bar back and forth near the top). Two thresholds keep
     it from flickering: slim past 56px, tall again only back near the top. */
  const BAND_CSS = 'html.vf-soft [role=group]{border:1px solid #E1E5EC !important;background:#F0F2F6 !important;padding:4px;gap:3px;border-radius:999px !important}'
    + 'html.vf-soft [role=group]>button{background:transparent !important;color:#586477 !important;border-radius:999px !important;min-height:36px !important}'
    + 'html.vf-soft [role=group]>button[aria-pressed=true]{background:#FFFFFF !important;color:#121417 !important;box-shadow:0 1px 3px rgba(18,20,23,.16),0 0 0 1px rgba(18,20,23,.04)}'
    + 'html.vf-soft [role=group]>button:not([aria-pressed=true]):hover{color:#121417 !important}'
    + '.vf-band{position:fixed !important;top:0;left:0;right:0}body{padding-top:var(--vf-bandh,68px)}body.vf-full .vf-band{display:none !important}';
  { const st = document.createElement('style'); st.textContent = tc(BAND_CSS); document.head.appendChild(st); }
  const measureBand = () => {
    const b = document.querySelector('.vf-band');
    if (b && !document.body.classList.contains('vf-scrolled') && !measureBand.busy) document.documentElement.style.setProperty('--vf-bandh', b.offsetHeight + 'px');
  };
  const onScrollBand = () => {
    const y = window.scrollY, cl = document.body.classList, was = cl.contains('vf-scrolled');
    const now = was ? y > 4 : y > 56;
    if (now === was) return;
    cl.toggle('vf-scrolled', now);
    if (!now) { measureBand.busy = true; clearTimeout(measureBand.t); measureBand.t = setTimeout(() => { measureBand.busy = false; measureBand(); }, 320); }
  };
  window.addEventListener('scroll', onScrollBand, { passive: true });
  window.addEventListener('resize', measureBand);
  window.addEventListener('load', measureBand);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureBand);
  document.addEventListener('DOMContentLoaded', () => { onScrollBand(); measureBand(); new MutationObserver(() => { cancelAnimationFrame(measureBand.f); measureBand.f = requestAnimationFrame(measureBand); }).observe(document.body, { childList: true, subtree: true }); });
  onScrollBand();
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
  { const st = document.createElement('style'); st.textContent = tc(COMBO_CSS); document.head.appendChild(st); }
  /* Calendar shading: a continuous slate scale, so every daily total gets its own shade. */
  // Lowercase hex output keeps these out of the theme rewrite; dark mode has its own scale.
  const CAL_STOPS = DARK ? [[0, [38, 43, 54]], [0.2, [50, 62, 88]], [0.45, [72, 96, 146]], [0.7, [112, 140, 198]], [1, [170, 192, 240]]]
    : [[0, [241, 244, 249]], [0.2, [205, 214, 230]], [0.45, [140, 158, 191]], [0.7, [65, 85, 127]], [1, [27, 42, 107]]];
  const calColor = (q) => {
    q = Math.max(0, Math.min(1, q || 0));
    let j = 1; while (j < CAL_STOPS.length - 1 && q > CAL_STOPS[j][0]) j++;
    const [qa, a] = CAL_STOPS[j - 1], [qb, b] = CAL_STOPS[j], t = (q - qa) / (qb - qa || 1);
    const c = a.map((x, k) => Math.round(x + (b[k] - x) * t));
    return { bg: '#' + c.map((x) => x.toString(16).padStart(2, '0')).join(''), fg: DARK ? (q > 0.55 ? '#12141a' : '#e9ebef') : (q > 0.5 ? '#ffffff' : '#12141a') };
  };
  /* Recently opened localities (this browser only), listed first in the locality pickers. */
  const RECENT_KEY = 'vf-recent-localities';
  const recentLocs = () => { try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, 5) : []; } catch (e) { return []; } };
  const addRecent = (id) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id].concat(recentLocs().filter((x) => x !== id)).slice(0, 5))); } catch (e) { /* storage off */ } };
  /* items: the full picker list ({ value: id, text }). Returns recent entries (value 'r:<id>') to
     put first; strip the prefix with VF.unRecent when one is picked. */
  const recentItems = (items, skip) => recentLocs().filter((id) => id !== skip).map((id) => items.find((o) => o.value === id)).filter(Boolean)
    .map((o) => ({ value: 'r:' + o.value, text: o.text, sub: 'Recent' }));
  /* Days that run differently: Election Day and the state holidays inside the voting window
     (Indigenous Peoples' Day, the second Monday in October, and Veterans Day, Nov 11). */
  const dayFlag = (k, eDate) => {
    if (!k) return '';
    if (k === eDate) return 'Election Day';
    const m = +k.slice(5, 7), d = +k.slice(8, 10), dow = new Date(+k.slice(0, 4), m - 1, d).getDay();
    if (m === 10 && dow === 1 && d >= 8 && d <= 14) return 'Indigenous Peoples’ Day';
    if (m === 11 && d === 11) return 'Veterans Day';
    return '';
  };
  window.VF = {
    dayFlag, flagChip: (k, eDate) => { const t = dayFlag(k, eDate); return t === 'Election Day' ? '★ Election Day' : t ? 'Holiday · ' + t : ''; },
    recentLocs, addRecent, recentItems, unRecent: (v) => (v || '').replace(/^r:/, ''),
    dark: DARK, soft: SOFT, tc, calColor, calLegend: [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 1].map((q) => calColor(q).bg),
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
    LEAN: ['#4e2a9e', '#8e6adf', '#cdbcf3', '#e3e6eb', '#bdebd6', '#4cc49b', '#00694f'],
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
