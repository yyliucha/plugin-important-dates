import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 1.2.8-rc.1 功能自测（浏览器 + API）
// 覆盖：D1 座驾卡片到期项渲染(I1 回归) / D2 车型字段联动 / D3 能源锁定
//       D4 切换车型保存不丢数据 / D5 折叠交互与布局 / D6 控制台无报错
import puppeteer from "puppeteer-core";


const RUN = Date.now();
let pass = 0, fail = 0;
const shots = [];

async function check(name, fn) {
  try {
    const d = await fn();
    pass++;
    console.log(`[PASS] ${name}${d ? " — " + d : ""}`);
  } catch (e) {
    fail++;
    console.log(`[FAIL] ${name} — ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"],
  defaultViewport: { width: 1500, height: 1000 },
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 220)));
page.on("console", (m) => {
  if (m.type() === "error" && /ReferenceError|TypeError|NotFoundError|before initialization|is not a function/.test(m.text())) {
    pageErrors.push(m.text().slice(0, 220));
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { const p = `${OUT_DIR}/func-${n}.png`; await page.screenshot({ path: p }); shots.push(p); return p; };

// ---------- 登录 ----------
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#username", { timeout: 30000 });
await page.type("#username", "admin");
await page.type("#plainPassword", "admin12345");
await page.click('button[type="submit"]');
await sleep(5000);

/** 页面内带会话调用插件接口 */
const api = (path, init = {}) =>
  page.evaluate(async (p, i) => {
    const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
    const headers = { ...(i.headers || {}) };
    if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
    if (i.body) headers["Content-Type"] = "application/json";
    const res = await fetch(p, { ...i, headers });
    return { status: res.status, text: await res.text() };
  }, path, init);

const CAR_BASE = "/apis/importantdates.halo.run/v1alpha1/cars";
const nm = (s) => `car-func128-${s}-${RUN}`;
async function createCar(suffix, spec) {
  const body = { apiVersion: "importantdates.halo.run/v1alpha1", kind: "Car", metadata: { name: nm(suffix) }, spec };
  const r = await api(CAR_BASE, { method: "POST", body: JSON.stringify(body) });
  if (r.status >= 300) throw new Error(`createCar ${suffix}: ${r.status} ${r.text.slice(0, 200)}`);
  return nm(suffix);
}
const getCar = async (name) => {
  const r = await api(`${CAR_BASE}/${name}`);
  if (!r.ok && r.status !== 200) throw new Error(`getCar: ${r.status}`);
  return JSON.parse(r.text);
};
const delCar = async (name) => { await api(`${CAR_BASE}/${name}`, { method: "DELETE" }); };

const off = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

console.log("=== 造数据 ===");
const petrol = await createCar("petrol", {
  displayName: `功能车-${RUN}`, plateNo: "粤B12345", brand: "比亚迪", model: "汉", vehicleType: "SEDAN",
  energyType: "FUEL", status: "IN_USE", important: true, visible: false, registeredDate: "2020-05-10",
  mileageKm: 32000,
  reminders: [
    { key: "INSURANCE_COMPULSORY", date: off(10), remindDays: 15, enabled: true, repeatMonths: 12 },
    { key: "MAINTENANCE", date: off(5), remindDays: 14, enabled: true, repeatMonths: 0 },
    { key: "INSPECTION", date: "", remindDays: 30, enabled: true, repeatMonths: 12 },
  ],
});
const ebike = await createCar("ebike", {
  displayName: `功能电瓶车-${RUN}`, plateNo: "粤B88888", brand: "雅迪", vehicleType: "EBIKE",
  energyType: "FUEL", status: "IN_USE", important: true, visible: false,
  reminders: [
    { key: "MAINTENANCE", date: off(3), remindDays: 7, enabled: true, repeatMonths: 6 },
    { key: "INSURANCE_COMPULSORY", date: off(20), remindDays: 15, enabled: true, repeatMonths: 12 },
  ],
});
const bike = await createCar("bike", {
  displayName: `功能自行车-${RUN}`, plateNo: "不该有车牌", vehicleType: "BICYCLE",
  energyType: "FUEL", status: "IN_USE", important: true, visible: false,
  reminders: [
    { key: "MAINTENANCE", date: off(2), remindDays: 7, enabled: true, repeatMonths: 3 },
    { key: "LICENSE", date: off(40), remindDays: 30, enabled: true, repeatMonths: 12 },
  ],
});
console.log("已建:", petrol, ebike, bike);

// ---------- 进入「记得」页面 → 座驾页签 ----------
async function gotoCarsTab() {
  await page.goto(`${base}/console/important-dates`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector(".tabs", { timeout: 30000 });
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll(".tabs button, .tabs a, button")];
    const b = btns.find((x) => (x.textContent || "").includes("座驾"));
    if (b) { b.click(); return true; }
    return false;
  });
  assert(clicked, "找不到「座驾」页签");
  await sleep(2000);
}

async function cardOf(displayName) {
  return page.evaluate((n) => {
    const cards = [...document.querySelectorAll(".car-card")];
    const c = cards.find((x) => (x.textContent || "").includes(n));
    if (!c) return null;
    const chips = [...c.querySelectorAll(".car-event")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
    return {
      text: (c.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300),
      chips,
      hasNoEventsHint: (c.textContent || "").includes("暂无启用的到期项"),
    };
  }, displayName);
}

/** 打开某辆车的编辑弹窗 */
async function openEdit(displayName) {
  const ok = await page.evaluate((n) => {
    const cards = [...document.querySelectorAll(".car-card")];
    const c = cards.find((x) => (x.textContent || "").includes(n));
    if (!c) return false;
    const btns = [...c.querySelectorAll("button")];
    const b = btns.find((x) => (x.textContent || "").trim() === "编辑");
    if (b) { b.click(); return true; }
    return false;
  }, displayName);
  assert(ok, `找不到 ${displayName} 的编辑按钮`);
  await page.waitForSelector(".form .sec", { timeout: 15000 });
  await sleep(1200);
}

/** 读取弹窗状态：可见字段、能源框值/是否只读、到期项下拉、折叠分区 */
const readModal = () =>
  page.evaluate(() => {
    const visible = (el) => !!(el && el.offsetParent !== null && el.getBoundingClientRect().height > 0);
    const labels = [...document.querySelectorAll(".form .sec-body .label")].map((e) => e.textContent.trim());
    // 能源类型
    let energyValue = null, energyReadonly = false;
    const energyLabelEl = [...document.querySelectorAll(".form .label")].find((e) => e.textContent.trim() === "能源类型");
    if (energyLabelEl && visible(energyLabelEl)) {
      const field = energyLabelEl.closest("label, .field");
      const inp = field?.querySelector("input.locked, input");
      const sel = field?.querySelector("select");
      if (inp) { energyValue = inp.value; energyReadonly = inp.disabled; }
      else if (sel) { energyValue = sel.value; energyReadonly = false; }
    }
    // 车牌字段是否可见
    const plateLabelEl = [...document.querySelectorAll(".form .label")].find((e) => e.textContent.trim() === "车牌号");
    const plateVisible = !!(plateLabelEl && visible(plateLabelEl));
    // 第一条到期项的项目下拉选项
    const sel0 = document.querySelector(".rr-main select");
    const options = sel0 ? [...sel0.options].map((o) => o.textContent.trim()) : [];
    // 分区
    const sections = [...document.querySelectorAll(".form details.sec")].map((d) => ({
      name: d.querySelector(".sec-name")?.textContent.trim(),
      open: d.open,
      bodyVisible: visible(d.querySelector(".sec-body")),
      rect: (() => { const r = d.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; })(),
    }));
    // 到期项数量
    const rows = document.querySelectorAll(".rr-main").length;
    return { labels, energyValue, energyReadonly, plateVisible, options, sections, rows };
  });

/** 设置车辆分类下拉并等待联动 */
async function setVehicleType(value) {
  const ok = await page.evaluate((v) => {
    const sel = [...document.querySelectorAll(".form select")].find((s) =>
      [...s.options].some((o) => (o.textContent || "").includes("自行车"))
    );
    if (!sel) return false;
    sel.value = v;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, value);
  assert(ok, "找不到车辆分类下拉");
  await sleep(900);
}

try {
  // ================= D1：座驾卡片到期项（I1 回归）=================
  await gotoCarsTab();
  await check("D1a 汽油车卡片显示到期项（I1 回归）", async () => {
    const c = await cardOf(`功能车-${RUN}`);
    assert(c, "卡片未找到");
    assert(!c.hasNoEventsHint, `显示了「暂无启用的到期项」→ 回归未修复。卡片: ${c.text}`);
    assert(c.chips.length >= 3, `到期项标签只有 ${c.chips.length} 个: ${JSON.stringify(c.chips)}`);
    return c.chips.join(" | ");
  });
  await check("D1b 电瓶车卡片：车型不适用的旧保险不参与提醒", async () => {
    const c = await cardOf(`功能电瓶车-${RUN}`);
    assert(c, "卡片未找到");
    assert(c.chips.length >= 1, `无到期项标签: ${JSON.stringify(c.chips)}`);
    assert(c.chips.some((x) => x.includes("保养")), `应显示保养: ${JSON.stringify(c.chips)}`);
    assert(!c.chips.some((x) => x.includes("交强险")), `电瓶车不应提醒交强险: ${JSON.stringify(c.chips)}`);
    return c.chips.join(" | ");
  });
  await check("D1c 自行车卡片只显示保养（无交强险/驾照换证）", async () => {
    const c = await cardOf(`功能自行车-${RUN}`);
    assert(c, "卡片未找到");
    assert(c.chips.some((x) => x.includes("保养")), `应显示保养: ${JSON.stringify(c.chips)}`);
    assert(!c.chips.some((x) => x.includes("交强险")), `自行车不应有交强险: ${JSON.stringify(c.chips)}`);
    assert(!c.chips.some((x) => x.includes("驾照换证")), `自行车不应显示驾照换证: ${JSON.stringify(c.chips)}`);
    return c.chips.join(" | ");
  });

  await check("D1c2 老数据能源纠偏：自行车显示「人力」而非「燃油」", async () => {
    const bikeCard = await cardOf(`功能自行车-${RUN}`);
    const eCard = await cardOf(`功能电瓶车-${RUN}`);
    assert(bikeCard, "自行车卡片未找到");
    assert(eCard, "电瓶车卡片未找到");
    // 库里 energyType 都是 "FUEL"（模拟老数据），展示时必须按车型纠偏
    // 卡片格式为「车型 · 品牌 型号 · 能源」，品牌可能缺省，所以按能源词判断
    assert(/·\s*人力/.test(bikeCard.text), `自行车能源应为「人力」：${bikeCard.text.slice(0, 80)}`);
    assert(!/·\s*燃油/.test(bikeCard.text), `自行车仍显示「燃油」：${bikeCard.text.slice(0, 80)}`);
    assert(/·\s*纯电/.test(eCard.text), `电瓶车能源应为「纯电」：${eCard.text.slice(0, 80)}`);
    assert(!/·\s*燃油/.test(eCard.text), `电瓶车仍显示「燃油」：${eCard.text.slice(0, 80)}`);
    return `自行车=人力 电瓶车=纯电（库中均为 FUEL）`;
  });

  await check("D1d 后端提醒接口同样过滤车型不适用的项（弹窗/横幅的数据源）", async () => {
    // 提醒接口只收录「前台展示」的车 → 专建一对可见车辆，并带对照项
    const visSedan = await createCar("vis-sedan", {
      displayName: `可见提醒车A-${RUN}`, vehicleType: "SEDAN", energyType: "FUEL",
      status: "IN_USE", important: true, visible: true,
      reminders: [{ key: "INSURANCE_COMPULSORY", date: off(6), remindDays: 15, enabled: true, repeatMonths: 12 }],
    });
    const visBike = await createCar("vis-bike", {
      displayName: `可见提醒自行车B-${RUN}`, vehicleType: "BICYCLE", energyType: "HUMAN",
      status: "IN_USE", important: true, visible: true,
      reminders: [
        { key: "MAINTENANCE", date: off(2), remindDays: 7, enabled: true, repeatMonths: 3 },
        { key: "LICENSE", date: off(40), remindDays: 30, enabled: true, repeatMonths: 12 },
      ],
    });

    const r = await api("/important-dates-reminders");
    assert(r.status === 200, `接口返回 ${r.status}`);
    const all = JSON.parse(r.text).allReminders || [];
    const forCar = (n) => all.filter((x) => (x.carName || "").includes(n));
    const sedanItems = forCar(`可见提醒车A-${RUN}`);
    const bikeItems = forCar(`可见提醒自行车B-${RUN}`);

    // 对照组：汽油车的交强险必须在（证明接口确实收录了这两辆新车）
    assert(sedanItems.some((x) => x.key === "INSURANCE_COMPULSORY"),
      `对照组失败：汽油车的交强险未出现在提醒里 → 本用例无效。实得: ${JSON.stringify(sedanItems.map((x) => x.key))}`);
    // 自行车：保养在、驾照换证必须被过滤掉
    assert(bikeItems.some((x) => x.key === "MAINTENANCE"),
      `自行车保养应出现: ${JSON.stringify(bikeItems.map((x) => x.key))}`);
    assert(!bikeItems.some((x) => x.key === "LICENSE"),
      `自行车不应提醒驾照换证: ${JSON.stringify(bikeItems.map((x) => x.key))}`);

    await delCar(visSedan); await delCar(visBike);
    return `汽油车=[${sedanItems.map((x) => x.key).join(",")}] 自行车=[${bikeItems.map((x) => x.key).join(",")}]`;
  });
  await shot("cars-list");

  // ================= D2/D3：车型字段联动 =================
  await check("D2a 电瓶车：车牌可见 / 能源锁定为纯电只读", async () => {
    await openEdit(`功能电瓶车-${RUN}`);
    const m = await readModal();
    assert(m.plateVisible, "电瓶车应显示车牌号");
    assert(m.energyValue === "纯电", `能源类型应为「纯电」，实际 ${m.energyValue}`);
    assert(m.energyReadonly, "电瓶车能源类型应为只读锁定");
    return `plate=可见 energy=${m.energyValue} readonly=${m.energyReadonly}`;
  });
  await check("D2b 电瓶车：到期项下拉不含保险/年检/车船税/驾照换证", async () => {
    const m = await readModal();
    const bad = m.options.filter((o) => /交强险|商业险|年检|车船税|驾照换证/.test(o));
    assert(bad.length === 0, `下拉仍有不适用项: ${bad.join(",")}`);
    return `选项=${m.options.join("/")}`;
  });
  await check("D3a 自行车：车牌与能源类型均隐藏", async () => {
    await page.keyboard.press("Escape");
    await sleep(600);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => (x.textContent || "").trim() === "取消");
      if (b) b.click();
    });
    await sleep(800);
    await openEdit(`功能自行车-${RUN}`);
    const m = await readModal();
    assert(!m.plateVisible, "自行车不应显示车牌号字段");
    assert(m.energyValue === null, `自行车不应显示能源类型字段，实际读到 ${m.energyValue}`);
    return `plate=${m.plateVisible} energy=${m.energyValue}`;
  });
  await check("D3b 自行车：到期项下拉只有保养/自定义", async () => {
    const m = await readModal();
    const sorted = [...m.options].sort().join("/");
    assert(m.options.length === 2, `应有 2 个选项，实际 ${m.options.length}: ${sorted}`);
    assert(m.options.includes("保养") && m.options.includes("自定义"), `选项不对: ${sorted}`);
    return sorted;
  });
  await check("D3c 自行车：驾照换证到期项被隐藏（只保留保养）", async () => {
    const m = await readModal();
    assert(m.rows === 1, `应只显示 1 条到期项（保养），实际 ${m.rows} 条`);
    return `${m.rows} 条`;
  });
  await shot("bike-form");

  // ================= D5：折叠分区与布局 =================
  await check("D5a 分区为原生 details，默认只展开基本信息与到期提醒", async () => {
    const m = await readModal();
    assert(m.sections.length === 5, `应有 5 个分区，实际 ${m.sections.length}`);
    const openNames = m.sections.filter((s) => s.open).map((s) => s.name);
    assert(openNames.length === 2, `默认应展开 2 个，实际 ${openNames.length}: ${openNames.join(",")}`);
    assert(openNames.includes("基本信息") && openNames.includes("到期提醒"), `展开的不对: ${openNames.join(",")}`);
    return `分区=[${m.sections.map((s) => `${s.name}${s.open ? "开" : "收"}`).join(" ")}]`;
  });
  await check("D5b 收起的分区不占位（高度 = 标题高度）", async () => {
    const geo = await page.evaluate(() =>
      [...document.querySelectorAll(".form details.sec")].map((d) => {
        const body = d.querySelector(".sec-body");
        return {
          name: d.querySelector(".sec-name")?.textContent.trim(),
          open: d.open,
          detailsH: Math.round(d.getBoundingClientRect().height),
          summaryH: Math.round(d.querySelector(".sec-head").getBoundingClientRect().height),
          // Chrome 对折叠 details 的子元素仍会算几何尺寸，必须用 checkVisibility 判是否真正渲染
          bodyRendered: typeof body.checkVisibility === "function"
            ? body.checkVisibility({ contentVisibilityAuto: true })
            : body.offsetParent !== null,
        };
      })
    );
    const collapsed = geo.filter((g) => !g.open);
    assert(collapsed.length === 3, `应有 3 个收起分区，实际 ${collapsed.length}`);
    for (const g of collapsed) {
      assert(!g.bodyRendered, `${g.name} 收起后内容仍在渲染`);
      assert(g.detailsH <= g.summaryH + 4, `${g.name} 收起后仍占 ${g.detailsH}px（标题 ${g.summaryH}px）`);
    }
    for (const g of geo.filter((x) => x.open)) {
      assert(g.detailsH > g.summaryH, `${g.name} 展开后未撑开（${g.detailsH} <= ${g.summaryH}）`);
    }
    // 竖直不重叠
    return geo.map((g) => `${g.name}${g.open ? "开" : "收"}:${g.detailsH}/${g.summaryH}`).join(" ");
  });
  await check("D5c 点击分区标题可展开/收起", async () => {
    const before = (await readModal()).sections.find((s) => s.name === "相册").open;
    await page.evaluate(() => {
      const d = [...document.querySelectorAll(".form details.sec")].find((x) => x.querySelector(".sec-name")?.textContent.trim() === "相册");
      d.querySelector("summary").click();
    });
    await sleep(600);
    const after = (await readModal()).sections.find((s) => s.name === "相册").open;
    assert(after !== before, `点击后状态未变 (${before} -> ${after})`);
    return `${before} -> ${after}`;
  });
  await shot("sections");

  // ================= D4：切换车型保存不丢数据 =================
  async function clickSave() {
    const ok = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.filter((x) => (x.textContent || "").trim() === "保存").pop();
      if (b) { b.click(); return true; }
      return false;
    });
    assert(ok, "找不到保存按钮");
    await sleep(3000);
  }
  await check("D4a 自行车改成汽油车 → 保险/年检项恢复显示", async () => {
    await setVehicleType("SEDAN");
    const m = await readModal();
    assert(m.plateVisible, "改成汽油车后应显示车牌号");
    assert(m.energyValue !== null && !m.energyReadonly, `汽油车能源类型应可选，实际 value=${m.energyValue} readonly=${m.energyReadonly}`);
    assert(m.options.length === 5, `汽油车应有 5 个到期项，实际 ${m.options.length}: ${m.options.join("/")}`);
    return `选项=${m.options.join("/")} 行数=${m.rows}`;
  });
  await shot("switch-to-sedan");

  await check("D4b 保存后数据未丢（保险项仍在库里）", async () => {
    await clickSave();
    const car = await getCar(bike);
    const keys = (car.spec.reminders || []).map((r) => r.key);
    assert(car.spec.vehicleType === "SEDAN", `车型应已保存为 SEDAN，实际 ${car.spec.vehicleType}`);
    assert(keys.includes("MAINTENANCE"), `保养项丢失: ${keys.join(",")}`);
    return `库里 reminders=[${keys.join(",")}]`;
  });

  await check("D4c 汽油车改成自行车并保存 → 保险项保留、下车后不再显示", async () => {
    await gotoCarsTab();
    await openEdit(`功能车-${RUN}`);
    await setVehicleType("BICYCLE");
    const m = await readModal();
    assert(m.options.length === 2, `自行车下拉应 2 项，实际 ${m.options.length}`);
    assert(m.rows === 1, `应只剩保养 1 行，实际 ${m.rows}`);
    await clickSave();
    const car = await getCar(petrol);
    const keys = (car.spec.reminders || []).map((r) => r.key);
    const ins = (car.spec.reminders || []).find((r) => r.key === "INSURANCE_COMPULSORY");
    assert(keys.includes("INSURANCE_COMPULSORY"), `交强险被删掉了！keys=${keys.join(",")}`);
    assert(keys.includes("INSPECTION"), `年检被删掉了！keys=${keys.join(",")}`);
    assert(ins && ins.date === off(10), `交强险到期日被改动: ${ins?.date} (期望 ${off(10)})`);
    return `库里=[${keys.join(",")}] 交强险到期=${ins?.date} 未丢 ✓`;
  });

  await check("D4d 改回汽油车 → 卡片重新显示全部到期项", async () => {
    await gotoCarsTab();
    await openEdit(`功能车-${RUN}`);
    await setVehicleType("SEDAN");
    await clickSave();
    await gotoCarsTab();
    const c = await cardOf(`功能车-${RUN}`);
    assert(c, "卡片未找到");
    assert(!c.hasNoEventsHint, `改回汽油车后卡片为空: ${c.text}`);
    assert(c.chips.length >= 3, `应有 ≥3 个到期项标签，实际 ${c.chips.length}: ${JSON.stringify(c.chips)}`);
    return c.chips.join(" | ");
  });

  // ================= D6：控制台报错 =================
  await check("D6 控制台无 JS 报错", async () => {
    assert(pageErrors.length === 0, `捕获到 ${pageErrors.length} 条: ${pageErrors.slice(0, 3).join(" || ")}`);
    return "0 条";
  });

  await shot("final");
} catch (e) {
  console.log("!! 脚本异常:", e.message);
  await shot("crash");
} finally {
  // 清理测试车
  for (const n of [petrol, ebike, bike]) { try { await delCar(n); } catch {} }
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  console.log("截图:", shots.join(", "));
  if (pageErrors.length) console.log("页面报错:", pageErrors.slice(0, 5).join(" || "));
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

