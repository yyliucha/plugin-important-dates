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
3. Write the release notes: `docs/release-notes-<version>.md` (Chinese, for the store) and `docs/release-notes-<version>.en.md` (English).
4. `./gradlew clean build` → verify the jar metadata (`plugin.yaml` inside the jar shows the new version).
5. Verify on a clean Halo 2.26 instance: `halo-smoke.mjs` (44/44) plus the browser checks.
6. Commit and push (English message), wait for CI to pass.
7. Create the release: title = `<tag>`, notes = Chinese section + English section (see above), one jar asset, `--latest` for stable or `--prerelease` for previews.
8. Submit the store version with the Chinese notes, then update the store app info if needed.
