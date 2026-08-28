# 重要日期（plugin-important-dates）

[![build](https://github.com/yyliucha/plugin-important-dates/actions/workflows/build.yaml/badge.svg)](https://github.com/yyliucha/plugin-important-dates/actions/workflows/build.yaml)

一个 Halo 2.x 插件：在**后台**记录并管理自己的重要日期，例如结婚纪念日、孩子出生日期等。

[English README](README.en.md)

## 功能

- 记录重要日期：**名称 + 日期 + 多行备注**
- 日期类型支持 **阳历 / 农历**（农历支持闰月）
- **每年自动循环**：阳历按"每年同月同日"，农历按"每年换算成当年阳历日期"（即每次循环会显示今年/明年的下一次阳历日期）
- **人员管理**：可添加人员（张三、李四…），记录其姓名、昵称、关系、生日（阳历/农历）、性别、血型、身高、体重（最新值）、喜好、备注；重要日期可**关联多人**（如结婚纪念日关联夫妻两人），并支持按人员筛选
- **自研日期选择器**：阳历模式为日历网格（格子内标注农历）；农历模式可选年份、月份（含闰月）与日期，实时显示对应阳历
- **操作日志**：每次新增、编辑、删除（日期或人员）都会记录时间、操作类型、目标与详情，可在"操作日志"弹窗中查看
- **重要标识与到期提醒**：日期可标记"重要/普通"；后台「重要日期」页与前台 `/important-dates` 页顶部显示到期提醒（"明天是「结婚纪念日」"/"还有 3 天是「宝宝生日」"）；**提前提醒天数、后台/前台提醒开关可在 插件设置 中配置**（默认提前 3 天）
- **前台可见性**：日期和人员各有"前台展示"开关（默认开），关闭后仅后台可见，不出现在前台（含提醒）
- **前台页面**：`/important-dates` 独立页面（不依赖主题），展示全部重要日期（按"即将到来"排序，含"还有 X 天"）与人员卡片；仅公开姓名、关系、生日等，**不展示体重、备注、操作日志**；同时提供 `importantDateFinder` Finder API 供主题自定义展示
- **在主题内打开（全自动）**：插件启动时会自动探测当前激活主题的布局（`modules/layout.html` / `layout.html` / `base.html`），并自动生成适配模板 `themes/主题名/templates/important-dates.html`（已存在则不覆盖）；设置「使用主题模板渲染」默认开启，页面即在主题布局内打开（自动跟随主题导航、页脚、明暗模式）。主题没有布局片段或模板异常时，自动回退到插件自带页面（不会 500）；切换主题后首次访问会自动重新生成适配模板。取消勾选该设置可始终使用插件自带页面。
- **导出 / 导入**：一键导出全部记录为 JSON 文件（含人员，可用于备份或迁移）；导入时按记录标识判重，已存在的自动跳过、不覆盖，结果弹窗汇报
- 纯后台管理：在 Halo 后台左侧菜单"内容 → 重要日期"中进行增删改查，不涉及前台显示

## 数据存储

- 记录与操作日志均存储于 **Halo 扩展存储**（扩展资源 `importantdates.halo.run/v1alpha1`），底层就是**站点的数据库**——站点配置为 H2 则存 H2，配置为 MySQL/PostgreSQL 则存对应数据库（`extensions` 表），与站点数据同库同备份。
- 插件不含任何联网请求（前端仅调用本站后台 API）。

## 兼容性

- 适用于 **Halo 2.14 及以上**（含 2.20 / 2.21 / 2.22 / 2.23 等版本，基于 Halo 2.20 平台 API 编译，Java 17 字节码）
- 插件安装后，管理员角色默认拥有"重要日期"的查看与管理权限（无需手动配置）

## 安装

1. 从 [Releases](https://github.com/yyliucha/plugin-important-dates/releases) 下载最新的 `plugin-important-dates-*.jar` 并上传到服务器；
2. 打开 Halo 后台 → **插件** → 右上角 **安装** → 选择 **本地安装**，上传 jar 文件；
3. 安装完成后在"已安装"列表中找到 **重要日期**，点击 **启用**；
4. 启用后，左侧菜单 **内容** 分组下会出现 **重要日期**，即可开始记录。

## 使用

- 点击右上角 **新增**，填写：
  - **名称**：例如"结婚纪念日"、"孩子出生日期"；
  - **日期类型**：选择"阳历"或"农历"；
  - **日期**：点击输入框打开日历面板——阳历模式直接点击日期（面板内标注农历）；农历模式先选年份与月份（存在闰月的年份会有"闰X月"选项），再点选日期；
  - **备注**：可记录细节（多行文本），如"结婚 10 周年"、"宝宝出生时间 8:32"。
- 列表中的 **最近一次** 列会显示该日期下一次出现的阳历日期（农历日期会自动换算）。
- 右上角 **操作日志** 可查看每次新增/编辑/删除的时间、目标与变更详情。
- **导出** 将全部记录下载为 `important-dates-YYYY-MM-DD.json`（备份/迁移用，含人员）；**导入** 选择该 JSON 文件即可恢复，重复记录自动跳过。
- 「人员」页签可管理人员信息；新增/编辑重要日期时可在"关联人员"中勾选一人或多人（如结婚纪念日关联夫妻两人）。
- **重要/普通**：新增或编辑日期时可勾选"重要"（默认重要），重要日期才会出现在到期提醒中（列表开关可随时切换）。
- **前台展示**：日期与人员的"前台"开关控制是否出现在 `/important-dates`；关闭后仅后台可见。访问链接：`https://你的域名/important-dates`（页面由插件自身渲染，不依赖主题；仅展示公开信息）。
- **提醒配置**：后台「插件 → 重要日期 → 设置」可调整提前提醒天数（默认 3 天）与后台/前台提醒开关。

## 将页面放入主题内打开（可选）

默认 `/important-dates` 由插件自带模板渲染（独立样式，不依赖主题）。若希望页面**在主题布局内打开**（带导航、页脚等）：

1. 在**当前激活主题**的 `templates/` 目录下新建 `important-dates.html`，参考以下模板（使用插件传入的数据）：

```html
<!DOCTYPE html>
<html lang="zh-CN" xmlns:th="http://www.thymeleaf.org">
<head>
    <title th:text="${title}">重要日期</title>
    <!-- 可在主题布局中替换为 th:replace 等主题片段，例如：th:replace="~{modules/layout}" -->
</head>
<body>
    <!-- 这里为页面主体，可按需替换为当前主题的布局片段 -->
    <h1 th:text="${title}">重要日期</h1>

    <div th:if="${reminders != null && !reminders.isEmpty()}" style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:10px 16px;">
        <div th:each="r : ${reminders}">
            今天是「<span th:text="${r.title}">结婚纪念日</span>」
            <span th:if="${r.daysUntil > 0}" th:text="'（还有 ' + ${r.daysUntil} + ' 天）'"></span>
        </div>
    </div>

    <ul>
        <li th:each="d : ${dates}">
            <strong th:text="${d.title}">结婚纪念日</strong>
            <span th:text="' — ' + ${d.dateText}"></span>
            <span th:if="${d.showImportantTag != null}"></span>
            <em th:text="'还有 ' + ${d.daysUntil} + ' 天'">还有 3 天</em>
        </li>
    </ul>

    <ul>
        <li th:each="p : ${people}">
            <strong th:text="${p.displayName}">张三</strong>
            <span th:text="'（' + ${p.birthdayText} + '）'">（六月初六）</span>
        </li>
    </ul>
</body>
</html>
```

2. 打开后台「插件 → 重要日期 → 设置」，勾选 **使用主题模板渲染** 并保存；
3. 访问 `/important-dates`，页面即按主题模板渲染（在主题布局内）。

说明：主题模板可访问的数据：`title`（页面标题）、`dates`（重要日期列表：title/dateText/nextSolarDate/daysUntil/personNames/important）、`people`（人员：displayName/nickname/relation/birthdayText/nextSolarDate/daysUntil）、`reminders`（即将到来的重要日期）、`showImportantTag`（是否显示"重要"标记）；如需完全自定义也可以在主题模板中直接调用 `importantDateFinder` Finder API。

- 每条记录可随时 **编辑** / **删除**，数据保存在站点数据库中，升级 Halo 不影响。

## 重新构建（可选）

需要 JDK 17+（已在 JDK 23 下验证）、Node.js 18+ 与 npm：

```bash
cd plugin-important-dates
./gradlew build
```

构建结果位于 `build/libs/plugin-important-dates-1.0.5.jar`。

> 版本说明：插件使用 1.0.x 开发版本序列，每轮迭代版本号递增（1.0.0 → 1.0.1 → 1.0.2 → …）。

## 数据说明

- 数据以 Halo 扩展资源 `importantdates.halo.run/v1alpha1` 存储，删除 Halo 站点数据时会一并删除，请自行备份。
- 插件不含任何联网请求（前端仅调用本站后台 API）。
