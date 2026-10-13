import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 验证拖拽排序保存（1.2.4）：不再并发打出一串请求，改为「只写必要区间 + PATCH + 串行 + 重试」
// 断言：① 写入请求最大并发 = 1；② 无 GET+PUT 成对请求（用 PATCH 只改字段）；③ 排序结果正确落库；④ 无 5xx
import puppeteer from "puppeteer-core";


let pass = 0;
let fail = 0;
const check = async (name, fn) => {
  try {
    const d = await fn();
    pass++;
    console.log(`[PASS] ${name}${d ? " — " + d : ""}`);
  } catch (e) {
    fail++;
    console.log(`[FAIL] ${name} — ${e.message}`);
  }
};

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"],
  defaultViewport: { width: 1500, height: 1000 },
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));

let inflight = 0;
let maxWriteInflight = 0;
let maxAllInflight = 0;
const reqs = [];
page.on("request", (r) => {
  const u = r.url();
  if (!/\/apis\/importantdates\.halo\.run\/v1alpha1\/(persons|cars|importantdates)/.test(u)) return;
  inflight++;
  maxAllInflight = Math.max(maxAllInflight, inflight);
  const item = { t: Date.now(), method: r.method(), url: u.replace(base, ""), done: false, isWrite: r.method() !== "GET" };
  if (item.isWrite) maxWriteInflight = Math.max(maxWriteInflight, inflight);
  reqs.push(item);
  item.finish = () => {
    inflight--;
    item.done = true;
  };
});
page.on("response", (res) => {
  const u = res.url();
  if (!/\/apis\/importantdates\.halo\.run\/v1alpha1\/(persons|cars|importantdates)/.test(u)) return;
  const item = [...reqs].reverse().find((r) => r.url === u.replace(base, "") && !r.done);
  if (item) {
    item.status = res.status();
    item.finish?.();
  }
});

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("#username", { timeout: 60000 });
await page.type("#username", "admin");
await page.type("#plainPassword", "admin12345");
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 5000));

// 准备 5 位人员（保证有足够的拖拽空间）
await page.evaluate(async () => {
  const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
  const existing = await fetch("/apis/importantdates.halo.run/v1alpha1/persons?page=1&size=100").then((x) => x.json());
  const count = (existing.items || []).length;
  for (let i = count + 1; i <= 5; i++) {
    await fetch("/apis/importantdates.halo.run/v1alpha1/persons", {
      method: "POST",
      headers: { "X-XSRF-TOKEN": xsrf, "Content-Type": "application/json" },
      body: JSON.stringify({
        apiVersion: "importantdates.halo.run/v1alpha1",
        kind: "Person",
        metadata: { name: `person-sortverify-${Date.now()}-${i}` },
        spec: { displayName: `排序验证${i}`, dateType: "SOLAR", solarDate: "1990-01-0" + ((i % 9) + 1), visible: true, sortOrder: i },
      }),
    });
  }
});

await page.goto(`${base}/console/important-dates`, { waitUntil: "domcontentloaded", timeout: 180000 });
await new Promise((r) => setTimeout(r, 9000));
await page.evaluate(() => [...document.querySelectorAll("button.tab-btn")].find((b) => b.innerText.startsWith("人员"))?.click());
await new Promise((r) => setTimeout(r, 2500));
const before = await page.evaluate(() => [...document.querySelectorAll(".person-card .person-name")].map((e) => e.innerText.trim()));
console.log(`[准备] 人员顺序: ${before.join(" | ")}`);

reqs.length = 0;
const dragResult = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".person-card")];
  if (cards.length < 3) return "too-few-cards";
  const from = cards[cards.length - 1];
  const to = cards[1];
  const dt = new DataTransfer();
  from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
  to.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
  to.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
  return "ok";
});
await new Promise((r) => setTimeout(r, 7000));
const writes = reqs.filter((r) => r.isWrite);
const gets = reqs.filter((r) => !r.isWrite);
console.log(`[请求] 写 ${writes.length} 个（最大并发 ${maxWriteInflight}），读 ${gets.length} 个`);
for (const r of writes) console.log(`   +${String(r.t - (reqs[0]?.t || 0)).padStart(5)}ms  ${r.method} ${r.status ?? "-"} ${r.url}`);

await check("拖拽触发保存", async () => {
  if (dragResult !== "ok") throw new Error(`拖拽未执行: ${dragResult}`);
  if (!writes.length) throw new Error("没有产生写入请求");
  return `${writes.length} 个写请求`;
});

await check("写入请求串行发出（最大并发 1，不再触发代理限流）", async () => {
  if (maxWriteInflight > 1) throw new Error(`写入最大并发 ${maxWriteInflight}（应 ≤ 1）`);
  return `最大并发 ${maxWriteInflight}`;
});

await check("只用 PATCH 改字段（不再先 GET 再 PUT，请求数减半）", async () => {
  const nonPatch = writes.filter((r) => r.method !== "PATCH");
  if (nonPatch.length) throw new Error(`出现非 PATCH 写请求: ${nonPatch.map((r) => r.method).join(",")}`);
  const personGets = gets.filter((r) => /persons\/person-/.test(r.url));
  if (personGets.length) throw new Error(`仍存在逐条 GET: ${personGets.length} 个`);
  return `写 ${writes.length} 个全部为 PATCH，逐条 GET 0 个`;
});

await check("全部请求成功（无 5xx）", async () => {
  const bad = reqs.filter((r) => (r.status ?? 200) >= 400);
  if (bad.length) throw new Error(`失败请求: ${bad.map((r) => `${r.status} ${r.url}`).join(", ")}`);
  return `${reqs.length} 个请求全部 2xx`;
});

await check("排序结果正确落库（拖拽项落到第 2 位）", async () => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 9000));
  await page.evaluate(() => [...document.querySelectorAll("button.tab-btn")].find((b) => b.innerText.startsWith("人员"))?.click());
  await new Promise((r) => setTimeout(r, 2500));
  const after = await page.evaluate(() => [...document.querySelectorAll(".person-card .person-name")].map((e) => e.innerText.trim()));
  const expected = [before[0], before[before.length - 1], ...before.slice(1, -1)];
  if (JSON.stringify(after) !== JSON.stringify(expected)) {
    throw new Error(`顺序不符：期望 ${expected.join(" | ")}，实际 ${after.join(" | ")}`);
  }
  const sortOrders = await page.evaluate(async () => {
    const res = await fetch("/apis/importantdates.halo.run/v1alpha1/persons?page=1&size=100");
    const body = await res.json();
    return (body.items || []).map((p) => ({ name: p.spec.displayName, order: p.spec.sortOrder, visible: p.spec.visible }))
      .filter((p) => p.visible !== false)
      .sort((a, b) => a.order - b.order)
      .map((p) => `${p.name}:${p.order}`);
  });
  return `${after.join(" | ")} ｜落库值 ${sortOrders.join(", ")}`;
});

await check("控制台无脚本错误", async () => {
  if (errs.length) throw new Error(errs.slice(0, 3).join(" | "));
  return "无 pageerror";
});

await browser.close();
await new Promise((r) => setTimeout(r, 3000));
console.log(`\n===== 拖拽排序保存: ${pass} PASS, ${fail} FAIL =====`);
process.exit(fail > 0 ? 1 : 0);

