import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 关闭方式菜单：只有「本次关闭 / 今天不再提示 / N 天内不显示」，
// 没有任何「永久不再提示」；每个时长都按天数生效，到期自动恢复。
import puppeteer from "puppeteer-core";
import { cleanupTestData } from "./_cleanup.mjs";

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

// 先清掉历史残留：堆积的测试数据会把本次用例的数据挤出弹窗显示窗口，
// 报出来的错却和真正的原因毫不相干。
const cleaned = await cleanupTestData(api);
if (cleaned.dates || cleaned.cars || cleaned.persons) {
  console.log(
    "[cleanup] 清掉历史测试数据：日期 " + cleaned.dates + " / 座驾 " + cleaned.cars + " / 人员 " + cleaned.persons
  );
}
const CM = "/api/v1alpha1/configmaps/plugin-important-dates-configmap";
const cm = await api(CM); const meta = JSON.parse(cm.text).metadata || {}; const orig = JSON.parse(cm.text).data || {};
/**
 * 写入悬浮提醒设置。基于**最新**的 configmap 重新读取再合并：ConfigMap 是乐观锁
 * （metadata.version 不匹配就 409），用启动时抓的旧副本反复 PUT 会在几次写入后开始失败。
 */
const writeToast = async (over) => {
  const fresh = JSON.parse((await api(CM)).text);
  const toast = Object.assign({}, JSON.parse((fresh.data || {}).toast || "{}"),
    { toastEnabled: true, toastScope: "SITE", toastCloseSeconds: 30 }, over);
  const res = await api(CM, { method: "PUT", body: JSON.stringify({
    apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...(fresh.metadata || {}) },
    data: Object.assign({}, fresh.data || orig, { toast: JSON.stringify(toast) }) }) });
  if (![200, 201].includes(res.status)) throw new Error(`写设置失败 ${res.status}: ${res.text.slice(0, 160)}`);
  return res.status;
};
// 显式写死本次要用的取值，别依赖实例上残留的设置 —— 上一轮跑（或手工调试）留下的
// toastCloseMenu=false / toastDurations 会让 D1~D3 这些"按默认菜单"的用例莫名其妙地失败。
// 这类"合并式写入"的默认值必须全部显式给出，否则用例的结果取决于上一个人留下了什么。
await writeToast({ toastCloseMenu: true, toastDurations: "3,5,7,30", toastDefaultClose: "once", toastFrequency: "every" });
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
// 只在站点页面里清：在登录页/空白页调 localStorage 会抛 SecurityError，整个用例会平白失败
const clearMarks = async () => {
  await p.evaluate(() => {
    try {
      ["id-toast-until", "id-toast-forever", "id-toast-last", "id-toast-last-count", "id-toast-day"]
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* 当前页面拿不到存储就跳过，不影响用例本身 */ }
  });
};
/** 打开页面 → 点 × → 等菜单出现 → 取下所有菜单文案 */
const openMenu = async () => {
  await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert(await waitBox(), "未弹出");
  await p.evaluate(() => document.querySelector("#id-toast-close").dispatchEvent(new MouseEvent("click", { bubbles: true })));
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
    // 先落到站点页面再清记录（登录页访问 localStorage 会抛 SecurityError）
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
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
    await p.evaluate(() => document.querySelector("#id-toast-close").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await new Promise((r) => setTimeout(r, 700));
    const diag = await p.evaluate(async () => {
      const box = document.getElementById("id-toast-box");
      const served = await (await fetch("/important-dates-reminders?ts=" + Date.now())).json();
      return {
        boxExists: !!box,
        menuTexts: box ? [...box.querySelectorAll("button")].map((b) => b.innerText.trim()) : [],
        // 菜单没出现时这几个值基本能直接指出原因（多半是设置被上一轮跑带偏了）
        servedCloseMenu: served.toastCloseMenu,
        servedDefault: served.toastDefaultClose,
        servedDurations: served.toastDurations,
      };
    });
    if (!diag.menuTexts.length) throw new Error(`菜单未出现。诊断=${JSON.stringify(diag)}`);
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
    await p.evaluate(() => document.querySelector("#id-toast-close").dispatchEvent(new MouseEvent("click", { bubbles: true })));
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
    await p.evaluate(() => document.querySelector("#id-toast-close").dispatchEvent(new MouseEvent("click", { bubbles: true })));
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
    await p.evaluate(() => document.querySelector("#id-toast-close").dispatchEvent(new MouseEvent("click", { bubbles: true })));
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
    const putStatus = await writeToast({ toastDurations: "10" });
    await new Promise((r) => setTimeout(r, 3000));
    await clearMarks();
    const labels = await openMenu();
    const served = await p.evaluate(async () => {
      const d = await (await fetch("/important-dates-reminders?ts=" + Date.now())).json();
      return d.toastDurations;
    });
    assert(labels.includes("10 天内不显示"), `菜单缺少「10 天内不显示」：菜单=${JSON.stringify(labels)} 端点下发=${JSON.stringify(served)} 写入状态=${putStatus}`);
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
  // ConfigMap 是乐观锁：必须带上**当前**版本号再还原，用启动时抓的旧版本会 409，
  // 结果设置留在测试值上，污染下一个用例。下同。
  const now = JSON.parse((await api(CM)).text);
  await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...(now.metadata || {}) }, data: orig })});
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
