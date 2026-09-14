## v1.2.2-SNAPSHOT

> **This is a preview / development build** that fixes an issue reported against `1.2.1`. A stable `1.2.2` will follow once testing passes.
>
> **Testing is incomplete. Bugs may be destructive (data corruption or data loss).** Please back up your site data before installing and avoid using it on a production site.
>
> **Hard-refresh your browser once after installing (Ctrl+Shift+R)**: the Halo console caches plugin console bundles, so a stale bundle hides the new UI.

### Fixed: the attachment library no longer comes up empty when the configured scope does not match

- **Problem**: the "pick from the attachment library" dialogs for the vehicle album and the person avatar required the configured **category and storage policy to match at the same time**. Whenever one of them did not match the real data (images without a category, or uploaded with another policy) the list was empty — the person dialog even showed a blank box, which looked like "the settings are ignored".
- **Now**: the category + policy pair is preferred, and when it matches **nothing** the scope widens automatically — category only → policy only → all images — with a one-line note at the top that states the effective scope and the match counts, for example:
  `No image matches "category + policy"; widened to category only, showing 12 (category "Article images": 12 matches · policy "Avatars": 0 matches)`
- **"Ungrouped" is handled properly**: the "ungrouped" option now means "images without a category" instead of being compared as a literal group name (which could never match).
- **No more silent defaulting to the first category/policy**: previously an unconfigured site had its library quietly narrowed to one category + policy — exactly what made it look like the settings were not applied. Unconfigured now means "no restriction" and shows every image; saved values that no longer exist (deleted group/policy) fall back to "no restriction".
- **Uploads are unchanged**: files are still stored with the configured category/policy, and "ungrouped" is not sent as a group name.
- **Layout**: the scope explanation has its own row so long text no longer squeezes the dialog title; the dialog still shows "showing N of M images" and keeps the "show all images (ignore category/policy)" switch.

### Verified (clean Halo 2.26 instance)

- Regression: `halo-smoke.mjs` **50/50 passed**; browser end-to-end `browser-121-e2e.mjs` **13/13 passed**
- Attachment scope suite **5/5 passed** (`verify-album-scope.mjs`): category matches while policy does not → widened to category only with match counts (both the vehicle and the person path); "ungrouped" filters correctly; unconfigured shows everything; no console errors

### Compatibility and upgrade

- **Halo 2.26 or later**; upgrading from 1.2.0 / 1.2.1 / 1.1.x: disable, uninstall, install this build and enable — your data is kept
- If your theme contains a custom override at `templates/important-dates.html`, replace it with the latest file from `docs/theme-override/`
