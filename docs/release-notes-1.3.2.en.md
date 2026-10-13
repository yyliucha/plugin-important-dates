# 1.3.2 · the plugin is simply "记得" now

> Hard-refresh your browser once after installing (**Ctrl+Shift+R**). This release is copy only —
> **functionality is identical to 1.3.1**.

## 1. The former name is gone

The rename happened several versions ago, yet the store listing and the plugin page still carried a
"formerly Important Dates" note. From 1.3.2 **every public description talks about "记得" and nothing
else**:

- Plugin description (Halo plugin page / app store): "记得 - **重要日期与爱车**: …" became
  "记得 - **记日子、记人、记爱车**: …";
- README (Chinese and English) and the store README: the titles and the rename paragraph no longer
  mention the old name;
- The store listing's short summary, description and cover notes were updated to match.

**Deliberately unchanged** (changing them would break upgrades or data): the plugin id
`plugin-important-dates`, the public URL `/important-dates`, the jar name and the setting keys. Your
data, settings and upgrade path are untouched.

## 2. Functionality

The same as `1.3.1` — that is: the site-wide popup works and can be set to appear on **every page
load**; the vehicle form only shows the fields a vehicle actually has (e-bike locked to EV, bicycle
without plate or energy type); switching vehicle type keeps your data and switching back restores it;
and the reminder state machine (done rolls forward, overdue to-do state, one-click undo) plus
privacy masking all remain as they were.

## 3. Verification

| Suite | Result |
|---|---|
| Popup contract (today / every visit / off-node days / new browser / no cookie / × does not mute) | **6/6 PASS** |
| Popup on every page load | **5/5 PASS** |
| × no longer mutes silently | **4/4 PASS** |
| Close-menu durations and permanent | **3/3 PASS** |
| Site-wide scope | **4/4 PASS** |
| Console functional regression | **18/18 PASS** |
| Front-end regression | **5/5 PASS** |

## 4. Upgrading

- **Halo 2.26+**; upgrade straight from 1.3.x, **no data is lost**;
- The description lives inside the jar, so it only updates by installing this version — editing the
  store text alone will not change the plugin page;
- **Restart the Halo process**, and remove any other `plugin-important-dates-*.jar` from the plugins
  directory so only the new one remains;
- Hard-refresh the browser once.
