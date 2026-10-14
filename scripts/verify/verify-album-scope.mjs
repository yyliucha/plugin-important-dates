import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 验证「附件库来源范围」修复（1.2.2）：座驾相册 / 人员大头贴都不再因为「分类 + 策略」同时不命中而显示空白
// 用法： node verify-album-scope.mjs [baseUrl]
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
      if (i.body && !(i.body instanceof FormData)) headers["Content-Type"] = "application/json";
      const res = await fetch(p, { ...i, headers });
      return { status: res.status, text: await res.text() };
    },
    path,
    init
  );

// ---------- 1. 准备数据：一个分组 + 3 张图片 ----------
const GROUP_NAME = `attachment-group-e2e${RUN}`;
await api("/apis/storage.halo.run/v1alpha1/groups", {
  method: "POST",
  body: JSON.stringify({
    apiVersion: "storage.halo.run/v1alpha1",
    kind: "Group",
    metadata: { name: GROUP_NAME },
    spec: { displayName: `E2E 分类 ${RUN}` },
  }),
});
const policies = JSON.parse((await api("/apis/storage.halo.run/v1alpha1/policies?page=1&size=10")).text);
const DEFAULT_POLICY = policies.items?.[0]?.metadata?.name || "default-policy";

const uploaded = await page.evaluate(
  async (groupName, policyName, run) => {
    const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
    const makeFile = (label, color) =>
      new Promise((resolve) => {
        const c = document.createElement("canvas");
        c.width = 240;
        c.height = 160;
        const ctx = c.getContext("2d");
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 240, 160);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 28px sans-serif";
        ctx.fillText(label, 16, 92);
        c.toBlob((b) => resolve(new File([b], `${label}.png`, { type: "image/png" })), "image/png");
      });
    const out = [];
    // 两张放进分组，一张不分组
    for (const [label, color, group] of [
      ["grouped-a", "#2563eb", groupName],
      ["grouped-b", "#16a34a", groupName],
      ["ungrouped", "#db2777", ""],
    ]) {
      const fd = new FormData();
      fd.append("file", await makeFile(`${label}-${run}`, color));
      fd.append("policyName", policyName);
      if (group) fd.append("groupName", group);
      const res = await fetch("/apis/api.console.halo.run/v1alpha1/attachments/upload", {
        method: "POST",
        headers: { "X-XSRF-TOKEN": xsrf },
        body: fd,
      });
      out.push(res.status);
    }
    return out;
  },
  GROUP_NAME,
  DEFAULT_POLICY,
  RUN
);
if (uploaded.some((s) => s >= 400)) throw new Error(`上传测试图片失败: ${uploaded.join(",")}`);

const CM = "/api/v1alpha1/configmaps/plugin-important-dates-configmap";
const setAttachment = async (obj) => {
  const cm = JSON.parse((await api(CM)).text);
  cm.data = cm.data || {};
  cm.data.attachment = JSON.stringify(obj);
  const res = await api(CM, { method: "PUT", body: JSON.stringify(cm) });
  if (![200, 201].includes(res.status)) throw new Error(`写入配置失败 HTTP ${res.status}: ${res.text.slice(0, 160)}`);
  await new Promise((r) => setTimeout(r, 1200));
};

// ---------- 2. 打开座驾弹窗的附件库 ----------
// 自己造一辆车来编辑，不依赖实例上"恰好存在"的车：
// 之前是优先找「E2E表单车」，找不到就退而取第一辆车 —— 实例上没有任何车时（例如刚清过
// 测试数据）整个套件会因为"未找到座驾卡片"直接挂掉，而失败原因和本用例要验证的东西无关。
const OWN_CAR = `car-albumscope-${RUN}`;
const ownCarRes = await api("/apis/importantdates.halo.run/v1alpha1/cars", {
  method: "POST",
  body: JSON.stringify({
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Car",
    metadata: { name: OWN_CAR },
    spec: {
      displayName: `相册用例车-${RUN}`,
      vehicleType: "SEDAN",
      status: "IN_USE",
      visible: true,
      important: true,
      photos: [],
      reminders: [],
    },
  }),
});
if (![200, 201].includes(ownCarRes.status)) {
  throw new Error(`创建相册用例车失败 ${ownCarRes.status}: ${ownCarRes.text.slice(0, 160)}`);
}

const openCarLibrary = async () => {
  await page.goto(`${base}/console/important-dates`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 8000));
  // 等卡片真的渲染出来再点：整套连着跑时实例比较慢，写死一个等待时间会随机失败
  let clicked = false;
  for (let i = 0; i < 20 && !clicked; i++) {
    clicked = await page.evaluate((carName) => {
      // 每次重试都确保「座驾」页签是激活的
      [...document.querySelectorAll("button.tab-btn")].find((b) => b.innerText.startsWith("座驾"))?.click();
      const card = [...document.querySelectorAll(".car-card")].find((c) => (c.innerText || "").includes(carName));
      if (!card) return false;
      const edit = [...card.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "编辑");
      if (!edit) return false;
      edit.click();
      return true;
    }, `相册用例车-${RUN}`);
    if (!clicked) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!clicked) throw new Error(`未找到座驾卡片（等了 20 秒，车名 相册用例车-${RUN}）`);
  await new Promise((r) => setTimeout(r, 2500));
  const opened = await page.evaluate(async () => {
    const modal = [...document.querySelectorAll(".modal, [role='dialog'], .vc-modal")].find((m) => (m.innerText || "").includes("编辑座驾"));
    if (!modal) return false;
    // 「从附件库选择」在相册分区里，而相册分区默认是收起的：先展开，否则按钮虽然
    // 在 DOM 里但不可见，直接点也会被当成"找不到"。
    const sec = [...modal.querySelectorAll("details.sec")].find((d) => (d.querySelector(".sec-name")?.innerText || "").includes("相册"));
    if (sec && !sec.open) {
      sec.open = true;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    const btn = [...(modal.querySelectorAll("button") || [])].find((b) => (b.innerText || "").trim() === "从附件库选择");
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!opened) throw new Error("未找到「从附件库选择」按钮");
  await new Promise((r) => setTimeout(r, 3500));
};

const readCarLibrary = () =>
  page.evaluate(() => {
    const panel = document.querySelector(".lib-panel");
    if (!panel) return null;
    return {
      hint: (panel.querySelector(".lib-group-hint")?.innerText || "").replace(/\s+/g, " "),
      scope: (panel.querySelector(".lib-scope-bar .hint")?.innerText || "").replace(/\s+/g, " "),
      items: [...panel.querySelectorAll(".lib-grid .lib-item")].map((i) => (i.innerText || "").trim()),
      empty: (panel.querySelector(".lib-empty")?.innerText || "").replace(/\s+/g, " "),
    };
  });

const closeLibrary = () =>
  page.evaluate(() => {
    [...document.querySelectorAll(".lib-panel .lib-close")].forEach((b) => b.click());
  });

// 场景 1：分类命中、策略不命中（复现用户现场：分类 + 策略同时命中 0 张）
await setAttachment({
  carGroupName: GROUP_NAME,
  carPolicyName: "attachment-policy-nonexistent",
  avatarGroupName: GROUP_NAME,
  avatarPolicyName: "attachment-policy-nonexistent",
});
await openCarLibrary();
await check("座驾相册：分类命中而策略不命中时放宽显示（不再空白）", async () => {
  const lib = await readCarLibrary();
  if (!lib) throw new Error("附件库浮层未打开");
  if (!lib.items.length) throw new Error(`仍然没有图片（hint=${lib.hint} empty=${lib.empty}）`);
  if (!lib.hint.includes("已放宽为仅按分类")) throw new Error(`未提示已放宽范围: ${lib.hint}`);
  if (!lib.hint.includes("命中")) throw new Error(`未显示命中数: ${lib.hint}`);
  return `${lib.items.length} 张；${lib.hint}`;
});
await closeLibrary();

// 场景 2：分类 = 未分组
await setAttachment({ carGroupName: "__ungrouped__", carPolicyName: "", avatarGroupName: "__ungrouped__", avatarPolicyName: "" });
await openCarLibrary();
await check("座驾相册：分类选「未分组」时按未分组过滤且可读", async () => {
  const lib = await readCarLibrary();
  if (!lib) throw new Error("附件库浮层未打开");
  if (!lib.items.length) throw new Error(`未分组下没有图片（hint=${lib.hint}）`);
  if (!lib.hint.includes("未分组")) throw new Error(`提示未显示「未分组」: ${lib.hint}`);
  return `${lib.items.length} 张；${lib.hint}`;
});
await closeLibrary();

// 场景 3：都不限定
await setAttachment({ carGroupName: "", carPolicyName: "", avatarGroupName: "", avatarPolicyName: "" });
await openCarLibrary();
await check("座驾相册：未配置来源时显示全部图片", async () => {
  const lib = await readCarLibrary();
  if (!lib) throw new Error("附件库浮层未打开");
  const scopeTotal = Number((lib.scope.match(/共\s*(\d+)\s*张/) || [])[1] || 0);
  if (!lib.items.length || lib.items.length !== scopeTotal) {
    throw new Error(`应显示全部 ${scopeTotal} 张，实际 ${lib.items.length}（hint=${lib.hint}）`);
  }
  if (!lib.hint.includes("不限定来源")) throw new Error(`提示应为不限定来源: ${lib.hint}`);
  return `全部 ${lib.items.length} 张；${lib.hint}`;
});
await closeLibrary();

// ---------- 3. 人员大头贴（同样路径） ----------
await setAttachment({
  carGroupName: "",
  carPolicyName: "",
  avatarGroupName: GROUP_NAME,
  avatarPolicyName: "attachment-policy-nonexistent",
});
await check("人员大头贴：分类命中而策略不命中时放宽显示且不空白", async () => {
  await page.goto(`${base}/console/important-dates`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 8000));
  await page.evaluate(() => [...document.querySelectorAll("button.tab-btn")].find((b) => b.innerText.startsWith("人员"))?.click());
  await new Promise((r) => setTimeout(r, 2500));
  const clicked = await page.evaluate(() => {
    const card = document.querySelector(".person-card") || [...document.querySelectorAll("div")].find((d) => (d.innerText || "").includes("编辑"));
    const btn = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "编辑");
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!clicked) throw new Error("未找到人员「编辑」按钮");
  await new Promise((r) => setTimeout(r, 2500));
  const opened = await page.evaluate(() => {
    const modal = [...document.querySelectorAll(".modal, [role='dialog'], .vc-modal")].find((m) => (m.innerText || "").includes("编辑人员"));
    const btn = [...(modal?.querySelectorAll("button") || [])].find((b) => (b.innerText || "").trim() === "从附件库选择");
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!opened) throw new Error("未找到人员弹窗的「从附件库选择」");
  await new Promise((r) => setTimeout(r, 3500));
  const lib = await page.evaluate(() => {
    const panel = document.querySelector(".lib-panel");
    if (!panel) return null;
    return {
      hint: (panel.querySelector(".lib-group-hint")?.innerText || "").replace(/\s+/g, " "),
      items: [...panel.querySelectorAll(".lib-grid .lib-item")].map((i) => (i.innerText || "").trim()),
      body: (panel.querySelector(".lib-body")?.innerText || "").replace(/\s+/g, " "),
    };
  });
  if (!lib) throw new Error("人员附件库浮层未打开");
  if (!lib.items.length) throw new Error(`人员附件库仍无图片（hint=${lib.hint} body=${lib.body.slice(0, 80)}）`);
  if (!lib.hint.includes("已放宽为仅按分类")) throw new Error(`未提示放宽: ${lib.hint}`);
  await page.screenshot({ path: `${OUT_DIR}/ui-122-person-album.png` });
  return `${lib.items.length} 张；${lib.hint}`;
});

await check("控制台无脚本错误", async () => {
  if (errs.length) throw new Error(errs.slice(0, 3).join(" | "));
  return "无 pageerror";
});

// 收尾：删掉本用例自己造的车，别把数据留给下一次运行
await api(`/apis/importantdates.halo.run/v1alpha1/cars/${OWN_CAR}`, { method: "DELETE" });

await browser.close();
await new Promise((r) => setTimeout(r, 3000));
console.log(`\n===== 附件库来源范围: ${pass} PASS, ${fail} FAIL =====`);
process.exit(fail > 0 ? 1 : 0);

