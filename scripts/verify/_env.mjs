/**
 * 测试脚本共用配置。
 *
 * 这些脚本需要一个**正在运行、且已安装本插件**的 Halo 实例，只做黑盒验证
 * （通过 HTTP 接口 + 无头浏览器操作真实界面），不会改动你的业务代码。
 *
 * 可用环境变量：
 *   HALO_BASE   Halo 站点地址，默认 http://127.0.0.1:8090
 *   REPO_ROOT   仓库根目录，默认取本文件的上两级
 *   OUT_DIR     截图与临时文件输出目录，默认 <仓库>/build/verify
 *
 * 运行前请先启动 Halo 并装好插件，例如：
 *   HALO_BASE=http://127.0.0.1:8090 node scripts/verify/halo-smoke.mjs
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));

/** 仓库根目录 */
export const REPO = resolve(process.env.REPO_ROOT || resolve(here, "..", ".."));

/** 测试产物目录（截图等） */
export const OUT_DIR = resolve(process.env.OUT_DIR || resolve(REPO, "build", "verify"));
mkdirSync(OUT_DIR, { recursive: true });

/** Halo 站点地址 */
export const base = process.env.HALO_BASE || "http://127.0.0.1:8090";

/** 无头浏览器路径：优先环境变量，其次常见的 Chrome / Edge 安装位置 */
export const CHROME =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((p) => existsSync(p));

/** 统一的 puppeteer 启动参数 */
export const LAUNCH = {
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"],
};

/** 运行前的连通性检查：实例不可用时给出人话提示，而不是一堆 ECONNREFUSED */
export async function requireInstance() {
  try {
    const r = await fetch(`${base}/actuator/health`, { redirect: "manual" });
    if (!r.ok && r.status !== 404) throw new Error(String(r.status));
  } catch {
    console.error(
      `\n连不上 Halo（${base}）。请先启动实例并安装插件，或用 HALO_BASE 指定地址。\n` +
        `例如：HALO_BASE=http://127.0.0.1:8090 node scripts/verify/${process.argv[1].split(/[\\/]/).pop()}\n`
    );
    process.exit(2);
  }
}

/** 常用：把相对路径拼到仓库根 */
export const repoPath = (...parts) => resolve(REPO, ...parts);
