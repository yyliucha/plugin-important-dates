# 1.3.3 · the popup stops asking for a dozen decisions, and "never show again" is gone

> After installing, **hard-refresh the browser (Ctrl+Shift+R)** and **restart the Halo process**. Replacing the jar without restarting leaves Halo running the old code from memory.

## 1. The popup is a nudge again, not a wall of items

When a reminder is ignored, the usual reason is not that it shows too little — it shows too much at once.

- **One line per vehicle**: the soonest due item, plus "**this vehicle has N items due**".
  Previously insurance, commercial insurance, vehicle tax and inspection each took a line. They are one errand, split into four decisions, leaving the reader to work out that they belong together.
- **Anything folded away is summarised as "N more"**, including items beyond the per-kind cap. That number counts **only what was actually held back** — overdue, already-handled and not-yet-due items are not mixed in, so it never inflates.
- **A link at the bottom goes straight to the 记得 page** — the console page when you are browsing the console, the public page on the site. The label is configurable.

The full dates have not gone anywhere: the front banner, the dashboard widget and the 记得 page still list every item of every vehicle. The popup reminds; the lists inform.

## 2. "Never show again" has been removed

The only way to go fully quiet used to be "forever", and the cost was that one careless click could hide reminders permanently — with no visible feedback, so it simply looked broken.

Every choice now expires:

- The menu is **this time / not today / hide for 3, 5, 7 or 30 days**.
- The durations are configurable (default `3,5,7,30`); the menu is built from what the server sends, so changing the setting needs no script change.
- **Visitors are not locked out**: a permanent-mute flag written by 1.3.1 or earlier is cleared on sight.
- An unrecognised choice falls back to dismissing the current popup — it can never mute forever.

## 3. You can now cap how often the popup appears

Choose **every page load / at most N times a day / at most once every N minutes**. The counter lives in the visitor's browser, so each device is counted separately.

## 4. Fixed: custom vehicle due-dates never triggered a reminder

The per-vehicle-type capability list was missing "custom", so a custom due-date (say, tyre replacement) could be created and saved but would **never** enter the reminder list. This was a regression introduced with the 1.3.0 vehicle tiering; custom items on cars now remind normally.

## 5. Settings text now matches reality

- The **default × action** is explicitly marked as applying **only while the close menu is on** (with the menu off, × just dismisses the current popup — deliberate, so nothing is silenced behind your back).
- Toast help text no longer describes the removed "records written to the database" behaviour.

## 6. A word on upgrading

**Do not hand-replace the jar in the plugins directory.** Halo records each plugin's load path in its database; if you swap the file, that path still points at the old filename and the plugin simply stops loading (the API returns 404 and the console menu disappears). Upgrade by uploading the new jar on the Plugins page, or let Halo run its own upgrade flow.
