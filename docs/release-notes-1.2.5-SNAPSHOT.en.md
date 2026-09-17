## v1.2.5-SNAPSHOT

> **This is a preview / development build** that adds graceful degradation and admin marking for image references that no longer resolve. A stable `1.2.5` will follow once testing passes.
>
> **Hard-refresh your browser once after installing (Ctrl+Shift+R)**: the Halo console caches plugin console bundles, so a stale bundle hides the new UI.

### New: when an image reference is dead, degrade gracefully and show it in the console

**Background**: the plugin stores **attachment URLs** (vehicle album `photos[].url`, person avatar `avatar`). Once that attachment is deleted in Halo, moved to another storage policy, or **blocked by another plugin's global rule** (for example a hotlink-protection plugin turning `/upload/**` into 404), the stored URL dies — and the result is a broken image on the public page and in the console, with no easy way to tell which record is at fault.

**Three things changed**:

1. **Graceful degradation on the public page (visitors never see a broken image)**
   - a dead vehicle cover falls back to the vehicle-type icon (`🚙` and friends), keeping the card layout intact;
   - a dead avatar falls back to the initial-character badge (same look as when no avatar is set);
   - a dead photo in the album viewer becomes a “Image unavailable (the attachment may have been deleted)” placeholder while the rest of the album still browses normally.
2. **The console points at it**
   - vehicle cards show a `含失效图片 N` badge; person cards show `大头贴已失效`;
   - the album row in the vehicle form shows a 🚫 placeholder plus “Image unavailable (the attachment may have been deleted) — remove it or pick another”, and it can be removed or replaced in one click.
3. **Cheap detection**: the console fetches the **attachment list once** when a list loads and compares locally (no per-image requests). Only site-local `/upload/**` URLs are judged — external URLs are never marked, and when the attachment list cannot be fetched **nothing is marked at all**, so there are no false positives.

> This is “detect after the fact plus degrade gracefully” — it does **not** stop you from deleting attachments. If an attachment really is gone, use the badge to remove or replace the reference.

### Verified (clean Halo 2.26 instance)

- Regression: `halo-smoke.mjs` **50/50 passed**; browser end-to-end `browser-121-e2e.mjs` **13/13 passed**; attachment-scope suite `verify-album-scope.mjs` **5/5 passed**; drag-and-drop order suite `verify-sort-save.mjs` **6/6 passed**
- **Dead-image suite `verify-image-fallback.mjs` 7/7 passed**: the two console badges, the album-row hint, the public cover falling back to the type icon, the public avatar falling back to the initial character, the album placeholder, and no console errors (built with a real attachment plus a deliberately missing `/upload/definitely-missing-*.png`)
- Screenshots: `docs/manual-test/e125-front-fallback.png`, `docs/manual-test/e125-console-broken.png`

### Compatibility and upgrade

- **Halo 2.26 or later**; upgrading from 1.2.0 – 1.2.4 / 1.1.x: disable, uninstall, install this build and enable — your data is kept
- If your theme contains a custom override at `templates/important-dates.html`, replace it with the latest file from `docs/theme-override/`
