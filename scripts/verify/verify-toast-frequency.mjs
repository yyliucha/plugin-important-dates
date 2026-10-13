import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 新功能验证：提示频率（每次/每天N次/每N分钟）+「今天不再提示」
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
const cm = await api(CM);
const meta = JSON.parse(cm.text).metadata || {};
const orig = JSON.parse(cm.text).data || {};
const putToast = async (patch) => {
  const cur = (await api(CM)).text;
  const base0 = JSON.parse(cur).data || {};
  await api(CM, { method: "PUT", body: JSON.stringify({
    apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...(JSON.parse(cur).metadata || {}) },
    data: Object.assign({}, base0, {
      toast: JSON.stringify(Object.assign({}, JSON.parse(base0.toast || "{}"),
        { toastEnabled: true, toastScope: "PAGE", toastCloseSeconds: 30, toastCloseMenu: true }, patch)),
      reminder: JSON.stringify(Object.assign({}, JSON.parse(base0.reminder || "{}"), { remindDays: 15, frontendReminder: true })),
    })})});
  await new Promise((r) => setTimeout(r, 2500));
};

const DATE_BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const d0 = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
const nm = `date-freq-${RUN}`;
await api(DATE_BASE, { method: "POST", body: JSON.stringify({ apiVersion: "importantdates.halo.run/v1alpha1", kind: "ImportantDate",
  metadata: { name: nm }, spec: { title: `频率测试-${RUN}`, dateType: "SOLAR", solarDate: d0, important: true, visible: true } })});

let ctx = await browser.createBrowserContext();
let p = await ctx.newPage();
const visit = async () => {
  await p.goto(`${base}/important-dates`, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (await p.evaluate(() => { const el = document.getElementById("id-toast-box"); return !!(el && el.getBoundingClientRect().width > 0); })) return true;
  }
  return false;
};
const clearState = () => p.evaluate(() => {
  ["id-toast-until","id-toast-forever","id-toast-last","id-toast-last-count","id-toast-day"].forEach((k) => localStorage.removeItem(k));
});

try {
  await check("F1 频率=every：连续两次访问都弹", async () => {
    await putToast({ toastFrequency: "every" });
    await p.goto(`${base}/important-dates`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await clearState();
    const a = await visit(); const b = await visit();
    assert(a && b, `every 应当每次都弹（第一次=${a}，第二次=${b}）`);
    return "两次都弹";
  });

  await check("F2 频率=daily N=1：当天第二次不再弹", async () => {
    await putToast({ toastFrequency: "daily", toastFrequencyN: 1 });
    // 用全新 context（storage 干净），否则首次加载就已经弹过一次并记账
    await ctx.close();
    ctx = await browser.createBrowserContext();
    p = await ctx.newPage();
    const a = await visit();
    const b = await visit();
    assert(a, "第一次应当弹出");
    assert(!b, "当天已弹 1 次，第二次不该再弹");
    const n = await p.evaluate(() => localStorage.getItem("id-toast-last-count"));
    assert(n === "1", `计数应为 1，实际 ${n}`);
    return `首次弹、第二次不弹（计数=${n}）`;
  });

  await check("F3 频率=interval N=30：间隔内不再弹", async () => {
    await putToast({ toastFrequency: "interval", toastFrequencyN: 30 });
    await ctx.close();
    ctx = await browser.createBrowserContext();
    p = await ctx.newPage();
    const a = await visit();
    const b = await visit();
    assert(a, "第一次应当弹出");
    assert(!b, "30 分钟间隔内不该再弹");
    return "首次弹、间隔内不弹";
  });

  await check("F4 频率=interval：把上次时间改成 31 分钟前后应恢复", async () => {
    await p.evaluate(() => localStorage.setItem("id-toast-last", String(Date.now() - 31 * 60000)));
    const a = await visit();
    assert(a, "间隔已过，应当恢复弹出");
    return "已恢复";
  });

  await check("F5 关闭菜单含「今天不再提示」，选后当天不再弹", async () => {
    await putToast({ toastFrequency: "every", toastCloseMenu: true });
    await ctx.close();
    ctx = await browser.createBrowserContext();
    p = await ctx.newPage();
    assert(await visit(), "应先弹出");
    // 点 × 打开菜单，检查选项文案
    await p.evaluate(() => {
      const el = document.getElementById("id-toast-box");
      el.querySelector("#id-toast-close").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 400));
    const labels = await p.evaluate(() => {
      const box = document.getElementById("id-toast-box");
      return [...box.querySelectorAll("button")].map((b) => b.innerText.trim());
    });
    assert(labels.includes("今天不再提示"), `菜单缺少该项：${JSON.stringify(labels)}`);
    // 点「今天不再提示」
    await p.evaluate(() => {
      const box = document.getElementById("id-toast-box");
      const btn = [...box.querySelectorAll("button")].find((b) => b.innerText.trim() === "今天不再提示");
      btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const until = await p.evaluate(() => Number(localStorage.getItem("id-toast-until") || 0));
    const endOfToday = await p.evaluate(() => { const d = new Date(); d.setHours(24,0,0,0); return d.getTime(); });
    assert(until > Date.now(), "未写入关闭期");
    assert(Math.abs(until - endOfToday) < 5000, `关闭期应到当天 24 点（差 ${Math.round((until-endOfToday)/1000)}s）`);
    const again = await visit();
    assert(!again, "选了「今天不再提示」后不该再弹");
    return `选项=${labels.join("/")}；关闭期至当天 24 点`;
  });
} finally {
  await api(`${DATE_BASE}/${nm}`, { method: "DELETE" });
  // 带当前版本号还原（乐观锁：用启动时的旧版本会 409，设置就留在测试值上了）
  const now = JSON.parse((await api(CM)).text);
  await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...(now.metadata || {}) }, data: orig })});
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

