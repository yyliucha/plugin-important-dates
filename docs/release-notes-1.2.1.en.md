## v1.2.1

### Testing and upgrade notes

> Scope of testing so far: automated regression on a clean Halo 2.26 instance (**50/50 checks**) plus browser end-to-end checks (**13/13**) and an idempotent migration check on existing data. Long-running operation, multi-theme compatibility and extreme data volumes are **not** covered yet.
>
> A development build (`1.2.1-SNAPSHOT`) was published earlier as a preview. This is the stable `1.2.1` release with the same feature set (plus the widget footer that now always reports the total). Feedback is welcome.
>
> Version note: the `1.2.1` number had never been released (the latest stable was `1.2.0`), so this release uses `1.2.1` directly — no version is skipped.

### Vehicle due items that match real paperwork

- **Vehicle-level insurer**: enter the insurance company once per vehicle (with quick picks for common ones); compulsory and commercial insurance share it, and a single item can still override it via "use another insurer"
- **Repeat interval per item**: every year (12) / every two years (24) / every three years (36) / one-off / custom months. "One-off" stops after the reminder fires once
- **Trimmed due-item row**: type, policy number, due date, lead days, repeat interval, enabled
- **Idempotent migration** for existing data: at startup, per-item insurers are promoted to the vehicle level and duplicates are cleared. It only reads and writes the plugin's own vehicle records and can run repeatedly

### Inspection schedule derived from the rules, still overridable

- When no inspection date is entered, the next inspection is derived from the **first registration date plus the vehicle category**:
  - Non-commercial small passenger cars: sticker only in years 2 and 4, on-site inspection in years 6 and 10, yearly on-site inspection from year 11
  - Motorcycles: sticker every two years for the first four years, then yearly on-site inspection (local rules apply)
  - E-bikes and bicycles: normally no inspection; fill it in manually if your local rules require one
- Reminder titles carry the stage (for example "Inspection · sticker renewal"), the form shows the derived date with its basis, and a missing registration date raises a prompt
- **Manual override**: tick "specify the date manually" to use your own date (clearing it stops inspection reminders)
- **30 days lead by default**: on-site inspection usually takes 2–3 working days, so plan ahead

### Inspection and road tax follow the insurance date by default

- Both follow the **compulsory insurance due date** (linked, read-only) and are saved with the same date
- Untick to enter a separate date; if the compulsory insurance date is still empty, the form tells you and links up as soon as it is filled

### Reminders and dashboard

- **Same car, same day merged**: compulsory insurance, commercial insurance, road tax and inspection due on one day become a single line (for example "Xiaobai · compulsory / commercial / inspection"); the admin list still shows each item
- **Dashboard widget paging**: 5 items per page by default, adjustable or switchable off under Settings → Display; the widget shows the **complete reminder list** (no longer capped by the toast noise limit) and its footer always reports the total ("9 items · 1 per page", or just the count when paging is off); paging only changes local state
- **One-time rule notice**: when a vehicle enters the on-site inspection period (from year 6) or switches to yearly inspection (from year 11), the vehicle page shows a notice once and stays quiet after "Got it"
- **Overdue items stand out**: the widget now shows "overdue by N days" instead of "today" for reminders that already passed

### Compatibility and upgrade

- **Halo 2.26 or later** (full regression on a clean 2.26 instance: **50/50 passed**; browser end-to-end: **13/13 passed**, covering the vehicle form, derived inspection with manual override, insurance-synced dates, dashboard paging and merged reminders; idempotent migration of existing data verified)
- Upgrading from 1.2.0 / 1.1.x: disable, uninstall, install this build and enable. Your data is kept and migrated idempotently
- **Hard-refresh your browser once after upgrading (Ctrl+Shift+R / Cmd+Shift+R)**: the Halo console caches plugin console bundles, and without a hard refresh you may see a missing "Remember" menu, missing plugin settings tabs or a missing dashboard widget (confirmed in testing — a hard refresh fixes it, nothing is wrong on the server)
- If your theme contains a custom override at `templates/important-dates.html`, replace it with the latest file from `docs/theme-override/`
- If you use a page cache or static-site plugin, clear the cache once after upgrading
