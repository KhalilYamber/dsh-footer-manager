// 回归：主人自己撤下的入口（hidden / aria-hidden）不算「占用底部区域」
//
// 真实来源：dsh-wsl-workspace 0.7.11 起，宽侧栏下入口搬进 Workspaces 区标题栏，
// 底部只留一颗 hidden 的兜底按钮等窄侧栏回来用。管家过去按「插槽里有节点」算占用，
// 于是抽屉里列出一条屏幕上不存在、开关也按不出变化的东西。
const fs = require('fs');

function makeEl(tag, text, cls, attrs) {
  const el = {
    tagName: tag.toUpperCase(), className: cls || '', textContent: text || '',
    style: {}, dataset: {}, children: [], attrs: Object.assign({}, attrs || {}),
    appendChild(c) { el.children.push(c); return c; }, remove() {},
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return el.attrs[k] === undefined ? null : el.attrs[k]; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(el.attrs, k); },
    contains() { return false; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 36, height: 36, left: 12, top: 700 }; },
    querySelector(sel) {
      const want = sel.replace('.', '');
      const st = [...el.children];
      while (st.length) {
        const n = st.shift();
        if ((n.className || '').split(/\s+/).includes(want)) return n;
        if (n.children) st.push(...n.children);
      }
      return null;
    },
  };
  return el;
}

const slot = makeEl('div', '', 'slot');
// 主人自己撤下的两种写法
const parked = makeEl('button', 'WWSL工作区', 'dww-action dww-action--wide', { hidden: '' });
const ariaParked = makeEl('button', '远程配对', 'rw-pair', { 'aria-hidden': 'true' });
// 正常占位的入口
const visible = makeEl('button', '当前入口', 'ml-entry');
// 过去被管家自己遮住的入口：必须仍然列出，否则用户没法恢复
const restoreMe = makeEl('button', '旧入口', 'x-entry');
const selfRow = makeEl('div', '', 'dfm_entryRow');
selfRow.appendChild(makeEl('button', '', 'dfm_entry'));
[visible, parked, ariaParked, restoreMe, selfRow].forEach(n => slot.appendChild(n));

const head = makeEl('head'), body = makeEl('body');
body.appendChild(slot);
const styleNodes = [];
const document = {
  hidden: false, head, body,
  createElement(t) { const n = makeEl(t); if (t === 'style') styleNodes.push(n); return n; },
  querySelector(sel) {
    if (sel.includes('data-slot')) return slot;
    const m = sel.match(/data-plugin-css="([^"]+)"/);
    if (m) return styleNodes.find(n => n.dataset.pluginCss === m[1]) || null;
    return null;
  },
  querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {},
};
const store = { v: { 'dsh-footer-manager:hidden': JSON.stringify(['旧入口']) } };
const window = {
  innerHeight: 800,
  localStorage: {
    setItem(k, v) { store.v[k] = v; },
    getItem(k) { return store.v[k] === undefined ? null : store.v[k]; },
  },
  addEventListener() {}, removeEventListener() {}, setTimeout() { return 0; }, setInterval() { return 0; },
  clearInterval() {}, clearTimeout() {},
};
global.window = window; global.document = document;

const rt = { state: [], idx: 0, effects: [] };
const react = {
  Fragment: Symbol(),
  createElement: (t, p, ...k) => ({ type: t, props: p || {}, kids: k }),
  useState(init) {
    const i = rt.idx++;
    if (!(i in rt.state)) rt.state[i] = typeof init === 'function' ? init() : init;
    return [rt.state[i], (v) => { rt.state[i] = typeof v === 'function' ? v(rt.state[i]) : v; }];
  },
  useRef(v) { const i = rt.idx++; if (!(i in rt.state)) rt.state[i] = { current: v }; return rt.state[i]; },
  useEffect(fn) { rt.effects.push(fn); }, useCallback(fn) { rt.idx++; return fn; },
};
let captured = null;
global.window.__ModuleLoader__ = { load: (d) => { captured = d; } };
eval(fs.readFileSync(require('path').join(__dirname, '..', 'lib', 'client.js'), 'utf8'));
const mod = captured.factory((n) => n === 'react' ? react
  : n === 'react-dom' ? { createPortal: (e) => e }
    : (() => { throw new Error(n); })());

let comp = null;
mod.apply({ slots: { inject: (s, f) => f(), register: (o, c) => { comp = c; return () => {}; } }, effect: () => {} });

rt.state = []; rt.idx = 0; rt.effects = []; rt.state[0] = true;
const tree = comp();
rt.effects.forEach(fn => fn());
rt.effects = [];

let panelEl = null;
(function find(n, d) {
  if (!n || d > 8 || panelEl) return;
  if (Array.isArray(n)) { n.forEach(x => find(x, d)); return; }
  if (typeof n !== 'object') return;
  if (typeof n.type === 'function' && n.type.name === 'Panel') { panelEl = n; return; }
  (n.kids || []).forEach(k => find(k, d + 1));
})(tree, 0);
if (!panelEl) { console.log('FAIL: 入口树里没有 Panel'); process.exit(1); }

const Panel = panelEl.type, props = panelEl.props;
rt.state = []; rt.idx = 0; rt.effects = [];
const rendered = Panel(props);
rt.effects.forEach(fn => fn());

function nodes(node) {
  const out = [];
  (function scan(n, d) {
    if (!n || d > 14) return;
    if (Array.isArray(n)) { n.forEach(x => scan(x, d)); return; }
    if (typeof n !== 'object') return;
    out.push(n);
    (n.kids || []).forEach(k => scan(k, d + 1));
    if (n.props) Object.keys(n.props).forEach(key => {
      const v = n.props[key];
      if (v && typeof v === 'object') scan(v, d + 1);
    });
  })(node, 0);
  return out;
}

const all = nodes(rendered);
const names = all.filter(n => n.props && n.props.className === 'dfm_itemName').map(n => (n.kids || []).join(''));
console.log('抽屉里的入口：', JSON.stringify(names));

if (!names.includes('当前入口')) { console.log('FAIL: 正常占位的入口被漏掉了'); process.exit(1); }
if (names.includes('WWSL工作区')) { console.log('FAIL: hidden 的入口仍被当成占用'); process.exit(1); }
if (names.includes('远程配对')) { console.log('FAIL: aria-hidden 的入口仍被当成占用'); process.exit(1); }
if (!names.includes('旧入口')) { console.log('FAIL: 本插件自己遮住的入口不见了，用户没法恢复'); process.exit(1); }
console.log('PASS: 主人撤下的两种写法都不进清单；本插件遮住的仍在');

const meta = all.filter(n => n.props && n.props.className === 'dfm_itemMeta').map(n => (n.kids || []).join(''));
if (!meta.includes('已隐藏')) { console.log('FAIL: 本插件遮住的那条状态没有写「已隐藏」'); process.exit(1); }

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
if (!/共 3 个/.test(footText)) { console.log('FAIL: 计数把撤下的入口也算进去了（应为 3：自己 + 当前入口 + 旧入口）'); process.exit(1); }
console.log('PASS: 计数只数真正占位的条目');

const switches = all.filter(n => n.type === 'button' && n.props && typeof n.props['aria-label'] === 'string');
const parkedSw = switches.find(s => s.props['aria-label'].includes('WWSL工作区'));
if (parkedSw) { console.log('FAIL: 还为撤下的入口画了一条按不出变化的开关'); process.exit(1); }
const restorable = switches.find(s => s.props['aria-label'] === '显示 旧入口');
if (!restorable) { console.log('FAIL: 恢复开关丢了'); process.exit(1); }
console.log('PASS: 没有假开关，恢复开关还在');

// 主人把入口放回来（例如侧栏收成窄栏）时，它要重新出现在清单里
delete parked.attrs.hidden;
rt.state = []; rt.idx = 0; rt.effects = [];
const again = nodes(Panel(props))
  .filter(n => n.props && n.props.className === 'dfm_itemName').map(n => (n.kids || []).join(''));
if (!again.includes('WWSL工作区')) { console.log('FAIL: 主人放回来后入口没有重新出现'); process.exit(1); }
console.log('PASS: 主人放回来后重新出现 →', JSON.stringify(again));
