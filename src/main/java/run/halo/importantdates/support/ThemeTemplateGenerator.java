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
     * @return 模板内容；无法解析布局时返回 null
     */
    public static String generate(String layoutContent, String layoutTemplateName) {
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
        sb.append("<!doctype html>\n");
        sb.append("<html xmlns:th=\"https://www.thymeleaf.org\"\n");
        sb.append("  th:replace=\"~{").append(layoutTemplateName)
            .append(" :: html(").append(replace).append(")}\">\n");
        if (hasHead) {
            sb.append("  <head th:fragment=\"head\">\n")
                .append("    <title th:text=\"${title}\">重要日期</title>\n")
                .append("    <style>")
                .append(".id-remind{background:#fff7ed;border:1px solid #fdba74;border-radius:10px;")
                .append("padding:10px 16px;margin-bottom:16px;}")
                .append(".id-remind-item{color:#9a3412;line-height:1.9;}")
                .append(".id-item{border-bottom:1px solid rgba(128,128,128,.22);padding:12px 0;}")
                .append(".id-muted{opacity:.65;font-size:.9em;}")
                .append(".id-meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline;}")
                .append("@media (prefers-color-scheme: dark){")
                .append(".id-remind{background:rgba(250,204,21,.1);border-color:rgba(250,204,21,.35);}")
                .append(".id-remind-item{color:#fbbf24;}}")
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
        <div style="max-width: 860px; margin: 0 auto; padding: 16px;">
          <h1 style="font-size: 1.6rem; margin: 8px 0 4px;">重要日期</h1>
          <p class="id-muted">记录值得纪念的日子，以及身边重要的人。</p>

          <div class="id-remind" th:if="${reminders != null && !reminders.isEmpty()}">
            <div class="id-remind-item" th:each="r : ${reminders}">
              <span th:if="${r.daysUntil <= 0}" th:text="|今天是「${r.title}」|">今天是「结婚纪念日」</span>
              <span th:if="${r.daysUntil == 1}" th:text="|明天是「${r.title}」|">明天是「结婚纪念日」</span>
              <span th:if="${r.daysUntil > 1}" th:text="|还有 ${r.daysUntil} 天是「${r.title}」|">还有 3 天是「结婚纪念日」</span>
            </div>
          </div>

          <h2 style="font-size: 1.3rem;">重要日期</h2>
          <p class="id-muted" th:if="${#lists.isEmpty(dates)}">还没有记录。</p>
          <div class="id-item" th:each="d : ${dates}">
            <div class="id-meta">
              <div>
                <span style="font-weight:600;" th:text="${d.title}">结婚纪念日</span>
                <span th:if="${showImportantTag != null and showImportantTag and d.important}"
                      style="opacity:.7; font-size:.85em;">（重要）</span>
                <div class="id-muted">
                  <span th:text="${d.dateText}">2019-05-20</span>
                  <span th:if="${d.personNames != null && !d.personNames.isEmpty()}"
                        th:text="| · ${#strings.listJoin(d.personNames, '、')}|"> · 张三、李四</span>
                </div>
              </div>
              <span style="white-space:nowrap;" th:text="|${d.nextSolarDate} · 还有 ${d.daysUntil} 天|">
                2026-05-20 · 还有 265 天
              </span>
            </div>
          </div>

          <h2 style="font-size: 1.3rem;">重要的人</h2>
          <p class="id-muted" th:if="${#lists.isEmpty(people)}">还没有添加。</p>
          <div class="id-item" th:each="p : ${people}">
            <span style="font-weight:600;" th:text="${p.displayName}">张三</span>
            <span th:if="${p.relation}" class="id-muted" th:text="| （${p.relation}）|">（朋友）</span>
            <div class="id-muted">
              生日 <span th:text="${p.birthdayText}">六月初六</span>
              <span th:if="${p.nextSolarDate != null}" th:text="|（${p.nextSolarDate}）|">（2025-07-25）</span>
              <span th:if="${p.daysUntil >= 0}" th:text="| · 还有 ${p.daysUntil} 天|"> · 还有 32 天</span>
            </div>
          </div>
        </div>
        """;
}
