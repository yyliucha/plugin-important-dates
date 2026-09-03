# 主题覆盖模板说明

> 适用于「尚未适配 Halo 2.26 页面布局契约」的主题（如 theme-clarity v1.6.x）。
> 插件端严格遵守 Halo 官方规范：**不写入、不修改任何主题文件**；覆盖模板属于主题侧内容，
> 由站点管理员放置，插件永不触碰。

## 什么时候需要

`/important-dates` 的渲染顺序（官方 TemplateNameResolver 机制）：

1. 主题目录存在 `templates/important-dates.html` → **使用主题模板**（嵌套主题布局）；
2. 否则使用插件自带默认模板：
   - 主题支持「页面布局契约」（提供 `templates/layout.html`）→ **自动复用主题外壳**（Halo 2.26+）；
   - 主题未支持契约 → Halo 使用内置 fallback 布局（页面为独立内容页，功能完整）。

如果你的主题未支持布局契约、又希望页面嵌套在主题内，请使用本目录的覆盖模板。

## 使用方式（以 theme-clarity 为例）

1. 将 `clarity-important-dates.html` 复制到你主题目录：
   ```
   themes/主题名/templates/important-dates.html
   ```
2. 清一次主题/页面缓存（或重启 Halo），`/important-dates` 即在主题布局内打开；
3. 想回到默认：删除该文件并清缓存即可（插件会再次使用默认模板/契约）。

## 自定义生成

你的主题 `modules/layout.html` 的 `th:fragment="html (…)"` 参数可能与本样例不同
（常见参数：`content`、`showAside`、`pageTitle`/`title`、`head`、`hero`、`footer`、`sidebar`）。
生成覆盖模板时：

- 参考你主题里任意现成页面的 `th:replace="~{modules/layout :: html(...)}"` 调用（如 `page.html`、`links.html`）；
- 将 `content = ~{::content}` 保留，替换 `showAside` 等参数为适合页面内容的值（本页建议 `showAside = false`）；
- 内容区块（`.id-wrap` 内）可直接复用 `clarity-important-dates.html` 中的 `content` 片段与头部 `<style>`；
- 模型可用变量：`title`、`dates`（title/dateText/nextSolarDate/daysUntil/personNames/important）、
  `people`（displayName/nickname/relation/birthdayText/nextSolarDate/daysUntil）、
  `reminders`（title/daysUntil/dateText/nextSolarDate）、`showImportantTag`。

## 一句话原则

插件负责功能与默认展示，主题负责选择性覆盖与样式 —— 这是 Halo 官方《与主题集成》指南定义的边界；
覆盖模板是"主题侧"的文件，插件不生成、不修改、不删除。
