## v1.2.4

### Testing and upgrade notes

> Verified on a **clean Halo 2.26 instance**: automated regression **50/50 passed**, browser end-to-end **13/13 passed**, attachment-scope suite **5/5 passed** and a drag-and-drop order suite **6/6 passed** (peak write concurrency = 1, JSON Patch only, no per-item GETs, no 5xx, persisted order correct). Long-running operation, multi-theme compatibility and extreme data volumes are not covered yet.
>
> **Hard-refresh your browser once after upgrading (Ctrl+Shift+R / Cmd+Shift+R)**: the Halo console caches plugin console bundles, and without a hard refresh the new UI may not show up (for example a missing "Remember" menu or a missing dashboard widget).

### Fixed: 503 when saving a dragged order (the reverse proxy rejected the request burst before it reached Halo)

- **Symptom**: reordering people / dates / vehicles by drag-and-drop failed with "保存排序失败: Request failed with status code 503", the dialog showed the proxy's `503 Service Temporarily Unavailable` page, and **Halo's log contained no entry at all**.
- **Root cause**:
  1. The old routine renumbered the whole list and submitted every update through `Promise.all`, and each update used "GET the latest version, then PUT";
  2. Measured on a 4–6 item list, one drag produced **6 GETs + 6 PUTs with a peak concurrency of 6, all inside 45 ms**;
  3. The site sits behind a reverse proxy (nginx / CDN). nginx answers `limit_req` (request rate) and `limit_conn` (concurrent connections) with **503 by default**, and it answers by itself — the request never reaches Halo, which is exactly why the server log was empty.
- **Fix**: ① write only the contiguous range that actually moved (falling back to a full renumber when the stored values are not the dense 1..n shape, so the result is always correct); ② use **JSON Patch** to change just `spec.sortOrder`, dropping the GET and halving the request count; ③ submit **sequentially** (40 ms apart) so peak concurrency drops to 1; ④ **retry with backoff** on 429/5xx (3 attempts); ⑤ report the reverse proxy explicitly instead of only the raw status code.
- **Measured before/after**:

  | | Before | After |
  |---|---|---|
  | Write requests | 6 PUTs (+6 GETs) | 5 PATCHes (0 GETs) |
  | Peak concurrency | **6** | **1** |
  | Result | burst, easily rejected by the proxy | all 2xx, order persisted correctly |

> Note: if the proxy's limits are very tight (for example `limit_conn` allowing only a couple of connections), it is still worth reviewing `limit_req` / `limit_conn`. This plugin no longer produces bursts.

### Verified (clean Halo 2.26 instance)

- Regression: `halo-smoke.mjs` **50/50 passed**; browser end-to-end `browser-121-e2e.mjs` **13/13 passed**; attachment-scope suite `verify-album-scope.mjs` **5/5 passed**
- Drag-and-drop order suite `verify-sort-save.mjs` **6/6 passed**: asserts peak write concurrency = 1, no per-item GETs, PATCH only, no 5xx, and the persisted order is correct
- Hardened along the way: the smoke script's readiness probe now requires the plugin API **and** the public page to be healthy twice in a row, so the brief window while Halo restarts a freshly installed plugin (which can return `Scheme not found`) is no longer mistaken for a failure

### Compatibility and upgrade

- **Halo 2.26 or later**; upgrading from 1.2.0 / 1.2.1 / 1.2.2 / 1.2.3 / 1.1.x: disable, uninstall, install this build and enable — your data is kept
- If your theme contains a custom override at `templates/important-dates.html`, replace it with the latest file from `docs/theme-override/`
- If you use a page cache or static-site plugin, clear the cache once after upgrading
