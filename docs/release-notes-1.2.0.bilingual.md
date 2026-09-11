## v1.2.0

### 中文

### ⚠️ 重要提示（请先读）

> **本版本功能测试尚不完整，可能存在导致数据异常甚至数据丢失的严重问题（毁灭性 Bug）。**
> 请**务必先完整备份站点数据（数据库 + 附件）**，并**谨慎升级**；建议先在测试站点验证无误后再用于生产环境。
>
> 说明：本版的实际测试范围是「全新 Halo 2.26 实例的自动化回归 44/44 + 浏览器交互验证」，**尚未覆盖**长期运行、历史数据迁移、多主题兼容、极端数据量等场景；开发版（`1.2.0-SNAPSHOT`）已先行发布供体验，本次为**正式版 1.2.0**，功能与开发版一致，后续会持续修复与完善，欢迎反馈问题。

> **应用更名**：原名「重要日期」→ 现名「**记得**」。原因：本次新增完整的**座驾（爱车）模块**并扩展为前台「生活 / 爱车」双视图，功能已从"记日期"变成"记日子、记人、记爱车"，旧名字无法覆盖；「记得」既保留"记得每个重要日子"，也涵盖"记得保养、记得年检"。插件 ID（`plugin-important-dates`）不变，**更名不影响数据、设置、前台地址与升级路径**，老用户升级即可。

### 🚗 新增：座驾（汽车 / 电瓶车 / 自行车）
- **车辆档案**：品牌与车系型号、17 类分类（轿车 / SUV / MPV / 跑车 / 越野车 / 皮卡 / 旅行车 / 两厢车 / 跨界车 / 微面 / 房车 / 货车 / 客车 / 摩托车 / **电瓶车 / 自行车** / 其他）、能源类型、颜色、车牌号、VIN、发动机号、注册与购买日期、里程、状态（在用车 / 已出售 / 已报废）
- **多图相册**：上传或从附件库多选、拖拽排序、设封面；**每张可单独勾选是否在前台展示**（未勾选仅后台可见，适合行驶证、保单等证件照）
- **到期提醒**：交强险 / 商业险 / 年检 / 保养 / 车船税 / 驾照换证 / 自定义项；每项可设置提前天数与启用开关；按年循环项到期后自动滚动到下一次；已出售 / 报废车辆不再提醒
- **车主与常用驾驶人**（可选）：车辆卡片与人员卡片使用统一徽章（男生「酷」/ 女生「可爱」/ 未关联中性）
- **拖拽排序**：车辆列表可拖拽排序，前后台顺序一致

### 🖥 前台：生活 / 爱车 双视图
- 页面顶部切换（地址栏记忆 `?view=car`）：生活视图＝重要日期 + 牵挂的人；爱车视图＝车辆卡片 + 车主与驾驶人 + 其他重要的人
- **相册查看**：点击车辆封面 → 全屏滚动浏览（只读），仅显示后台勾选「展示」的照片

### 🔒 隐私
- **车牌号在前台永远脱敏**（如 `粤B·****5`）；VIN / 发动机号 / 保单号 / 购买价格不输出到前台；未勾选「展示」的照片不出现在前台
- **零系统配置写入、零主题文件写入、无联网请求**

### ✨ 其他改进（相对 1.1.5）
- 重要日期与座驾到期**统一按剩余天数排序**（谁近谁靠前）；悬浮弹窗每类最多 N 条，超出自动合并提示
- 编辑日期 / 人员时，日历面板自动定位到已选日期；人员关系新增「本人」
- 操作日志支持分页浏览 + 按天自动清理；导出 / 导入升级为 JSON v3（含座驾与相册，兼容旧文件）
- 「生活 / 爱车」切换按钮对比度提升（5.17，达 WCAG AA），不再受主题 button 样式影响

### ⬆️ 兼容与升级
- **Halo 2.26 及以上**（全新 2.26 实例全量回归 44/44 通过；**但未覆盖极端场景，见文首提示**）
- 由 1.1.x 升级：**先备份** → 停用 → 卸载 → 安装本版 → 启用
- 若主题目录存在自定义覆盖文件 `templates/important-dates.html`，请用仓库 `docs/theme-override/` 下最新版替换（或删除该文件使用插件默认模板），否则前台看不到「爱车」视图
- 若使用页面静态化 / 缓存插件，升级后清理一次页面缓存

---

### English

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

