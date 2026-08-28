package run.halo.importantdates.support;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 主题模板生成器：根据主题布局片段参数自动生成 important-dates.html。
 *
 * <p>工作原理：解析主题 templates/ 下布局文件（modules/layout.html / layout.html / base.html）
 * 中 {@code th:fragment="html (params)"} 的参数列表，按已知参数名映射生成
 * {@code th:replace="~{... :: html(...)}"} 调用；内容区固定为内置的 Thymeleaf 片段
 * （使用中性样式、明暗色自适应），保证任意主题下视觉效果协调。
 *
 * @author yyliucha
 * @since 1.0.11
 */
public final class ThemeTemplateGenerator {

    private static final Pattern FRAGMENT_PATTERN =
        Pattern.compile("th:fragment\\s*=\\s*[\"']html\\s*\\(([^)]*)\\)[\"']");

    private ThemeTemplateGenerator() {
    }

    /**
     * 尝试生成模板。
     *
     * @param layoutContent 布局文件内容
     * @param layoutTemplateName 布局模板名（如 modules/layout）
     * @param version 插件版本（写入生成标记，用于自动升级）
     * @return 模板内容；无法解析布局时返回 null
     */
    public static String generate(String layoutContent, String layoutTemplateName, String version) {
        List<String> params = parseParams(layoutContent);
        if (params == null) {
            return null;
        }
        StringBuilder replace = new StringBuilder();
        for (String param : params) {
            if (replace.length() > 0) {
                replace.append(", ");
            }
            replace.append(param).append(" = ").append(mapParam(param));
        }
        boolean hasHead = params.contains("head");

        StringBuilder sb = new StringBuilder();
        sb.append("<!-- id-gen:").append(version == null ? "0.0.0" : version).append(" -->\n");
        sb.append("<!doctype html>\n");
        sb.append("<html xmlns:th=\"https://www.thymeleaf.org\"\n");
        sb.append("  th:replace=\"~{").append(layoutTemplateName)
            .append(" :: html(").append(replace).append(")}\">\n");
        if (hasHead) {
            sb.append("  <head th:fragment=\"head\">\n")
                .append("    <title th:text=\"${title}\">重要日期</title>\n")
                .append("    <style>")
                .append(".id-hero{padding:6px 0 2px;}")
                .append(".id-hero-title{font-size:1.8rem;margin:0 0 4px;}")
                .append(".id-hero-sub{opacity:.62;margin:0 0 20px;}")
                .append(".id-block-title{font-size:1.15rem;margin:26px 0 12px;display:flex;align-items:center;gap:8px;}")
                .append(".id-count{opacity:.5;font-weight:400;font-size:.9em;}")
                .append(".id-date-card{display:flex;align-items:center;gap:14px;border:1px solid rgba(128,128,128,.2);")
                .append("border-radius:14px;padding:12px 16px;margin-bottom:10px;background:rgba(255,255,255,.02);}")
                .append(".id-date-chip{min-width:58px;text-align:center;background:rgba(79,124,255,.14);color:#6b93ff;")
                .append("border-radius:10px;padding:7px 8px;flex:none;}")
                .append(".id-chip-md{font-size:1rem;font-weight:700;display:block;line-height:1.2;}")
                .append(".id-chip-lu{font-size:.72em;display:block;opacity:.75;line-height:1.2;margin-top:2px;}")
                .append(".id-date-info{flex:1;min-width:0;}")
                .append(".id-date-title{font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}")
                .append(".id-imp{font-size:.72em;color:#f59e0b;border:1px solid rgba(245,158,11,.5);")
                .append("border-radius:999px;padding:0 8px;line-height:1.6;}")
                .append(".id-date-sub{opacity:.6;font-size:.85em;margin-top:3px;}")
                .append(".id-date-days{text-align:right;white-space:nowrap;flex:none;}")
                .append(".id-days-num{font-size:1.05rem;font-weight:700;color:#6b93ff;display:block;line-height:1.2;}")
                .append(".id-days-unit{font-size:.74em;opacity:.6;display:block;margin-top:2px;}")
                .append(".id-people{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}")
                .append(".id-person{display:flex;align-items:center;gap:12px;border:1px solid rgba(128,128,128,.2);")
                .append("border-radius:14px;padding:12px 14px;background:rgba(255,255,255,.02);}")
                .append(".id-avatar{width:44px;height:44px;border-radius:50%;background:rgba(79,124,255,.15);color:#6b93ff;")
                .append("display:flex;align-items:center;justify-content:center;font-size:1.15rem;font-weight:700;flex:none;}")
                .append(".id-person-info{flex:1;min-width:0;}")
                .append(".id-person-name{font-weight:600;display:flex;align-items:center;gap:6px;}")
                .append(".id-person-sub{opacity:.6;font-size:.8em;margin-top:2px;}")
                .append(".id-person-days{font-size:.84em;color:#6b93ff;opacity:.92;flex:none;white-space:nowrap;}")
                .append("@media (prefers-color-scheme: light){.id-date-card,.id-person{background:#fff;}}")
                .append("@media (max-width: 560px){.id-date-card{flex-wrap:wrap;gap:8px 12px;}.id-date-days{width:100%;text-align:left;}}")
                .append(".id-remind{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.35);")
                .append("border-radius:12px;padding:10px 16px;margin-bottom:14px;}")
                .append(".id-remind-item{color:#d97706;line-height:1.9;}")
                .append("@media (prefers-color-scheme: dark){.id-remind{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.4);}.id-remind-item{color:#fbbf24;}}")
                .append("</style>\n")
                .append("  </head>\n");
        }
        sb.append("  <th:block th:fragment=\"content\">\n");
        sb.append(CONTENT_FRAGMENT);
        sb.append("  </th:block>\n");
        sb.append("</html>\n");
        return sb.toString();
    }

    /**
     * 解析布局 fragment 参数；未找到返回 null。
     */
    public static List<String> parseParams(String layoutContent) {
        if (layoutContent == null) {
            return null;
        }
        Matcher matcher = FRAGMENT_PATTERN.matcher(layoutContent);
        if (!matcher.find()) {
            return null;
        }
        List<String> params = new ArrayList<>();
        for (String part : matcher.group(1).split(",")) {
            String p = part.trim();
            if (!p.isEmpty()) {
                params.add(p);
            }
        }
        return params.isEmpty() ? null : params;
    }

    /**
     * 已知参数名映射（无默认值的参数显式传入；其余为 null 使用布局默认值）。
     */
    private static String mapParam(String param) {
        return switch (param) {
            case "title", "pageTitle" -> "${title}";
            case "content" -> "~{::content}";
            case "head" -> "~{::head}";
            case "hero" -> "null";
            case "footer" -> "null";
            case "sidebar" -> "null";
            case "showAside" -> "false";
            case "contentClass", "bodyClass", "cover" -> "null";
            default -> "null";
        };
    }

    /**
     * 内置内容模板（重要日期页面主体；数据来自插件 model）。
     */
    private static final String CONTENT_FRAGMENT = """
        <div style="max-width: 860px; margin: 0 auto; padding: 20px 16px 8px;">
          <div class="id-hero">
            <h1 class="id-hero-title">重要日期</h1>
            <p class="id-hero-sub">记录值得纪念的日子，以及身边重要的人。</p>
          </div>

          <div class="id-remind" th:if="${reminders != null && !reminders.isEmpty()}">
            <div class="id-remind-item" th:each="r : ${reminders}">
              <span th:if="${r.daysUntil <= 0}" th:text="|今天是「${r.title}」|">今天是「结婚纪念日」</span>
              <span th:if="${r.daysUntil == 1}" th:text="|明天是「${r.title}」|">明天是「结婚纪念日」</span>
              <span th:if="${r.daysUntil > 1}" th:text="|还有 ${r.daysUntil} 天是「${r.title}」|">还有 3 天是「结婚纪念日」</span>
            </div>
          </div>

          <h2 class="id-block-title">重要日期 <span class="id-count" th:text="${#lists.size(dates)}">5</span></h2>
          <p class="id-hero-sub" th:if="${#lists.isEmpty(dates)}">还没有记录。</p>
          <div class="id-date-card" th:each="d : ${dates}">
            <div class="id-date-chip">
              <span class="id-chip-md" th:text="${d.nextSolarDate != null ? #strings.substring(d.nextSolarDate, 5) : '—'}">10-02</span>
              <span class="id-chip-lu" th:if="${d.dateType == 'LUNAR'}" th:text="${d.dateText}">六月初六</span>
            </div>
            <div class="id-date-info">
              <div class="id-date-title">
                <span th:text="${d.title}">结婚纪念日</span>
                <span class="id-imp" th:if="${showImportantTag != null and showImportantTag and d.important}">重要</span>
              </div>
              <div class="id-date-sub">
                <span th:text="${d.dateText}">2021-10-02</span>
                <span th:if="${d.personNames != null && !d.personNames.isEmpty()}"
                      th:text="| · ${#strings.listJoin(d.personNames, '、')}|"> · 老婆</span>
              </div>
            </div>
            <div class="id-date-days">
              <span class="id-days-num" th:text="${d.daysUntil}">35</span>
              <span class="id-days-unit" th:if="${d.nextSolarDate != null}" th:text="|天后 · ${d.nextSolarDate}|">天后 · 2026-10-02</span>
            </div>
          </div>

          <h2 class="id-block-title">重要的人 <span class="id-count" th:text="${#lists.size(people)}">1</span></h2>
          <p class="id-hero-sub" th:if="${#lists.isEmpty(people)}">还没有添加。</p>
          <div class="id-people" th:unless="${#lists.isEmpty(people)}">
            <div class="id-person" th:each="p : ${people}">
              <span class="id-avatar" th:text="${#strings.substring(p.displayName, 0, 1)}">老</span>
              <div class="id-person-info">
                <div class="id-person-name">
                  <span th:text="${p.displayName}">老婆</span>
                  <span th:if="${p.relation}" class="id-imp" th:text="${p.relation}">配偶</span>
                </div>
                <div class="id-person-sub">
                  生日 <span th:text="${p.birthdayText}">1999-10-28</span>
                  <span th:if="${p.nextSolarDate != null}" th:text="|（${p.nextSolarDate}）|">（2026-10-28）</span>
                </div>
              </div>
              <span class="id-person-days" th:if="${p.daysUntil >= 0}" th:text="|还有 ${p.daysUntil} 天|">还有 61 天</span>
            </div>
          </div>
        </div>
        """;
}
