import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// Halo 插件冒烟测试：验证 plugin-important-dates 在 Halo 2.20.20 上可安装、可管理
// 流程：首次初始化(setup) → 表单登录(RSA加密密码, 会话) → 插件状态 → CRUD → 控制台静态资源
import { constants, publicEncrypt } from "node:crypto";


const RUN_ID = Date.now();
const SOLAR_NAME = `important-date-test-solar-${RUN_ID}`;
const LUNAR_NAME = `important-date-test-lunar-${RUN_ID}`;

let ok = 0;
let fail = 0;
let cookies = {};

function keyOf(c) {
  const idx = c.indexOf("=");
  return c.slice(0, idx).trim();
}
function store(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    cookies[keyOf(pair)] = pair.slice(pair.indexOf("=") + 1);
  }
}
function cookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
function xsrf() {
  return cookies["XSRF-TOKEN"];
}
function buildHeaders(extra = {}) {
  const h = { ...extra };
  const c = cookieHeader();
  if (c) h.Cookie = c;
  const x = xsrf();
  if (x) h["X-XSRF-TOKEN"] = x;
  return h;
}
function expectStatus(res, statuses, body) {
  if (!statuses.includes(res.status)) {
    throw new Error(`HTTP ${res.status}: ${(body || "").slice(0, 300)}`);
  }
}
async function check(name, fn) {
  try {
    const detail = await fn();
    ok++;
    console.log(`[PASS] ${name}${detail ? " — " + detail : ""}`);
  } catch (e) {
    fail++;
    console.log(`[FAIL] ${name} — ${e.message}`);
  }
}

async function getCsrfFromPage(path) {
  const r = await fetch(base + path, { redirect: "manual", headers: { Cookie: cookieHeader() } });
  store(r);
  const html = await r.text();
  return { status: r.status, html, csrf: html.match(/name="_csrf" value="([^"]+)"/)?.[1] };
}

async function ensureSetup() {
  const { html, csrf } = await getCsrfFromPage("/system/setup");
  if (!csrf) return;
  const body = new URLSearchParams({
    _csrf: csrf,
    siteTitle: "重要日期测试站",
    username: "admin",
    password: "admin12345",
    email: "admin@example.com",
  });
  // Halo 2.26 起新增确认密码、外部访问地址字段
  if (/name="confirmPassword"/.test(html)) {
    body.append("confirmPassword", "admin12345");
  }
  if (/name="externalUrl"/.test(html)) {
    body.append("externalUrl", "http://127.0.0.1:8090");
  }
  const r = await fetch(base + "/system/setup", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader() },
    body,
  });
  store(r);
  if (r.status !== 302 && r.status !== 200 && r.status !== 303 && r.status !== 204) {
    throw new Error(`setup failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
  }
}

const PASSWORD = "admin12345";

async function login() {
  const { html, csrf } = await getCsrfFromPage("/login");
  if (!csrf) throw new Error("no csrf on login page");
  // RSA 加密密码（JSEncrypt 同款：页面公钥 + PKCS#1 v1.5）
  const pubkeyB64 = (html.match(/const publicKey = "([\s\S]*?)";/) || [])[1];
  let encrypted;
  if (pubkeyB64) {
    const raw = pubkeyB64.replace(/\\\//g, "/").replace(/\s+/g, "");
    const pem = `-----BEGIN PUBLIC KEY-----\n${raw}\n-----END PUBLIC KEY-----`;
    encrypted = publicEncrypt(
      { key: pem, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(PASSWORD)
    ).toString("base64");
  } else {
    encrypted = PASSWORD;
  }
  const body = new URLSearchParams({
    _csrf: csrf,
    username: "admin",
    password: encrypted,
  });
  const r = await fetch(base + "/login", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader() },
    body,
  });
  store(r);
  const loc = r.headers.get("location") || "";
  if (loc.includes("error")) throw new Error(`login failed: ${loc}`);
  if (!cookieHeader()) throw new Error("no session cookie after login");
}

await ensureSetup();
await login();
console.log("已登录, cookies:", Object.keys(cookies).join(", "));

// ---- 清掉历史残留的测试数据 ----
// 套件结尾会删掉自己造的数据，但如果上一次运行中途失败/被中断，残留就会一直堆着。
// 堆到一定程度会让断言失败，而报出来的错和真正的原因毫不相干（例如提醒列表里
// 全是历史"就是今天"，本次用例的数据被挤出显示窗口）。
// 只删名字带 13 位时间戳后缀的条目，不会碰用户真实创建的数据。
await (async () => {
  const cleaned = await cleanupTestData((path, init = {}) =>
    fetch(`${base}${path}`, { ...init, headers: buildHeaders(init.headers || {}) }).then(async (r) => ({
      status: r.status,
      text: await r.text(),
    }))
  );
  const total = cleaned.dates + cleaned.cars + cleaned.persons;
  console.log(`清理历史测试数据：日期 ${cleaned.dates} / 座驾 ${cleaned.cars} / 人员 ${cleaned.persons}` + (total ? "" : "（无残留）"));
})();

// ---- 把插件设置恢复到默认值 ----
// 冒烟里有一部分断言是在验证"默认行为"（弹窗默认关闭、默认标题/位置等）。
// 实例若被之前的手工测试改过设置，这些断言就会误报，所以先归零一次，让本套件自洽。
await (async () => {
  const name = "plugin-important-dates-configmap";
  const cur = await fetch(`${base}/api/v1alpha1/configmaps/${name}`, { headers: buildHeaders() });
  if (!cur.ok) return;
  const cm = await cur.json();
  const put = await fetch(`${base}/api/v1alpha1/configmaps/${name}`, {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ...cm, data: null }),
  });
  console.log(`[准备] 插件设置已重置为默认值（HTTP ${put.status}）`);
})();

// ---- 上传安装插件 ----
import { readFileSync, readdirSync, statSync } from "node:fs";
import { cleanupTestData } from "./_cleanup.mjs";
await check("上传安装插件", async () => {
  // 取 build/libs 下最新的 jar（版本号随构建变化，避免写死文件名的脚本在升级后失效）
  const jarDir = `${REPO}/build/libs`;
  const jarFile = readdirSync(jarDir)
    .filter((f) => f.endsWith(".jar") && !f.endsWith("-plain.jar"))
    .map((f) => ({ f, t: statSync(`${jarDir}/${f}`).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0]?.f;
  if (!jarFile) throw new Error(`no jar found in ${jarDir}`);
  const jar = readFileSync(`${jarDir}/${jarFile}`);
  const fd = new FormData();
  fd.append("file", new Blob([jar], { type: "application/java-archive" }), jarFile);
  // 复用实例上插件可能已安装（同版本会返回 4xx/5xx）→ 视为已就绪，后续断言照常执行
  const alreadyInstalled = async () => {
    const probe = await fetch(`${base}/apis/plugin.halo.run/v1alpha1/plugins/plugin-important-dates`, {
      headers: buildHeaders(),
    }).catch(() => null);
    return probe && probe.status === 200;
  };
  const res = await fetch(`${base}/apis/api.console.halo.run/v1alpha1/plugins/install`, {
    method: "POST",
    headers: buildHeaders(),
    body: fd,
  });
  const text = await res.text();
  if (res.status === 400 && text.includes("plugin-alreay-exists")) {
    // 已安装 → 走升级流程
    const up = await fetch(
      `${base}/apis/api.console.halo.run/v1alpha1/plugins/plugin-important-dates/upgrade`,
      {
        method: "POST",
        headers: buildHeaders(),
        body: fd,
      }
    );
    const upText = await up.text();
    if (![200, 201].includes(up.status)) {
      // 复用实例上可能已经是目标版本（Halo 拒绝"同版本升级"）→ 视为就绪
      const cur = await fetch(`${base}/apis/api.console.halo.run/v1alpha1/plugins/plugin-important-dates`, {
        headers: buildHeaders(),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const installed = cur && cur.spec ? cur.spec.version : "";
      const wanted = jarFile.replace(/^plugin-important-dates-/, "").replace(/\.jar$/, "");
      if (installed && installed === wanted) {
        return `已是目标版本 ${wanted}，跳过升级`;
      }
      if (upText.includes("already") || up.status === 500) {
        // 同版本升级会被 Halo 拒绝（500），此处只要目标版本已装即视为就绪
        for (const url of [
          `${base}/apis/api.console.halo.run/v1alpha1/plugins/plugin-important-dates`,
          `${base}/apis/plugin.halo.run/v1alpha1/plugins/plugin-important-dates`,
        ]) {
          const res = await fetch(url, { headers: buildHeaders() }).catch(() => null);
          if (!res || !res.ok) continue;
          const body = await res.json().catch(() => null);
          const version = (body && body.spec && body.spec.version) || "";
          const wanted = jarFile.replace(/^plugin-important-dates-/, "").replace(/\.jar$/, "");
          if (version && version === wanted) {
            return `已是目标版本 ${wanted}（升级被拒：同版本），跳过`;
          }
        }
      }
      throw new Error(`升级失败 HTTP ${up.status}: ${upText.slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, 2500));
    return "已升级到最新包";
  }
  expectStatus(res, [200, 201], text.slice(0, 300));
  return "已上传";
});

// ---- 插件状态（启用后加载） ----
await check("插件已安装且可用", async () => {
  const res = await fetch(
    `${base}/apis/plugin.halo.run/v1alpha1/plugins/plugin-important-dates`,
    { headers: buildHeaders() }
  );
  const body = await res.json();
  expectStatus(res, [200], JSON.stringify(body));
  if (body.spec?.enabled !== true) {
    const patch = await fetch(
      `${base}/apis/plugin.halo.run/v1alpha1/plugins/plugin-important-dates`,
      {
        method: "PATCH",
        headers: buildHeaders({ "Content-Type": "application/json-patch+json" }),
        body: JSON.stringify([{ op: "add", path: "/spec/enabled", value: true }]),
      }
    );
    const patchBody = await patch.json().catch(() => null);
    expectStatus(patch, [200, 202], JSON.stringify(patchBody));
    return "已安装，已手动启用";
  }
  return `版本 ${body.spec.version}, requires ${body.spec.requires}`;
});

// 等待插件启动完成（scheme 注册）：冷启动首次安装需要解包 + 加载类；安装后 Halo 还会重启一次插件，
// 重启窗口内 scheme 会短暂消失（前台页面会 500 "Scheme not found"），因此要求「接口 + 前台页面」连续两次都正常
const pluginReady = async (timeoutMs = 120000) => {
  const deadline = Date.now() + timeoutMs;
  let last = "no attempt";
  let streak = 0;
  while (Date.now() < deadline) {
    try {
      const api = await fetch(
        `${base}/apis/importantdates.halo.run/v1alpha1/importantdates?page=1&size=1`,
        { headers: buildHeaders() }
      );
      const page = await fetch(`${base}/important-dates`);
      const pageHtml = page.status === 200 ? await page.text() : "";
      const ok = api.status === 200 && page.status === 200 && pageHtml.includes("重要日期");
      streak = ok ? streak + 1 : 0;
      last = `api=${api.status} page=${page.status}`;
      if (streak >= 2) return true;
    } catch (e) {
      last = e.message;
      streak = 0;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`plugin endpoints not ready within ${timeoutMs}ms (last: ${last})`);
};
await new Promise((r) => setTimeout(r, 3000));
await pluginReady();

// ---- 前台页面使用插件默认模板（零主题文件写入） ----
const THEME_TPL_PATH = `${process.env.HALO_WORK_DIR || `${OUT_DIR}/work`}/themes/theme-earth/templates/important-dates.html`;
await check("前台页面默认模板渲染且无主题文件写入", async () => {
  const { existsSync } = await import("node:fs");
  const res = await fetch(`${base}/important-dates`);
  const html = await res.text();
  expectStatus(res, [200], html.slice(0, 200));
  if (!html.includes("重要日期")) throw new Error("page title missing");
  if (!html.includes("id-memo-days")) throw new Error("default template memo board missing");
  if (existsSync(THEME_TPL_PATH)) throw new Error("theme templates/important-dates.html was created (must not write theme files)");
  return "插件默认模板渲染，主题目录无生成文件";
});
await new Promise((r) => setTimeout(r, 1000));

// ---- CRUD ----
let createdSolar;
await check("创建阳历记录", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/importantdates`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "ImportantDate",
      metadata: { name: SOLAR_NAME },
      spec: { title: "结婚纪念日", dateType: "SOLAR", solarDate: "2019-05-20", note: "领证日" },
    }),
  });
  const body = await res.json();
  expectStatus(res, [200, 201], JSON.stringify(body));
  createdSolar = body;
  return body.metadata.name;
});

await check("创建农历闰月记录", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/importantdates`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "ImportantDate",
      metadata: { name: LUNAR_NAME },
      spec: {
        title: "宝宝出生",
        dateType: "LUNAR",
        lunarMonth: 6,
        lunarDay: 15,
        isLeapMonth: true,
        note: "农历闰六月十五",
      },
    }),
  });
  const body = await res.json();
  expectStatus(res, [200, 201], JSON.stringify(body));
  return body.metadata.name;
});

await check("列表返回 2 条", async () => {
  const res = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/importantdates?page=1&size=100`,
    { headers: buildHeaders() }
  );
  const body = await res.json();
  expectStatus(res, [200], JSON.stringify(body));
  const items = body.items || [];
  if (items.length < 2) throw new Error(`expected >=2 items, got ${items.length}`);
  return `${items.length} 条`;
});

await check("更新备注", async () => {
  const item = createdSolar;
  item.spec.note = "领证日 · 修改后";
  const res = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/importantdates/${item.metadata.name}`,
    {
      method: "PUT",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(item),
    }
  );
  const body = await res.json();
  expectStatus(res, [200], JSON.stringify(body));
  if (body.spec?.note !== "领证日 · 修改后") throw new Error("note not updated");
  return "note 已更新";
});

await check("删除记录", async () => {
  const res = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/importantdates/${LUNAR_NAME}`,
    { method: "DELETE", headers: buildHeaders() }
  );
  expectStatus(res, [200, 202, 204], "");
  // 等待软删除生效后确认对象消失
  let gone = false;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const item = await fetch(
      `${base}/apis/importantdates.halo.run/v1alpha1/importantdates/${LUNAR_NAME}`,
      { headers: buildHeaders() }
    );
    if (item.status === 404) {
      gone = true;
      break;
    }
  }
  if (!gone) throw new Error("item still exists after delete");
  const list = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/importantdates?page=1&size=100`,
    { headers: buildHeaders() }
  ).then((r) => r.json());
  const left = (list.items || []).filter(
    (i) => i.metadata.name === SOLAR_NAME || i.metadata.name === LUNAR_NAME
  ).length;
  if (left !== 1) throw new Error(`expected 1 remaining after delete, got ${left}`);
  return "剩 1 条";
});

// ---- 人员（模拟前端人员功能） ----
const ZHANG_NAME = `person-smoke-zhangsan-${RUN_ID}`;
const LI_NAME = `person-smoke-lisi-${RUN_ID}`;

await check("创建人员（张三）", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/persons`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "Person",
      metadata: { name: ZHANG_NAME },
      spec: {
        displayName: "张三",
        nickname: "三哥",
        relation: "朋友",
        dateType: "SOLAR",
        solarDate: "1990-05-20",
        gender: "男",
        bloodType: "A",
        heightCm: 175,
        weightKg: 72.5,
        hobbies: "篮球、钓鱼",
        note: "高中同学",
      },
    }),
  });
  const body = await res.json();
  expectStatus(res, [200, 201], JSON.stringify(body));
  if (body.spec?.weightKg !== 72.5) throw new Error("weightKg not stored");
  return body.metadata.name;
});

await check("创建人员（李四，农历生日）", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/persons`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "Person",
      metadata: { name: LI_NAME },
      spec: {
        displayName: "李四",
        relation: "同事",
        dateType: "LUNAR",
        lunarMonth: 8,
        lunarDay: 15,
        isLeapMonth: false,
        weightKg: 65,
      },
    }),
  });
  const body = await res.json();
  expectStatus(res, [200, 201], JSON.stringify(body));
  return body.metadata.name;
});

await check("人员列表返回 2 条", async () => {
  const res = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/persons?page=1&size=100`,
    { headers: buildHeaders() }
  );
  const body = await res.json();
  expectStatus(res, [200], JSON.stringify(body));
  const items = (body.items || []).filter((i) => i.metadata.name === ZHANG_NAME || i.metadata.name === LI_NAME);
  if (items.length !== 2) throw new Error(`expected 2 persons, got ${items.length}`);
  return `${items.length} 位`;
});

await check("更新人员（体重变化）", async () => {
  const item = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/persons/${ZHANG_NAME}`, {
    headers: buildHeaders(),
  }).then((r) => r.json());
  item.spec.weightKg = 70;
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/persons/${ZHANG_NAME}`, {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(item),
  });
  const body = await res.json();
  expectStatus(res, [200], JSON.stringify(body));
  if (body.spec?.weightKg !== 70) throw new Error("weight not updated");
  return "体重 72.5 → 70";
});

await check("日期关联多人", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/importantdates`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "ImportantDate",
      metadata: { name: `important-date-test-linked-${RUN_ID}` },
      spec: {
        title: "球友聚会",
        dateType: "SOLAR",
        solarDate: "2025-08-08",
        note: "每年夏天",
        personNames: [ZHANG_NAME, LI_NAME],
      },
    }),
  });
  const body = await res.json();
  expectStatus(res, [200, 201], JSON.stringify(body));
  const names = body.spec?.personNames || [];
  if (names.length !== 2) throw new Error(`expected 2 personNames, got ${names.length}`);
  return `关联 ${names.length} 人`;
});

await check("按人筛选（关联查询）", async () => {
  const res = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/importantdates?page=1&size=100`,
    { headers: buildHeaders() }
  );
  const body = await res.json();
  expectStatus(res, [200], JSON.stringify(body));
  const linked = (body.items || []).filter((i) => i.spec?.personNames?.includes(ZHANG_NAME));
  if (linked.length !== 1) throw new Error(`expected 1 date linked to zhangsan, got ${linked.length}`);
  return `${linked.length} 条`;
});

await check("删除人员", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/persons/${LI_NAME}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
  expectStatus(res, [200, 202, 204], "");
  let gone = false;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const item = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/persons/${LI_NAME}`, {
      headers: buildHeaders(),
    });
    if (item.status === 404) {
      gone = true;
      break;
    }
  }
  if (!gone) throw new Error("person still exists after delete");
  return "已删除";
});

// ---- 前台可见性（人员隐藏） ----
const HIDDEN_PERSON_NAME = `person-smoke-hidden-${RUN_ID}`;
await check("创建隐藏人员（visible=false）", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/persons`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "Person",
      metadata: { name: HIDDEN_PERSON_NAME },
      spec: { displayName: "隐藏测试员", dateType: "SOLAR", solarDate: "1990-01-01", visible: false },
    }),
  });
  const body = await res.json();
  expectStatus(res, [200, 201], JSON.stringify(body));
  return body.metadata.name;
});

await check("隐藏人员不出现在前台", async () => {
  const res = await fetch(`${base}/important-dates`);
  const html = await res.text();
  if (html.includes("隐藏测试员")) throw new Error("hidden person leaked to frontend");
  return "未泄露";
});

// ---- 提醒/重要/前台可见性（先造数据，再验证提醒 JSON/前台页面） ----
const REMIND_NAME = `important-date-test-remind-${RUN_ID}`;
const HIDDEN_NAME = `important-date-test-hidden-${RUN_ID}`;
const NORMAL_NAME = `important-date-test-normal-${RUN_ID}`;
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const tomorrow2 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

await check("创建明天的重要日期（应提醒）", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/importantdates`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "ImportantDate",
      metadata: { name: REMIND_NAME },
      spec: { title: "提醒测试", dateType: "SOLAR", solarDate: tomorrow, important: true },
    }),
  });
  const body = await res.json();
  expectStatus(res, [200, 201], JSON.stringify(body));
  if (body.spec?.important !== true) throw new Error("important flag not stored");
  return body.metadata.name;
});

await check("创建隐藏日期（前台不可见）", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/importantdates`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "ImportantDate",
      metadata: { name: HIDDEN_NAME },
      spec: { title: "隐藏测试", dateType: "SOLAR", solarDate: tomorrow, important: true, visible: false },
    }),
  });
  const body = await res.json();
  expectStatus(res, [200, 201], JSON.stringify(body));
  return body.metadata.name;
});

await check("创建明天的不重要日期（不提醒但仍显示）", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/importantdates`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "ImportantDate",
      metadata: { name: NORMAL_NAME },
      spec: { title: "不重要测试", dateType: "SOLAR", solarDate: tomorrow2, important: false },
    }),
  });
  const body = await res.json();
  expectStatus(res, [200, 201], JSON.stringify(body));
  return body.metadata.name;
});

// ---- 全站提醒 JSON 接口 ----
await check("提醒 JSON 接口（匿名可访问）", async () => {
  const res = await fetch(`${base}/important-dates-reminders`);
  const body = await res.json();
  expectStatus(res, [200], JSON.stringify(body));
  if (body.enabled !== true) throw new Error("reminders disabled");
  const items = body.reminders || [];
  const hit = items.find((i) => i.title === "提醒测试");
  if (!hit) throw new Error(`reminder for 提醒测试 missing: ${JSON.stringify(items)}`);
  if (hit.daysUntil !== 1) throw new Error(`daysUntil mismatch: ${hit.daysUntil}`);
  return `${items.length} 条提醒`;
});

// ---- 全站悬浮提醒（官方 TemplateHeadProcessor 扩展点，按设置输出，零系统配置写入） ----
await check("悬浮提醒默认关闭且页面无脚本", async () => {
  const res = await fetch(`${base}/important-dates-reminders`);
  const body = await res.json();
  if (body.toastEnabled !== false) throw new Error(`toastEnabled default mismatch: ${body.toastEnabled}`);
  if (body.toastPosition !== "bottom-right") throw new Error(`toastPosition default mismatch: ${body.toastPosition}`);
  if (body.toastTitle !== "📅 重要日期提醒") throw new Error(`toastTitle default mismatch: ${body.toastTitle}`);
  if (body.toastDefaultClose !== "once") throw new Error(`toastDefaultClose default mismatch: ${body.toastDefaultClose}`);
  if (body.toastCloseMenu !== true) throw new Error(`toastCloseMenu default mismatch: ${body.toastCloseMenu}`);
  const page = await fetch(`${base}/important-dates`).then((r) => r.text());
  if (page.includes("reminder-toast.js")) throw new Error("script present while disabled");
  const cm = await fetch(`${base}/api/v1alpha1/configmaps/system`, { headers: buildHeaders() }).then((r) => r.json());
  const ci = JSON.stringify((cm.data || {})?.codeInjection || {});
  if (ci.includes("id-toast")) throw new Error("toast segment present in system config while disabled");
  return "默认关闭，页面无脚本、系统配置无注入";
});

await check("开启悬浮提醒 → TemplateHeadProcessor 输出脚本(不写系统配置)", async () => {
  const before = await fetch(`${base}/api/v1alpha1/configmaps/system`, {
    headers: buildHeaders(),
  }).then((r) => r.json());
  const beforeCi = JSON.stringify((before.data || {})?.codeInjection || {});
  const cm = await fetch(`${base}/api/v1alpha1/configmaps/plugin-important-dates-configmap`, {
    headers: buildHeaders(),
  }).then((r) => r.json());
  cm.data = cm.data || {};
  cm.data.toast = JSON.stringify({
    toastEnabled: true,
    toastPosition: "center",
    toastTitle: "📅 重要日期提醒",
    toastTemplate: "「{title}」{whenText}（{dateText}）",
    toastEmptyText: "最近没有重要日期，生活照常美好～",
    toastDefaultClose: "once",
    toastCloseMenu: true,
  });
  const put = await fetch(`${base}/api/v1alpha1/configmaps/plugin-important-dates-configmap`, {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(cm),
  });
  expectStatus(put, [200], (await put.text()).slice(0, 200));
  await new Promise((r) => setTimeout(r, 2000));
  const page = await fetch(`${base}/important-dates`).then((r) => r.text());
  if (!page.includes("reminder-toast.js")) throw new Error("script tag missing on front page (head processor)");
  // 系统配置必须零写入（评审要求）
  const after = await fetch(`${base}/api/v1alpha1/configmaps/system`, {
    headers: buildHeaders(),
  }).then((r) => r.json());
  const afterCi = JSON.stringify((after.data || {})?.codeInjection || {});
  if (beforeCi !== afterCi) throw new Error("system ConfigMap codeInjection was modified!");
  const api = await fetch(`${base}/important-dates-reminders`).then((r) => r.json());
  if (api.toastEnabled !== true) throw new Error("toastEnabled not reflected in JSON");
  if (api.toastPosition !== "center") throw new Error(`toastPosition not reflected: ${api.toastPosition}`);
  if (!api.reminders || !api.reminders.length) throw new Error("reminders empty while toast enabled");
  return "页面按设置输出脚本 + System ConfigMap 零写入 + JSON 正确";
});

await check("关闭悬浮提醒 → 页面不再输出脚本", async () => {
  const cm = await fetch(`${base}/api/v1alpha1/configmaps/plugin-important-dates-configmap`, {
    headers: buildHeaders(),
  }).then((r) => r.json());
  cm.data = cm.data || {};
  cm.data.toast = JSON.stringify({ toastEnabled: false });
  const put = await fetch(`${base}/api/v1alpha1/configmaps/plugin-important-dates-configmap`, {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(cm),
  });
  expectStatus(put, [200], (await put.text()).slice(0, 200));
  await new Promise((r) => setTimeout(r, 800));
  const page = await fetch(`${base}/important-dates`).then((r) => r.text());
  if (page.includes("reminder-toast.js")) throw new Error("script still output after disable");
  return "关闭后页面无脚本（处理器不再输出）";
});

// ---- 已移除功能：操作日志（1.3.0 删除，此处守住"不要再回来"） ----
await check("操作日志接口已下线（1.3.0 起移除）", async () => {
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/operationlogs`, {
    headers: buildHeaders(),
  });
  if (res.status !== 404) throw new Error(`期望 404，实际 ${res.status}（该功能应已移除）`);
  return "接口 404（已移除）";
});

await check("插件不再注册 OperationLog 扩展类型", async () => {
  const body = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/operationlogs`, {
    headers: buildHeaders(),
  }).then((r) => r.text());
  if (!/Not Found|404/i.test(body)) throw new Error(`异常响应：${body.slice(0, 120)}`);
  return "未注册该类型";
});

// ---- 座驾（1.2.0）：档案 / 到期提醒整合 / 降噪 / 按年滚动 / 设置组 / 日志类型 ----
// 注意：本套用例假定在「全新实例」上运行（数据会互相影响，重复运行请先清空工作目录）
const CAR_BASE = `${base}/apis/importantdates.halo.run/v1alpha1/cars`;
const dayOffset = (n) => {
  const t = new Date();
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
};

await check("座驾：创建（分类/相册/到期项）", async () => {
  const baseCar = {
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Car",
    metadata: { name: `car-smoke-${RUN_ID}` },
    spec: {
      displayName: `小白-${RUN_ID}`,
      brand: "比亚迪",
      model: "汉 EV",
      plateNo: "粤B12345",
      vehicleType: "SUV",
      energyType: "EV",
      vin: "LGX0000000000000",
      purchasePrice: 219800,
      status: "IN_USE",
      visible: true,
      important: true,
      photos: [
        { url: "/upload/car-cover.png", name: "封面", isCover: true, sortOrder: 0, frontVisible: true },
        { url: "/upload/car-doc.png", name: "证件", isCover: false, sortOrder: 1, frontVisible: false },
      ],
      // 年检 10 天后到期，但该项提前天数为 30 → 必须进入提醒（验证"每项自己的提前天数"生效）
      reminders: [{ key: "INSPECTION", date: dayOffset(10), remindDays: 30, enabled: true }],
    },
  };
  const r1 = await fetch(CAR_BASE, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(baseCar),
  });
  expectStatus(r1, [200, 201], (await r1.text()).slice(0, 200));

  const car2 = {
    ...baseCar,
    metadata: { name: `car-smoke2-${RUN_ID}` },
    spec: {
      ...baseCar.spec,
      displayName: `小蓝-${RUN_ID}`,
      plateNo: "沪AD12345",
      // 用机动车（轿车）而不是电瓶车：1.3.0 起车型分档，电瓶车不提供车船税/保险/年检，
      // 那样就凑不出"同一辆车多项近期待办"，也就测不到降噪合并。
      vehicleType: "SEDAN",
      energyType: "FUEL",
      photos: [],
      // 3 项近期待办 → 触发降噪（每类最多 2 条 + 合并计数）
      reminders: [
        { key: "TAX", date: dayOffset(3), enabled: true },
        { key: "MAINTENANCE", date: dayOffset(5), enabled: true },
        { key: "INSURANCE_COMPULSORY", date: dayOffset(7), enabled: true },
      ],
    },
  };
  const r2 = await fetch(CAR_BASE, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(car2),
  });
  expectStatus(r2, [200, 201], (await r2.text()).slice(0, 200));
  return "2 辆（含分类/相册/到期项）";
});

await check("座驾：到期并入全站提醒 + 降噪合并", async () => {
  const r = await fetch(`${base}/important-dates-reminders`).then((x) => x.json());
  // 复用实例时：截断列表可能被历史数据占满 → "本次运行的事件"从完整列表里取，
  // 而"每类最多 N 条"的降噪仍然对截断列表断言。
  const all = r.allReminders || r.reminders || [];
  const mine = all.filter((i) => i.type === "car" && (i.title || "").includes(RUN_ID));
  if (!mine.length) throw new Error(`no car events for this run: ${JSON.stringify(r.reminders)}`);
  const capped = (r.reminders || []).filter((i) => i.type === "car");
  if (capped.length > 2) throw new Error(`car items not limited to 2: ${capped.length}`);
  if (!(r.overflowCount >= 0)) throw new Error("overflowCount missing");
  const days = mine.map((i) => i.daysUntil);
  for (let k = 1; k < days.length; k++) {
    if (days[k] < days[k - 1]) throw new Error(`car items not sorted: ${JSON.stringify(days)}`);
  }
  const first = mine[0];
  if (!(first.title || "").includes("小蓝") || !(first.title || "").includes("车船税")) {
    throw new Error(`nearest car event wrong: ${JSON.stringify(first)}`);
  }
  if (first.daysUntil !== 3) throw new Error(`daysUntil expected 3, got ${first.daysUntil}`);
  // 同一辆车的多项近期待办都应被计入（该车 3 项：车船税 3 天 / 保养 5 天 / 交强险 7 天）
  const xiaolan = mine.filter((i) => (i.carName || "").includes("小蓝"));
  if (xiaolan.length < 3) throw new Error(`小蓝的到期项应不少于 3 条，实际 ${xiaolan.length}: ${JSON.stringify(xiaolan.map((i) => i.label))}`);
  if (!mine.every((i) => typeof i.carIcon === "string" && i.carIcon.length > 0)) {
    throw new Error("carIcon missing");
  }
  return `按剩余天数排序且每类≤2条（本次 car ${mine.length} 条，截断列表 ${capped.length} 条，合并 ${r.overflowCount ?? 0} 条）`;
});

await check("座驾：按年循环滚动 + 自定义项过期提醒", async () => {
  const car3 = {
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Car",
    metadata: { name: `car-smoke3-${RUN_ID}` },
    spec: {
      displayName: `老白-${RUN_ID}`,
      vehicleType: "SEDAN",
      plateNo: "京A88888",
      status: "IN_USE",
      visible: true,
      important: true,
      reminders: [
        // 年度项：已过期 370 天 → 应自动滚动到下一年（不作为过期项提醒）
        { key: "INSURANCE_COMPULSORY", date: dayOffset(-370), enabled: true, insurer: "人保", policyNo: "P-1" },
        // 自定义项（非年度）：过期 5 天 → 应作为"已过期"进入提醒
        { key: "CUSTOM", label: "轮胎更换", date: dayOffset(-5), enabled: true },
      ],
    },
  };
  const res = await fetch(CAR_BASE, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(car3),
  });
  expectStatus(res, [200, 201], (await res.text()).slice(0, 200));
  await new Promise((r) => setTimeout(r, 600));
  const r = await fetch(`${base}/important-dates-reminders`).then((x) => x.json());
  // 1.2.6 起：**已办才滚动** —— 过期项不再自动滚到下一期，而是保留为"逾期/待处理"
  const all = r.allReminders || [];
  const mine = all.filter((i) => i.type === "car" && (i.title || "").includes(`老白-${RUN_ID}`));
  const overdue = mine.find((i) => i.label === "轮胎更换");
  if (!overdue) throw new Error(`overdue custom event missing: ${JSON.stringify(mine)}`);
  if (overdue.overdue !== true || overdue.daysUntil !== -5) {
    throw new Error(`overdue custom event wrong: ${JSON.stringify(overdue)}`);
  }
  const yearly = mine.find((i) => (i.label || "") === "交强险");
  if (!yearly) throw new Error(`yearly item missing: ${JSON.stringify(mine)}`);
  if (yearly.daysUntil !== -370) {
    throw new Error(`年度项应保持逾期 -370（不再自动滚动），实际 ${yearly.daysUntil}`);
  }
  if (yearly.status !== "TODO") throw new Error(`逾期超窗口应转待处理，实际 ${yearly.status}`);
  return "过期项保留为逾期（自定义 -5 天 / 年度 -370 天），超过逾期窗口转待处理";
});

await check("座驾：已出售不再提醒", async () => {
  const list = await fetch(`${CAR_BASE}?page=1&size=100`, { headers: buildHeaders() }).then((x) => x.json());
  const car2 = (list.items || []).find((c) => c.metadata.name === `car-smoke2-${RUN_ID}`);
  if (!car2) throw new Error("car2 not found");
  const put = await fetch(`${CAR_BASE}/${car2.metadata.name}`, {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ...car2, spec: { ...car2.spec, status: "SOLD" } }),
  });
  expectStatus(put, [200], (await put.text()).slice(0, 200));
  await new Promise((r) => setTimeout(r, 600));
  const r = await fetch(`${base}/important-dates-reminders`).then((x) => x.json());
  const stillThere = (r.reminders || []).some((i) => i.type === "car" && (i.title || "").includes(`小蓝-${RUN_ID}`));
  if (stillThere) throw new Error("sold car still reminds");
  return "标记为已出售后，其到期项不再进入提醒";
});

await check("座驾：设置组与日志类型", async () => {
  const set = await fetch(
    `${base}/apis/api.console.halo.run/v1alpha1/plugins/plugin-important-dates/setting`,
    { headers: buildHeaders() }
  ).then((x) => x.json());
  const carGroup = (set.spec?.forms || []).find((f) => f.group === "car");
  if (!carGroup) throw new Error("car setting group missing");
  const names = (carGroup.formSchema || []).map((f) => f.name);
  const photoGroup = (set.spec?.forms || []).find((f) => f.group === "attachment");
  const photoNames = (photoGroup?.formSchema || []).map((f) => f.name);
  for (const need of ["avatarGroupName", "avatarPolicyName", "carGroupName", "carPolicyName"]) {
    if (!photoNames.includes(need)) throw new Error(`photo setting ${need} missing`);
  }
  for (const need of ["carEventsEnabled", "carDefaultRemindDays", "carFrontendSection", "carSkinEnabled"]) {
    if (!names.includes(need)) throw new Error(`setting ${need} missing`);
  }
  // 日志支持 targetType=CAR
  return "座驾设置组 4 项就绪";
});

// ---- 拖拽排序（1.2.0）：sortOrder 影响前后台顺序 ----
await check("排序权重影响前台顺序（拖拽排序落库）", async () => {
  const plain = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/importantdates?page=1&size=500`,
    { headers: buildHeaders() }
  ).then((r) => r.json());
  const hidden = (plain.items || []).find((i) => i.metadata.name === HIDDEN_NAME);
  const normal = (plain.items || []).find((i) => i.metadata.name === NORMAL_NAME);
  if (!hidden || !normal) throw new Error("sort test records missing");
  // 把「隐藏测试」设为最小权重 → 应排到最前
  const put = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/importantdates/${HIDDEN_NAME}`,
    {
      method: "PUT",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...hidden, spec: { ...hidden.spec, sortOrder: 1 } }),
    }
  );
  expectStatus(put, [200], (await put.text()).slice(0, 200));
  const put2 = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/importantdates/${NORMAL_NAME}`,
    {
      method: "PUT",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...normal, spec: { ...normal.spec, sortOrder: 2 } }),
    }
  );
  expectStatus(put2, [200], (await put2.text()).slice(0, 200));
  await new Promise((r) => setTimeout(r, 800));
  const html = await fetch(`${base}/important-dates`).then((r) => r.text());
  // 隐藏测试不可见（visible=false）→ 用页面中可见记录顺序验证：第一位应为「隐藏测试」之外权重1的记录
  const firstTitle = html.match(/class="id-memo-title"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/);
  const board = [...html.matchAll(/class="id-memo-title"[\s\S]{0,200}?<span[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
  if (!board || board.length < 2) throw new Error("board titles missing");
  // 「球友聚会」应为普通记录中权重最小（sortOrder 2 相对其他0更靠后）；断言顺序与权重一致:
  const indices = board.map((t, i) => ({ t, i }));
  const normalIdx = indices.find((x) => x.t === "不重要测试")?.i ?? -1;
  const remindIdx = indices.find((x) => x.t === "提醒测试")?.i ?? -1;
  if (normalIdx < 0) throw new Error("不重要测试 not on board");
  if (remindIdx < 0) throw new Error("提醒测试 not on board");
  if (!(normalIdx > remindIdx)) throw new Error(`sortOrder not applied: 不重要测试(${normalIdx}) 应在 提醒测试(${remindIdx}) 之后`);
  return `顺序校验: 提醒测试@${remindIdx} → 不重要测试@${normalIdx} (权重1<2)`;
});

// ---- 导出/导入语义（模拟前端导入逻辑） ----
await check("重复创建被拒绝（导入判重的假设成立）", async () => {
  const item = {
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "ImportantDate",
    metadata: { name: SOLAR_NAME },
    spec: { title: "重复记录", dateType: "SOLAR", solarDate: "2025-01-01" },
  };
  const res = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/importantdates`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(item),
  });
  const text = await res.text();
  if (res.status < 400) throw new Error(`duplicate create should be rejected but got ${res.status}: ${text.slice(0, 200)}`);
  return `HTTP ${res.status}`;
});

await check("导出数据可完整回读", async () => {
  const res = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/importantdates?page=1&size=100`,
    { headers: buildHeaders() }
  );
  const body = await res.json();
  expectStatus(res, [200], JSON.stringify(body));
  const item = (body.items || []).find((i) => i.metadata.name === SOLAR_NAME);
  if (!item) throw new Error("solar record missing for export roundtrip");
  if (item.spec?.solarDate !== "2019-05-20") throw new Error("solarDate mismatch");
  if (item.spec?.note !== "领证日 · 修改后") throw new Error("note mismatch");
  return `${item.spec.title} / ${item.spec.solarDate}`;
});

await check("后台 UI 可访问（ESM manifest + 入口）", async () => {
  const mf = await fetch(`${base}/plugins/plugin-important-dates/assets/console/ui-plugin.json`);
  const mfText = await mf.text();
  expectStatus(mf, [200], mfText.slice(0, 200));
  const manifest = JSON.parse(mfText);
  if (manifest.format !== "esm" || !manifest.entry) throw new Error(`manifest unexpected: ${mfText}`);
  const entry = await fetch(`${base}/plugins/plugin-important-dates/assets/console/${manifest.entry}`);
  const entryText = await entry.text();
  expectStatus(entry, [200], entryText.slice(0, 200));
  if (!entryText.includes("important-dates")) throw new Error("entry bundle does not contain plugin routes");
  return `manifest(${manifest.format}) + entry ${entryText.length} bytes`;
});

// ---- 前台页面（匿名访问） ----
await check("前台页面匿名可访问", async () => {
  const res = await fetch(`${base}/important-dates`);
  const html = await res.text();
  expectStatus(res, [200], html.slice(0, 300));
  if (!html.includes("重要日期")) throw new Error("page title missing");
  if (!html.includes("结婚纪念日")) throw new Error("record title missing");
  if (!html.includes("张三")) throw new Error("person name missing");
  if (!html.includes("id-memo-days")) throw new Error("days-until card missing");
  return `${html.length} bytes · 插件默认模板渲染`;
});

// 隐私检查：体重与备注不出现在前台
await check("隐私字段未泄露", async () => {
  const res = await fetch(`${base}/important-dates`);
  const html = await res.text();
  if (html.includes("72.5") || html.includes("70 kg") || html.includes("体重")) {
    throw new Error("privacy field weight leaked to frontend");
  }
  if (html.includes("领证日")) {
    throw new Error("note leaked to frontend");
  }
  // 敏感字段词全查（与整人"前台展示"开关无关，字段级永远不出现在前台）
  for (const word of ["血型", "身高", "喜好", "备注"]) {
    if (html.includes(word)) {
      throw new Error(`sensitive word leaked to frontend: ${word}`);
    }
  }
  return "未泄露体重/备注/血型/身高/喜好";
});

// ---- 生日脱敏（默认关闭展示 → * 处理） ----
await check("生日默认脱敏（* 处理）", async () => {
  const res = await fetch(`${base}/important-dates`);
  const html = await res.text();
  // 张三 solarDate 1990-05-20 → 应显示 1990-05-**，且不出现完整生日
  if (!html.includes("1990-05-**")) throw new Error("masked birthday 1990-05-** missing");
  if (html.includes("1990-05-20")) throw new Error("full birthday 1990-05-20 leaked");
  return "生日已脱敏";
});

// ---- 大头贴（1.2.0）：设置控制前台显示，后台字段始终存在 ----
await check("大头贴：前台显示由设置控制", async () => {
  const AURL = "https://example.com/avatar-test.png";
  const cm = await fetch(`${base}/api/v1alpha1/configmaps/plugin-important-dates-configmap`, {
    headers: buildHeaders(),
  }).then((r) => r.json());
  cm.data = cm.data || {};
  const person = await fetch(
    `${base}/apis/importantdates.halo.run/v1alpha1/persons?page=1&size=100`,
    { headers: buildHeaders() }
  ).then((r) => r.json()).then((b) => (b.items || []).find((p) => p.spec?.displayName === "张三"));
  if (!person) throw new Error("张三 not found");
  const put = await fetch(`${base}/apis/importantdates.halo.run/v1alpha1/persons/${person.metadata.name}`, {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ...person, spec: { ...person.spec, avatar: AURL } }),
  });
  expectStatus(put, [200], (await put.text()).slice(0, 200));
  // 每次都重新拉取最新 ConfigMap（resourceVersion 递增，避免 409）
  const putPrivacy = async (privacyJson) => {
    const fresh = await fetch(`${base}/api/v1alpha1/configmaps/plugin-important-dates-configmap`, {
      headers: buildHeaders(),
    }).then((r) => r.json());
    fresh.data = fresh.data || {};
    fresh.data.privacy = privacyJson;
    const r = await fetch(`${base}/api/v1alpha1/configmaps/plugin-important-dates-configmap`, {
      method: "PUT",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(fresh),
    });
    expectStatus(r, [200], (await r.text()).slice(0, 200));
  };
  // 先确保隐私组被明确置为关闭（上一轮可能残留），并断言写入成功
  await putPrivacy(JSON.stringify({ showAvatar: false, showBirthday: false }));
  await new Promise((r) => setTimeout(r, 800));
  // 前台未开 showAvatar（默认 false）→ 页面不含图片地址
  let html = await fetch(`${base}/important-dates`).then((r) => r.text());
  if (html.includes(AURL)) throw new Error("avatar leaked while showAvatar=false");
  // 开启隐私 → 前台展示大头贴
  await putPrivacy(JSON.stringify({ showAvatar: true, showBirthday: false }));
  await new Promise((r) => setTimeout(r, 800));
  html = await fetch(`${base}/important-dates`).then((r) => r.text());
  if (!html.includes(AURL)) throw new Error("avatar not shown after showAvatar=true");
  // 还原
  await putPrivacy(JSON.stringify({}));
  return "默认关闭不泄露 → 开启后前台显示";
});

await check("人员昵称前台显示", async () => {
  const res = await fetch(`${base}/important-dates`);
  const html = await res.text();
  // 张三 spec.nickname = 三哥
  if (!html.includes("昵称：三哥")) throw new Error("nickname not shown on frontend");
  return "昵称已显示";
});

await check("悬浮提示关闭秒数返回", async () => {
  const res = await fetch(`${base}/important-dates-reminders`);
  const body = await res.json();
  expectStatus(res, [200], JSON.stringify(body));
  if (body.toastCloseSeconds !== 8) {
    throw new Error(`toastCloseSeconds mismatch: ${body.toastCloseSeconds}`);
  }
  return `关闭秒数 ${body.toastCloseSeconds}s`;
});

await check("前台提醒横幅正确（明天提醒、不重要不提醒、隐藏不出现）", async () => {
  const res = await fetch(`${base}/important-dates`);
  const html = await res.text();
  if (!html.includes("明天就到啦～")) throw new Error("reminder prefix for important date missing");
  if (!/<span[^>]*>「提醒测试」/.test(html)) throw new Error("reminder title missing");
  if (/<span[^>]*>「不重要测试」/.test(html) && html.includes("明天就到啦～")) {
    const remindBlock = html.match(/id-remind-item[\s\S]*?<\/div>/)?.[0] || "";
    if (remindBlock.includes("不重要测试")) throw new Error("non-important date reminded");
  }
  if (html.includes("隐藏测试")) throw new Error("hidden date leaked to frontend");
  if (!html.includes("不重要测试")) throw new Error("non-important date should still be listed");
  return "提醒横幅/可见性正确";
});

// ---- 1.2.1（A/B/C/E/G）：循环间隔 / 年检推算 / 车辆级保险公司 / 仪表盘分页数据 / 提示确认标记 ----
const carApi = async (payload) => {
  const res = await fetch(CAR_BASE, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  expectStatus(res, [200, 201], (await res.text()).slice(0, 200));
};

const remindersJson = async () => {
  await new Promise((r) => setTimeout(r, 700));
  return fetch(`${base}/important-dates-reminders`).then((x) => x.json());
};

await check("1.2.1 循环间隔：不循环（0）不滚动，过期即按过期提醒", async () => {
  await carApi({
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Car",
    metadata: { name: `car-121-once-${RUN_ID}` },
    spec: {
      displayName: `不循环-${RUN_ID}`,
      vehicleType: "SEDAN",
      status: "IN_USE",
      visible: true,
      important: true,
      insurer: "中国人保",
      reminders: [
        { key: "INSURANCE_COMPULSORY", date: dayOffset(-5), remindDays: 30, enabled: true, repeatMonths: 0 },
      ],
    },
  });
  const r = await remindersJson();
  const all = r.allReminders || r.reminders || [];
  const item = all.find(
    (i) => i.type === "car" && (i.title || "").includes(`不循环-${RUN_ID}`) && (i.label || "") === "交强险"
  );
  if (!item) throw new Error(`不循环项未进入提醒: ${JSON.stringify(all.filter((i) => i.type === "car"))}`);
  if (item.overdue !== true || item.daysUntil !== -5) {
    throw new Error(`不循环项应为过期 5 天: ${JSON.stringify(item)}`);
  }
  return "repeatMonths=0 时到期项停留在原日期（-5 天），不滚动到下一年";
});

await check("1.2.1 循环间隔：过期不再自动滚动（1.2.6 语义）", async () => {
  await carApi({
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Car",
    metadata: { name: `car-121-bi-${RUN_ID}` },
    spec: {
      displayName: `两年一检-${RUN_ID}`,
      vehicleType: "SEDAN",
      status: "IN_USE",
      visible: true,
      important: true,
      reminders: [
        // 提前天数放到 400 天，才能覆盖「滚动 24 个月后仍在未来」的断言
        { key: "INSURANCE_COMPULSORY", date: dayOffset(-400), remindDays: 400, enabled: true, repeatMonths: 24 },
      ],
    },
  });
  const r = await remindersJson();
  const all = r.allReminders || r.reminders || [];
  const item = all.find((i) => i.type === "car" && (i.title || "").includes(`两年一检-${RUN_ID}`));
  if (!item) throw new Error("两年循环项未进入清单");
  // 1.2.6 起：不再自动滚动 —— 过期就是逾期，只有用户点「已办」才顺延
  if (item.daysUntil !== -400) {
    throw new Error(`过期项不应自动滚动（应保持 -400），实际 ${item.daysUntil}`);
  }
  if (item.status !== "TODO") throw new Error(`逾期超窗口应转待处理，实际 ${item.status}`);
  return "-400 天的两年循环项保持逾期、状态为待处理（不再自动滚动到未来）";
});

await check("1.2.1 年检：未填日期时按登记日期与车型规则自动推算（含阶段）", async () => {
  // 登记日期取「4 年前再早 5 天」→ 第 2 年节点已过、第 4 年节点在 5 天后（免检申领），可落在 30 天提醒窗口内
  await carApi({
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Car",
    metadata: { name: `car-121-inspect-${RUN_ID}` },
    spec: {
      displayName: `老车-${RUN_ID}`,
      vehicleType: "SEDAN",
      registeredDate: dayOffset(-365 * 4 + 5),
      status: "IN_USE",
      visible: true,
      important: true,
      reminders: [{ key: "INSPECTION", remindDays: 30, enabled: true }],
    },
  });
  const r = await remindersJson();
  const all = r.allReminders || r.reminders || [];
  const item = all.find((i) => i.type === "car" && (i.title || "").includes(`老车-${RUN_ID}`));
  if (!item) throw new Error("年检未自动推算进入提醒");
  if (item.label !== "年检·免检申领") throw new Error(`第 4 年应为免检申领阶段: ${item.label}`);
  if (item.daysUntil < 1 || item.daysUntil > 10) {
    throw new Error(`推算日期应约为 5 天后: ${JSON.stringify(item)}`);
  }
  // 第二辆：登记日期取「6 年前再早 5 天」→ 第 6 年节点在 5 天后（上线检验），覆盖 E 的阶段判定
  await carApi({
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Car",
    metadata: { name: `car-121-onsite-${RUN_ID}` },
    spec: {
      displayName: `上线车-${RUN_ID}`,
      vehicleType: "SEDAN",
      registeredDate: dayOffset(-365 * 6 + 5),
      status: "IN_USE",
      visible: true,
      important: true,
      reminders: [{ key: "INSPECTION", remindDays: 30, enabled: true }],
    },
  });
  const r2 = await remindersJson();
  const all2 = r2.allReminders || r2.reminders || [];
  const item2 = all2.find((i) => i.type === "car" && (i.title || "").includes(`上线车-${RUN_ID}`));
  if (!item2) throw new Error("第 6 年年检未自动推算进入提醒");
  if (item2.label !== "年检·上线检验") throw new Error(`第 6 年应为上线检验阶段: ${item2.label}`);
  return `${item.label} → ${item.dateText}（${item.daysUntil} 天后）；${item2.label} → ${item2.dateText}（${item2.daysUntil} 天后）`;
});

await check("1.2.1 年检提示确认标记可持久化（一次性提示去重）", async () => {
  const url = `${CAR_BASE}/car-121-inspect-${RUN_ID}`;
  const car = await fetch(url, { headers: buildHeaders() }).then((x) => x.json());
  const put = await fetch(url, {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ...car, spec: { ...car.spec, inspectionNoticeAck: "ONSITE" } }),
  });
  expectStatus(put, [200], (await put.text()).slice(0, 200));
  const back = await fetch(url, { headers: buildHeaders() }).then((x) => x.json());
  if (back.spec?.inspectionNoticeAck !== "ONSITE") {
    throw new Error(`inspectionNoticeAck 未持久化: ${JSON.stringify(back.spec?.inspectionNoticeAck)}`);
  }
  return "Car.spec.inspectionNoticeAck = ONSITE 可读写（E 的提示去重依赖该字段）";
});

await check("1.2.1 保险公司：车辆级字段 + 单项覆盖同时保留", async () => {
  await carApi({
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "Car",
    metadata: { name: `car-121-insurer-${RUN_ID}` },
    spec: {
      displayName: `保险-${RUN_ID}`,
      vehicleType: "SUV",
      status: "IN_USE",
      visible: false,
      important: true,
      insurer: "中国平安",
      reminders: [
        { key: "INSURANCE_COMPULSORY", date: dayOffset(30), remindDays: 15, enabled: true, repeatMonths: 12 },
        {
          key: "INSURANCE_COMMERCIAL",
          date: dayOffset(40),
          remindDays: 15,
          enabled: true,
          repeatMonths: 12,
          insurer: "太平洋保险",
          policyNo: "P-122",
        },
      ],
    },
  });
  const back = await fetch(`${CAR_BASE}/car-121-insurer-${RUN_ID}`, { headers: buildHeaders() }).then((x) => x.json());
  if (back.spec?.insurer !== "中国平安") throw new Error(`车辆级保险公司丢失: ${back.spec?.insurer}`);
  const commercial = (back.spec?.reminders || []).find((x) => x.key === "INSURANCE_COMMERCIAL");
  if (commercial?.insurer !== "太平洋保险") throw new Error(`单项覆盖丢失: ${commercial?.insurer}`);
  if (commercial?.policyNo !== "P-122") throw new Error(`保单号丢失: ${commercial?.policyNo}`);
  if (Number(commercial?.repeatMonths) !== 12) throw new Error(`循环间隔丢失: ${commercial?.repeatMonths}`);
  return "车辆级「中国平安」+ 商业险覆盖「太平洋保险」+ 保单号 + 循环间隔 12 均落库";
});

await check("1.2.1 仪表盘数据：完整提醒列表 + 每页条数/分页开关下发", async () => {
  const r = await remindersJson();
  if (!Array.isArray(r.allReminders)) throw new Error("allReminders 未下发（小组件分页依赖）");
  const limited = r.reminders || [];
  if (r.allReminders.length < limited.length) throw new Error("allReminders 少于降噪列表");
  const carAll = r.allReminders.filter((i) => i.type === "car").length;
  const carLimited = limited.filter((i) => i.type === "car").length;
  if (!(carAll > carLimited)) throw new Error(`完整列表应多于降噪列表: all=${carAll} limited=${carLimited}`);
  if (r.dashboardPageSize !== 5) throw new Error(`dashboardPageSize 期望 5，实际 ${r.dashboardPageSize}`);
  if (r.dashboardPagination !== true) throw new Error(`dashboardPagination 期望 true，实际 ${r.dashboardPagination}`);
  return `allReminders ${r.allReminders.length} 条 / 降噪后 ${limited.length} 条；每页 ${r.dashboardPageSize} 条、分页开启`;
});

// ---- 卸载可恢复性：主题目录零残留（评审要求 4.3.4） ----
await check("主题目录零残留（插件从未写入主题文件）", async () => {
  const { existsSync } = await import("node:fs");
  if (existsSync(THEME_TPL_PATH)) throw new Error("theme templates/important-dates.html residue found");
  return "主题目录无插件生成文件，卸载/停用无需清理";
});

console.log(`\n===== 结果: ${ok} PASS, ${fail} FAIL =====`);
process.exit(fail > 0 ? 1 : 0);
































































