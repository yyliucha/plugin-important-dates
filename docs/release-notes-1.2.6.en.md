## v1.2.6

### Testing and upgrade notes

> Verified on a **clean Halo 2.26 instance**: smoke **50/50**, reminder state machine **7/7**, prompts & undo **7/7**, maintenance semantics **4/4**, dead-image degradation **7/7**, browser end-to-end **13/13**, attachment scope **5/5**, drag-and-drop order **6/6**.
>
> **Hard-refresh your browser after upgrading (Ctrl+Shift+R)** — the console caches both the plugin console bundle and the reminder script.
>
> **What changes for you**: the old "a past due date silently rolls into the next cycle" behaviour is gone — **only pressing "Done" rolls a date forward**. Existing repeating items whose date has passed without being confirmed will therefore show up as **overdue** in the console; one press on "Done" moves them to the next cycle.

### Highlights

- **Done-driven rolling**: a past due date now means *overdue*, not "next cycle". Pressing Done rolls it by the repeat interval (always into the future).
- **Overdue window (3 days, configurable 1–30)** with day-by-day wording, then a **"to-do" state** that is never silently dropped (the old 30-day disappearance is fixed).
- **Done semantics**: repeating items roll one cycle; **maintenance items record "just serviced"** (last service date + next due from the interval); one-off items are completed.
- **Undo** restores the previous due date (and the previous service date) in one click; **ignore** is per cycle and comes back when the date changes.
- **Cadence**: reminder nodes every 7 days inside the window + the 15/7/3/1/0 ladder + overdue days 1/2/3, each node popping exactly once and the record stored in the database (browser-independent).
- **Public surfaces** only show pending, not-overdue items; the toast is limited to the Remember page by default (configurable) and now fetches live data, so page caches can no longer replay stale reminders.
- **In-place actions**: Done / Undo inside the vehicle dialog persist immediately, refresh just that row and keep the dialog open.
- **Humanized copy** everywhere (Chinese dates, warmer confirmations, no HTTP codes or log-style wording).
- **Removed** on request: the self-check panel, the operation-log entry (and log writing), the About and Log settings groups, the public garage sort/filter toolbar, and several plugin self-description footers.
- **Fixed**: enabling the site-wide toast used to swallow the whole Remember page (self-closing `<script/>`); saving from the vehicle dialog wiped reminder state; the reminder row failed to render due to a missing import.

### Compatibility

Halo 2.26+. Upgrading from 1.2.0 – 1.2.5: disable → uninstall → install → enable; your data is kept (no migration script needed).