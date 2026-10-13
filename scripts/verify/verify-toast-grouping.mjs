import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 弹窗降噪（1.3.3）：
//   ① 一辆车的多个到期项在弹窗里只占一行，并注明「这辆车共 N 项到期」
//   ② 被折叠/被"每类最多 N 条"裁掉的条数，报成「还有 N 项」
//   ③ 弹窗底部有可点的详情入口，跳「记得」页
// 完整日期在横幅/仪表盘/记得页仍然逐条可见 —— 弹窗只负责"提醒"，不负责"清单"。
import puppeteer from "puppeteer-core";

const RUN = Date.now();
let pass = 0, fail = 0;
async function check(n, fn) {
  try { const d = await fn(); pass++; console.log(`[PASS] ${n}${d ? " — " + d : ""}`); }
  catch (e) { fail++; console.log(`[FAIL] ${n} — ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m); }

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-gpu"],
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
const writeToast = async (over) => {
  const fresh = JSON.parse((await api(CM)).text);
  const toast = Object.assign({}, JSON.parse((fresh.data || {}).toast || "{}"),
    { toastEnabled: true, toastScope: "SITE", toastCloseSeconds: 30, toastCloseMenu: false }, over);
  const res = await api(CM, { method: "PUT", body: JSON.stringify({
    apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...(fresh.metadata || {}) },
    data: Object.assign({}, fresh.data || {}, { toast: JSON.stringify(toast) }) }) });
  if (![200, 201].includes(res.status)) throw new Error(`写设置失败 ${res.status}`);
};
// 合并式写入：菜单开关这类"默认值"必须显式给出，否则本用例的结果取决于上一个用例留下了什么
await writeToast({ toastMaxPerType: 5, toastCloseMenu: true, toastDefaultClose: "once" });
await new Promise((r) => setTimeout(r, 3000));

const DATE_BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const ymd = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const off = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

// 一辆车、4 个到期项，到期日各不相同 —— 旧行为会在弹窗里占 4 行
const CAR = `car-group-${RUN}`;
const made = await api("/apis/importantdates.halo.run/v1alpha1/cars", {
  method: "POST",
  body: JSON.stringify({
    apiVersion: "importantdates.halo.run/v1alpha1", kind: "Car",
    metadata: { name: CAR },
    spec: {
      displayName: `合并车-${RUN}`, vehicleType: "SEDAN", status: "IN_USE",
      visible: true, important: true, photos: [],
      reminders: [
        { key: "INSURANCE_COMPULSORY", date: off(5), repeatMonths: 12, remindDays: 15, enabled: true },
        { key: "INSURANCE_COMMERCIAL", date: off(9), repeatMonths: 12, remindDays: 15, enabled: true },
        { key: "TAX", date: off(14), repeatMonths: 12, remindDays: 15, enabled: true },
        { key: "INSPECTION", date: off(20), repeatMonths: 12, remindDays: 30, enabled: true },
      ],
    },
  }),
});
if (![200, 201].includes(made.status)) throw new Error(`建车失败 ${made.status}: ${made.text.slice(0, 160)}`);

// 再放一个纪念日，用来验证「还有 N 项」的计数
const D = `date-group-${RUN}`;
await api(DATE_BASE, { method: "POST", body: JSON.stringify({
  apiVersion: "importantdates.halo.run/v1alpha1", kind: "ImportantDate",
  metadata: { name: D }, spec: { title: `合并纪念日-${RUN}`, dateType: "SOLAR", solarDate: ymd(2), important: true, visible: true } })});

const ctx = await browser.createBrowserContext();
const p = await ctx.newPage();
const waitBox = async () => {
  for (let i = 0; i < 60; i++) {
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
  await check("G1 端点：一辆车只下发一条，且带 groupTotal=该车项数", async () => {
    const d = await page.evaluate(async () => (await (await fetch("/important-dates-reminders?ts=" + Date.now())).json()));
    const mine = (d.toastItems || []).filter((i) => (i.carName || "").includes(`合并车-${RUN}`));
    assert(mine.length === 1, `该车应只占 1 条，实际 ${mine.length}: ${JSON.stringify(mine.map((m) => m.label))}`);
    assert(Number(mine[0].groupTotal) === 4, `groupTotal 应为 4，实际 ${mine[0].groupTotal}`);
    // 留下的应是最近到期的那一项（交强险 5 天后）
    assert(/交强险/.test(mine[0].label || ""), `应留最近到期项（交强险），实际 ${mine[0].label}`);
    return `1 行：${mine[0].label}（共 ${mine[0].groupTotal} 项）`;
  });

  await check("G2 端点：overflowCount 不虚高，且等于「该显示而未显示」的条数", async () => {
    const d = await page.evaluate(async () => {
      const items = (await (await fetch("/important-dates-reminders?ts=" + Date.now())).json());
      // 用车名+到期日还原"未折叠时会有几行"：有 groupTotal 的按总数算，其余算 1 行
      let wouldShow = 0;
      for (const i of items.toastItems || []) {
        wouldShow += Number(i.groupTotal) > 1 ? Number(i.groupTotal) : 1;
      }
      const ungrouped = (items.toastItems || []).filter((i) => !(Number(i.groupTotal) > 1)).length;
      return { over: Number(items.overflowCount), shown: (items.toastItems || []).length, wouldShow, ungrouped, total: (items.allReminders || []).length };
    });
    // 要么没折叠（over=0），要么恰好等于折叠掉的行数；绝不能把逾期/已办/未到期也算进来
    const expected = Math.min(Math.max(0, d.wouldShow - d.shown), Math.max(0, d.total - d.ungrouped));
    assert(d.over >= 0, `overflowCount 不应为负：${d.over}`);
    assert(d.over <= d.total, `overflowCount(${d.over}) 不该超过总条数(${d.total})`);
    assert(d.over === expected, `overflowCount 应为 ${expected}（折叠前 ${d.wouldShow} 行 → 现在 ${d.shown} 行），实际 ${d.over}`);
    return `还有 ${d.over} 项（${d.wouldShow} 行折叠为 ${d.shown} 行，总 ${d.total} 条）`;
  });

  await check("G3 弹窗：显示「这辆车共 N 项到期」", async () => {
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "弹窗未出现");
    const text = await p.evaluate(() => (document.getElementById("id-toast-box")?.textContent || "").replace(/\s+/g, " "));
    assert(text.includes(`合并车-${RUN}`), `弹窗未提到这辆车: ${text.slice(0, 200)}`);
    assert(/这辆车共 4 项到期/.test(text), `未注明该车共 4 项: ${text.slice(0, 220)}`);
    return text.slice(0, 120);
  });

  await check("G4 弹窗：报的条数与端点一致（没折叠就不虚报）", async () => {
    const served = await p.evaluate(async () => (await (await fetch("/important-dates-reminders?ts=" + Date.now())).json()).overflowCount);
    const text = await p.evaluate(() => (document.getElementById("id-toast-box")?.textContent || "").replace(/\s+/g, " "));
    if (served > 0) {
      assert(text.includes(`还有 ${served} 项`), `弹窗未显示「还有 ${served} 项」: ${text.slice(0, 220)}`);
      return `还有 ${served} 项`;
    }
    // 没有折叠时不该出现这句 —— 凭空报一个数同样是误导
    assert(!/还有 \d+ 项/.test(text), `端点说没折叠，弹窗却在报「还有 N 项」: ${text.slice(0, 220)}`);
    return "未折叠，未虚报条数";
  });

  await check("G5 弹窗：有可点的详情入口，指向记得页", async () => {
    const link = await p.evaluate(() => {
      const a = document.querySelector("#id-toast-box a");
      return a ? { text: (a.innerText || "").trim(), href: a.getAttribute("href") } : null;
    });
    assert(link, "弹窗里没有详情入口链接");
    assert(/记得|看全部/.test(link.text) || link.text.length > 0, `入口文案为空: ${JSON.stringify(link)}`);
    assert(/important-dates/.test(link.href), `入口应指向记得页，实际 ${link.href}`);
    await p.screenshot({ path: `${OUT_DIR}/ui-133-toast-grouped.png`, fullPage: false });
    return `${link.text} → ${link.href}`;
  });

  await check("G7 新增的文案不挡关闭按钮（点 × 仍能弹出菜单）", async () => {
    // 回归：正文里加了「这辆车共 N 项到期」这个 <span> 之后，形如 "#id-toast-box span"
    // 的"取第一个 span"选择器会点到正文上，× 就变成点不动了。关闭按钮必须有固定 id。
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(await waitBox(), "弹窗未出现");
    const before = await p.evaluate(() => !!document.getElementById("id-toast-close"));
    assert(before, "弹窗里找不到 #id-toast-close（关闭按钮缺少固定 id）");
    await p.evaluate(() => document.getElementById("id-toast-close").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await new Promise((r) => setTimeout(r, 700));
    const menus = await p.evaluate(() => {
      const box = document.getElementById("id-toast-box");
      return box ? [...box.querySelectorAll("button")].map((b) => b.innerText.trim()) : [];
    });
    assert(menus.length > 0, `点 × 没有弹出关闭方式菜单（菜单项=[]）—— 关闭按钮的点击目标可能被正文抢走了`);
    assert(menus.includes("本次关闭"), `菜单内容不对: ${JSON.stringify(menus)}`);
    return `点 × 弹出 ${menus.length} 项菜单`;
  });

  await check("G6 完整清单未受影响：记得页仍能逐条看到该车的各项", async () => {
    await p.goto(`${base}/important-dates?view=car`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 6000));
    const text = await p.evaluate((run) => {
      const hits = [];
      for (const el of document.querySelectorAll(".id-car-card, .id-reminder, li, div")) {
        const t = el.innerText || "";
        if (t.includes(`合并车-${run}`) && t.length < 300) hits.push(t.replace(/\s+/g, " "));
      }
      return hits.join(" | ");
    }, String(RUN));
    assert(text.includes("交强险"), `前台应能看到该项: ${text.slice(0, 300)}`);
    // 至少能看到两项不同内容，且都挂在同一辆车下 —— 证明完整清单没有跟着弹窗一起被折叠
    const distinct = ["交强险", "商业险", "车船税", "年检"].filter((w) => text.includes(w));
    assert(distinct.length >= 2, `前台应逐条列出该车的多个到期项，实际只看到: ${distinct.join("/")} | ${text.slice(0, 300)}`);
    return `前台仍逐条可见：${distinct.join(" / ")}`;
  });
} finally {
  await api(`/apis/importantdates.halo.run/v1alpha1/cars/${CAR}`, { method: "DELETE" });
  await api(`${DATE_BASE}/${D}`, { method: "DELETE" });
  const fresh = JSON.parse((await api(CM)).text);
  await api(CM, { method: "PUT", body: JSON.stringify({ apiVersion: "v1alpha1", kind: "ConfigMap",
    metadata: { name: "plugin-important-dates-configmap", ...(fresh.metadata || {}) }, data: fresh.data })});
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
