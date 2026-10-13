import { readFileSync } from "node:fs";
import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance, repoPath } from "./_env.mjs";
await requireInstance();

// 验证新行为：每次打开都提示（不再"只弹一次"）
import puppeteer from "puppeteer-core";

const RUN = Date.now();
let pass = 0, fail = 0;
async function check(n, fn) {
  try { const d = await fn(); pass++; console.log(`[PASS] ${n}${d ? " — " + d : ""}`); }
  catch (e) { fail++; console.log(`[FAIL] ${n} — ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m); }

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new", args: ["--no-sandbox", "--disable-gpu"],
  defaultViewport: { width: 1400, height: 900 },
});
const page = await browser.newPage();
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#username", { timeout: 30000 });
await page.type("#username", "admin"); await page.type("#plainPassword", "admin12345");
await page.click('button[type="submit"]'); await new Promise((r) => setTimeout(r, 5000));
const api = (p, i = {}) => page.evaluate(async (path, init) => {
  const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
  const h = { ...(init.headers || {}) }; if (xsrf) h["X-XSRF-TOKEN"] = xsrf;
  if (init.body) h["Content-Type"] = "application/json";
  const r = await fetch(path, { ...init, headers: h }); return { status: r.status, text: await r.text() };
}, p, i);
const CM = "/api/v1alpha1/configmaps/plugin-important-dates-configmap";
const cm = await api(CM); const meta = JSON.parse(cm.text).metadata || {}; const orig = JSON.parse(cm.text).data || {};
await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
  metadata: { name: "plugin-important-dates-configmap", ...meta },
  data: Object.assign({}, orig, { toast: JSON.stringify(Object.assign({}, JSON.parse(orig.toast || "{}"), {
    toastEnabled: true, toastScope: "SITE", toastPosition: "bottom-center", toastCloseSeconds: 6, toastCloseMenu: false })) })})});
await new Promise((r) => setTimeout(r, 3500));

const DATE_BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const d0 = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
const nm = `date-every-${RUN}`;
await api(DATE_BASE, { method: "POST", body: JSON.stringify({ apiVersion: "importantdates.halo.run/v1alpha1", kind: "ImportantDate",
  metadata: { name: nm }, spec: { title: `每次都弹-${RUN}`, dateType: "SOLAR", solarDate: d0, important: true, visible: true } })});

const ctx = await browser.createBrowserContext();
const p = await ctx.newPage();
const watch = async (path) => {
  await p.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const b = await p.evaluate(() => {
      const el = document.getElementById("id-toast-box");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 ? { w: Math.round(r.width), text: (el.textContent || "").slice(0, 60) } : null;
    });
    if (b) return b;
  }
  return null;
};

try {
  await check("E1 第一次打开就弹（首页）", async () => {
    const b = await watch("/");
    assert(b, "没有弹出");
    assert(b.text.includes(`每次都弹-${RUN}`), `文案不含该项: ${b.text}`);
    return `${b.w}px`;
  });
  await check("E2 同一浏览器再次打开仍然弹（本次改动目标）", async () => {
    const b = await watch("/");
    assert(b, "第二次没有弹出 —— 仍然是'只弹一次'");
    return `${b.w}px`;
  });
  await check("E3 第三次、换页面也弹", async () => {
    const b = await watch("/important-dates");
    assert(b, "第三次没有弹出");
    return `${b.w}px`;
  });
  await check("E4 浏览器未记录'已弹过'（旧机制已移除）", async () => {
    const st = await p.evaluate(() => ({ v2: localStorage.getItem("id-toast-shown-v2"), v1: localStorage.getItem("id-toast-shown") }));
    assert(!st.v2 && !st.v1, `仍有本地记账: ${JSON.stringify(st)}`);
    return "无本地记账";
  });
  await check("E5 页面脚本版本与仓库源码一致", async () => {
    // 期望值取自源码，避免每次改脚本都要改断言
    const src = readFileSync(repoPath("src/main/resources/static/reminder-toast.js"), "utf8");
    const want = (src.match(/__ID_TOAST_VERSION = "(\d+)"/) || [])[1];
    const got = await p.evaluate(() => window.__ID_TOAST_VERSION);
    assert(want, "未能从源码解析出版本号");
    assert(got === want, `页面脚本为 ${got}，源码为 ${want}（可能未重启 Halo 或浏览器缓存了旧脚本）`);
    return `v${got}`;
  });
} finally {
  await api(`${DATE_BASE}/${nm}`, { method: "DELETE" });
  await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...meta }, data: orig })});
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

