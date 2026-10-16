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
      if (parts[0] === 'status') return { page: 'status', props: {} };
      const eid = /^20\d\d(-special)?$/.test(parts[0] || '') ? parts[0] : '2026';
      if (parts[1]) return { page: 'locality', props: { eid, lid: parts[1] } };
      return { page: 'home', props: { eid } };
    }
  };
})();
