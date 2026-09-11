## v1.2.0-SNAPSHOT · Preview (development build)

> **This is a preview / development build** of the upcoming `1.2.0`. The vehicle module can be tried end to end, but the plugin is still under development: features may change and problems may exist. A stable `1.2.0` will follow.
>
> **Testing is incomplete. Bugs may be destructive (data corruption or data loss).** Please back up your site data before installing and avoid using it on a production site.

### Renamed

The display name changed from "Important Dates" to **Remember** because the plugin now covers dates, people and vehicles. The plugin ID (`plugin-important-dates`), data, settings and the frontend URL (`/important-dates`) are unchanged.

### New in this build

- **Vehicles (cars / e-bikes / bicycles)**: 17 categories, energy type, plate number, VIN, engine number, registration and purchase dates, mileage, status
- **Photo album**: upload or multi-select from the attachment library, drag to reorder, set cover, per-photo visibility toggle
- **Due reminders**: compulsory and commercial insurance, inspection, maintenance, road tax, licence renewal and custom items, with per-item lead days; yearly items roll over automatically; sold or scrapped vehicles stop reminding
- **Linked people**: owner and regular drivers with matching card badges
- **Public page**: "Life / Garage" dual view with album viewer (read-only)
- **Privacy**: masked plate numbers on the public page; sensitive fields are never exposed; no system config writes, no theme file writes, no network requests
- **Other**: unified reminder sorting by days remaining with per-type limits, date picker opens on the selected date, operation log paging and cleanup, export / import JSON v3

### Compatibility

- Halo 2.26 or later (automated regression on a clean 2.26 instance: 44/44)
- Upgrading from 1.1.x: disable, uninstall, install this build and enable. Your data is stored in the site database
- If your theme contains a custom override at `templates/important-dates.html`, replace it with the latest file from `docs/theme-override/`
