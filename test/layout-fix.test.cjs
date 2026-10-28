const fs = require('fs');
function makeEl(tag, text, cls) {
  const el = { tagName: tag.toUpperCase(), className: cls || '', textContent: text || '', style: {}, dataset: {}, children: [], parent: null,
    appendChild(c) { c.parent = el; el.children.push(c); return c; },
    remove() { if (el.parent) { const i = el.parent.children.indexOf(el); if (i >= 0) el.parent.children.splice(i, 1); } },
    setAttribute() {}, getAttribute() { return null; },
    contains() { return false; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 36, height: 36, left: 12, top: 700, bottom: 736 }; },
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
    const m = sel.match(/data-plugin-css="([^"]+)"/);
    if (m) { const st = [...head.children]; while (st.length) { const n = st.shift(); if (n.dataset && n.dataset.pluginCss === m[1]) return n; if (n.children) st.push(...n.children); } return null; }
    return null; },
  querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {} };
const store = { v: {} };
const window = { innerHeight: 800, innerWidth: 1200,
  localStorage: { setItem(k, v) { store.v[k] = v; }, getItem(k) { return store.v[k] === undefined ? null : store.v[k]; } },
  addEventListener() {}, removeEventListener() {}, setTimeout() { return 0; }, setInterval() { return 0; },
  clearInterval() {}, clearTimeout() {}, getComputedStyle() { return { display: 'block' }; } };
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
if (!panelEl) { console.log('FAIL: 没有 Panel'); process.exit(1); }
const Panel = panelEl.type, props = panelEl.props;

function render() { rt.state = []; rt.idx = 0; rt.effects = []; Panel(props); rt.effects.forEach(fn => fn()); rt.effects = []; rt.idx = 0; return Panel(props); }
function nodes(node) { const out = [];
  (function scan(n, d) { if (!n || d > 14) return; if (Array.isArray(n)) { n.forEach(x => scan(x, d)); return; }
    if (typeof n !== 'object') return; out.push(n);
    (n.kids || []).forEach(k => scan(k, d + 1));
    if (n.props) Object.keys(n.props).forEach(key => { const v = n.props[key]; if (v && typeof v === 'object') scan(v, d + 1); }); })(node, 0);
  return out; }
function texts(n) { return nodes(n).filter(x => typeof x === 'string'); }

// 1) 布局修复：点一下 → 样式出现；重渲染后文字应为「开」
let el = render();
let link = nodes(el).find(n => n.type === 'button' && (n.kids || []).join('') === '布局修复：关');
if (!link) { console.log('FAIL: 找不到「布局修复：关」'); process.exit(1); }
link.props.onClick();
if (!document.querySelector('style[data-plugin-css="dsh-footer-manager/fix"]')) { console.log('FAIL: 开启后没有注入修复样式'); process.exit(1); }
el = render();
link = nodes(el).find(n => n.type === 'button' && (n.kids || []).join('') === '布局修复：开');
if (!link) { console.log('FAIL: 重开后状态没同步（仍是「关」）—— 这是重写前会说的话'); process.exit(1); }
console.log('PASS: 布局修复状态与页面一致（重开抽屉仍显示「开」）');
link.props.onClick();
if (document.querySelector('style[data-plugin-css="dsh-footer-manager/fix"]')) { console.log('FAIL: 关闭后样式还在'); process.exit(1); }
console.log('PASS: 关闭布局修复会移除样式');

// 2) 全部恢复
el = render();
const hideSw = nodes(el).find(n => n.type === 'button' && n.props && n.props['aria-label'] === '隐藏 WSL工作区');
if (!hideSw) { console.log('FAIL: 找不到 WSL 开关'); process.exit(1); }
hideSw.props.onClick();
if (wsl.style.display !== 'none') { console.log('FAIL: 没遮住'); process.exit(1); }
el = render();
const restoreAll = nodes(el).find(n => n.type === 'button' && (n.kids || []).join('') === '全部恢复');
if (!restoreAll) { console.log('FAIL: 隐藏后没有「全部恢复」'); process.exit(1); }
restoreAll.props.onClick();
if (wsl.style.display === 'none') { console.log('FAIL: 全部恢复没生效'); process.exit(1); }
const left = JSON.parse(store.v['dsh-footer-manager:hidden'] || '[]');
if (left.length !== 0) { console.log('FAIL: 存储没清空'); process.exit(1); }
console.log('PASS: 全部恢复 → 元素复原、存储清空');
