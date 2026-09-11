# 记得 · 重要日期与爱车（plugin-important-dates）

[![build](https://github.com/yyliucha/plugin-important-dates/actions/workflows/build.yaml/badge.svg)](https://github.com/yyliucha/plugin-important-dates/actions/workflows/build.yaml)
[![plugin](https://img.shields.io/badge/Halo-2.x-1f6feb?logo=halo&color=1f6feb)](https://github.com/halo-dev/halo)

一个 Halo 2.x 插件：记录纪念日、生日与家人朋友，也管好你的座驾（汽车 / 电瓶车 / 自行车）——保险、年检、保养到期自动提醒；支持阳历/农历、多图相册、前台「生活 / 爱车」双视图、隐私脱敏，**零系统配置写入、零主题文件写入**。

> **更名说明**：原名「重要日期」，1.2.0 起更名「**记得**」——功能已从"记日期"扩展到"记日子、记人、记爱车"，旧名装不下。插件 ID（`plugin-important-dates`）不变，**数据、设置、前台地址（`/important-dates`）与升级路径均不受影响**。

[English README](README.en.md) ｜ [Releases](https://github.com/yyliucha/plugin-important-dates/releases) ｜ [问题反馈](https://github.com/yyliucha/plugin-important-dates/issues) ｜ 作者：[yyliucha](https://github.com/yyliucha)

## 截图

| 截图 | 说明 |
| --- | --- |
| ![仪表盘提醒小组件](https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/screenshot-dashboard.png) | **控制台仪表盘小组件**：到期提醒常驻仪表盘，每分钟自动刷新 |
| ![后台页签](https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/screenshot-console-main.png) | **后台页签**：重要日期 / 人员 / 座驾，提醒横幅 + 卡片列表 + 拖拽排序 |
| ![座驾列表](https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/screenshot-console-car.png) | **座驾页签**：分类图标、车牌、到期徽章（已过期 / 临近）、车主与驾驶人、前台开关 |
| ![座驾表单](https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/screenshot-console-car-form.png) | **座驾表单**：分类（含电瓶车 / 自行车）、能源、证照与里程、多图相册、到期项 |
| ![前台页面](https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/screenshot-frontend-page.png) | **前台 `/important-dates`**：生活视图——重要日期 + 牵挂的人（生日与纪念日倒计时） |
| ![前台爱车视图](https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/screenshot-frontend-car.png) | **爱车视图**：车辆卡片（脱敏车牌、到期徽章）+ 车主与驾驶人（统一徽章）+ 其他重要的人 |
| ![前台相册](https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/screenshot-frontend-album.png) | **相册查看**：点击封面全屏浏览（只读、Esc 关闭），仅显示后台勾选「展示」的照片 |
| ![全站悬浮提醒](https://raw.githubusercontent.com/yyliucha/plugin-important-dates/main/docs/screenshots/screenshot-toast.png) | **全站悬浮提醒**：位置自选、倒计时 + 进度条、关闭方式菜单（本次 / 3 天 / 10 天 / 永久） |

## 功能

**📅 重要日期**
- 名称 + 日期 + 多行备注；**阳历 / 农历（含闰月）**，农历自动换算当年阳历
- **每年自动循环**，列表显示"最近一次"与"还有几天"；支持**拖拽排序**（前后台一致）
- 自研日期选择器：阳历格内标注农历；农历选年/月（含闰月）/日实时换算；**编辑时面板定位到已选日期**

**👤 人员**
- 姓名、昵称、关系（含"本人"）、生日（阳历/农历）、性别、血型、身高、体重、喜好、备注、**大头贴**（官方附件上传 / 附件库选择）；支持拖拽排序
- 重要日期可关联多人，列表可按人员筛选

**🚗 座驾（汽车 / 电瓶车 / 自行车）**
- **17 类分类**（轿车 / SUV / MPV / 跑车 / 越野车 / 皮卡 / 旅行车 / 两厢车 / 跨界车 / 微面 / 房车 / 货车 / 客车 / 摩托车 / **电瓶车 / 自行车** / 其他）、能源类型（燃油 / 纯电 / 插混 / 油电混动 / 人力）、品牌型号、颜色、VIN、发动机号、注册与购买日期、里程、状态（在用车 / 已出售 / 已报废）
- **多图相册**：上传或附件库多选、拖拽排序、设封面；**每张可单独勾选「展示」**（未勾选仅后台可见，适合行驶证、保单等证件照）
- **到期提醒**：交强险 / 商业险 / 年检 / 保养（按上次保养 + 间隔月数推算）/ 车船税 / 驾照换证 / 自定义项；每项可设启用与提前天数；**按年循环项到期自动滚动**；已出售 / 报废不再提醒
- **关联人员**：车主 + 常用驾驶人（可选），车辆卡片与人员卡片使用**统一徽章**（男生「酷」/ 女生「可爱」/ 未关联中性）

**🔔 到期提醒（三处，任你挑）**
- **仪表盘小组件**（Halo 2.21+）：常驻仪表盘、每分钟刷新（仪表盘 → 编辑 → 添加部件 → 小部件中心 → 分组「记得」）
- **后台 + 前台横幅**："「结婚纪念日」明天就到啦～" / "「小白」的交强险还有 7 天到期，记得安排一下呀～"
- **全站悬浮弹窗**（可选）：任意页面弹出，位置 / 文案 / 倒计时可配
- 重要日期与座驾到期**统一排序（谁近谁靠前）**；悬浮弹窗每类最多 N 条，超出自动合并提示

**👁 隐私**
- 日期、人员、车辆各有「前台展示」开关（车辆默认关闭）
- 前台**永不输出**：体重、血型、身高、喜好、备注；**车牌号永远脱敏**（`粤B·****5`）；VIN、发动机号、保单号、购买价格不输出；生日默认脱敏
- 未勾选「展示」的照片不出现在前台相册

**🏠 前台页面（插件默认模板，主题可选覆盖）**
- 单页 **「生活 / 爱车」** 双视图切换（地址栏记忆 `?view=car`）：生活视图＝重要日期 + 牵挂的人；爱车视图＝车辆卡片 + 车主与驾驶人 + 其他重要的人
- **相册**：点击车辆封面全屏滚动查看（只读）
- 通过官方**页面布局契约**复用主题外壳（主题不支持时用 Halo fallback 布局）；主题可放置同名模板覆盖；**插件不写入、不修改任何主题文件**（停用 / 卸载零残留）
- 提供 `importantDateFinder`：`listAll()` / `listAllPeople()` / `listAllCars()` / `listUpcoming(days)` / `listUpcomingCarEvents(days)`

**📊 其他**
- **操作日志**：日期 / 人员 / 座驾的增删改全程记录，分页浏览 + 按天自动清理（默认 30 天）
- **导出 / 导入**：JSON（v3，含人员与座驾），判重跳过、不覆盖，兼容旧版导出文件

## 数据与合规

- 数据存于 **Halo 扩展存储**（`importantdates.halo.run/v1alpha1`），底层即站点数据库（H2 / MySQL / PostgreSQL），与站点同库同备份
- **零系统配置写入**（不使用「代码注入」，脚本经官方 `TemplateHeadProcessor` 输出）、**零主题文件写入**
- **无任何联网请求**，不采集、不上传任何用户数据

## 兼容性

- **Halo 2.26 及以上**（按官方 2.26 文档与扩展点实现；Java 17 字节码；全新 2.26 实例全量回归 44/44 通过）
- 管理员安装后默认拥有全部权限，无需手动配置角色权限

## 安装与升级

1. 从 [Releases](https://github.com/yyliucha/plugin-important-dates/releases) 下载 `plugin-important-dates-*.jar`；
2. Halo 后台 → **插件** → **安装** → 本地安装 → 上传 jar → 启用（左侧菜单 **内容 → 记得**）；
3. 前台访问 `https://你的域名/important-dates`。

**升级**：停用 → 卸载旧版 → 安装新 jar → 启用（数据不丢失）。若使用页面静态化 / 缓存插件，升级后清理一次页面缓存。

## 使用（后台）

- **新增日期**：名称、日期类型、日期（阳历点选 / 农历选年月日）、关联人员（可多选）、备注；可设「重要」与「前台展示」
- **人员页签**：维护人员信息与「前台展示」；可拖拽排序
- **座驾页签**：维护车辆档案、相册（含逐张「展示」勾选）、到期项；可拖拽排序；卡片上可直接切换「前台展示」
- **操作日志 / 导出 / 导入**：页面右上角
- **提醒与隐私配置**：插件 → 记得 → 设置（提醒、座驾设置、照片设置、隐私、日志）

## 全站悬浮提醒（可选，设置驱动）

- **启用**：经官方 `TemplateHeadProcessor` 输出脚本，关闭即不输出，停用 / 卸载随插件消失
- **位置**：右下角 / 左下角 / 右上角 / 左上角 / 底部居中 / 屏幕中间（默认右下角）
- **文案占位符**：`{title}`、`{whenText}`、`{daysUntil}`、`{dateText}`、`{nextSolarDate}`
- **行为**：自动关闭（默认 8 秒，含倒计时 + 进度条）；点 × 可选**本次 / 3 天 / 10 天 / 永久**；站主可设 × 默认行为与是否显示关闭菜单

> 历史升级提示：1.0.21 及以前使用「代码注入」方式，1.0.30–1.1.1 曾自动维护注入片段；自 1.1.2 起改为官方扩展点。**若站点仍留有 `id-toast:start/end` 片段，请到「系统设置 → 代码注入」删除一次。**

## 主题模板（自定义展示，可选）

插件**不写入主题文件**。想完全自定义时，在主题放置 `templates/important-dates.html`（TemplateNameResolver 优先使用；删除即回退插件默认模板）。

可用数据：
- 生活视图：`title`、`dates`、`people`、`reminders`、`showImportantTag`、`showAvatar`
- 爱车视图：`cars`（含 `plateMasked`、`coverUrl`、`photos`、`skin`、`events`）、`carEvents`、`carPeople`、`otherPeople`、`personCars`、`showCarSection`、`carSkinEnabled`、`view`

## 重新构建（可选）

需 JDK 17+（已在 JDK 23 验证）与 Node.js 18+：

```bash
cd plugin-important-dates
./gradlew build
```

构建结果位于 `build/libs/plugin-important-dates-<版本>.jar`（当前版本：`1.2.0`）。

> 版本说明：**最新正式版** `1.2.0`（更名「记得」，新增座驾模块）；此前的开发版为 `1.2.0-SNAPSHOT`（已作为预发布提供体验）。
>
> ⚠️ **重要提示**：本版功能测试尚不完整，可能存在导致数据异常甚至丢失的严重问题（毁灭性 Bug）。**升级前请完整备份站点数据（数据库 + 附件）并谨慎操作**，建议先在测试站点验证。

## License

[MIT](LICENSE)
