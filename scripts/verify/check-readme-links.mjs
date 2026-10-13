import { base, CHROME, LAUNCH, OUT_DIR, REPO, requireInstance } from "./_env.mjs";
await requireInstance();

// 校验三个 README 里所有链接（图片与文档）在 GitHub 上是否可访问
import { readFileSync } from "node:fs";
const root = `${REPO}/`;
const files = ["README.md", "README.en.md", "README.store.md"];

const urls = new Map(); // url -> [来源]
for (const f of files) {
  const t = readFileSync(root + f, "utf8");
  for (const m of t.matchAll(/!?\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
    const u = m[1];
    if (!urls.has(u)) urls.set(u, []);
    urls.get(u).push(f);
  }
}

console.log(`共 ${urls.size} 个链接，开始校验…\n`);
let bad = 0;
for (const [u, from] of urls) {
  let status = "ERR";
  try {
    let r = await fetch(u, { method: "HEAD", redirect: "follow" });
    if (r.status === 405 || r.status === 501) r = await fetch(u, { redirect: "follow" });
    status = r.status;
  } catch (e) { status = "ERR " + e.message.slice(0, 40); }
  const ok = status === 200;
  if (!ok) bad++;
  const label = u.replace("https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/", "")
                 .replace("https://github.com/yyliucha/plugin-important-dates/", "");
  console.log(`${ok ? "OK  " : "BAD "} ${String(status).padEnd(4)} ${label}   [${[...new Set(from)].join(", ")}]`);
}
console.log(bad === 0 ? "\n全部链接可访问" : `\n有 ${bad} 个链接不可访问`);

