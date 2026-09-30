# 1.3.0 · vehicle forms tiered by vehicle type, a rebuilt dialog, and a fix for a defect that could go unnoticed

> Hard-refresh your browser once after installing (**Ctrl+Shift+R**): the console caches plugin UI bundles, and a stale bundle will not show the new form.

## 1. A shipped defect, fixed (introduced in 1.2.6, affecting 1.2.7)

On the console **Remember → Vehicles** cards, the **insurance / road-tax / maintenance due badges disappeared entirely**, leaving only inspection, and the card read "no enabled due items".

**Root cause**: the trailing `return` in `resolveDueDate()` had been swallowed into the preceding comment line, so the function returned nothing for every **non-inspection** reminder — and every caller skips on an empty result.

**Why the existing tests stayed green**: the dashboard widget and the reminder state machine read the **server endpoint**, while this function is only used by the **console page** — a path that had no coverage at all. It is fixed, and a browser case now covers it.

## 2. The vehicle form only shows the fields a vehicle actually has

Tiered by **"does it have an engine, does it have a plate"**, so e-bikes and bicycles are no longer handed insurance, inspection and road tax:

| Field | 🚗 Car / motorcycle | 🛵 E-bike | 🚲 Bicycle |
|---|---|---|---|
| Energy type | selectable | **locked to EV** (read-only) | **hidden** |
| Plate number | shown | shown | **hidden** |
| Frame number | shown | shown (labelled "frame / vehicle number") | **hidden** |
| Engine number | shown | **hidden** | **hidden** |
| First registration date | shown (used to derive inspection) | **hidden** | **hidden** |
| Mileage / mileage date | shown | shown | **hidden** |
| Insurer | shown | **hidden** | **hidden** |
| Due items offered | compulsory & commercial insurance, inspection, maintenance, road tax, custom | maintenance, custom | maintenance, custom |

**Driver licence renewal is no longer attached to a vehicle**: it belongs to a person, not a car, so one driver with two cars is not reminded twice. Existing items are kept in the database and simply stop showing and alerting.

## 3. Switching vehicle type never loses data

Turn a car into a bicycle and its insurance / inspection items are **not deleted**:

- they disappear from the form (and from the item dropdown);
- the cards, the dashboard widget, the public banner and the toast **all stop alerting on them**;
- switch back to a car and they return **exactly as they were**, due dates untouched.

Front end and backend apply the same rule for "should this item be alerted on for this vehicle type", and **your stored data is never rewritten**.

## 4. The edit dialog is no longer a long scroll

- **Five collapsible sections**: **basic info** and **due items** open by default; **album**, **people** and **more** collapsed with a summary on the right (e.g. "3 photos", "站长（孙铭）");
- Collapsing uses the **native `<details>` element**, so expand/collapse is guaranteed by the browser rather than by scripted styles;
- Each due item went from two rows plus sub-blocks to a **single row**, with lead days and repeat interval behind "settings" and a plain-language summary when collapsed (e.g. "15 days ahead · yearly").

## 5. Legacy energy values are corrected on display

Older vehicles usually carry the default energy type "fuel", which e-bikes and bicycles inherited too (a card read "bicycle · petrol").

The label is now **corrected by vehicle type at display time**: bicycle → human, e-bike → EV, a stray "human" on a motor vehicle → fuel.
**Stored data is not rewritten** — only the display is corrected; saving the form once persists the normalised value.

## 6. Unreachable code removed

- The self-check panel, the operation-log dialog and all of their call sites are gone (their entries were removed in 1.2.6, leaving no-op implementations behind);
- `selfCheck.ts`, `OperationLog.java` and `OperationLogCleaner.java` deleted (the latter read a settings group that no longer exists, so it ran empty every time);
- The stale operation-log claim in `plugin.yaml` was corrected as well.

## 7. Verification

On a real Halo 2.26 instance, **against existing data** (including 10 historical vehicles):

| Suite | Result |
|---|---|
| Functional `func-128.mjs` | **18/18 PASS** |
| Front-end regression `func-frontend.mjs` | **5/5 PASS** |

Covering: card due items (the regression case for the defect above), the vehicle-type linkage, the energy lock, **data retention across a type switch**, collapsible sections not taking up space plus click to expand/collapse, the backend reminder endpoint filtering by vehicle type, legacy energy correction, and no JS errors on either surface.

Self-testing also uncovered and fixed two further problems: **items that do not apply were still alerting** (only the form had been filtered), and **legacy energy values displayed incorrectly**.

## 8. Upgrading

- **Halo 2.26+**; upgrade straight from 1.2.x, **no data is lost** and no migration script is needed;
- If your theme directory has a `templates/important-dates.html` override, replace it with the latest from `docs/theme-override/` (this release did not change the public vehicle card structure);
- Hard-refresh your browser once after installing.
