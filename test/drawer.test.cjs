const fs = require('fs');
function makeEl(tag, text, cls) {
  const el = { tagName: tag.toUpperCase(), className: cls || '', textContent: text || '', style: {}, dataset: {}, children: [],
    appendChild(c) { el.children.push(c); return c; }, remove() {}, setAttribute() {}, getAttribute() { return null; },
    contains() { return false; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 36, height: 36, left: 12, top: 700 }; },
    querySelector(sel) { const want = sel.replace('.', ''); const st = [...el.children];
      while (st.length) { const n = st.shift(); if ((n.className || '').split(/\s+/).includes(want)) return n; if (n.children) st.push(...n.children); } return null; } };
  return el;
}
const slot = makeEl('div', '', 'slot');
const wsl = makeEl('div', 'WSL工作区', 'dww_entry');
const selfRow = makeEl('div', '', 'dfm_entryRow');
selfRow.appendChild(makeEl('button', '', 'dfm_entry'));
slot.appendChild(wsl); slot.appendChild(selfRow);
const head = makeEl('head'), body = makeEl('body'); body.appendChild(slot);
const styleNodes = [];
const document = { hidden: false, head, body,
  createElement(t) { const n = makeEl(t); if (t === 'style') styleNodes.push(n); return n; },
  querySelector(sel) {
    if (sel.includes('data-slot')) return slot;
    if (sel.includes('footArea')) return null;
    if (sel.includes('footerActions')) return slot;
    const m = sel.match(/data-plugin-css="([^"]+)"/); if (m) return styleNodes.find(n => n.dataset.pluginCss === m[1]) || null;
    return null; },
  querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {} };
const store = { v: {} };
const window = { innerHeight: 800,
  localStorage: { setItem(k, v) { store.v[k] = v; }, getItem(k) { return store.v[k] === undefined ? null : store.v[k]; } },
  addEventListener() {}, removeEventListener() {}, setTimeout() { return 0; }, setInterval() { return 0; },
  clearInterval() {}, clearTimeout() {}, getComputedStyle() { return { display: 'block', visibility: 'visible', opacity: '1', overflow: 'visible' }; } };
global.window = window; global.document = document;

const rt = { state: [], idx: 0, effects: [] };
const react = {
  Fragment: Symbol(), createElement: (t, p, ...k) => ({ type: t, props: p || {}, kids: k }),
  useState(init) { const i = rt.idx++; if (!(i in rt.state)) rt.state[i] = typeof init === 'function' ? init() : init;
    return [rt.state[i], (v) => { rt.state[i] = typeof v === 'function' ? v(rt.state[i]) : v; }]; },
  useRef(v) { const i = rt.idx++; if (!(i in rt.state)) rt.state[i] = { current: v }; return rt.state[i]; },
  useEffect(fn) { rt.effects.push(fn); }, useCallback(fn) { rt.idx++; return fn; },
};
let captured = null; global.window.__ModuleLoader__ = { load: (d) => { captured = d; } };
eval(fs.readFileSync(require('path').join(__dirname, '..', 'lib', 'client.js'), 'utf8'));
const mod = captured.factory((n) => n === 'react' ? react : n === 'react-dom' ? { createPortal: (e) => e } : (() => { throw new Error(n); })());
let comp = null;
mod.apply({ slots: { inject: (s, f) => f(), register: (o, c) => { comp = c; return () => {}; } }, effect: () => {} });

rt.state = []; rt.idx = 0; rt.effects = []; rt.state[0] = true;
const tree = comp(); rt.effects.forEach(fn => fn()); rt.effects = [];
let panelEl = null;
(function find(n, d) { if (!n || d > 8 || panelEl) return; if (Array.isArray(n)) { n.forEach(x => find(x, d)); return; }
  if (typeof n !== 'object') return;
  if (typeof n.type === 'function' && n.type.name === 'Panel') { panelEl = n; return; }
  (n.kids || []).forEach(k => find(k, d + 1)); })(tree, 0);
if (!panelEl) { console.log('FAIL: 入口树里没有 Panel'); process.exit(1); }
const Panel = panelEl.type;
const props = panelEl.props;

function render() {
  rt.state = []; rt.idx = 0; rt.effects = [];
  Panel(props); rt.effects.forEach(fn => fn()); rt.effects = [];
  rt.idx = 0;
  return Panel(props);
}
function nodes(node) { const out = [];
  (function scan(n, d) { if (!n || d > 14) return; if (Array.isArray(n)) { n.forEach(x => scan(x, d)); return; }
    if (typeof n !== 'object') return; out.push(n);
    (n.kids || []).forEach(k => scan(k, d + 1));
    if (n.props) Object.keys(n.props).forEach(key => { const v = n.props[key]; if (v && typeof v === 'object') scan(v, d + 1); }); })(node, 0);
  return out; }
function textOf(node) { return nodes(node).map(n => (typeof n === 'string' ? n : '')).join(' '); }

let el = render();
const all = nodes(el);
const names = all.filter(n => n.props && n.props.className === 'dfm_itemName').map(n => (n.kids || []).join(''));
console.log('抽屉里的入口：', JSON.stringify(names));
if (!names.includes('WSL工作区')) { console.log('FAIL: 抽屉里没有列出 WSL 入口'); process.exit(1); }
function deepText(n) {
  if (n === null || n === undefined) return '';
  if (typeof n === 'string') return n + ' ';
  if (Array.isArray(n)) return n.map(deepText).join('');
  if (typeof n !== 'object') return '';
  let out = '';
  (n.kids || []).forEach(k => { out += deepText(k); });
  return out;
}
const footText = all.filter(n => n.props && n.props.className === 'dfm_foot').map(deepText).join(' | ');
console.log('底栏：', footText);
if (!/共 2 个/.test(footText)) { console.log('FAIL: 底栏计数不对'); process.exit(1); }

// 开关：aria-label 以「隐藏 」开头
const switches = all.filter(n => n.type === 'button' && n.props && typeof n.props['aria-label'] === 'string' && /^(隐藏|显示) /.test(n.props['aria-label']));
console.log('开关：', JSON.stringify(switches.map(s => s.props['aria-label'] + (s.props.disabled ? '(disabled)' : ''))));
const hideSw = switches.find(s => s.props['aria-label'] === '隐藏 WSL工作区');
if (!hideSw) { console.log('FAIL: 找不到 WSL 的开关'); process.exit(1); }
hideSw.props.onClick();
if (wsl.style.display !== 'none') { console.log('FAIL: 关掉以后没被遮住'); process.exit(1); }
if (selfRow.style.display === 'none') { console.log('FAIL: 误伤自己'); process.exit(1); }
console.log('PASS: 开关关闭 → 目标被遮；自己未受影响');

const persisted = JSON.parse(store.v['dsh-footer-manager:hidden'] || '[]');
if (!persisted.includes('WSL工作区')) { console.log('FAIL: 未持久化'); process.exit(1); }
console.log('PASS: 已持久化 →', JSON.stringify(persisted));

const el2 = render();
const sw2 = nodes(el2).filter(n => n.type === 'button' && n.props && /^(隐藏|显示) /.test(String(n.props['aria-label'] || '')));
const showSw = sw2.find(s => s.props['aria-label'] === '显示 WSL工作区');
if (!showSw) { console.log('FAIL: 隐藏后开关没有变成「显示」'); process.exit(1); }
showSw.props.onClick();
if (wsl.style.display === 'none') { console.log('FAIL: 打开开关后仍被遮'); process.exit(1); }
console.log('PASS: 开关打开 → 恢复显示');
