## v1.2.4-SNAPSHOT

> **This is a preview / development build** that fixes the "HTTP 503 while saving a drag-and-drop order" issue reported against `1.2.3`. A stable `1.2.4` will follow once testing passes.
>
> **Hard-refresh your browser once after installing (Ctrl+Shift+R)**: the Halo console caches plugin console bundles, so a stale bundle hides the new UI.

### Fixed: 503 when saving a dragged order (the reverse proxy rejected the request burst before it reached Halo)

**Symptom**: reordering people / dates / vehicles by drag-and-drop failed with "保存排序失败: Request failed with status code 503", the dialog showed the proxy's `503 Service Temporarily Unavailable` page, and **Halo's log contained no entry at all**.

**Root cause**:

1. The old save routine renumbered the whole list and submitted every update through `Promise.all`, and each update used "GET the latest version, then PUT".
2. Measured on a 4–6 item list, one drag produced **6 GETs + 6 PUTs with a peak concurrency of 6, all inside 45 ms**.
3. The site sits behind a reverse proxy (nginx / CDN). nginx answers `limit_req` (request rate) and `limit_conn` (concurrent connections) with **503 by default**, and it answers by itself — the request never reaches Halo, which is exactly why the server log was empty.

**Fix**:

1. **Write only the range that actually moved** (the contiguous span whose positions changed; if the stored values are not the dense 1..n shape — e.g. edited by hand — it falls back to a full renumber so the result is always correct).
2. **Use JSON Patch**: `PATCH /persons/{name}` with `[{op:"add", path:"/spec/sortOrder", value:N}]` — one field instead of a full GET + PUT, **halving the request count**.
3. **Submit sequentially** (40 ms apart): peak concurrency drops to **1**, so no burst is produced.
4. **Retry on 429/5xx** (300/600 ms backoff, 3 attempts) so a transient blip heals itself.
5. **Clearer error**: when the retries still fail, the message now says the reverse proxy is temporarily unavailable (HTTP 503) and suggests dragging again, instead of only showing the raw status code.

**Measured before/after** (same instance, same drag):

| | Before | After |
|---|---|---|
| Write requests | 6 PUTs (+6 GETs) | 5 PATCHes (0 GETs) |
| Peak concurrency | **6** | **1** |
| Result | burst, easily rejected by the proxy | all 2xx, order persisted correctly |

> Note: if the proxy's limits are very tight (for example `limit_conn` allowing only a couple of connections), it is still worth reviewing `limit_req` / `limit_conn`. This plugin no longer produces bursts.

### Verified (clean Halo 2.26 instance)

- Regression: `halo-smoke.mjs` **50/50 passed**; browser end-to-end `browser-121-e2e.mjs` **13/13 passed**; attachment scope suite `verify-album-scope.mjs` **5/5 passed**
- **Drag-and-drop order suite `verify-sort-save.mjs` 6/6 passed**: asserts peak write concurrency = 1, no per-item GETs, PATCH only, no 5xx, and the persisted order is correct
- Hardened along the way: the smoke script's readiness probe now requires the plugin API **and** the public page to be healthy twice in a row, so the brief window while Halo restarts a freshly installed plugin (which can return `Scheme not found`) is no longer mistaken for a failure

### Compatibility and upgrade

- **Halo 2.26 or later**; upgrading from 1.2.0 / 1.2.1 / 1.2.2 / 1.2.3 / 1.1.x: disable, uninstall, install this build and enable — your data is kept
- If your theme contains a custom override at `templates/important-dates.html`, replace it with the latest file from `docs/theme-override/`
