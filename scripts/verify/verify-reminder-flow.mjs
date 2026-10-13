import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 验证 1.2.6「提醒状态机」：逾期 3 天逐日文案 / 待处理 / 已办顺延 / 忽略 / 前台过滤 / 节点式弹一次
import puppeteer from "puppeteer-core";


const RUN = Date.now();
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

const ymd = (offsetDays) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("#username", { timeout: 60000 });
await page.type("#username", "admin");
await page.type("#plainPassword", "admin12345");
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 5000));

const api = (path, init = {}) =>
  page.evaluate(
    async (p, i) => {
      const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
      const headers = { ...(i.headers || {}) };
      if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
      if (i.body && typeof i.body === "string" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      const res = await fetch(p, { ...i, headers });
      return { status: res.status, text: await res.text() };
    },
    path,
    init
  );
const json = async (path, init) => JSON.parse((await api(path, init)).text);

// ---------- 造数据 ----------
const CAR = `car-reminder126-${RUN}`;
const reminders = [
  // 逾期 1 天（不循环）
  { key: "CUSTOM", label: `逾期一天-${RUN}`, date: ymd(-1), repeatMonths: 0, remindDays: 15, enabled: true },
  // 逾期 5 天（不循环）→ 超过默认 3 天窗口 → 待处理
  { key: "CUSTOM", label: `待处理-${RUN}`, date: ymd(-5), repeatMonths: 0, remindDays: 15, enabled: true },
  // 还有 3 天（循环 12 个月）→ 节点 D3，用于顺延与节点测试
  { key: "INSURANCE_COMPULSORY", label: `交强险-${RUN}`, date: ymd(3), repeatMonths: 12, remindDays: 15, enabled: true },
  // 还有 10 天（不循环）→ 用于忽略测试
  { key: "CUSTOM", label: `忽略测试-${RUN}`, date: ymd(10), repeatMonths: 0, remindDays: 15, enabled: true },
];
const created = await api("/apis/importantdates.halo.run/v1alpha1/cars", {
  method: "POST",
  body: JSON.stringify({
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Car",
    metadata: { name: CAR },
    spec: {
      displayName: `状态车-${RUN}`,
      vehicleType: "SEDAN",
      status: "IN_USE",
      visible: true,
      important: true,
      photos: [],
      reminders,
    },
  }),
});
if (![200, 201].includes(created.status)) throw new Error(`建车失败 ${created.status}: ${created.text.slice(0, 160)}`);

// ---------- ① 接口：状态与文案 ----------
const fetchReminders = async () => json("/important-dates-reminders");
await check("① 逾期文案逐日不同 · 超过窗口转待处理", async () => {
  await api("/important-dates-reminders"); // 触发一次计算
  const data = await fetchReminders();
  const all = data.allReminders || [];
  const overdue = all.find((i) => (i.label || "").includes(`逾期一天-${RUN}`));
  const todo = all.find((i) => (i.label || "").includes(`待处理-${RUN}`));
  if (!overdue) throw new Error("逾期 1 天的项未出现在提醒列表（应在逾期窗口内）");
  if (!todo) throw new Error("待处理项未保留在列表（不应被静默清掉）");
  if (overdue.status !== "PENDING") throw new Error(`逾期项状态应为 PENDING，实际 ${overdue.status}`);
  if (!/昨天到期了/.test(overdue.stageText || "")) throw new Error(`逾期第 1 天文案不符: ${overdue.stageText}`);
  if (todo.status !== "TODO") throw new Error(`逾期 5 天应转 TODO，实际 ${todo.status}`);
  if (!/待处理/.test(todo.stageText || "")) throw new Error(`待处理文案不符: ${todo.stageText}`);
  if (!(data.todoCount >= 1)) throw new Error(`todoCount 未统计: ${data.todoCount}`);
  return `逾期1天=「${overdue.stageText}」· 逾期5天=「${todo.stageText}」· todoCount=${data.todoCount}`;
});

await check("② 前台横幅不显示逾期 / 待处理项", async () => {
  const html = await (await fetch(`${base}/important-dates?view=car`)).text();
  if (html.includes(`逾期一天-${RUN}`)) throw new Error("逾期项出现在前台横幅");
  if (html.includes(`待处理-${RUN}`)) throw new Error("待处理项出现在前台横幅");
  if (!html.includes(`交强险-${RUN}`)) throw new Error("即将到期的项却未出现在前台");
  return "逾期与待处理项已从访客可见面移除，即将到期项正常显示";
});

// 开启悬浮提醒（默认关闭）：节点式弹出依赖它（插件设置存放在同名 ConfigMap 里）
const CM = "/api/v1alpha1/configmaps/plugin-important-dates-configmap";
const cm = JSON.parse((await api(CM)).text);
cm.data = cm.data || {};
let toastCfg = {};
try {
  toastCfg = cm.data.toast ? JSON.parse(cm.data.toast) : {};
} catch {
  toastCfg = {};
}
toastCfg.toastEnabled = true;
cm.data.toast = JSON.stringify(toastCfg);
const saved = await api(CM, { method: "PUT", body: JSON.stringify(cm) });
if (![200, 201].includes(saved.status)) throw new Error(`开启悬浮提醒失败 ${saved.status}: ${saved.text.slice(0, 120)}`);
await new Promise((r) => setTimeout(r, 2000));

// ---------- ③ 节点式：每次访问都下发；服务端不记账，弹窗去重记在浏览器 ----------
await check("③ 悬浮提示每次访问都下发 · 服务端不写「已弹过」记录", async () => {
  // 1.3.1 起：服务端不再做"交付即记账"。以前弹一次就往车的 notifiedStages 里写一笔，
  // 结果用户没看到（脚本被缓存、弹窗被拦）也判定为已提醒，之后再也不弹。
  // 现在服务端每次都照常下发，去重完全交给浏览器（localStorage）。
  const TOAST_CAR = `car-toastnode-${RUN}`;
  const made = await api("/apis/importantdates.halo.run/v1alpha1/cars", {
    method: "POST",
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "Car",
      metadata: { name: TOAST_CAR },
      spec: {
        displayName: `节点车-${RUN}`,
        vehicleType: "SEDAN",
        status: "IN_USE",
        visible: true,
        important: true,
        photos: [],
        reminders: [
          { key: "CUSTOM", label: `节点项-${RUN}`, date: ymd(3), repeatMonths: 0, remindDays: 15, enabled: true },
        ],
      },
    }),
  });
  if (![200, 201].includes(made.status)) throw new Error(`建车失败 ${made.status}`);

  const readToast = async () => {
    const d = await json(`/important-dates-reminders?ts=${Date.now()}`);
    return (d.toastItems || []).map((i) => ({ text: i.text || "", stage: i.stageCode }));
  };
  const before = await readToast();
  const hit = before.find((i) => i.text.includes(`节点项-${RUN}`));
  if (!hit) throw new Error(`弹出前未下发该节点：${JSON.stringify(before.map((b) => b.text))}`);
  if (hit.stage !== "D3") throw new Error(`节点编码应为 D3，实际 ${hit.stage}`);

  await page.goto(`${base}/important-dates`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 4000));
  const car = await json(`/apis/importantdates.halo.run/v1alpha1/cars/${TOAST_CAR}`);
  const stages = car.spec.reminders[0].notifiedStages || [];
  if (stages.length) throw new Error(`服务端不该再写"已弹过"记录: ${JSON.stringify(stages)}`);
  if (car.spec.reminders[0].notifiedForDate) {
    throw new Error(`服务端不该再写 notifiedForDate: ${car.spec.reminders[0].notifiedForDate}`);
  }
  // 浏览器侧应该记下"刚弹过"（提示频率用的时间戳）
  const shown = await page.evaluate(() => localStorage.getItem("id-toast-last"));
  if (!shown) throw new Error("浏览器未记录弹出时间（id-toast-last 为空）");
  const after = await readToast();
  if (!after.some((i) => i.text.includes(`节点项-${RUN}`))) {
    throw new Error(`服务端把该项从候选里移除了（应始终下发，由浏览器去重）: ${JSON.stringify(after.map((a) => a.text))}`);
  }
  return `下发「${hit.text}」(D3)，服务端记录=无，浏览器记录=${shown}，再次访问仍下发`;
});
// ---------- ④ 已办：循环项顺延一期 / 一次性项完成 ----------
await check("④ 已办：循环项顺延一期并留痕", async () => {
  const before = await json(`/apis/importantdates.halo.run/v1alpha1/cars/${CAR}`);
  const idx = before.spec.reminders.findIndex((r) => (r.label || "").includes(`交强险-${RUN}`));
  const oldDate = before.spec.reminders[idx].date;
  const patched = await api(`/apis/importantdates.halo.run/v1alpha1/cars/${CAR}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json-patch+json" },
    body: JSON.stringify([
      { op: "add", path: `/spec/reminders/${idx}/date`, value: ymd(3 + 365) },
      { op: "add", path: `/spec/reminders/${idx}/lastDoneFrom`, value: oldDate },
    ]),
  });
  if (![200, 204].includes(patched.status)) throw new Error(`PATCH 失败 ${patched.status}`);
  const after = await json(`/apis/importantdates.halo.run/v1alpha1/cars/${CAR}`);
  const moved = after.spec.reminders[idx];
  if (moved.date === oldDate) throw new Error("到期日未顺延");
  if (moved.lastDoneFrom !== oldDate) throw new Error("未记录原到期日");
  return `${oldDate} → ${moved.date}（原到期日已留痕）`;
});

await check("⑤ 已办/忽略后不再进入提醒（含前台）", async () => {
  const state = await json(`/apis/importantdates.halo.run/v1alpha1/cars/${CAR}`);
  const idxSkip = state.spec.reminders.findIndex((r) => (r.label || "").includes(`忽略测试-${RUN}`));
  const idxDone = state.spec.reminders.findIndex((r) => (r.label || "").includes(`逾期一天-${RUN}`));
  const r1 = await api(`/apis/importantdates.halo.run/v1alpha1/cars/${CAR}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json-patch+json" },
    body: JSON.stringify([
      { op: "add", path: `/spec/reminders/${idxSkip}/ackState`, value: "SKIPPED" },
      { op: "add", path: `/spec/reminders/${idxSkip}/skippedForDate`, value: state.spec.reminders[idxSkip].date },
      { op: "add", path: `/spec/reminders/${idxDone}/ackState`, value: "DONE" },
    ]),
  });
  if (![200, 204].includes(r1.status)) throw new Error(`PATCH 失败 ${r1.status}`);
  const data = await fetchReminders();
  const all = data.allReminders || [];
  if (all.some((i) => (i.label || "").includes(`忽略测试-${RUN}`))) throw new Error("已忽略项仍在提醒列表");
  if (all.some((i) => (i.label || "").includes(`逾期一天-${RUN}`))) throw new Error("已办项仍在提醒列表");
  const html = await (await fetch(`${base}/important-dates?view=car`)).text();
  if (html.includes(`忽略测试-${RUN}`) || html.includes(`逾期一天-${RUN}`)) {
    throw new Error("已办/已忽略项仍出现在前台");
  }
  return "已忽略与已办项均退出提醒列表与前台";
});

// ---------- ⑥ 控制台：状态标签与按钮 ----------
await check("⑥ 控制台显示待处理标签与「已办/忽略」按钮", async () => {
  await page.goto(`${base}/console/important-dates`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 9000));
  await page.evaluate(() => [...document.querySelectorAll("button.tab-btn")].find((b) => b.innerText.startsWith("座驾"))?.click());
  await new Promise((r) => setTimeout(r, 2500));
  const info = await page.evaluate((run) => {
    const card = [...document.querySelectorAll(".car-card")].find((c) => (c.innerText || "").includes(`状态车-${run}`));
    if (!card) return null;
    const events = [...card.querySelectorAll(".car-event")].map((e) => ({
      text: (e.innerText || "").replace(/\s+/g, " ").trim(),
      todo: e.classList.contains("todo"),
      done: e.classList.contains("done"),
      acts: [...e.querySelectorAll(".event-act")].map((b) => b.getAttribute("title")),
    }));
    return { events };
  }, String(RUN));
  if (!info) throw new Error("未找到测试车辆卡片");
  const todoEvent = info.events.find((e) => e.todo);
  if (!todoEvent) throw new Error(`未标出待处理项: ${JSON.stringify(info.events)}`);
  const hasDoneAct = info.events.some((e) => e.acts.some((t) => (t || "").includes("已办")));
  if (!hasDoneAct) throw new Error(`未提供「已办」按钮: ${JSON.stringify(info.events)}`);
  await page.screenshot({ path: `${OUT_DIR}/ui-126-reminder-state.png` });
  return `待处理项=「${todoEvent.text}」；按钮=${info.events[0].acts.join("/")}`;
});

await check("⑦ 控制台无脚本错误", async () => {
  if (errs.length) throw new Error(errs.slice(0, 3).join(" | "));
  return "无 pageerror";
});

await browser.close();
await new Promise((r) => setTimeout(r, 3000));
console.log(`\n===== 提醒状态机（1.2.6）: ${pass} PASS, ${fail} FAIL =====`);
process.exit(fail > 0 ? 1 : 0);

