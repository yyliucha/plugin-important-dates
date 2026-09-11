## v1.2.0

### Important notice (read first)

> **This release has not been fully tested. It may cause data corruption or even data loss (potentially destructive bugs).**
> Please **back up your site data (database and attachments) before upgrading** and proceed with caution; validate on a staging site first.
>
> Scope of testing so far: automated regression on a clean Halo 2.26 instance (44/44 checks) plus browser interaction checks. Long-running operation, migration of existing data, multi-theme compatibility and extreme data volumes are **not** covered yet.
>
> A development build (`1.2.0-SNAPSHOT`) was published earlier as a preview. This is the stable `1.2.0` release with the same feature set; further fixes and improvements will follow. Feedback is welcome.

### Renamed: "Important Dates" becomes "Remember"

The plugin grew from dates-only into dates, people and vehicles, so the display name changed to **Remember**. The plugin ID (`plugin-important-dates`), your data, settings, frontend URL (`/important-dates`) and the upgrade path are unchanged.

### New: Vehicles (cars / e-bikes / bicycles)

- **Vehicle profile**: brand and model, 17 categories (sedan, SUV, MPV, sports, off-road, pickup, wagon, hatchback, crossover, van, RV, truck, bus, motorcycle, **e-bike, bicycle**, other), energy type (fuel / EV / PHEV / HEV / human), colour, plate number, VIN, engine number, registration and purchase dates, mileage, status (in use / sold / scrapped)
- **Photo album**: upload or multi-select from the attachment library, drag to reorder, set cover; **each photo can be toggled visible or admin-only** (useful for licence and insurance documents)
- **Due reminders**: compulsory and commercial insurance, inspection, maintenance (computed from the last service plus interval), road tax, licence renewal, custom items; per-item lead days and on/off; yearly items roll over automatically; sold or scrapped vehicles stop reminding
- **Linked people**: owner and regular drivers (optional); vehicle cards and person cards share the same badge style (cool for male, cute for female, neutral when unlinked)
- **Drag to sort**: vehicle order is shared between the admin console and the public page

### Public page: "Life / Garage" dual view

- Switch at the top of the page, remembered in the URL (`?view=car`). Life view: important dates plus the people you care about. Garage view: vehicle cards, owners and drivers, and other people
- **Album viewer**: click a vehicle cover to browse full screen (read-only, Esc to close); only photos marked as visible are shown

### Privacy

- **Plate numbers are always masked on the public page** (for example `YueB****5`); VIN, engine number, policy number and purchase price are never exposed; photos not marked visible never appear publicly
- **No system config writes, no theme file writes, no network requests**

### Other improvements since 1.1.5

- Dates and vehicle due items are merged into a single list sorted by days remaining; the site-wide toast shows at most N items per type and merges the rest into a summary
- The date picker opens on the already selected date when editing; a "self" relation was added for people
- Operation log now supports paging and automatic retention-based cleanup; export / import upgraded to JSON v3 (including vehicles and albums, backward compatible)
- The "Life / Garage" switch button now has a WCAG AA contrast ratio (5.17) and is no longer affected by theme button styles

### Compatibility and upgrade

- **Halo 2.26 or later** (automated regression on a clean 2.26 instance: 44/44; extreme scenarios are not covered — see the notice above)
- Upgrading from 1.1.x: **back up first**, then disable, uninstall, install this version and enable
- If your theme contains a custom override at `templates/important-dates.html`, replace it with the latest file from `docs/theme-override/` (or delete it to use the plugin default), otherwise the Garage view will not appear
- If you use a page cache or static-site plugin, clear the cache once after upgrading
