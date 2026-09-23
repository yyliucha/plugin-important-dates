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
   - When regenerating `README.store.md`, turn **every** link into an absolute GitHub URL: the store renders this field on its own domain, so relative paths (`README.en.md`, `LICENSE`, `docs/...`) resolve against the store site and 404.
     - images: `docs/screenshots/x.png` → `https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/x.png`
     - docs: `README.en.md` → `https://github.com/yyliucha/plugin-important-dates/blob/main/README.en.md`; `LICENSE` → `.../blob/main/LICENSE`
3. Write the release notes: `docs/release-notes-<version>.md` (Chinese, for the store) and `docs/release-notes-<version>.en.md` (English).
4. If `reminder-toast.js` changed, bump `TOAST_SCRIPT_VERSION` in `ReminderHeadProcessor` so browsers do not keep the cached old script.
5. `./gradlew clean build` → verify the jar metadata (`plugin.yaml` inside the jar shows the new version).
5. Verify on a clean Halo 2.26 instance: `halo-smoke.mjs` (50/50, includes the 1.2.1 car checks) plus the browser end-to-end script (`browser-121-e2e.mjs`, 13/13) and the migration script (`migrate-check.mjs`).
6. Commit and push (English message), wait for CI to pass.
7. Create the release: title = `<tag>`, notes = Chinese section + English section (see above), one jar asset, `--latest` for stable or `--prerelease` for previews.
8. Submit the store version with the Chinese notes, then update the store app info if needed.

## Local build notes (Windows dev box)

- `build/libs/plugin-important-dates-<version>.jar` must contain the console bundle: check for `console/main.*.js` inside the jar before shipping.
  The `buildFrontend` task may report success while producing nothing when npm cannot be started from Gradle
  (error: `A problem occurred starting process 'command 'npm''`). Set `NPM_CMD` to the npm executable, e.g.
  `$env:NPM_CMD = "C:\Users\Administrator\AppData\Local\nvm\v22.20.0\npm.cmd"`, or build the UI first
  (`cd console; npm run build`) and then package with `./gradlew build -x buildFrontend`.
- Regression scripts live outside the repo in `F:\dsh\halo-test`: start Halo with
  `--halo.work-dir=F:/dsh/halo-test/work-xxx` (**forward slashes** — backslashes break H2's `r2dbc:///` URL) and
  keep it running as a detached process (`Start-Process -RedirectStandardOutput ...`), not inside a job that can be killed.
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