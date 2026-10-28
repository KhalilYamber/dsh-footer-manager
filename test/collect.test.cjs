const fs = require('fs');
function makeEl(tag, text, cls) {
  const el = { tagName: tag.toUpperCase(), className: cls || '', textContent: text || '', style: {}, dataset: {}, children: [], parent: null,
    appendChild(c) { c.parent = el; el.children.push(c); return c; },
    remove() { if (el.parent) { const i = el.parent.children.indexOf(el); if (i >= 0) el.parent.children.splice(i, 1); } },
    setAttribute() {}, getAttribute() { return null; },
    contains() { return false; }, clicked: 0, click() { this.clicked += 1; },
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



// ── 收编模式 ──
function styleExists(id) { return !!document.querySelector('style[data-plugin-css="' + id + '"]'); }

if (styleExists('dsh-footer-manager/collect')) { console.log('FAIL: 收编默认不应开启'); process.exit(1); }
console.log('PASS: 收编默认关闭');

let el = render();
const onBtn = nodes(el).find(n => n.type === 'button' && (n.kids || []).join('') === '收编：关');
if (!onBtn) { console.log('FAIL: 抽屉里没有「收编：关」'); process.exit(1); }
onBtn.props.onClick();
if (!styleExists('dsh-footer-manager/collect')) { console.log('FAIL: 开启后没有注入隐藏样式'); process.exit(1); }
if (store.v['dsh-footer-manager:collect'] !== '1') { console.log('FAIL: 收编状态没持久化'); process.exit(1); }
console.log('PASS: 开启收编 → 注入隐藏样式并持久化');

// 渲染后应出现「打开」按钮，点击应触发原入口的 click()
el = render();
const openBtn = nodes(el).find(n => n.type === 'button' && (n.kids || []).join('') === '打开');
if (!openBtn) { console.log('FAIL: 收编模式下没有「打开」按钮'); process.exit(1); }
openBtn.props.onClick();
if (wsl.clicked !== 1) { console.log('FAIL: 点「打开」没有触发原入口（clicked=' + wsl.clicked + '）'); process.exit(1); }
console.log('PASS: 点「打开」→ 触发原入口自身的 click（功能不减）');

// 关掉后「打开」消失
el = render();
const offBtn = nodes(el).find(n => n.type === 'button' && (n.kids || []).join('') === '收编：开');
if (!offBtn) { console.log('FAIL: 状态没同步为「收编：开」'); process.exit(1); }
offBtn.props.onClick();
if (styleExists('dsh-footer-manager/collect')) { console.log('FAIL: 关闭后样式还在'); process.exit(1); }
console.log('PASS: 关闭收编 → 样式移除');
