/**
 * 左下角管家 · 浏览器半个
 *
 * 职责只有两件：
 *   1. 在侧栏底部占一格，点开是贴着它的小抽屉；
 *   2. 抽屉里列出「底部区域目前的全部入口」，每条一个开关，可以遮住 / 恢复。
 *
 * 边界（刻意不做的事）：
 *   · 不注销别人的注册——插槽是全开设计，插件之间没有摘牌的权限；
 *   · 不碰宿主与其它插件的内部结构，只按元素「文字 → 类名」打指纹做遮挡；
 *   · 不做全屏弹窗，抽屉贴着触发按钮展开。
 */
window.__ModuleLoader__.load({
	id: "dsh-footer-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// 模块级留痕：用来区分「模块没被求值」与「apply 没被调用」
		try { window.localStorage.setItem("dsh-footer-manager:module-loaded", String(Date.now())); } catch (e) {}

		const react = require("react");
		const reactDom = require("react-dom");
		const h = react.createElement;

		const SLOT = "sidebar.footer.action";
		const STYLE_ID = "dsh-footer-manager/style";
		const FIX_ID = "dsh-footer-manager/fix";
		const NARROW_ID = "dsh-footer-manager/narrow";
		const NARROW_KEY = "dsh-footer-manager:narrow";
		const COLLECT_ID = "dsh-footer-manager/collect";
		const COLLECT_KEY = "dsh-footer-manager:collect";
		const AUDIT_KEY = "dsh-footer-manager:audit";
		const AUDIT_MAX = 30;
		const HIDDEN_KEY = "dsh-footer-manager:hidden";
		const MARK_PREFIX = "dsh-footer-manager:";

		/** 抽屉宽度与贴边距离，定位与越界处理共用 */
		const DRAWER_W = 276;
		const EDGE = 8;

		/** 失败要留痕：被静默吞掉的异常，正是最难查的那类问题。 */
		function mark(key, value) {
			try { window.localStorage.setItem(MARK_PREFIX + key, String(value)); } catch (e) { /* 隐私模式 */ }
		}

		// ── 样式 ────────────────────────────────────────────────────────
		const CSS = [
			".dfm_entryRow{display:inline-flex;align-items:center;flex:none;order:-1}",
			".dfm_entry{position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;transition:background-color .12s,color .12s}",
			".dfm_dot{position:absolute;top:4px;right:4px;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-warn-primary);box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2)}",
			".dfm_audit{margin-top:6px;padding:7px 4px 1px;border-top:1px solid var(--dsw-alias-border-l2)}",
			".dfm_auditTitle{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin-bottom:2px}",
			".dfm_auditRow{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dfm_auditRow b{font-weight:500;color:var(--dsw-alias-label-primary)}",
			".dfm_entry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dfm_entry:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",

			".dfm_pop{position:fixed;z-index:1200;width:" + DRAWER_W + "px;max-height:min(360px,calc(100vh - 96px));overflow:auto;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:var(--dsw-shadow-lv3);padding:8px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}",

			".dfm_head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:2px 4px 6px}",
			".dfm_title{margin:0;font-size:13px;font-weight:600;line-height:18px}",
			".dfm_sub{margin:1px 0 0;font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary)}",
			".dfm_x{border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:14px;line-height:1;padding:3px 6px;border-radius:6px;flex:none}",
			".dfm_x:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",

			".dfm_list{display:flex;flex-direction:column;gap:1px}",
			".dfm_item{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;min-width:0}",
			".dfm_item:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dfm_itemText{flex:1;min-width:0}",
			".dfm_itemName{font-size:13px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dfm_itemMeta{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary)}",

			".dfm_sw{position:relative;width:36px;height:20px;flex:none;padding:0;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);cursor:pointer;transition:background-color .15s,border-color .15s}",
			".dfm_sw.on{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}",
			".dfm_sw:disabled{opacity:.4;cursor:default}",
			".dfm_sw:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
			".dfm_knob{position:absolute;top:1px;left:1px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.28);transition:transform .15s}",
			".dfm_sw.on .dfm_knob{transform:translateX(16px)}",

			".dfm_foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 8px;margin-top:6px;padding:7px 4px 1px;border-top:1px solid var(--dsw-alias-border-l2);font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
			".dfm_actions{display:flex;align-items:center;gap:10px;flex:none}",
			".dfm_link{border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;line-height:16px;padding:0}",
			".dfm_link:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}"
		].join("\n");

		function injectStyle(id, text) {
			if (typeof document === "undefined") return;
			if (document.querySelector('style[data-plugin-css="' + id + '"]') !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-footer-manager";
			tag.dataset.pluginCss = id;
			tag.textContent = text;
			document.head.appendChild(tag);
		}

		// ── 布局修复（可选）───────────────────────────────────────────
		// 把底部区域从「谁先写谁赢」的抢占式布局拉回正常流；默认关闭，只在需要时开。
		const FIX_CSS = [
			'[data-slot="' + SLOT + '"]{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:8px!important;width:100%!important;height:auto!important;max-height:none!important;overflow:visible!important}',
			'[data-slot="' + SLOT + '"]>*{flex:0 0 auto!important;order:0!important;min-width:0!important;visibility:visible!important;opacity:1!important;position:static!important;max-height:none!important}'
		].join("\n");

		function isFixOn() {
			if (typeof document === "undefined") return false;
			return document.querySelector('style[data-plugin-css="' + FIX_ID + '"]') !== null;
		}

		function setFix(on) {
			if (typeof document === "undefined") return;
			const existing = document.querySelector('style[data-plugin-css="' + FIX_ID + '"]');
			if (!on) { if (existing) existing.remove(); return; }
			if (!existing) injectStyle(FIX_ID, FIX_CSS);
		}

		// ── 宽入口收窄（默认开）───────────────────────────────────────
		// 背景：有的插件把入口做成 width:100% 的整行长条（例如 dsh-wsl-workspace 的
		// `.dww-action--wide{width:100%}`）。它在 flex 行里会吃掉整行，把同排其它入口挤走。
		// 这里不改任何布局方向，只把它们压回「内容宽度」——功能不减，位置让出来。
		const NARROW_CSS = '[data-slot="' + SLOT + '"]>*{width:auto!important;max-width:max-content!important;min-width:0!important;flex:0 0 auto!important}';

		function isNarrowOn() {
			try {
				const raw = window.localStorage.getItem(NARROW_KEY);
				return raw === null ? true : raw === "1";
			} catch (e) { return true; }
		}

		function applyNarrowStyle(on) {
			if (typeof document === "undefined") return;
			const existing = document.querySelector('style[data-plugin-css="' + NARROW_ID + '"]');
			if (!on) { if (existing) existing.remove(); return; }
			if (!existing) injectStyle(NARROW_ID, NARROW_CSS);
		}

		function setNarrow(on, persist) {
			if (persist !== false) {
				try { window.localStorage.setItem(NARROW_KEY, on ? "1" : "0"); } catch (e) {}
			}
			applyNarrowStyle(on);
		}

		// ── 收编模式（默认关）─────────────────────────────────────────
		// 做不到的事先说清：不能把别人的 React 组件搬进我的窗口（节点会被 React 收回，直接炸）。
		// 能做的是「藏起来但保持可用」：把别人的入口 display:none，DOM 仍在 React 树里，
		// 于是它自己的 click 处理器依旧有效——抽屉里点「打开」就等于点它本人。
		// 结果：底部只留管家一格（位置固定），其余入口全部收进抽屉，功能一个不少。
		const COLLECT_CSS = '[data-slot="' + SLOT + '"]>*:not(.dfm_entryRow){display:none!important}';

		function isCollectOn() {
			try { return window.localStorage.getItem(COLLECT_KEY) === "1"; } catch (e) { return false; }
		}

		function applyCollectStyle(on) {
			if (typeof document === "undefined") return;
			const existing = document.querySelector('style[data-plugin-css="' + COLLECT_ID + '"]');
			if (!on) { if (existing) existing.remove(); return; }
			if (!existing) injectStyle(COLLECT_ID, COLLECT_CSS);
		}

		function setCollect(on, persist) {
			if (persist !== false) {
				try { window.localStorage.setItem(COLLECT_KEY, on ? "1" : "0"); } catch (e) {}
				pushAudit(on ? "收编开启" : "收编关闭", "底部其余入口");
				notify();
			}
			applyCollectStyle(on);
		}

		/**
		 * 触发别人那个被藏起来的入口：它的 click 处理器仍然挂在 React 树上。
		 * 不能只用渲染时缓存的那个节点——对方重渲染会换掉 DOM，旧节点已脱离文档，
		 * 对它 click 什么都不会发生（且不会报错，是最难发现的那种失败）。
		 * 所以按指纹重新找一次，找不到才退回缓存节点。
		 */
		function fireEntry(fp, cached) {
			let target = null;
			const slot = slotEl();
			if (slot && fp) {
				const kids = Array.from(slot.children);
				for (let i = 0; i < kids.length; i++) {
					if (fingerprint(kids[i]) === fp) { target = kids[i]; break; }
				}
			}
			if (!target) target = cached;
			if (!target) return false;
			try { target.click(); return true; } catch (e) { return false; }
		}

		// ── 入口识别与遮挡 ──────────────────────────────────────────────
		function classOf(el) {
			if (typeof el.className === "string") return el.className;
			const attr = el.getAttribute && el.getAttribute("class");
			return attr || "";
		}

		/** 管家自己的那一格：靠内部是否含 .dfm_entry 判断（它是唯一带这个类名的元素）。 */
		function isSelf(el) {
			return !!(el && el.querySelector && el.querySelector(".dfm_entry"));
		}

		/** 指纹优先取文字；图标式入口没有文字，退回类名；两者都没有则返回空串（不允许遮挡）。 */
		function fingerprint(el) {
			const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
			if (text) return text;
			const cls = classOf(el).split(/\s+/).filter(Boolean).slice(0, 2).join(".");
			return cls ? "class:" + cls.slice(0, 40) : "";
		}

		function loadHidden() {
			try {
				const raw = window.localStorage.getItem(HIDDEN_KEY);
				const arr = raw ? JSON.parse(raw) : [];
				return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
			} catch (e) { return new Set(); }
		}

		function saveHidden(set) {
			try { window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
		}

		let HIDDEN = loadHidden();
		/** 只记录「我们自己遮过的元素」，恢复时不会顺手把别人有意藏起来的元素弄出来。 */
		const APPLIED = new WeakSet();

		function slotEl() {
			if (typeof document === "undefined") return null;
			return document.querySelector('[data-slot="' + SLOT + '"]');
		}

		function syncHidden() {
			const slot = slotEl();
			if (!slot) return;
			Array.from(slot.children).forEach(function (el) {
				if (isSelf(el)) return;
				const fp = fingerprint(el);
				if (fp === "") return;
				if (HIDDEN.has(fp)) {
					if (el.style.display !== "none") { el.style.display = "none"; APPLIED.add(el); }
				} else if (APPLIED.has(el)) {
					el.style.display = "";
					APPLIED.delete(el);
				}
			});
		}

		/**
		 * 账本：谁在什么时候被藏 / 被放回。
		 * 目的很直接——任何入口哪天不见了，先查这里，而不是靠猜。
		 * 只增不删（最多保留 30 条），存在 localStorage，跨刷新保留。
		 */
		function loadAudit() {
			try {
				const raw = window.localStorage.getItem(AUDIT_KEY);
				const arr = raw ? JSON.parse(raw) : [];
				return Array.isArray(arr) ? arr : [];
			} catch (e) { return []; }
		}

		function pushAudit(action, name) {
			try {
				const list = loadAudit();
				list.push({ action: action, name: String(name || "").slice(0, 40), at: Date.now() });
				while (list.length > AUDIT_MAX) list.shift();
				window.localStorage.setItem(AUDIT_KEY, JSON.stringify(list));
			} catch (e) {}
		}

		/** 极小的变更广播：让入口图标上的提醒点能跟着藏/放实时更新。 */
		const WATCHERS = new Set();
		function notify() { WATCHERS.forEach(function (fn) { try { fn(); } catch (e) {} }); }

		function setHidden(fp, on, name) {
			if (on) HIDDEN.add(fp); else HIDDEN.delete(fp);
			saveHidden(HIDDEN);
			pushAudit(on ? "隐藏" : "恢复", name || fp);
			syncHidden();
			notify();
		}

		function clearHidden() {
			if (HIDDEN.size > 0) pushAudit("全部恢复", HIDDEN.size + " 个入口");
			HIDDEN = new Set();
			saveHidden(HIDDEN);
			syncHidden();
			notify();
		}

		/** 底部区域目前的全部入口（含被遮挡的——它们仍在 DOM 里）。 */
		function listEntries() {
			const slot = slotEl();
			const out = [];
			if (!slot) return out;
			Array.from(slot.children).forEach(function (el) {
				const self = isSelf(el);
				const fp = self ? "" : fingerprint(el);
				const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
				const name = self ? "左下角管家" : (text || (classOf(el).split(/\s+/)[0] || "未命名入口"));
				out.push({
					name: name,
					fp: fp,
					self: self,
					el: el,
					hidden: !!(fp && HIDDEN.has(fp)),
					usable: !self && fp !== ""
				});
			});
			return out;
		}

		// ── 组件 ────────────────────────────────────────────────────────
		function Icon(props) {
			const s = props.size || 16;
			return h("svg", { width: s, height: s, viewBox: "0 0 16 16", "aria-hidden": "true" },
				h("path", { d: "M2.4 4h11.2M2.4 8h11.2M2.4 12h11.2", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round" }),
				h("circle", { cx: "5.6", cy: "4", r: "1.5", fill: "currentColor" }),
				h("circle", { cx: "10.4", cy: "8", r: "1.5", fill: "currentColor" }),
				h("circle", { cx: "6.6", cy: "12", r: "1.5", fill: "currentColor" })
			);
		}

		function Panel(props) {
			const [entries, setEntries] = react.useState(listEntries);
			const [fixOn, setFixOn] = react.useState(isFixOn);
			const [narrowOn, setNarrowOn] = react.useState(isNarrowOn);
			const [collectOn, setCollectOn] = react.useState(isCollectOn);
			const boxRef = react.useRef(null);

			const refresh = react.useCallback(function () {
				if (typeof document !== "undefined" && document.hidden) return;
				setEntries(listEntries());
			}, []);

			react.useEffect(function () {
				refresh();
				const t = window.setInterval(refresh, 1000);
				return function () { window.clearInterval(t); };
			}, [refresh]);

			react.useEffect(function () {
				const onKey = function (e) { if (e.key === "Escape") props.onClose(); };
				const onDown = function (e) {
					const box = boxRef.current;
					if (box && box.contains && box.contains(e.target)) return;
					// 触发按钮本身也算「内部」：否则点它会被这里先关掉、再被 click 打开，表现为关不掉
					const trigger = props.triggerRef && props.triggerRef.current;
					if (trigger && trigger.contains && trigger.contains(e.target)) return;
					props.onClose();
				};
				window.addEventListener("keydown", onKey);
				document.addEventListener("mousedown", onDown);
				return function () {
					window.removeEventListener("keydown", onKey);
					document.removeEventListener("mousedown", onDown);
				};
			}, [props.onClose, props.triggerRef]);

			const hiddenCount = entries.filter(function (e) { return e.hidden; }).length;
			const anchor = props.anchor;
			const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
			const vw = (typeof window !== "undefined" && window.innerWidth) || 1200;

			let style;
			if (anchor) {
				const left = Math.min(Math.max(EDGE, anchor.left), Math.max(EDGE, vw - DRAWER_W - EDGE));
				const above = anchor.top;
				// 上方放得下就向上展开，否则掉到按钮下方——避免抽屉顶出屏幕
				style = above > 240
					? { left: left + "px", bottom: Math.max(EDGE, vh - anchor.top + EDGE) + "px" }
					: { left: left + "px", top: Math.max(EDGE, (anchor.bottom || anchor.top) + EDGE) + "px" };
			} else {
				style = { left: EDGE + "px", bottom: "60px" };
			}

			return h("div", { className: "dfm_pop", style: style, ref: boxRef, role: "dialog", "aria-label": "左下角管家" },
				h("div", { className: "dfm_head" },
					h("div", null,
						h("p", { className: "dfm_title" }, "左下角管家"),
						h("p", { className: "dfm_sub" }, "底部入口的显示开关")
					),
					h("button", { type: "button", className: "dfm_x", onClick: props.onClose, "aria-label": "关闭" }, "×")
				),

				h("div", { className: "dfm_list" },
					entries.length === 0
						? h("div", { className: "dfm_item" },
							h("div", { className: "dfm_itemText" },
								h("div", { className: "dfm_itemName" }, "这里还没有入口"),
								h("div", { className: "dfm_itemMeta" }, "插槽可能尚未就绪")
							)
						)
						: entries.map(function (e, i) {
							const meta = e.self ? "本插件" : (e.usable ? (e.hidden ? "已隐藏" : "显示中") : "不可识别");
							return h("div", { className: "dfm_item", key: (e.fp || "self") + "#" + i },
								h("div", { className: "dfm_itemText" },
									h("div", { className: "dfm_itemName", title: e.name }, e.name),
									h("div", { className: "dfm_itemMeta" }, meta)
								),
								collectOn && e.usable ? h("button", {
									type: "button",
									className: "dfm_link",
									title: "打开这个入口",
									onClick: function () { fireEntry(e.fp, e.el); props.onClose(); }
								}, "打开") : null,
								h("button", {
									type: "button",
									role: "switch",
									"aria-checked": e.hidden ? "false" : "true",
									className: "dfm_sw" + (e.hidden ? "" : " on"),
									disabled: !e.usable,
									"aria-label": (e.hidden ? "显示 " : "隐藏 ") + e.name,
									onClick: function () { setHidden(e.fp, !e.hidden, e.name); refresh(); }
								}, h("span", { className: "dfm_knob" }))
							);
						})
				),

				h("div", { className: "dfm_audit" },
					h("div", { className: "dfm_auditTitle" }, "最近记录（谁被藏 / 谁被放回）"),
					(function () {
						const log = loadAudit().slice(-5).reverse();
						if (log.length === 0) return h("div", { className: "dfm_auditRow" }, "暂无记录");
						return log.map(function (r, i) {
							const t = new Date(r.at);
							const hh = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
							return h("div", { className: "dfm_auditRow", key: i },
								hh + " · " + r.action + " · " + (r.name || "—"));
						});
					})()
				),
				h("div", { className: "dfm_foot" },
					h("span", null, "共 " + entries.length + " 个 · 已隐藏 " + hiddenCount),
					h("div", { className: "dfm_actions" },
						h("button", {
							type: "button",
							className: "dfm_link",
							title: "把其它入口全部收进本抽屉，底部只留管家一个",
							onClick: function () { const next = !collectOn; setCollect(next); setCollectOn(next); refresh(); }
						}, collectOn ? "收编：开" : "收编：关"),
						h("button", {
							type: "button",
							className: "dfm_link",
							title: "把占满整行的入口压回内容宽度",
							onClick: function () { const next = !isNarrowOn(); setNarrow(next); setNarrowOn(next); refresh(); }
						}, narrowOn ? "收窄：开" : "收窄：关"),
						hiddenCount > 0 ? h("button", {
							type: "button",
							className: "dfm_link",
							onClick: function () { clearHidden(); refresh(); }
						}, "全部恢复") : null,
						h("button", {
							type: "button",
							className: "dfm_link",
							onClick: function () { const next = !isFixOn(); setFix(next); setFixOn(next); refresh(); }
						}, fixOn ? "布局修复：开" : "布局修复：关")
					)
				)
			);
		}

		function FooterEntry() {
			const [open, setOpen] = react.useState(false);
			const [anchor, setAnchor] = react.useState(null);
			const [fallback, setFallback] = react.useState(false);
			const [hiddenCount, setHiddenCount] = react.useState(HIDDEN.size);
			const ref = react.useRef(null);
			const tries = react.useRef(0);

			// 有人被藏起来时，图标上挂个点——不然"我是不是藏了东西"只能靠记忆
			react.useEffect(function () {
				const fn = function () { setHiddenCount(HIDDEN.size); };
				WATCHERS.add(fn);
				return function () { WATCHERS.delete(fn); };
			}, []);

			// 保险丝：插槽里拿不到可见尺寸时退到固定浮标。分多次复查——侧栏可能比插件晚挂载。
			react.useEffect(function () {
				let alive = true;
				let timer = 0;
				const check = function () {
					if (!alive) return;
					const el = ref.current;
					const r = el ? el.getBoundingClientRect() : null;
					if (r && r.width >= 4 && r.height >= 4) { setFallback(false); tries.current = 0; return; }
					tries.current += 1;
					if (tries.current >= 10) { setFallback(true); return; }
					timer = window.setTimeout(check, 700);
				};
				timer = window.setTimeout(check, 600);
				const onResize = function () { tries.current = 0; check(); };
				window.addEventListener("resize", onResize);
				return function () {
					alive = false;
					window.clearTimeout(timer);
					window.removeEventListener("resize", onResize);
				};
			}, []);

			const toggle = function (e) {
				if (open) { setOpen(false); return; }
				const el = e && e.currentTarget;
				const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
				setAnchor(r ? { left: Math.round(r.left), top: Math.round(r.top), bottom: Math.round(r.bottom) } : null);
				setOpen(true);
			};

			const button = function (withRef) {
				return h("button", {
					ref: withRef ? ref : undefined,
					type: "button",
					className: "dfm_entry",
					title: "左下角管家",
					"aria-label": "左下角管家",
					"aria-expanded": open ? "true" : "false",
					onClick: toggle
				}, h(Icon, { size: 16 }), hiddenCount > 0 ? h("span", { className: "dfm_dot", "aria-hidden": "true" }) : null);
			};

			return h(react.Fragment, null,
				h("div", { className: "dfm_entryRow" }, button(true)),
				fallback ? reactDom.createPortal(
					h("div", { style: { position: "fixed", left: 12, bottom: 12, zIndex: 1100 } }, button(false)),
					document.body
				) : null,
				open ? reactDom.createPortal(
					h(Panel, { anchor: anchor, triggerRef: ref, onClose: function () { setOpen(false); } }),
					document.body
				) : null
			);
		}

		const inject = ["slots"];

		function apply(ctx) {
			injectStyle(STYLE_ID, CSS);
			try {
				ctx.slots.inject("sidebar.footer.action", function () {
					return ctx.slots.register({ name: "sidebar.footer.action", id: "footer-manager" }, FooterEntry);
				});
				mark("inject-ok", Date.now());
			} catch (e) {
				mark("inject-error", (e && e.message) || e);
			}

			if (isNarrowOn()) setNarrow(true);
			if (isCollectOn()) setCollect(true);
			syncHidden();
			if (typeof MutationObserver === "function") {
				let queued = false;
				const obs = new MutationObserver(function () {
					if (queued || HIDDEN.size === 0) return; // 没东西要遮时不排队
					queued = true;
					window.setTimeout(function () { queued = false; syncHidden(); }, 250);
				});
				obs.observe(document.body, { childList: true, subtree: true });
			}

			if (typeof ctx.effect === "function") {
				ctx.effect(function () {
					return function () {
						setFix(false);
						// 卸载只撤页面效果，不改用户偏好——否则一次热重载就把设置抹成「关」
						setNarrow(false, false);
						setCollect(false, false);
						const own = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]');
						if (own) own.remove();
					};
				}, "dsh-footer-manager: cleanup");
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
