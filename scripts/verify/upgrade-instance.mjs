// 把仓库里刚构建的 jar 通过 Halo 自己的升级接口装到测试实例上。
//
// 为什么不用复制文件：Halo 在数据库里记录每个插件的加载路径（status.loadLocation），
// 手工把 jar 换名或移走会让那条路径失效，插件**完全不加载**（接口 404、后台菜单消失）。
// 升级接口会同时更新文件与数据库记录，是唯一稳妥的方式。
//
// 用法：node scripts/verify/upgrade-instance.mjs [jarPath]
import { base, CHROME, LAUNCH, REPO, requireInstance } from "./_env.mjs";
await requireInstance();
import puppeteer from "puppeteer-core";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const PLUGIN = "plugin-important-dates";

function pickJar() {
  if (process.argv[2]) return process.argv[2];
  const dir = `${REPO}/build/libs`;
  const jars = readdirSync(dir)
    .filter((f) => f.startsWith(PLUGIN) && f.endsWith(".jar"))
    .map((f) => `${dir}/${f}`);
  if (!jars.length) throw new Error(`build/libs 里没有 ${PLUGIN} 的 jar，先构建`);
  // 取版本号最大的那个
  return jars.sort().at(-1);
}

const jar = pickJar();
if (!existsSync(jar)) throw new Error(`找不到 jar: ${jar}`);
const version = /(\d+\.\d+\.\d+(?:-[\w.]+)?)\.jar$/.exec(jar)?.[1] || "?";
const b64 = readFileSync(jar).toString("base64");
console.log(`升级到 ${version}：${jar}`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage();
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#username", { timeout: 30000 });
await page.type("#username", "admin");
await page.type("#plainPassword", "admin12345");
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 5000));

const before = await page.evaluate(async (name) => {
  const r = await fetch(`/apis/plugin.halo.run/v1alpha1/plugins/${name}`);
  const j = await r.json();
  return { version: j.spec?.version, phase: j.status?.phase };
}, PLUGIN);
console.log("升级前:", JSON.stringify(before));

const res = await page.evaluate(
  async (name, b64jar) => {
    const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
    const bin = atob(b64jar);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const fd = new FormData();
    fd.append("file", new File([bytes], `${name}.jar`, { type: "application/java-archive" }));
    const r = await fetch(`/apis/api.console.halo.run/v1alpha1/plugins/${name}/upgrade`, {
      method: "POST",
      headers: { "X-XSRF-TOKEN": xsrf },
      body: fd,
    });
    return { status: r.status, body: (await r.text()).slice(0, 300) };
  },
  PLUGIN,
  b64
);
if (res.status !== 200) {
  console.error("升级失败:", JSON.stringify(res));
  if (/已经存在|already/.test(res.body)) console.error("提示：Halo 拒绝同版本升级，请先提升版本号再构建。");
  await browser.close();
  process.exit(1);
}

// 等插件重新启动并生效
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  const live = await page.evaluate(async () => {
    try {
      const r = await fetch(`/important-dates-reminders?ts=${Date.now()}`);
      if (!r.ok) return null;
      return (await r.json()).build || null;
    } catch {
      return null;
    }
  });
  if (live) {
    console.log(`升级后: 服务端 build = ${live}`);
    await browser.close();
    process.exit(live === version ? 0 : 1);
  }
}
console.error("升级后接口一直没有恢复");
await browser.close();
process.exit(1);
