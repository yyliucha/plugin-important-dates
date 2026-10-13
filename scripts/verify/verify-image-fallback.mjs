import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 验证「图片引用已失效」的降级与标记（1.2.5）：
//   ① 前台：失效封面回退车型图标、失效大头贴回退首字、相册失效图显示占位（访客永远看不到破图）
//   ② 后台：车辆卡片标「含失效图片 N」、人员卡片标「大头贴已失效」、相册行提示并可直接移除
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
      if (i.body && typeof i.body === "string") headers["Content-Type"] = "application/json";
      const res = await fetch(p, { ...i, headers });
      return { status: res.status, text: await res.text() };
    },
    path,
    init
  );

// ---------- 准备数据 ----------
const MISSING = `/upload/definitely-missing-${RUN}.png`;
const REAL_CAR = `car-imgfallback-real-${RUN}`;
const BROKEN_CAR = `car-imgfallback-broken-${RUN}`;
const BROKEN_PERSON = `person-imgfallback-${RUN}`;

const uploaded = await page.evaluate(async (run) => {
  const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
  const file = await new Promise((resolve) => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px sans-serif";
    ctx.fillText(`OK ${run}`, 40, 250);
    c.toBlob((b) => resolve(new File([b], `ok-${run}.png`, { type: "image/png" })), "image/png");
  });
  const fd = new FormData();
  fd.append("file", file);
  fd.append("policyName", "default-policy");
  const res = await fetch("/apis/api.console.halo.run/v1alpha1/attachments/upload", {
    method: "POST",
    headers: { "X-XSRF-TOKEN": xsrf },
    body: fd,
  });
  const body = await res.json();
  return { status: res.status, url: body?.status?.permalink };
}, RUN);
if (uploaded.status !== 200 || !uploaded.url) throw new Error(`上传测试图片失败: ${JSON.stringify(uploaded)}`);
const REAL_URL = uploaded.url;

async function createCar(name, displayName, photos) {
  const res = await api("/apis/importantdates.halo.run/v1alpha1/cars", {
    method: "POST",
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "Car",
      metadata: { name },
      spec: {
        displayName,
        vehicleType: "SUV",
        status: "IN_USE",
        visible: true,
        important: true,
        photos,
        reminders: [{ key: "INSURANCE_COMPULSORY", date: "2027-01-01", remindDays: 15, enabled: true, repeatMonths: 12 }],
      },
    }),
  });
  if (![200, 201].includes(res.status)) throw new Error(`建车失败 ${res.status}: ${res.text.slice(0, 160)}`);
}

// 车 A：一张正常图 + 一张失效图（封面是正常图）
await createCar(REAL_CAR, `混合图车-${RUN}`, [
  { url: REAL_URL, name: "ok", isCover: true, sortOrder: 0, frontVisible: true },
  { url: MISSING, name: "gone", isCover: false, sortOrder: 1, frontVisible: true },
]);
// 车 B：只有一张失效图（封面即失效）
await createCar(BROKEN_CAR, `失效图车-${RUN}`, [
  { url: MISSING, name: "gone-cover", isCover: true, sortOrder: 0, frontVisible: true },
]);
// 人员：大头贴失效
const personRes = await api("/apis/importantdates.halo.run/v1alpha1/persons", {
  method: "POST",
  body: JSON.stringify({
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Person",
    metadata: { name: BROKEN_PERSON },
    spec: { displayName: `失效头像-${RUN}`, dateType: "SOLAR", solarDate: "1990-01-01", avatar: MISSING, visible: true },
  }),
});
if (![200, 201].includes(personRes.status)) throw new Error(`建人员失败 ${personRes.status}`);

// 前台展示大头贴（默认关闭），才能验证前台降级
const CM = "/api/v1alpha1/configmaps/plugin-important-dates-configmap";
const setPrivacy = async (privacy) => {
  const cm = JSON.parse((await api(CM)).text);
  cm.data = cm.data || {};
  cm.data.privacy = JSON.stringify(privacy);
  const res = await api(CM, { method: "PUT", body: JSON.stringify(cm) });
  if (![200, 201].includes(res.status)) throw new Error(`写隐私设置失败 ${res.status}`);
  await new Promise((r) => setTimeout(r, 1500));
};
await setPrivacy({ showAvatar: true, showBirthday: false });

// ---------- 后台：标记 ----------
await page.goto(`${base}/console/important-dates`, { waitUntil: "domcontentloaded", timeout: 180000 });
await new Promise((r) => setTimeout(r, 9000));

await check("后台车辆卡片标出「含失效图片」", async () => {
  await page.evaluate(() => [...document.querySelectorAll("button.tab-btn")].find((b) => b.innerText.startsWith("座驾"))?.click());
  await new Promise((r) => setTimeout(r, 2500));
  const tags = await page.evaluate((run) => {
    const out = {};
    for (const card of document.querySelectorAll(".car-card")) {
      const name = (card.querySelector(".car-name")?.innerText || "").trim();
      const tag = [...card.querySelectorAll(".broken-tag")].map((t) => t.innerText.trim()).join(",");
      if (name.includes(run)) out[name.split("\n")[0]] = tag;
    }
    return out;
  }, String(RUN));
  const mixed = Object.entries(tags).find(([k]) => k.includes("混合图车"))?.[1] || "";
  const broken = Object.entries(tags).find(([k]) => k.includes("失效图车"))?.[1] || "";
  if (!mixed.includes("含失效图片")) throw new Error(`混合图车未标记: ${JSON.stringify(tags)}`);
  if (!broken.includes("含失效图片")) throw new Error(`失效图车未标记: ${JSON.stringify(tags)}`);
  await page.screenshot({ path: `${OUT_DIR}/ui-125-console-broken.png`, fullPage: false });
  return `混合图车=「${mixed}」/ 失效图车=「${broken}」`;
});

await check("后台人员卡片标出「大头贴已失效」", async () => {
  await page.evaluate(() => [...document.querySelectorAll("button.tab-btn")].find((b) => b.innerText.startsWith("人员"))?.click());
  await new Promise((r) => setTimeout(r, 2500));
  const found = await page.evaluate((run) => {
    for (const card of document.querySelectorAll(".person-card")) {
      if ((card.innerText || "").includes(`失效头像-${run}`)) {
        return {
          tag: [...card.querySelectorAll(".broken-tag")].map((t) => t.innerText.trim()).join(","),
          hasImg: !!card.querySelector("img.person-avatar"),
          hasChar: !!card.querySelector(".person-avatar-char"),
        };
      }
    }
    return null;
  }, String(RUN));
  if (!found) throw new Error("未找到该人员卡片");
  if (!found.tag.includes("大头贴已失效")) throw new Error(`未标记: ${JSON.stringify(found)}`);
  if (found.hasImg) throw new Error("失效头像仍在后台渲染 <img>（应为首字兜底）");
  return `标记=「${found.tag}」，后台已回退首字`;
});

await check("座驾表单相册行提示失效并可移除", async () => {
  await page.evaluate(() => [...document.querySelectorAll("button.tab-btn")].find((b) => b.innerText.startsWith("座驾"))?.click());
  await new Promise((r) => setTimeout(r, 2000));
  const opened = await page.evaluate((run) => {
    const card = [...document.querySelectorAll(".car-card")].find((c) => (c.innerText || "").includes(`失效图车-${run}`));
    if (!card) return false;
    [...card.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "编辑")?.click();
    return true;
  }, String(RUN));
  if (!opened) throw new Error("未找到「失效图车」或编辑按钮");
  await new Promise((r) => setTimeout(r, 2500));
  // 相册分区默认是收起的（<details>），收起时 innerText 取不到行内文案，先展开
  const expanded = await page.evaluate(async () => {
    const modal = [...document.querySelectorAll(".modal, [role='dialog'], .vc-modal")].find((m) => (m.innerText || "").includes("编辑座驾"));
    if (!modal) return { ok: false, why: "弹窗未找到" };
    const sec = [...modal.querySelectorAll("details.sec")].find((d) => (d.querySelector(".sec-name")?.innerText || "").includes("相册"));
    if (!sec) return { ok: false, why: "未找到相册分区" };
    sec.open = true;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { ok: sec.open, why: "" };
  });
  if (!expanded.ok) throw new Error(`相册分区未展开: ${expanded.why}`);
  await new Promise((r) => setTimeout(r, 800));
  const modalInfo = await page.evaluate(() => {
    const modal = [...document.querySelectorAll(".modal, [role='dialog'], .vc-modal")].find((m) => (m.innerText || "").includes("编辑座驾"));
    if (!modal) return null;
    const rows = [...modal.querySelectorAll(".album-item")];
    return {
      removeBrokenLabel: [...modal.querySelectorAll(".album-actions button")]
        .map((b) => (b.innerText || "").trim())
        .find((t) => t.includes("移除失效图片")) || "",
      rows: rows.map((r) => ({
        text: (r.innerText || "").replace(/\s+/g, " "),
        brokenThumb: !!r.querySelector(".thumb-broken"),
        hasImg: !!r.querySelector("img.thumb"),
      })),
    };
  });
  if (!modalInfo) throw new Error("弹窗未打开");
  const album = modalInfo.rows;
  if (!album?.length) throw new Error("相册为空或弹窗未打开");
  const broken = album.find((r) => r.brokenThumb);
  if (!broken) throw new Error(`未标记失效缩略图: ${JSON.stringify(album)}`);
  if (!broken.text.includes("图片已不可用")) throw new Error(`缺少说明文案: ${broken.text}`);
  if (broken.hasImg) throw new Error("失效图片仍渲染 <img>");
  if (!modalInfo.removeBrokenLabel) throw new Error("相册区没有「移除失效图片」按钮");
  return `${broken.text.slice(0, 40)}…；${modalInfo.removeBrokenLabel}`;
});

// ---------- 前台：降级渲染 ----------
await check("前台：封面失效回退车型图标（不显示破图）", async () => {
  await page.goto(`${base}/important-dates?view=car`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 6000));
  const state = await page.evaluate((run) => {
    const covers = [...document.querySelectorAll(".id-car-cover")];
    for (const cover of covers) {
      const card = cover.closest(".id-car-card") || cover.parentElement?.parentElement;
      if (!(card?.innerText || "").includes(`失效图车-${run}`)) continue;
      const img = cover.querySelector("img");
      const icon = cover.querySelector(".id-car-cover-icon");
      return {
        imgDisplay: img ? getComputedStyle(img).display : "no-img",
        imgSrc: img?.getAttribute("src") || "",
        iconDisplay: icon ? getComputedStyle(icon).display : "no-icon",
      };
    }
    return null;
  }, String(RUN));
  if (!state) throw new Error("未找到「失效图车」卡片");
  if (state.imgDisplay !== "none") throw new Error(`封面图未被隐藏: ${JSON.stringify(state)}`);
  if (state.iconDisplay === "none" || state.iconDisplay === "no-icon") {
    throw new Error(`车型图标未显示: ${JSON.stringify(state)}`);
  }
  await page.screenshot({ path: `${OUT_DIR}/ui-125-front-fallback.png`, fullPage: false });
  return `封面 img display=${state.imgDisplay}，图标 display=${state.iconDisplay}`;
});

await check("前台：大头贴失效回退首字", async () => {
  const state = await page.evaluate((run) => {
    const slots = [...document.querySelectorAll(".id-avatar-slot")];
    for (const slot of slots) {
      const img = slot.querySelector("img");
      if (!(img?.getAttribute("src") || "").includes("definitely-missing")) continue;
      const fallback = slot.querySelector(".id-memo-avatar");
      return {
        imgDisplay: getComputedStyle(img).display,
        fallbackDisplay: fallback ? getComputedStyle(fallback).display : "no-fallback",
        char: fallback?.textContent?.trim() || "",
      };
    }
    return null;
  }, String(RUN));
  if (!state) throw new Error("未找到失效大头贴的容器（可能前台未渲染该人员）");
  if (state.imgDisplay !== "none") throw new Error(`大头贴未隐藏: ${JSON.stringify(state)}`);
  if (state.fallbackDisplay === "none" || state.fallbackDisplay === "no-fallback") {
    throw new Error(`首字兜底未显示: ${JSON.stringify(state)}`);
  }
  return `img display=${state.imgDisplay}，首字=「${state.char}」`;
});

await check("前台：相册里的失效图显示占位说明", async () => {
  const clicked = await page.evaluate((run) => {
    const covers = [...document.querySelectorAll(".id-car-cover")];
    for (const cover of covers) {
      const card = cover.closest(".id-car-card") || cover.parentElement?.parentElement;
      if ((card?.innerText || "").includes(`混合图车-${run}`)) {
        cover.click();
        return true;
      }
    }
    return false;
  }, String(RUN));
  if (!clicked) throw new Error("未找到「混合图车」封面");
  await new Promise((r) => setTimeout(r, 1500));
  const album = await page.evaluate(() => {
    const open = [...document.querySelectorAll(".id-album")].find((a) => getComputedStyle(a).display !== "none" && a.classList.contains("id-album-open"));
    const target = open || [...document.querySelectorAll(".id-album")].find((a) => getComputedStyle(a).display !== "none");
    if (!target) return null;
    const broken = target.querySelector(".id-album-broken");
    const imgs = [...target.querySelectorAll("img")];
    return {
      brokenText: broken?.textContent?.trim() || "",
      hiddenImgs: imgs.filter((i) => getComputedStyle(i).display === "none").length,
      totalImgs: imgs.length,
    };
  });
  if (!album) throw new Error("相册浮层未打开");
  if (!album.brokenText.includes("图片已不可用")) throw new Error(`未显示占位说明: ${JSON.stringify(album)}`);
  return `${album.brokenText}（${album.hiddenImgs}/${album.totalImgs} 张已隐藏）`;
});

await setPrivacy({});
await check("控制台无脚本错误", async () => {
  if (errs.length) throw new Error(errs.slice(0, 3).join(" | "));
  return "无 pageerror";
});

await browser.close();
await new Promise((r) => setTimeout(r, 3000));
console.log(`\n===== 图片失效降级与标记: ${pass} PASS, ${fail} FAIL =====`);
process.exit(fail > 0 ? 1 : 0);

