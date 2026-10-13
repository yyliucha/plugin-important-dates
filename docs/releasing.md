# Releasing conventions

This file records how releases are prepared, so every release looks consistent.

## GitHub Release

- **Title**: the version only — exactly the tag name. Examples: `v1.2.0`, `v1.2.0-SNAPSHOT`, `v1.1.5`.
  Do **not** put any description in the title; the details belong to the release notes.
- **Notes**: bilingual, in this exact order — a Chinese section first, then an English one:

  ```
  ## <tag>

  ### 中文

  <Chinese notes>

  ---

  ### English

  <English notes>
  ```

  Sources: Chinese from `docs/release-notes-<version>.md`, English from `docs/release-notes-<version>.en.md`
  (for releases created before this convention, see `docs/release-notes-1.2.0.bilingual.md` for a sample).
- **Asset**: exactly one jar — `plugin-important-dates-<version>.jar` (built from the tagged commit).
- **Flags**: pre-release builds use `--prerelease`; stable builds use `--latest`.
- **Commit messages** for release commits are English as well.

## Halo app store

- **版本号 / 标题**: `1.2.0` (no description in the title either).
- **版本说明**: use `docs/release-notes-<version>.md` (Chinese, Markdown is supported by this field).
- **描述 / 简介**: plain text only (the description field does not support Markdown); see `docs/store-assets/app-info.md`.
- **README field**: paste `README.store.md` (absolute image URLs).
- **Cover / Logo**: `docs/store-assets/cover.png`, `docs/store-assets/logo.png`.
- Tick **设置为最新版本** for a stable release so sites receive the update notice; tick **预发布** only for preview builds.

## Release checklist

1. Set the version in `gradle.properties` and `src/main/resources/plugin.yaml`.
2. Update `README.md` + regenerate `README.store.md`; refresh screenshots if the UI changed.
   **Also update `README.en.md`** — it is an independent translation and does *not* follow the Chinese file automatically
   (1.2.6 removed the operation log from `README.md` but the English usage section kept advertising it until 1.3.0).
   Anything user-visible that changed in this release — a removed feature, a new one, a renamed setting tab — must land in all three.
   - When regenerating `README.store.md`, turn **every** link into an absolute GitHub URL: the store renders this field on its own domain, so relative paths (`README.en.md`, `LICENSE`, `docs/...`) resolve against the store site and 404.
     - images: `docs/screenshots/x.png` → `https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/x.png`
     - docs: `README.en.md` → `https://github.com/yyliucha/plugin-important-dates/blob/main/README.en.md`; `LICENSE` → `.../blob/main/LICENSE`
   - Then run the link check (validates **links and content**, so it catches a stale English section):
     `npm run verify:readmes` — it runs `check-readmes.mjs` (three files match `origin/main`, version bump, key sections present)
     and `check-readme-links.mjs` (every link/image resolves with HTTP 200).
     Both take the repo root from `REPO_ROOT` (default: this repo), so they work from any checkout.
     Run the link check **after** pushing — it reads GitHub, and `raw.githubusercontent.com` caches for ~5 minutes;
     if a just-pushed change looks missing, confirm via `gh api repos/.../contents/<file>` before assuming a bad edit.
3. Write the release notes: `docs/release-notes-<version>.md` (Chinese, for the store) and `docs/release-notes-<version>.en.md` (English).
4. If `reminder-toast.js` changed, bump `TOAST_SCRIPT_VERSION` in `ReminderHeadProcessor` so browsers do not keep the cached old script
   (plugin static assets are served with `max-age=31536000` — without the bump the new script never reaches returning visitors).
   Bump it whenever the toast behaves differently, **even if you only changed settings**: the old cached script would otherwise
   ignore the new fields. Also keep the numbers in sync in `reminder-toast.js` (`__ID_TOAST_VERSION`) and `ImportantDateRouter`
   (`BUILD_MARKER`) so `?v=` matches the build that is actually deployed.
5. If you added or renamed a **setting**, remember that existing sites keep their stored ConfigMap: write the new key with a safe
   default in `settings.yaml` and make the server tolerate it being absent (e.g. `toastDurations` falls back to `3/5/7/30`, and the
   toast ignores an unknown `toastDefaultClose` instead of muting forever).
5. `./gradlew clean build` → verify the jar metadata (`plugin.yaml` inside the jar shows the new version).
6. Verify against a running Halo instance that already has the plugin — the suite now lives **in this repo**:

   ```bash
   npm install                       # 一次性：装 puppeteer-core
   npm run verify                    # 全部套件
   npm run verify:smoke              # 只跑冒烟
   npm run verify:toast              # 只跑悬浮弹窗相关
   HALO_BASE=http://127.0.0.1:8090 npm run verify
   ```

   套件分组见 `scripts/verify/run-all.mjs`：`smoke`（冒烟）、`behavior`（提醒状态机 + 图片失效降级）、
   `ui`（控制台功能 + 前台）、`toast`（弹窗契约/频率/关闭方式/全站作用域）、`data`（附件库范围 + 拖拽排序）。
   脚本只通过接口与无头浏览器操作，会自建并清理测试数据。
   文档类检查用 `npm run verify:readmes`（三份 README 与远端一致 + 所有链接可访问）。
7. Commit and push (English message), wait for CI to pass.
8. Create the release: title = `<tag>`, notes = Chinese section + English section (see above), one jar asset, `--latest` for stable or `--prerelease` for previews.
9. Submit the store version with the Chinese notes, then update the store app info if needed.

## Local build notes (Windows dev box)

- `build/libs/plugin-important-dates-<version>.jar` must contain the console bundle: check for `console/main.*.js` inside the jar before shipping.
  The `buildFrontend` task may report success while producing nothing when npm cannot be started from Gradle
  (error: `A problem occurred starting process 'command 'npm''`). Set `NPM_CMD` to the npm executable, e.g.
  `$env:NPM_CMD = "C:\nvm4w\nodejs\npm.cmd"`, or build the UI first
  (`cd console; npm run build`) and then package with `./gradlew build -x buildFrontend`.
  A long-lived Gradle daemon also pins the `PATH` it was started with, so a freshly installed node may be invisible to it;
  `./gradlew --stop` (or `NPM_CMD`) clears that up. `console/build/dist` must not be empty — an empty dist silently ships a
  plugin whose settings page and dashboard widget are missing. Windows also needs a JDK 17+ for Gradle itself: the box defaults
  to JDK 11, so pass `JAVA_HOME="C:\Program Files\Java\jdk-23"` (the plugin targets Java 17 bytecode).
- Regression scripts live in this repo under `scripts/verify/`; they need a **running Halo instance with the plugin installed**.
  Start Halo with a work dir that uses **forward slashes** (`--halo.work-dir=F:/dsh/halo-test/work-xxx`) — backslashes break
  H2's `r2dbc:///` URL — and keep it as a detached process, not inside a job that can be killed.
- **Replacing the jar on disk does not reload the plugin.** Halo keeps serving the previously loaded classes until the
  process restarts; observed repeatedly, including one case where the file hash matched the build exactly while the
  endpoint still answered with the old logic. Always restart Halo, and keep only one `plugin-important-dates-*.jar` in the
  plugins directory. The reminders endpoint returns a `build` field — use it to confirm which server code is actually live.
- After installing a new build, **hard-refresh the browser**: the Halo console caches plugin console bundles, and a
  stale bundle shows up as a missing "记得" menu, missing settings tabs or a missing dashboard widget.
## 版本号规则（Halo 强校验，踩过的坑）

Halo 只接受**标准语义化版本**，且**同一个版本号无法再安装/升级第二次**（会返回 HTTP 500），所以每次给用户测试的包都必须换号：

| 场景 | 正确写法 | 说明 |
|---|---|---|
| 正式版 | `1.2.6` | `major.minor.patch` |
| 开发/测试包 | `1.2.6-rc.1`、`1.2.6-rc.2`、`1.2.6-rc.3`… | 预发布后缀，**每次构建递增**；排序上 `< 1.2.6`，所以正式版能顺利盖上去 |
| 备选 | `1.2.6-beta.1`、`1.2.6-alpha.2` | 同上 |

**不能用的写法**（Halo 直接 400 拒绝，正则见下）：

- `1.2.6.01` —— 四段版本号，不合法；
- `1.2.6-rc.01` —— 预发布段**不允许前导零**（只能是 `0`、`[1-9]\d*`，或含字母/连字符的标识）；
- 重复使用 `1.2.6-SNAPSHOT` —— 版本号没变，Halo 拒绝安装。

Halo 的校验正则：

```text
^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$
```

发布时同步改两处：`gradle.properties` 与 `src/main/resources/plugin.yaml`。