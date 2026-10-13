import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 全站作用域契约（1.3.1）：任何页面都弹；每次都弹；不经服务端过滤
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
  data: Object.assign({}, orig, {
    toast: JSON.stringify(Object.assign({}, JSON.parse(orig.toast || "{}"), { toastEnabled: true, toastScope: "SITE", toastPosition: "bottom-center", toastCloseSeconds: 30 })),
    reminder: JSON.stringify(Object.assign({}, JSON.parse(orig.reminder || "{}"), { remindDays: 15, frontendReminder: true })),
  })})});
await new Promise((r) => setTimeout(r, 3500));

const DATE_BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const d0 = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
const name = `date-site2-${RUN}`;
await api(DATE_BASE, { method: "POST", body: JSON.stringify({ apiVersion: "importantdates.halo.run/v1alpha1", kind: "ImportantDate",
  metadata: { name }, spec: { title: `全站每次-${RUN}`, dateType: "SOLAR", solarDate: d0, important: true, visible: true } })});

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
      return r.width > 0 ? { w: Math.round(r.width), text: (el.textContent || "").slice(0, 70) } : null;
    });
    if (b) return b;
  }
  return null;
};
try {
  await check("S1 首页弹出（非「记得」页面）", async () => {
    const b = await watch("/");
    assert(b, "首页未弹出");
    assert(b.text.includes(`全站每次-${RUN}`), `文案不含该项: ${b.text}`);
    return `${b.w}px`;
  });
  await check("S2 换到「记得」页面同样弹出（每次访问都弹）", async () => {
    const b = await watch("/important-dates");
    assert(b, "「记得」页未弹出");
    return `${b.w}px`;
  });
  await check("S3 服务端不做交付过滤，清单仍然完整", async () => {
    const r = await p.evaluate(async () => {
      const res = await fetch("/important-dates-reminders?ts=" + Date.now(), { credentials: "same-origin" });
      const d = await res.json();
      return { n: (d.toastItems || []).length, cookie: document.cookie.includes("id-toast-seen") };
    });
    assert(r.n > 0, `服务端不应过滤，实际 ${r.n} 条`);
    assert(!r.cookie, "不该再写 id-toast-seen cookie");
    return `${r.n} 条，无 cookie`;
  });
  await check("S4 新浏览器同样能收到", async () => {
    const ctx2 = await browser.createBrowserContext();
    const p3 = await ctx2.newPage();
    await p3.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    let b = null;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 150));
      b = await p3.evaluate(() => {
        const el = document.getElementById("id-toast-box");
        return el && el.getBoundingClientRect().width > 0 ? (el.textContent || "").slice(0, 50) : null;
      });
      if (b) break;
    }
    await ctx2.close();
    assert(b, "新浏览器未收到");
    return "收到";
  });
} finally {
  await api(`${DATE_BASE}/${name}`, { method: "DELETE" });
  await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...meta }, data: orig })});
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

