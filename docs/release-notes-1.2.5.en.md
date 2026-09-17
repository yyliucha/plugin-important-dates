## v1.2.5

### Testing and upgrade notes

> Verified on a **clean Halo 2.26 instance**: smoke **50/50**, browser end-to-end **13/13**, dead-image degradation **7/7**, attachment scope **5/5**, drag-and-drop order **6/6**, this release's new capabilities **6/6**, and a settings probe **19/19** (see the verification section below). Long-running operation, multi-theme compatibility and extreme data volumes are not covered yet.
>
> **Hard-refresh your browser once after upgrading (Ctrl+Shift+R / Cmd+Shift+R)**: the Halo console caches plugin console bundles, so a stale bundle hides the new UI.
> **This is a preview / development build** with 14 improvements. A stable `1.2.5` will follow once testing passes.
>
> **Hard-refresh your browser once after installing (Ctrl+Shift+R)**: the Halo console caches plugin console bundles, so a stale bundle hides the new UI.

### 1. Stability — every write goes through one hardened path

- **Only changed fields**: single-field actions (public visibility, inspection-note acknowledgement, drag sorting, …) now use **JSON Patch** instead of “GET the latest version, then PUT the whole object”, halving the request count.
- **Batch writes are sequential** with a fixed gap — no more bursts; full-object saves (forms) also re-fetch the version and retry once on 409.
- **Backoff retries on 429 / 5xx** for every write.
- **Actionable Chinese errors**: 401/403/404/409/413/429/502/503/504 each get a clear message (for example “the site's reverse proxy is temporarily unavailable (HTTP 503) — retried and still failing, please try again”), instead of a bare `code 503`.
- **Safer imports**: JSON import submits **one record at a time** with a gap, shows **progress** (x/y, failures) and lists **per-record failure reasons** (previously only a count).

### 2. Image experience

- **Post-upload check**: after uploading, the URL is verified to be reachable before it is written into the record — no more “saved but unopenable” (blocked by a storage policy or another plugin).
- **Optional compression before upload**: images above 1.5 MB are compressed in the browser to a configurable width (1920 by default) with a “saved X MB” note; can be switched off under Photo settings.
- **Thumbnails everywhere (configurable)**: admin lists, album grids and public cards use Halo's `?width=` derivatives (480 px by default, site-local `/upload/` attachments only) while opening a photo still shows the original; 0 means always original.
- **One-click repair of stale references**: vehicle/person cards flag `含失效图片 N` / `大头贴已失效`, album rows offer “choose another”, and a new **“Remove broken images (N)”** action cleans them up; the public page already degrades to icons / initials / placeholders, so visitors never see a broken image.

### 3. Reminders

- **“Done — roll one cycle”**: a button on each due item moves its date forward by its repeat interval (12 months by default) so renewals and inspections need no manual date editing.
- **Dismiss a single reminder**: each line in the public banner and the dashboard widget has an ✕ that means “do not show this again in the current due cycle” (stored in the browser; a new due date brings it back), with a one-click restore; the capability can be switched off in settings.
- **Configurable inspection rules**: new “Vehicle settings → inspection nodes (default 2,4,6,10)” and “yearly on-site inspection from (default 11)” — adjust to your local vehicle-office rules; the form preview, public reminders and the rule note all follow.

### 4. Public page

- **Garage toolbar**: sort by default (admin drag order) / nearest due / name, and filter in-use vs. all (including sold and scrapped) — client-side only.
- **Consistent album ratio**: album photos render in a 4:3 frame (`object-fit: cover`) so browsing no longer jumps between image sizes.

### 5. Maintainability

- **Admin “Self-check” panel** (top-right of the Remember page): plugin version, data counts, reminder/display settings, how many images the photo settings actually match (and whether the scope was widened), **how many image references are stale**, and how many reminders are due soon — diagnosis without digging through logs.
- **“About” settings group**: version plus four usage notes (hard refresh, self-check entry, image degradation behaviour, zero-write promise).

### Verified (clean Halo 2.26 instance)

| Suite | Result |
|---|---|
| Smoke `halo-smoke.mjs` | **50/50 passed** |
| Browser end-to-end `browser-121-e2e.mjs` | **13/13 passed** |
| Attachment scope `verify-album-scope.mjs` | **5/5 passed** |
| Drag-and-drop order `verify-sort-save.mjs` | **6/6 passed** |
| Dead-image degradation `verify-image-fallback.mjs` | **7/7 passed** |
| **New: 1.2.5 capabilities `verify-features-125.mjs`** | **6/6 passed** (8 self-check rows, +12-month roll, `?width=480` thumbnails, public sort/filter, per-line dismissal, no console errors) |

### Compatibility and upgrade

- **Halo 2.26 or later**; upgrading from 1.2.0 – 1.2.4 / 1.1.x: disable, uninstall, install this build and enable — your data is kept
- If your theme contains a custom override at `templates/important-dates.html`, replace it with the latest file from `docs/theme-override/`
