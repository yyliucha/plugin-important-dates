import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 每次打开都弹之后，确认「关闭方式」的时长/永久选项仍然生效
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
    toastEnabled: true, toastScope: "SITE", toastCloseSeconds: 30 })) })})});
await new Promise((r) => setTimeout(r, 3500));
const DATE_BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const d0 = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
const nm = `date-dis-${RUN}`;
await api(DATE_BASE, { method: "POST", body: JSON.stringify({ apiVersion: "importantdates.halo.run/v1alpha1", kind: "ImportantDate",
  metadata: { name: nm }, spec: { title: `关闭测试-${RUN}`, dateType: "SOLAR", solarDate: d0, important: true, visible: true } })});

const ctx = await browser.createBrowserContext();
const p = await ctx.newPage();
const waitBox = async () => {
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const ok = await p.evaluate(() => {
      const el = document.getElementById("id-toast-box");
      return !!(el && el.getBoundingClientRect().width > 0);
    });
    if (ok) return true;
  }
  return false;
};
try {
  await check("D1 「永久关闭」后再打开不再弹", async () => {
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "首次未弹出");
    // 直接写入永久关闭标记（等价于点 × → 永久关闭）
    await p.evaluate(() => localStorage.setItem("id-toast-forever", "1"));
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(!(await waitBox()), "永久关闭后仍在弹");
    return "永久关闭生效";
  });
  await check("D2 清掉永久关闭标记后恢复弹出", async () => {
    await p.evaluate(() => localStorage.removeItem("id-toast-forever"));
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "清除后未恢复弹出");
    return "已恢复";
  });
  await check("D3 到期的临时关闭标记会自动恢复", async () => {
    await p.evaluate(() => localStorage.setItem("id-toast-until", String(Date.now() - 1000)));  // 已过期
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "过期标记应自动清理并弹出");
    const raw = await p.evaluate(() => localStorage.getItem("id-toast-until"));
    assert(!raw, `过期标记未清理: ${raw}`);
    return "过期即恢复";
  });
} finally {
  await api(`${DATE_BASE}/${nm}`, { method: "DELETE" });
  await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...meta }, data: orig })});
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

