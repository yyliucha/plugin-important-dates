# 2.0.0 · final feature release

> After installing, **hard-refresh the browser (Ctrl+Shift+R)** and **restart the Halo process**. Replacing the jar without restarting leaves Halo running the old code from memory.

This is the **last feature release**. The plugin will keep working but will not gain new features. So the focus is not "what else can it do" but **making it hard to break when nobody is maintaining it — and obvious to diagnose when it does**.

## 1. Built-in self-check: click it first when a reminder does not appear

A new **self-check** card in the settings walks the reminder chain and reports in plain language:

| Check | What it tells you |
| --- | --- |
| Reminder endpoint | Whether reminder data can be fetched, and how many items are currently in their reminder window |
| Server version | The version the backend is actually running (catches "new jar, old code") |
| Plugin version | Whether the plugin and the running server agree — a mismatch almost always means **the jar was replaced without a restart** |
| Popup script | Whether the popup script is injected on this page, and its script sequence number |

Anything abnormal comes with the next step to take (hard-refresh / restart Halo / check the switch). **This exists precisely because nobody will be around to debug it for you.**

## 2. The manual now ships inside the plugin

People who install from the app store **never see the repository README**, so the usage guide lives in the settings as a collapsible **"usage and FAQ"** panel:

- Three steps to get started
- Where the three reminder surfaces are
- Why the popup reappears on refresh, and how to make it less frequent
- What is shown to visitors by default
- What happens when something is overdue (overdue → to-do → always kept, reversible)
- **What to do when a reminder does not appear**
- Where the data lives and how to take it with you

## 3. Long lists now show what is coming up

The date list could only be filtered by person, and was ordered by drag position — with many entries you could not see what was near.

- New **urgency filter**: all / today / within 7 days / within 30 days / later, each with a count.
- New **"days left" column**: "tomorrow", "in 5 days", "3 days ago", with near items highlighted.

## 4. Fixed: drag-reordering scrambled hidden items

Reordering used to write back the order of **only the visible rows**, wiping the sort position of everything filtered out, so those entries silently jumped around. It now moves only the visible items and leaves the rest in their relative order. The new urgency filter would have made this far more destructive, so it is fixed here.

## 5. Popup accessibility

- **Esc closes** the popup. It only dismisses the current popup and **records nothing** — pressing Esc should never mean "stop reminding me from now on".
- The close control is a real `<button>` now: focusable with **Tab**, triggered with Enter, announced as "close reminder" by screen readers.
- The popup uses `role="status"` + `aria-live="polite"` instead of `role="alert"`: it is a reminder, not an error, and should not interrupt what the reader is currently saying.

## 6. Description trimmed to one sentence

The plugin description went from a 200-character run-on to a single sentence:

> 把容易忘的事记下来：纪念日与生日、家人朋友、爱车的保险年检保养到期，到点提醒你，愿意公开的还能展示在博客前台。

## 7. A note on maintenance

- **Upgrading**: upload the new jar on the Plugins page. **Do not hand-replace files in the plugins directory** — Halo records each plugin's load path, and a renamed file simply stops loading (the API returns 404 and the console menu disappears).
- **Your data**: anniversaries, people and vehicles live in Halo's own storage and are not deleted by uninstalling the plugin; the **export** button on the 记得 page writes everything to a JSON file.
- When something looks wrong, run the **self-check** first — it covers the vast majority of "the reminder does not appear" cases.
