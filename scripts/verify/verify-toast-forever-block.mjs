import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 验证：没有「永久不再提示」之后，静音会不会变成不可逆
//   ① 老版本留下的 id-toast-forever 标记要被清掉，不能继续吃静音
//   ② 关闭菜单关掉时，点 × 只收起当前弹窗，不写任何静音标记
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
const writeToast = (over) => api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
  metadata: { name: "plugin-important-dates-configmap", ...meta },
  data: Object.assign({}, orig, { toast: JSON.stringify(Object.assign({}, JSON.parse(orig.toast || "{}"),
    { toastEnabled: true, toastScope: "SITE", toastCloseSeconds: 30 }, over)) })})});
// 复刻最容易踩坑的配置：关掉菜单，默认关闭行为是「5 天内不显示」
await writeToast({ toastCloseMenu: false, toastDefaultClose: "5d" });
await new Promise((r) => setTimeout(r, 3500));
const DATE_BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const d0 = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
const nm = `date-forever-${RUN}`;
await api(DATE_BASE, { method: "POST", body: JSON.stringify({ apiVersion: "importantdates.halo.run/v1alpha1", kind: "ImportantDate",
  metadata: { name: nm }, spec: { title: `永久静音测试-${RUN}`, dateType: "SOLAR", solarDate: d0, important: true, visible: true } })});

const ctx = await browser.createBrowserContext();
const p = await ctx.newPage();
const waitBox = async () => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (await p.evaluate(() => { const el = document.getElementById("id-toast-box"); return !!(el && el.getBoundingClientRect().width > 0); })) return true;
  }
  return false;
};
const clearMarks = () => p.evaluate(() => ["id-toast-until", "id-toast-forever", "id-toast-last", "id-toast-last-count", "id-toast-day"]
  .forEach((k) => localStorage.removeItem(k)));
try {
  await check("P1 首次访问弹出", async () => {
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await clearMarks();
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "未弹出");
    return "弹出";
  });

  await check("P2 菜单关闭时，点 × 不再静默写入任何静音标记", async () => {
    await p.evaluate(() => {
      const el = document.getElementById("id-toast-box");
      el.querySelector("span").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 600));
    const st = await p.evaluate(() => ({ forever: localStorage.getItem("id-toast-forever"), until: localStorage.getItem("id-toast-until") }));
    assert(!st.forever && !st.until, `不该写任何静音标记: ${JSON.stringify(st)}`);
    return "未写入任何标记";
  });

  await check("P3 点 × 之后再刷新，弹窗仍然出现（修复目标）", async () => {
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "点 × 后刷新就不弹了 —— 仍然被静默静音");
    return "仍会弹出";
  });

  await check("P4 老版本留下的 id-toast-forever 标记被清掉，不再永久静音", async () => {
    // 1.3.1 及更早版本可能给这个浏览器写下过"永久不再提示"
    await p.evaluate(() => { localStorage.setItem("id-toast-forever", "1"); localStorage.removeItem("id-toast-until"); });
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "陈旧永久标记仍在拦截弹窗");
    const raw = await p.evaluate(() => localStorage.getItem("id-toast-forever"));
    assert(raw === null, `陈旧标记未被清理: ${raw}`);
    return "标记已清理并恢复弹出";
  });

  await check("P5 正常设置下不会写下永久标记（三处都应无关）", async () => {
    await clearMarks();
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "未弹出");
    await p.evaluate(() => {
      const el = document.getElementById("id-toast-box");
      el.querySelector("span").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 600));
    const st = await p.evaluate(() => ({ forever: localStorage.getItem("id-toast-forever"), until: localStorage.getItem("id-toast-until") }));
    assert(!st.forever, "不该出现永久标记");
    return st.until ? "只写了有期限的静音" : "未写静音标记";
  });
} finally {
  await api(`${DATE_BASE}/${nm}`, { method: "DELETE" });
  await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...meta }, data: orig })});
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
