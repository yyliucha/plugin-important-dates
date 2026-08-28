# Important Dates (plugin-important-dates)

[![build](https://github.com/yyliucha/plugin-important-dates/actions/workflows/build.yaml/badge.svg)](https://github.com/yyliucha/plugin-important-dates/actions/workflows/build.yaml)

A Halo 2.x plugin to **record and manage your important dates, family and friends from the admin console** — wedding anniversaries, children's birth dates — with solar/lunar calendar support, reminders and automatic in-theme page rendering.

[中文版 README](README.md) ｜ [Releases](https://github.com/yyliucha/plugin-important-dates/releases) ｜ Author: [yyliucha](https://github.com/yyliucha)

## Features

**📅 Important Dates**
- Records: **name + date + multiline notes**; date type supports **solar / lunar** (lunar supports leap months)
- **Yearly recurring**: solar dates repeat on the same month/day; lunar dates auto-convert to the corresponding solar date each year ("next occurrence" shown in the list)
- **Custom date picker**: solar mode shows a calendar grid annotated with lunar days; lunar mode lets you pick the year, month (including leap months) and day with live solar mapping — both support **year/month quick-select**
- **Important flag**: dates can be marked important/normal (important by default); only important dates take part in reminders

**👤 People Management**
- Person fields: name, nickname, relation (spouse/child/parent/friend…), birthday (solar/lunar), gender, blood type, height, weight (latest value), hobbies, notes
- Dates can **link to multiple people** (e.g. a wedding anniversary linked to the couple) and be **filtered by person**

**🔔 Reminders**
- Reminder banner on both the admin page and the public `/important-dates` page: "Tomorrow is「Wedding Anniversary」" / "3 days until「Baby's Birthday」"
- Reminder rule: **important + frontend-visible + within N days (inclusive)**; lead days and admin/frontend reminder switches are **configurable** on the plugin settings page (default: 3 days)

**👁 Frontend Visibility**
- Dates and people each have a "show on frontend" switch (on by default): when off they stay admin-only and never appear on the public page (including reminders) — great for private records

**🏠 Public Page (automatic in-theme rendering)**
- Zero manual setup: the plugin detects the active theme's layout (`modules/layout.html` / `layout.html` / `base.html`), parses its layout parameters and **auto-generates an adapted template** at `themes/{theme}/templates/important-dates.html` (templates carry a version marker and auto-upgrade with plugin releases)
- The page renders **inside your theme layout** (navigation, footer, dark mode all follow the theme) with a modern **card-based design** (month/day chips, big "days left" numbers, important badges, avatar person cards, responsive)
- If the theme has no layout fragment or the template fails, it **automatically falls back to the plugin's own page (never a 500)**; switching themes regenerates the template on first visit
- **Privacy**: only public fields are rendered (names, dates, birthdays) — weight, notes and the operation log are never exposed
- An `importantDateFinder` Finder API (`listAll` / `listAllPeople` / `listUpcoming`) is provided for fully custom theme rendering

**📊 Operation Log**
- Every create/update/delete (of dates or people) and every important/visibility switch records the time, action, target and change details — viewable in the "Operation Log" dialog

**💾 Export / Import**
- One-click export of all data (including people) to `important-dates-YYYY-MM-DD.json` for backup/migration; import validates and **skips duplicates by record ID (never overwrites)** with a result summary (old export files are still supported)

## Data Storage

- Dates, people and logs are stored in the **Halo extension store** (`importantdates.halo.run/v1alpha1`), which is backed by **your site's database** — H2 if the site uses H2, MySQL/PostgreSQL if configured (the `extensions` table). Same database and backups as your posts.
- The plugin makes **no network requests** (the frontend only calls the site's own admin API).

## Compatibility

- **Halo 2.14+** (built against the Halo 2.20 platform API, Java 17 bytecode; verified on 2.20 and 2.26)
- Admin role has full permissions after installation — no manual configuration needed

## Install / Upgrade

1. Download the latest `plugin-important-dates-*.jar` from the [Releases](../../releases) page.
2. Halo admin console → **插件 (Plugins)** → **安装 (Install)** → **本地安装 (Local Install)** → upload the jar.
3. **Upgrade**: in the plugin list, **disable** and **uninstall** the old version first, then install the new jar and enable (data lives in the site database — nothing is lost).
4. After enabling, the **重要日期 (Important Dates)** menu appears under **内容 (Content)**; visit `https://your-domain/important-dates` for the public page (no other configuration — it renders inside your theme automatically).

## Usage (Admin)

- **Add date**: top-right「+ 新增日期」→ name, date type, date (calendar panel), linked people (multi-select), notes; tick「重要」to join reminders and「前台展示」to make it public
- **People tab**: manage people; toggle「前台展示」right on the person card
- **List**: type, date, next occurrence, linked people, important marker, frontend switch; filter by person at the top
- **Operation log**: view all change details via the top-right button
- **Export / Import**: backup & restore via the top-right buttons (import validates first and skips duplicates)
- **Reminder settings**: Plugins → Important Dates → Settings: lead days (3 by default), admin reminder, frontend reminder, frontend "important" badge, theme-template rendering (keep on by default)

## Theme Template (custom rendering, optional)

The adapted theme template is **auto-generated** — no manual steps. To **fully customize** the display, edit `themes/{theme}/templates/important-dates.html` (it's regenerated automatically if you delete it, so keep your own copy or use a different filename).

Available model data: `title`, `dates` (title/dateText/nextSolarDate/daysUntil/personNames/important), `people` (displayName/nickname/relation/birthdayText/nextSolarDate/daysUntil), `reminders`, `showImportantTag`. You can also call the `importantDateFinder` Finder API directly.

## Build from Source (optional)

Requires JDK 17+ (verified on JDK 23), Node.js 18+ and npm:

```bash
cd plugin-important-dates
./gradlew build
```

The artifact is produced at `build/libs/plugin-important-dates-1.0.12.jar`.

> Versioning: this project uses a **1.0.x development version sequence** — each iteration bumps the patch version (+0.0.1: 1.0.0 → 1.0.1 → 1.0.2 → …).

## License

[MIT](LICENSE)
