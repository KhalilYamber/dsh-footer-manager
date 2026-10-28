#!/usr/bin/env node
/**
 * 回归测试入口：逐个跑 test/*.test.cjs，汇总 PASS/FAIL。
 *
 * 这些测试不依赖浏览器：把 react 与 DOM 桩掉，真跑插件的 apply / 渲染 / 遮挡 / 账本逻辑。
 * 它们抓到过两个真 bug（收编模式用了过期 DOM 节点、卸载时把用户偏好写回「关」），
 * 所以改动 lib/client.js 之后请先跑这一遍，再看屏幕。
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.cjs")).sort();
if (files.length === 0) {
  console.error("没有找到任何 *.test.cjs");
  process.exit(1);
}

let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  const ok = r.status === 0;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${f}`);
  if (!ok) {
    const lines = out.split("\n").filter(Boolean);
    for (const line of lines.slice(-6)) console.log("      " + line);
  }
}
console.log(`\n${files.length - failed}/${files.length} 个测试文件通过`);
process.exit(failed === 0 ? 0 : 1);
