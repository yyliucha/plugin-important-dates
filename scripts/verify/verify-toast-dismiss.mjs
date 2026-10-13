import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 关闭方式菜单：只有「本次关闭 / 今天不再提示 / N 天内不显示」，
// 没有任何「永久不再提示」；每个时长都按天数生效，到期自动恢复。
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
await writeToast({});
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
const clearMarks = async () => p.evaluate(() => {
  ["id-toast-until", "id-toast-forever", "id-toast-last", "id-toast-last-count", "id-toast-day"]
    .forEach((k) => localStorage.removeItem(k));
});
/** 打开页面 → 点 × → 等菜单出现 → 取下所有菜单文案 */
const openMenu = async () => {
  await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert(await waitBox(), "未弹出");
  await p.evaluate(() => document.querySelector("#id-toast-box span").dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await new Promise((r) => setTimeout(r, 700));
  return p.evaluate(() => {
    const btns = [...document.querySelectorAll("#id-toast-box button")];
    return btns.map((b) => (b.innerText || "").trim());
  });
};
const clickMenu = (label) => p.evaluate((want) => {
  const btn = [...document.querySelectorAll("#id-toast-box button")].find((b) => (b.innerText || "").trim() === want);
  if (!btn) throw new Error("菜单里没有「" + want + "」");
  btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}, label);
const marks = () => p.evaluate(() => ({
  until: Number(localStorage.getItem("id-toast-until") || 0),
  forever: localStorage.getItem("id-toast-forever"),
}));
const daysFromNow = (ms) => (ms - Date.now()) / 86400000;

try {
  await check("D1 菜单包含 3/5/7/30 天，且没有任何「永久」选项", async () => {
    await clearMarks();
    const labels = await openMenu();
    const want = ["本次关闭", "今天不再提示", "3 天内不显示", "5 天内不显示", "7 天内不显示", "30 天内不显示"];
    for (const w of want) assert(labels.includes(w), `菜单缺少「${w}」：${JSON.stringify(labels)}`);
    const foreverish = labels.filter((t) => /永久|永久关闭|一直|不再提示$/.test(t) && !t.includes("今天"));
    assert(!foreverish.length, `菜单仍有永久类选项：${JSON.stringify(foreverish)}`);
    return labels.join(" / ");
  });

  await check("D2 选「3 天内不显示」→ 记 3 天，且刷新后不再弹", async () => {
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "未弹出");
    await p.evaluate(() => document.querySelector("#id-toast-box span").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await new Promise((r) => setTimeout(r, 700));
    await clickMenu("3 天内不显示");
    await new Promise((r) => setTimeout(r, 500));
    const st = await marks();
    const d = daysFromNow(st.until);
    assert(d > 2.9 && d < 3.1, `应记 3 天，实际 ${d.toFixed(3)} 天`);
    assert(!st.forever, "不该写永久标记");
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(!(await waitBox()), "选了 3 天内不显示，刷新后仍在弹");
    return `记 ${d.toFixed(2)} 天后不再弹`;
  });

  await check("D3 选「30 天内不显示」→ 记 30 天", async () => {
    await clearMarks();
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "未弹出");
    await p.evaluate(() => document.querySelector("#id-toast-box span").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await new Promise((r) => setTimeout(r, 700));
    await clickMenu("30 天内不显示");
    await new Promise((r) => setTimeout(r, 500));
    const d = daysFromNow((await marks()).until);
    assert(d > 29.9 && d < 30.1, `应记 30 天，实际 ${d.toFixed(3)} 天`);
    return `记 ${d.toFixed(2)} 天`;
  });

  await check("D4 选「今天不再提示」→ 记到当地 24 点", async () => {
    await clearMarks();
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "未弹出");
    await p.evaluate(() => document.querySelector("#id-toast-box span").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await new Promise((r) => setTimeout(r, 700));
    await clickMenu("今天不再提示");
    await new Promise((r) => setTimeout(r, 500));
    const info = await p.evaluate(() => {
      const until = Number(localStorage.getItem("id-toast-until") || 0);
      const end = new Date(); end.setHours(24, 0, 0, 0);
      return { until, end: end.getTime(), now: Date.now() };
    });
    assert(info.until === info.end, `应记到当天 24 点（${new Date(info.end).toLocaleString()}），实际 ${new Date(info.until).toLocaleString()}`);
    assert(info.until > info.now, "记录的结束时间应在未来");
    return `到 ${new Date(info.until).toLocaleString()} 前不弹`;
  });

  await check("D5 选「本次关闭」→ 不写任何静音标记，刷新后照常弹", async () => {
    await clearMarks();
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "未弹出");
    await p.evaluate(() => document.querySelector("#id-toast-box span").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await new Promise((r) => setTimeout(r, 700));
    await clickMenu("本次关闭");
    await new Promise((r) => setTimeout(r, 500));
    const st = await marks();
    assert(!st.until && !st.forever, `不该写静音标记: ${JSON.stringify(st)}`);
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "本次关闭后刷新不再弹");
    return "不写标记，刷新仍弹";
  });

  await check("D6 时长改成自定义（只填 10）→ 菜单按设置变化", async () => {
    await writeToast({ toastDurations: "10" });
    await new Promise((r) => setTimeout(r, 3000));
    await clearMarks();
    const labels = await openMenu();
    assert(labels.includes("10 天内不显示"), `菜单缺少「10 天内不显示」：${JSON.stringify(labels)}`);
    assert(!labels.includes("3 天内不显示"), `菜单仍显示未勾选的 3 天：${JSON.stringify(labels)}`);
    await clickMenu("10 天内不显示");
    await new Promise((r) => setTimeout(r, 500));
    const d = daysFromNow((await marks()).until);
    assert(d > 9.9 && d < 10.1, `应记 10 天，实际 ${d.toFixed(3)} 天`);
    return `${labels.join(" / ")}（记 ${d.toFixed(2)} 天）`;
  });

  await check("D7 时长留空 → 回退默认 3/5/7/30", async () => {
    await writeToast({ toastDurations: "" });
    await new Promise((r) => setTimeout(r, 3000));
    await clearMarks();
    const labels = await openMenu();
    for (const w of ["3 天内不显示", "5 天内不显示", "7 天内不显示", "30 天内不显示"]) {
      assert(labels.includes(w), `回退后缺少「${w}」：${JSON.stringify(labels)}`);
    }
    return labels.join(" / ");
  });
} finally {
  await api(`${DATE_BASE}/${nm}`, { method: "DELETE" });
  await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...meta }, data: orig })});
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
