# Important Dates (plugin-important-dates)

A Halo 2.x plugin to **record and manage your important dates from the admin console** — wedding anniversaries, children's birth dates, and so on.

[中文版 README](README.md) ｜ [Halo Plugin Store](https://www.halo.run/)

## Features

- Record important dates: **name + date + multiline notes**
- Date type supports **solar / lunar calendar** (lunar months support leap months)
- **Yearly recurring**: solar dates repeat on the same month/day every year; lunar dates are converted to the corresponding solar date each year (the "next occurrence" is displayed automatically)
- **People management**: add people (张三, 李四, …) with name, nickname, relation, birthday (solar/lunar), gender, blood type, height, weight (latest value), hobbies and notes; important dates can **link to multiple people** (e.g. a wedding anniversary linked to the couple) and be filtered by person
- **Custom date picker**: solar mode shows a calendar grid annotated with lunar days; lunar mode lets you pick a year, month (including leap months) and day, with the mapped solar date shown in real time
- **Operation log**: every create / update / delete (of dates or people) records the time, action, target and details — viewable in the "Operation Log" dialog
- **Important flag & reminders**: dates can be marked important/normal; both the admin page and the public `/important-dates` page show an upcoming reminder banner ("Tomorrow is「Wedding Anniversary」"). The lead days (default 3) and the admin/frontend reminder switches are configurable on the plugin settings page
- **Frontend visibility**: dates and people each have a "show on frontend" switch (default on) — hidden items stay admin-only and never appear on the public page (including reminders)
- **Public page**: a theme-independent page at `/important-dates` listing all dates (sorted by next occurrence, with "days left") and people cards — only public fields (name, relation, birthday) are shown; weight, notes and the operation log are never exposed. A `importantDateFinder` Finder API is also provided for themed customization
- **Export / Import**: export all records (including people) to a JSON file for backup/migration; import validates and skips duplicates by record ID (never overwrites) with a result summary dialog
- Admin-only: everything happens in the Halo console ("内容 → 重要日期" menu); nothing is shown on the theme side

## Data Storage

- Records and operation logs are stored in the **Halo extension store** (extension resources `importantdates.halo.run/v1alpha1`), which is backed by **your site's database** — H2 if the site uses H2, MySQL/PostgreSQL if configured (the `extensions` table). Same database, same backups as your posts.
- The plugin makes **no network requests** (the frontend only calls the site's own admin API).

## Compatibility

- Requires **Halo 2.14+** (built against the Halo 2.20 platform API, Java 17 bytecode)
- After installation, the administrator role has view/manage permissions out of the box (no manual configuration)

## Installation

1. Download the latest `plugin-important-dates-*.jar` from the [Releases](../../releases) page and upload it to your server;
2. Open the Halo admin console → **插件 (Plugins)** → **安装 (Install)** → **本地安装 (Local Install)** → upload the jar;
3. Find **重要日期 (Important Dates)** in the installed list and click **启用 (Enable)**;
4. After enabling, the **重要日期** menu appears under the **内容 (Content)** group in the sidebar.

## Usage

- Click **新增 (Add)** in the top-right corner and fill in:
  - **Name**: e.g. "Wedding Anniversary", "Baby's Birth Date";
  - **Date type**: choose solar or lunar;
  - **Date**: click the input to open the calendar panel — in solar mode just click a day (lunar day annotations shown); in lunar mode pick the year and month (leap months appear as "闰X月" when present), then the day;
  - **Notes**: optional details (multiline), e.g. "10th anniversary", "Born at 8:32".
- The **最近一次 (Next occurrence)** column shows the next solar date of a lunar record (auto-converted).
- The **操作日志 (Operation Log)** button shows every create/update/delete with time, target and change details.
- **Export** downloads all records as `important-dates-YYYY-MM-DD.json` (includes people); **Import** restores from that file, skipping duplicates automatically.
- The **人员 (People)** tab manages people; while creating/editing a date you can tick one or more people in "关联人员" (linked people).
- **Important/Normal**: tick "重要" when creating/editing a date (on by default) — only important dates appear in reminder banners.
- **Frontend visibility**: the "前台" switch on dates and people controls appearance on `/important-dates`; when off the item is admin-only. Public page: `https://your-domain/important-dates` (rendered by the plugin itself — no theme changes needed).
- **Reminder settings**: on the plugin settings page (Plugins → Important Dates → Settings) you can set the lead days (default 3) and admin/frontend reminder switches.
- Every record can be **edited / deleted** at any time. Data lives in the site database and survives Halo upgrades.

## Build from Source (optional)

Requires JDK 17+ (verified on JDK 23), Node.js 18+ and npm:

```bash
cd plugin-important-dates
./gradlew build
```

The artifact is produced at `build/libs/plugin-important-dates-1.0.5.jar`.

> Versioning: this project uses a 1.0.x development version sequence — each iteration bumps the patch version (1.0.0 → 1.0.1 → 1.0.2 → …).

## Data Notes

- Data is stored as Halo extension resources `importantdates.halo.run/v1alpha1`; it will be removed together with the Halo site data if the site is deleted — please back up.
- The plugin makes no network requests (the frontend only calls the site's own admin API).

## License

[MIT](LICENSE)
