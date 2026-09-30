# 1.3.1 · the site-wide popup actually works now, and shows on every page load

> Hard-refresh your browser (**Ctrl+Shift+R**) after installing, and **restart the Halo process**.
> Swapping the jar alone is not enough: Halo keeps serving the previously loaded plugin classes
> from memory, which was the single most confusing part of tracking this down.

## 1. A chain of defects that made the popup impossible

The 1.3.0 popup could not appear at all, for several independent reasons along the delivery path:

- **Anniversaries and birthdays were filtered out**: the popup list required an item status of
  "pending", but only vehicle due items carry that field — so every date item was dropped before it
  could be shown. The popup had never worked for anniversaries.
- **Nodes were marked "already delivered" while rendering the page**, before the script fetched the
  data, so by the time it asked, its own items had been filtered out. That ordering was correct in
  1.2.6, when the popup content was embedded in the page, and became a regression in 1.2.7 when it
  moved to a live fetch.
- **The "already shown" report endpoint is 403 for visitors** — Halo only opens plugin routes to GET,
  so that endpoint was never usable.
- **A scope mismatch**: the popup data once lived in a block on the `/important-dates` page only,
  while the display scope was set to **all pages**, so every other page had no data at all.

The data now comes from the public `GET /important-dates-reminders`, which works whatever the scope is.

## 2. Behaviour change: the popup appears on every page load

At the site owner's request the popup now shows **every time a page is opened** (previously once per
browser). The data is fetched live, so an edit in the console is reflected on the next page load.

The **close menu** (on by default) is unchanged: × offers **this time / 3 days / 10 days / forever**,
with the timed and permanent choices stored in the visitor's browser and expiring on their own.

> ⚠️ The menu has a **5-second timeout**: with no choice made it applies the **default × action**.
> Set that default to "this time" or "3 days" — **not "forever"** — or a slow click will silence the
> popup permanently.

## 3. A silent-mute trap, fixed

With the close menu switched off, pressing × used to apply the configured **default × action**
directly. If that default was a timed or permanent option, a single click wrote a suppression
record — with no menu and no feedback — and the popup then stopped appearing on every later page
load; the symptom was "it disappears as soon as I refresh".

Now, with the menu off, **× only dismisses the popup that is on screen** and writes nothing. The
timed/permanent choices remain available through the menu when it is enabled, where the choice is explicit.

## 4. A server-side regression, fixed

While tidying the code I dropped the endpoint's config fields, so responses went out without
`enabled` / `remindDays` / `toastEnabled` and the script could not tell whether the popup was even
switched on. Restored — and the endpoint now carries a **`build`** field identifying the server logic
actually in effect, because the plugin page's version number does not reflect what is running when
several jars are left in the plugins directory or the process was never restarted.

## 5. Verification

On a live Halo 2.26 instance:

| Suite | Result |
|---|---|
| Popup on every page load (home / other page / repeats) | **5/5 PASS** |
| × no longer mutes silently | **4/4 PASS** |
| Close-menu durations and permanent still work | **3/3 PASS** |
| Site-wide scope (pops off the Remember page too) | **4/4 PASS** |
| Console functional regression | **18/18 PASS** |
| Front-end regression | **5/5 PASS** |

## 6. Upgrading

- **Halo 2.26+**; upgrade straight from 1.2.x / 1.3.0, **no data is lost**, no migration script needed;
- **Restart the Halo process**, and remove any other `plugin-important-dates-*.jar` from the plugins
  directory so only the new one remains;
- Hard-refresh the browser once (plugin assets are served with a one-year max-age; the script URL
  carries a new version parameter, so it invalidates automatically);
- If × was pressed earlier while the default action was "forever", the browser may still hold a
  suppression record — clear it to recover:
  `localStorage.removeItem('id-toast-forever'); localStorage.removeItem('id-toast-until');`
  (run in the console, then reload).
