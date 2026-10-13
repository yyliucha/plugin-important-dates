import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 悬浮弹窗契约（1.3.2）：进入提醒期即弹；每次访问都弹；服务端不过滤；菜单关闭时点×只收起
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
    // toastMaxPerType 提到上限 5：弹窗默认只显示每类最近 2 条，
    // 测试实例里难免堆着重复跑留下的到期项，会把本用例的「2 天后」挤掉。
    // 这条用例验证的是「非节点日也下发」，所以把窗口放大到能看见它。
    toast: JSON.stringify(Object.assign({}, JSON.parse(orig.toast || "{}"), { toastEnabled: true, toastScope: "PAGE", toastCloseSeconds: 30, toastCloseMenu: false, toastMaxPerType: 5 })),
    reminder: JSON.stringify(Object.assign({}, JSON.parse(orig.reminder || "{}"), { remindDays: 15, frontendReminder: true })),
  })})});
await new Promise((r) => setTimeout(r, 3500));
const DATE_BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const off = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const mk = async (suffix, days) => {
  const name = `date-c2-${suffix}-${RUN}`;
  await api(DATE_BASE, { method: "POST", body: JSON.stringify({ apiVersion: "importantdates.halo.run/v1alpha1", kind: "ImportantDate",
    metadata: { name }, spec: { title: `契约2-${suffix}-${RUN}`, dateType: "SOLAR", solarDate: off(days), important: true, visible: true } })});
  return name;
};
const nToday = await mk("today", 0);
const nD2 = await mk("oneday", 1);
const ctx = await browser.createBrowserContext();
const p = await ctx.newPage();
const watch = async () => {
  await p.goto(`${base}/important-dates`, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const b = await p.evaluate(() => {
      const el = document.getElementById("id-toast-box");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 ? { w: Math.round(r.width), text: (el.textContent || "").slice(0, 120) } : null;
    });
    if (b) return b;
  }
  return null;
};
try {
  await check("C1 纪念日当天弹出（进入提醒期即弹）", async () => {
    const b = await watch();
    assert(b, "没有弹出");
    assert(b.text.includes(`today-${RUN}`), `文案不含当天纪念日: ${b.text}`);
    return `${b.w}px`;
  });
  await check("C2 同一浏览器再次访问仍然弹出（每次访问都提示）", async () => {
    const b = await watch();
    assert(b, "第二次没有弹出");
    return `${b.w}px`;
  });
  // 弹窗按到期日排序、只在窗口内显示最近几条，所以这里造一条"明天到期"的项：
  // D1 是能造出来的最小非零天数，必然排在今天之后、其他任何项之前，断言才稳定。
  await check("C3 非节点日（明天到期）也会弹", async () => {
    const b = await watch();
    assert(b, "没有弹出");
    assert(b.text.includes(`契约2-oneday-${RUN}`), `文案不含明天到期的项: ${b.text}`);
    assert(/还有 1 天|明天/.test(b.text), `文案没有"明天"措辞: ${b.text}`);
    return `${b.w}px`;
  });
  await check("C4 新浏览器能收到", async () => {
    const ctx2 = await browser.createBrowserContext();
    const p3 = await ctx2.newPage();
    await p3.goto(`${base}/important-dates`, { waitUntil: "domcontentloaded", timeout: 60000 });
    let b = null;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 150));
      b = await p3.evaluate(() => { const el = document.getElementById("id-toast-box"); return el && el.getBoundingClientRect().width > 0 ? 1 : null; });
      if (b) break;
    }
    await ctx2.close();
    assert(b, "新浏览器未弹出");
    return "收到";
  });
  await check("C5 服务端不过滤，且不再写交付 cookie", async () => {
    const r = await p.evaluate(async () => {
      const res = await fetch("/important-dates-reminders?ts=" + Date.now(), { credentials: "same-origin" });
      const d = await res.json();
      return { n: (d.toastItems || []).length, cookie: document.cookie.includes("id-toast-seen") };
    });
    assert(r.n > 0, `服务端不应过滤，实际 ${r.n} 条`);
    assert(!r.cookie, "不该再写 id-toast-seen cookie");
    return `${r.n} 条，无 cookie`;
  });
  await check("C6 点 × 不写静音记录（菜单关闭时只收起当前弹窗）", async () => {
    await watch();
    await p.evaluate(() => {
      const el = document.getElementById("id-toast-box");
      if (el) el.querySelector("#id-toast-close").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 600));
    const st = await p.evaluate(() => ({ f: localStorage.getItem("id-toast-forever"), u: localStorage.getItem("id-toast-until") }));
    assert(!st.f && !st.u, `不该写静音记录: ${JSON.stringify(st)}`);
    return "未写入";
  });
} finally {
  await api(`${DATE_BASE}/${nToday}`, { method: "DELETE" });
  await api(`${DATE_BASE}/${nD2}`, { method: "DELETE" });
  // 带当前版本号还原（乐观锁：用启动时的旧版本会 409，设置就留在测试值上了）
  const now = JSON.parse((await api(CM)).text);
  await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...(now.metadata || {}) }, data: orig })});
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

