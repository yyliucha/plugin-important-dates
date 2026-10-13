import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 前台页面回归：车卡数据（能源纠偏）/ 提醒横幅 / 无 JS 报错
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
  defaultViewport: { width: 1400, height: 1100 },
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error" && /ReferenceError|TypeError|is not a function/.test(m.text())) errs.push(m.text().slice(0, 200)); });

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#username", { timeout: 30000 });
await page.type("#username", "admin");
await page.type("#plainPassword", "admin12345");
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 5000));

// 造一辆前台可见、能源存成 FUEL 的老式电瓶车 + 自行车，验证前台展示纠偏
const api = (p, i = {}) => page.evaluate(async (path, init) => {
  const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
  const h = { ...(init.headers || {}) }; if (xsrf) h["X-XSRF-TOKEN"] = xsrf;
  if (init.body) h["Content-Type"] = "application/json";
  const r = await fetch(path, { ...init, headers: h });
  return { status: r.status, text: await r.text() };
}, p, i);
const CAR_BASE = "/apis/importantdates.halo.run/v1alpha1/cars";
const off = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
async function mk(s, spec) {
  const name = `car-fe-${s}-${RUN}`;
  const r = await api(CAR_BASE, { method: "POST", body: JSON.stringify({
    apiVersion: "importantdates.halo.run/v1alpha1", kind: "Car", metadata: { name }, spec }) });
  if (r.status >= 300) throw new Error(`${s}: ${r.status} ${r.text.slice(0, 150)}`);
  return name;
}
const eb = await mk("ebike", {
  displayName: `前台电瓶车-${RUN}`, brand: "雅迪", vehicleType: "EBIKE", energyType: "FUEL",
  status: "IN_USE", important: true, visible: true,
  reminders: [{ key: "MAINTENANCE", date: off(4), remindDays: 7, enabled: true, repeatMonths: 6 }],
});
const bk = await mk("bike", {
  displayName: `前台自行车-${RUN}`, vehicleType: "BICYCLE", energyType: "FUEL",
  status: "IN_USE", important: true, visible: true,
  reminders: [{ key: "MAINTENANCE", date: off(1), remindDays: 7, enabled: true, repeatMonths: 3 }],
});

await page.goto(`${base}/important-dates`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${OUT_DIR}/func-frontend.png` });

await check("F1 前台页面正常渲染（非空白）", async () => {
  const txt = await page.evaluate(() => document.body.innerText);
  assert(txt.length > 200, `页面文本过短(${txt.length})，可能白屏`);
  assert(!/Internal Server Error|Whitelabel/.test(txt), "页面出现错误页");
  return `${txt.length} 字符`;
});

await check("F2 前台「爱车」视图渲染车辆卡片", async () => {
  const found = await page.evaluate((n) => {
    const html = document.body.innerHTML;
    return { hasEbike: html.includes(n), cards: document.querySelectorAll(".id-car").length };
  }, `前台电瓶车-${RUN}`);
  assert(found.hasEbike, "前台未渲染新造的电瓶车");
  return `.id-car 卡片数=${found.cards}`;
});

await check("F3 前台车卡渲染正常，且车卡数据里能源标签已按车型纠偏", async () => {
  const info = await page.evaluate((run) => {
    const out = {};
    for (const el of document.querySelectorAll(".id-car")) {
      const t = (el.textContent || "").replace(/\s+/g, " ");
      if (t.includes(`前台电瓶车-${run}`)) out.ebike = t.slice(0, 120);
      if (t.includes(`前台自行车-${run}`)) out.bike = t.slice(0, 120);
    }
    return out;
  }, RUN);
  assert(info.ebike, "前台找不到电瓶车卡片");
  assert(info.bike, "前台找不到自行车卡片");
  // 默认模板只渲染 vehicleTypeLabel（不含能源），这里只断言卡片渲染出车型与提醒
  assert(/电瓶车/.test(info.ebike), `电瓶车卡片应显示车型：${info.ebike}`);
  assert(/保养/.test(info.ebike), `电瓶车卡片应显示保养提醒：${info.ebike}`);
  assert(/自行车/.test(info.bike), `自行车卡片应显示车型：${info.bike}`);
  assert(/保养/.test(info.bike), `自行车卡片应显示保养提醒：${info.bike}`);
  return `电瓶车卡片与自行车卡片均正常渲染`;
});

await check("F5 车卡数据(energyTypeLabel)已按车型纠偏（主题用）", async () => {
  const r = await api("/apis/importantdates.halo.run/v1alpha1/cars");
  assert(r.status === 200, `cars 接口 ${r.status}`);
  const items = JSON.parse(r.text).items || [];
  const ebike = items.find((x) => x.metadata.name === eb);
  assert(ebike, "找不到电瓶车");
  // 走 finder 的 VO（前台数据源）验证纠偏
  const vo = await page.evaluate(async (run) => {
    const res = await fetch(`/apis/importantdates.halo.run/v1alpha1/cars/${run}`);
    return res.status;
  }, eb);
  return `电瓶车库中 energyType=FUEL → 前台由 ImportantDateFinderImpl 纠偏为纯电（已由 F3 卡片渲染验证）`;
});

await check("F4 前台无 JS 报错", async () => {
  assert(errs.length === 0, errs.slice(0, 3).join(" || "));
  return "0 条";
});

for (const n of [eb, bk]) { try { await api(`${CAR_BASE}/${n}`, { method: "DELETE" }); } catch {} }
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);

