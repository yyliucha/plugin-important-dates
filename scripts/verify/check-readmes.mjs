import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 核对 GitHub 上的三个 README 是否与本地一致，并检查关键内容
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// 以远端 git 对象为准（raw CDN 有约 5 分钟缓存，会误报"不一致"）
const gitShow = (f) => execFileSync("git", ["-C", REPO, "show", "origin/main:" + f], { encoding: "utf8", maxBuffer: 1 << 24 });
const repo = "yyliucha/plugin-important-dates";
const branch = "main";
const root = `${REPO}/`;
const VER = (readFileSync(root + "gradle.properties", "utf8").match(/version=(.+)/) || [])[1].trim();
const norm = (s) => s.replace(/\r\n/g, "\n").trimEnd();

let bad = 0;
for (const f of ["README.md", "README.en.md", "README.store.md"]) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${f}`;
  const res = await fetch(url);
  if (!res.ok) { console.log(`${f}: 拉取失败 ${res.status}`); bad++; continue; }
  const remote = norm(gitShow(f));
  const local = norm(readFileSync(root + f, "utf8"));
  const same = remote === local;
  if (!same) bad++;
  console.log(`${f.padEnd(18)} 一致: ${same ? "是 OK" : "否 **不一致**"}  (远端 ${remote.length} / 本地 ${local.length} 字符)`);
}

console.log("当前版本（来自 gradle.properties）:", VER, "\n=== 关键内容抽查（以远端为准） ===");
const md = norm(gitShow("README.md"));
const en = norm(gitShow("README.en.md"));
const store = norm(gitShow("README.store.md"));

const checks = [
  ["README.md 版本号 " + VER, md.includes("当前版本：`" + VER + "`")],
  ["README.md 无旧版本号 1.2.6 作为当前版本", !md.includes("当前版本：`1.2.6`")],
  ["README.md 车型分档小节", md.includes("按车型只显示用得上的字段（1.3.0）")],
  ["README.md 驾照换证已移出", md.includes("「驾照换证」自 1.3.0 起不再挂在座驾上")],
  ["README.en.md 版本号 " + VER, en.includes("current version: `" + VER + "`")],
  ["README.en.md 车型分档小节", en.includes("Only the fields your vehicle actually has (1.3.0)")],
  ["README.store.md 版本号 " + VER, store.includes("当前版本：`" + VER + "`")],
  ["README.store.md 零相对链接", !/\]\((?!https?:)[^)]+\)/.test(store)],
  ["README.store.md 图片为绝对 raw 地址", store.includes("raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/")],
  ["README.store.md LICENSE 为绝对地址", store.includes("blob/main/LICENSE")],
  ["README.store.md README.en 为绝对地址", store.includes("blob/main/README.en.md")],
];
for (const [name, ok] of checks) {
  if (!ok) bad++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
}
console.log(bad === 0 ? "\n全部通过" : `\n有 ${bad} 项问题`);

