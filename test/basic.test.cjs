// 离线冒烟：桩掉浏览器环境，真跑 apply 与两个组件
const fs = require('fs');

const calls = [];
const makeNode = (tag) => ({
  tagName: tag, className: '', dataset: {}, style: {},
  children: [], textContent: '',
  appendChild(c) { this.children.push(c); },
  remove() {}, setAttribute() {}, getAttribute() { return null; },
  getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0 }; },
});
const head = makeNode('head');
const body = makeNode('body');
const styleNodes = [];
const document = {
  hidden: false,
  head, body,
  createElement: (t) => { const n = makeNode(t); if (t === 'style') styleNodes.push(n); return n; },
  querySelector: (sel) => styleNodes.find(n => sel.includes(n.dataset.pluginCss)) || null,
  querySelectorAll: () => [],
};
const window = {
  localStorage: { _v: {}, setItem(k, v) { this._v[k] = v; calls.push(['setItem', k, v]); }, getItem(k) { return this._v[k]; } },
  addEventListener() {}, removeEventListener() {},
  setTimeout: (fn) => { fn(); return 0; },
  setInterval: () => 0, clearInterval() {}, clearTimeout() {},
  getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', overflow: 'visible' }),
};
global.window = window; global.document = document;

const react = {
  Fragment: Symbol('Fragment'),
  createElement: (type, props, ...kids) => ({ type, props: props || {}, kids }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useRef: (v) => ({ current: v }),
  useEffect: () => {}, useCallback: (f) => f,
};
const reactDom = { createPortal: (el) => el };

let captured = null;
global.window.__ModuleLoader__ = { load: (def) => { captured = def; } };

// 加载客户端模块
const src = fs.readFileSync(require('path').join(__dirname, '..', 'lib', 'client.js'), 'utf8');
eval(src);
if (!captured) throw new Error('模块没有调用 __ModuleLoader__.load');

const mod = captured.factory((name) => {
  if (name === 'react') return react;
  if (name === 'react-dom') return reactDom;
  throw new Error('未预期的 require: ' + name);
});
if (typeof mod.apply !== 'function') throw new Error('exports.apply 缺失');
if (!Array.isArray(mod.inject)) throw new Error('exports.inject 不是数组');

// 跑 apply
let registered = null;
let injectedSlot = null;
const ctx = {
  slots: {
    inject: (slot, factory) => { injectedSlot = slot; return factory(); },
    register: (opts, comp) => { registered = { opts, comp }; return () => {}; },
  },
  effect: () => {},
};
mod.apply(ctx);
if (injectedSlot !== 'sidebar.footer.action') throw new Error('注入的插槽名不对: ' + injectedSlot);
if (!registered) throw new Error('没有注册任何组件');
if (registered.opts.id !== 'footer-manager') throw new Error('注册 id 不对');
if (registered.opts.name !== 'sidebar.footer.action') throw new Error('注册 name 不对');

// 渲染入口组件（桩环境下手动调用）
const entry = registered.comp();
if (!entry) throw new Error('入口组件返回空');
const kids = (entry.kids || []).filter(Boolean);
if (kids.length === 0) throw new Error('入口组件没有子节点');

// 入口按钮的 onClick 应当能执行且不抛错
const row = kids[0];
const btn = (row.kids || []).find(k => k && k.props && k.props.className === 'dfm_entry');
if (!btn) throw new Error('找不到入口按钮');
if (typeof btn.props.onClick !== 'function') throw new Error('入口按钮没有 onClick');
btn.props.onClick();

// 样式是否注入
if (!calls.some(c => c[0] === 'setItem' && c[1] === 'dsh-footer-manager:inject-ok')) {
  throw new Error('没有留下 inject-ok 标记');
}

console.log('PASS: 模块加载 / apply / 插槽注入 / 注册 / 入口渲染 / 点击回调 / 成功留痕');
