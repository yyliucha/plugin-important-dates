## v1.2.3

### Testing and upgrade notes

> Verified on a **clean Halo 2.26 instance**: automated regression **50/50 passed**, browser end-to-end **13/13 passed**, attachment-scope suite **5/5 passed**, plus a sizing repro for the fix in this release (a 1920×1080 cover renders in a 395×191 card with an 84×62 thumbnail). Long-running operation, multi-theme compatibility and extreme data volumes are not covered yet.
>
> **Hard-refresh your browser once after upgrading (Ctrl+Shift+R / Cmd+Shift+R)**: the Halo console caches plugin console bundles, and without a hard refresh the new UI may not show up (for example a missing "Remember" menu or a missing dashboard widget).

### Fixed: the admin "Garage" tab is compact again (the cover no longer fills the screen)

- **Symptom**: as soon as a vehicle album had a photo, the cover in the admin 座驾 (Garage) tab was blown up to nearly full screen (a 1920×1080 upload rendered at 1180×664 inside a 1212×836 card).
- **Root cause**: the style block in `console/src/views/ImportantDatesView.vue` was closed too early — roughly 3 KB of CSS (`.cars-grid`, `.car-card`, `.car-cover`, `.car-events`, `.rule-notice`, `.person-avatar-char`, …) sat **after** `</style>` and was dropped by the bundler, so those rules never applied. Without a photo the cards still looked passable; with a photo the missing `width/height/object-fit` became obvious.
- **Fix**: the style block now closes at the end of the file, so every rule is bundled again (CSS grows from 16.65 KB back to 19.29 KB).
- **Result (measured)**: card 1212×836 → **395×191**; cover 1180×664 → **84×62** (`object-fit: cover`, so the uploaded size does not matter); the garage list is a **multi-column grid** again, with due badges (overdue / in N days), owner and drivers, and the edit / public-visibility / delete buttons back to their designed compact styling.
- **Also restored**: the same dropped block carried the styling of the one-time on-site inspection notice (`.rule-notice`) and the person initial avatars (`.person-avatar-char`), which now look as designed as well.

### Verified (clean Halo 2.26 instance)

- Regression: `halo-smoke.mjs` **50/50 passed**; browser end-to-end `browser-121-e2e.mjs` **13/13 passed**; attachment scope suite `verify-album-scope.mjs` **5/5 passed**
- Sizing repro `repro-car-card.mjs`: after uploading a 1920×1080 cover, the card and cover match the design values (395×191 / 84×62)

### Compatibility and upgrade

- **Halo 2.26 or later**; upgrading from 1.2.0 / 1.2.1 / 1.2.2 / 1.1.x: disable, uninstall, install this build and enable — your data is kept
- If your theme contains a custom override at `templates/important-dates.html`, replace it with the latest file from `docs/theme-override/`
- If you use a page cache or static-site plugin, clear the cache once after upgrading
