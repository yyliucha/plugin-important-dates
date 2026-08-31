# 重要日期（plugin-important-dates）

[![build](https://github.com/yyliucha/plugin-important-dates/actions/workflows/build.yaml/badge.svg)](https://github.com/yyliucha/plugin-important-dates/actions/workflows/build.yaml)

一个 Halo 2.x 插件：在**后台**记录并管理自己的重要日期与家人朋友，例如结婚纪念日、孩子出生日期，支持阳历/农历、到期提醒、主题内自动展示。

[English README](README.en.md) ｜ [Releases](https://github.com/yyliucha/plugin-important-dates/releases) ｜ 作者：[yyliucha](https://github.com/yyliucha)

## 功能

**📅 重要日期**
- 记录：**名称 + 日期 + 多行备注**；日期类型支持 **阳历 / 农历**（农历支持闰月）
- **每年自动循环**：阳历按"每年同月同日"；农历自动换算成当年阳历日期，列表显示"最近一次"
- **自研日期选择器**：阳历模式为日历网格（格子内标注农历）；农历模式可选年份、月份（含闰月）、日期并实时显示对应阳历；均支持**年/月下拉快选**
- **重要/普通标识**：默认重要，重要日期参与到期提醒，可作为后续全站提示的条件

**👤 人员管理**
- 人员字段：姓名、昵称、关系（配偶/子女/父母/朋友…）、生日（阳历/农历）、性别、血型、身高、体重（最新值）、喜好、备注
- 重要日期可**关联多人**（如结婚纪念日关联夫妻两人），列表支持**按人员筛选**

**🔔 到期提醒**
- 后台「重要日期」页与前台 `/important-dates` 页顶部显示提醒横幅："明天是「结婚纪念日」" / "还有 3 天是「宝宝生日」"
- 提醒条件：**重要 + 前台可见 + 提前 N 天内（含当天）**；提前天数与后台/前台提醒开关均在**插件设置**中配置（默认提前 3 天）

**👁 前台可见性**
- 日期与人员各有「**前台展示**」开关（默认开）：关闭后仅后台可见，不出现在前台（含提醒），适合私人记录

**🏠 前台页面（在主题内打开，全自动）**
- 无需任何手动操作：插件自动探测当前主题布局（`modules/layout.html` / `layout.html` / `base.html`），解析布局参数并**自动生成适配模板**到 `themes/主题名/templates/important-dates.html`（模板带版本标记，插件升级后自动更新样式）
- 页面自动在主题布局内打开（导航、页脚、明暗模式跟随主题）；**卡片式设计**：月日徽章、大数字"还有 X 天"、重要胶囊徽章、人员首字头像卡，移动端自适应
- 主题没有布局片段/模板异常时**自动回退插件自带页面（不会 500）**；切换主题后首次访问自动重新生成
- 隐私控制：前台仅展示名称、日期、关联人姓名、生日；**体重、备注、操作日志不会出现在前台**
- 提供 `importantDateFinder` Finder API（listAll / listAllPeople / listUpcoming），主题可完全自定义展示

**📊 操作日志**
- 每次新增、编辑、删除（日期或人员）以及"重要/前台"状态切换都会记录时间、操作类型、目标与变更详情，可在「操作日志」弹窗查看

**💾 导出 / 导入**
- 一键导出全部数据（含人员）为 `important-dates-YYYY-MM-DD.json`（备份/迁移）；导入按记录标识判重，**已存在自动跳过、不覆盖**，结果弹窗汇报（兼容旧版导出文件）

## 数据存储

- 记录、人员、操作日志均存储于 **Halo 扩展存储**（`importantdates.halo.run/v1alpha1`），底层就是**站点的数据库**——站点配置为 H2 则存 H2，配置为 MySQL/PostgreSQL 则存对应数据库（`extensions` 表），与站点数据同库同备份
- 插件**不含任何联网请求**（前端仅调用本站后台 API）

## 兼容性

- **Halo 2.14 及以上**（基于 2.20 平台 API 编译，Java 17 字节码；已在 2.20 / 2.26 上验证）
- 管理员安装后默认拥有全部权限，无需手动配置

## 安装 / 升级

1. 从 [Releases](https://github.com/yyliucha/plugin-important-dates/releases) 下载最新的 `plugin-important-dates-*.jar`；
2. Halo 后台 → **插件** → **安装** → **本地安装** → 上传 jar。
3. **升级**：在插件列表中先**停用**，再**卸载**旧版本，然后安装新 jar 并启用（数据在站点数据库中，不会丢失）。
4. 启用后左侧菜单 **内容 → 重要日期** 出现；前台访问 `https://你的域名/important-dates`（无需其他配置，自动在主题内打开）。

## 使用（后台）

- **新增日期**：右上角「+ 新增日期」→ 名称、日期类型、日期（日历面板：阳历点选 / 农历选年月日）、关联人员（可多选）、备注；可勾选「重要」参与提醒、「前台展示」控制是否公开
- **人员页签**：管理人员信息；人员卡片上可直接切换「前台展示」
- **列表**：显示类型、日期、最近一次、关联人、重要标记、前台开关；顶部可按人员筛选
- **操作日志**：右上角按钮查看全部变更明细
- **导出 / 导入**：右上角按钮备份与恢复（导入会先校验，重复自动跳过）
- **提醒配置**：后台「插件 → 重要日期 → 设置」：提前提醒天数（默认 3）、后台提醒、前台提醒、前台"重要"标记、主题模板渲染（一般保持默认开启）

## 全站悬浮提醒（可选，右下角气球，全站生效）

后台与 `/important-dates` 页的提醒横幅是插件内置的。想在**博客每个页面**看到**悬浮提醒**（右下角浮出气球、按配置秒数自动淡出、可点 ×），在 Halo 系统设置（`系统 → 代码注入 → 全局 head 或 footer`）粘贴一次下面的脚本——插件提供公开数据接口 `GET /important-dates-reminders`（含 `toastCloseSeconds`，来自插件设置「悬浮提示自动关闭秒数」；无提醒时脚本不做任何事）：

```html
<script>
(function(){
  fetch('/important-dates-reminders').then(function(r){return r.json();}).then(function(d){
    if(!d.enabled || !d.reminders || !d.reminders.length) return;
    function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    var box=document.createElement('div');
    box.style.cssText='position:fixed;right:16px;bottom:16px;z-index:99999;max-width:340px;background:#fff7ed;border:1px solid #fdba74;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.22);padding:14px 40px 14px 16px;font-size:14px;color:#9a3412;font-family:inherit;opacity:0;transform:translateY(12px);transition:opacity .3s,transform .3s;';
    box.innerHTML='<div style="font-weight:600;margin-bottom:4px;">📅 重要日期提醒</div>'+
      d.reminders.map(function(r){
        var t=r.daysUntil<=0?'今天是':(r.daysUntil===1?'明天是':'还有 '+r.daysUntil+' 天是');
        return '<div>★ '+t+'「'+esc(r.title)+'」</div>';
      }).join('')+
      '<span style="position:absolute;right:12px;top:8px;cursor:pointer;opacity:.6;font-size:18px;">×</span>';
    var close=function(){box.style.opacity='0';box.style.transform='translateY(12px)';setTimeout(function(){box.remove();},320);};
    box.querySelector('span').onclick=close;
    document.body.appendChild(box);
    requestAnimationFrame(function(){box.style.opacity='1';box.style.transform='translateY(0)';});
    var secs=Number(d.toastCloseSeconds||8);
    if(secs>0){setTimeout(close, secs*1000);}
  }).catch(function(){});
})();
</script>
```

- 提醒内容与配置和插件页完全一致（重要 + 前台可见 + 提前 N 天内；在插件设置里改天数/开关即同步生效）
- **自动关闭秒数**：插件设置「悬浮提示自动关闭秒数」可调（默认 8 秒；0 = 不自动关闭，手动点 ×）
- 想改为顶部横幅式：把脚本里 `box` 样式换成 `top:0;left:0;right:0;` 并加 `text-align:center` 即可
- 想关闭全站提醒：插件设置里关闭「前台提醒」（接口返回空，脚本不显示）
- 说明：通过 Halo 官方「代码注入」机制生效（站点级配置，由你粘贴启用，非插件自动写入）；后台（控制台）整站暂无官方注入机制，保持「重要日期」插件页顶部提醒即可

## 主题模板（自定义展示，可选）

插件已自动生成主题模板，无需手动操作。想**完全自定义**展示时，编辑主题里的 `templates/important-dates.html`（或参考下列数据自行新建，注意删除旧文件后插件会重新生成）：

模板可直接消费的数据：`title`、`dates`（title/dateText/nextSolarDate/daysUntil/personNames/important）、`people`（displayName/nickname/relation/birthdayText/nextSolarDate/daysUntil）、`reminders`（即将到来的重要日期）、`showImportantTag`。也可以直接调用 `importantDateFinder` Finder API 获取数据。

## 重新构建（可选）

需要 JDK 17+（已在 JDK 23 下验证）、Node.js 18+ 与 npm：

```bash
cd plugin-important-dates
./gradlew build
```

构建结果位于 `build/libs/plugin-important-dates-1.0.12.jar`。

> 版本说明：插件使用 **1.0.x 开发版本序列**，每轮迭代版本号 +0.0.1（1.0.0 → 1.0.1 → 1.0.2 → …）。

## License

[MIT](LICENSE)
