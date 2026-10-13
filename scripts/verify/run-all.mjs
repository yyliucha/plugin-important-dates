/**
 * 一次跑完常用验证套件（需要一个已装好插件的 Halo 实例）。
 *
 * 用法：
 *   node scripts/verify/run-all.mjs              # 跑全部
 *   node scripts/verify/run-all.mjs smoke toast  # 只跑指定组
 *   HALO_BASE=http://127.0.0.1:8090 node scripts/verify/run-all.mjs
 *
 * 说明：这些是**黑盒**验证 —— 通过 HTTP 接口与无头浏览器操作真实界面，
 * 会创建并清理自己的测试数据（前缀可辨识），不会碰你已有的数据。
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.HALO_BASE || "http://127.0.0.1:8090";

/** 套件分组：名字 → 脚本（顺序执行，前面的失败不影响后面继续跑） */
const GROUPS = {
  smoke: ["halo-smoke.mjs"],
  behavior: ["verify-reminder-flow.mjs", "verify-image-fallback.mjs"],
  ui: ["func-128.mjs", "func-frontend.mjs"],
  toast: [
    "verify-toast-contract.mjs",
    "verify-toast-everytime.mjs",
    "verify-toast-frequency.mjs",
    "verify-toast-dismiss.mjs",
    "verify-toast-forever-block.mjs",
    "verify-toast-site.mjs",
  ],
  data: ["verify-album-scope.mjs", "verify-sort-save.mjs"],
};

const picked = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const names = picked.length ? picked : Object.keys(GROUPS);
for (const n of names) {
  if (!GROUPS[n]) {
    console.error(`未知分组「${n}」，可选：${Object.keys(GROUPS).join(" / ")}`);
    process.exit(2);
  }
}

function run(script) {
  return new Promise((done) => {
    const p = spawn(process.execPath, [resolve(here, script)], { stdio: "inherit", env: process.env });
    p.on("exit", (code) => done(code === 0));
  });
}

const results = [];
for (const n of names) {
  for (const s of GROUPS[n]) {
    console.log(`\n${"=".repeat(70)}\n▶ ${n} / ${s}\n${"=".repeat(70)}`);
    const ok = await run(s);
    results.push({ group: n, script: s, ok });
  }
}

console.log(`\n${"=".repeat(70)}\n汇总（实例：${base}）\n${"=".repeat(70)}`);
for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.group} / ${r.script}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} / ${results.length} 套件通过`);
process.exit(failed.length ? 1 : 0);
