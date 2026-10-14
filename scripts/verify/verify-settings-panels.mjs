import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 设置页新增的两块自定义 UI（2.0.0）：
//   ① 自检卡片：必须能点、能出结论（组件注册失败会让整页渲染不出来，所以这条很关键）
//   ② 使用说明：折叠面板，默认收起，展开后有内容
// 同时确认这两个"不保存任何值"的输入项不会往配置里写垃圾键。
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
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"],
  defaultViewport: { width: 1500, height: 1100 },
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#username", { timeout: 30000 });
await page.type("#username", "admin");
await page.type("#plainPassword", "admin12345");
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 5000));

try {
  await check("S1 设置表单包含两个自定义输入项，且类型名已注册", async () => {
    const schema = await page.evaluate(async () => {
      const r = await fetch("/apis/api.console.halo.run/v1alpha1/plugins/plugin-important-dates/setting");
      const j = await r.json();
      const toast = (j.spec.forms || []).find((f) => f.group === "toast") || {};
      return (toast.formSchema || [])
        .filter((f) => String(f.$formkit || "").startsWith("idReminder"))
        .map((f) => f.$formkit);
    });
    assert(schema.includes("idReminderSelfCheck"), `缺少自检卡片: ${JSON.stringify(schema)}`);
    assert(schema.includes("idReminderHelp"), `缺少使用说明: ${JSON.stringify(schema)}`);
    return schema.join(" / ");
  });

  await check("S2 设置页能正常渲染（自定义组件注册失败会让整页挂掉）", async () => {
    await page.goto(`${base}/console/plugins/plugin-important-dates`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await new Promise((r) => setTimeout(r, 9000));
    // 设置按分组分页签，Halo 用的是 .tabbar-item 这类 div（不是 button/a），要点进去才渲染表单
    const clicked = await page.evaluate(() => {
      const el = [...document.querySelectorAll(".tabbar-item")]
        .find((b) => (b.innerText || "").trim() === "全站悬浮提醒");
      if (!el) return false;
      el.click();
      return true;
    });
    assert(clicked, "设置页上找不到「全站悬浮提醒」分组页签");
    await new Promise((r) => setTimeout(r, 7000));
    const state = await page.evaluate(() => {
      const text = document.body.innerText || "";
      return {
        hasSelfCheck: text.includes("提醒自检"),
        hasHelp: text.includes("使用说明与常见问题"),
        hasButton: [...document.querySelectorAll("button")].some((b) => (b.innerText || "").includes("开始检查")),
        // 表单本身也要在：输入项数量为 0 说明整块表单没渲染出来
        inputs: [...document.querySelectorAll("input,select,textarea")].length,
      };
    });
    assert(state.hasSelfCheck, `页面上没有「提醒自检」：${JSON.stringify(state)}`);
    assert(state.hasHelp, `页面上没有「使用说明」：${JSON.stringify(state)}`);
    assert(state.hasButton, "自检卡片里没有「开始检查」按钮（自定义组件可能没渲染出来）");
    assert(state.inputs > 0, `悬浮提醒分组里的普通设置项也没渲染出来（inputs=0）`);
    return `两块 UI 都在，同组还有 ${state.inputs} 个原生输入项`;
  });

  await check("S3 点「开始检查」能跑完并给出结论", async () => {
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").includes("开始检查"));
      if (!btn) return false;
      btn.click();
      return true;
    });
    assert(clicked, "找不到「开始检查」按钮");
    await new Promise((r) => setTimeout(r, 4000));
    const out = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const names = ["提醒接口", "服务端版本", "插件版本", "弹窗脚本"];
      return {
        found: names.filter((n) => text.includes(n)),
        // 结论行里应出现版本号，证明真的跑到了
        mentionsVersion: /2\.0\.0/.test(text),
      };
    });
    assert(out.found.length >= 3, `自检没有输出足够的结果项：${JSON.stringify(out)}`);
    assert(out.mentionsVersion, `自检结果里没看到服务端版本号：${JSON.stringify(out)}`);
    await page.screenshot({ path: `${OUT_DIR}/ui-200-selfcheck.png`, fullPage: false });
    return `检查项：${out.found.join("、")}`;
  });

  await check("S4 使用说明默认收起、点开后能看到内容", async () => {
    const before = await page.evaluate(() => (document.body.innerText || "").includes("三步就能用起来"));
    assert(!before, "使用说明默认应该是收起的");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => (b.innerText || "").includes("使用说明与常见问题"));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const after = await page.evaluate(() => {
      const t = document.body.innerText || "";
      return {
        steps: t.includes("三步就能用起来"),
        trouble: t.includes("提醒没出现怎么办"),
        data: t.includes("数据在哪"),
      };
    });
    assert(after.steps, "展开后没有「三步就能用起来」");
    assert(after.trouble, "展开后没有「提醒没出现怎么办」");
    assert(after.data, "展开后没有「数据在哪」");
    await page.screenshot({ path: `${OUT_DIR}/ui-200-help.png`, fullPage: false });
    return "收起 → 展开正常，含排障与数据说明";
  });

  await check("S5 这两个输入项不往插件配置里写垃圾键", async () => {
    const keys = await page.evaluate(async () => {
      const r = await fetch("/api/v1alpha1/configmaps/plugin-important-dates-configmap");
      const j = await r.json();
      return Object.keys(JSON.parse((j.data || {}).toast || "{}"));
    });
    const junk = keys.filter((k) => /^_|selfCheck|help/i.test(k));
    assert(!junk.length, `配置里出现了不该保存的键: ${JSON.stringify(junk)}`);
    return `toast 分组键：${keys.join(", ")}`;
  });

  await check("S6 设置页没有脚本错误", async () => {
    const real = pageErrors.filter((e) => !/ResizeObserver|Script error/i.test(e));
    assert(!real.length, real.slice(0, 3).join(" | "));
    return "无 pageerror";
  });
} finally {
  await browser.close();
  console.log(`\n===== 设置页自检与帮助（2.0.0）: ${pass} PASS, ${fail} FAIL =====`);
  process.exit(fail > 0 ? 1 : 0);
}
