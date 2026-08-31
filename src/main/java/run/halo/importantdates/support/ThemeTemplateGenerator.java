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
                .append(".id-wrap{max-width:920px;margin:0 auto;padding:24px 16px 8px;}")
                .append(".id-hero{padding:6px 0 2px;}")
                .append(".id-hero-title{font-size:1.8rem;margin:0 0 4px;font-family:'Kaiti SC','KaiTi','STKaiti','STXihei','PingFang SC',sans-serif;}")
                .append(".id-hero-sub{opacity:.62;margin:0 0 20px;}")
                .append(".id-block-title{font-size:1.15rem;margin:26px 0 14px;display:flex;align-items:center;gap:8px;}")
                .append(".id-count{opacity:.5;font-weight:400;font-size:.9em;}")
                .append(".id-board{columns:3 230px;column-gap:14px;}")
                .append("@media (max-width:860px){.id-board{columns:2 200px;}}")
                .append("@media (max-width:560px){.id-board{columns:1 170px;}}")
                .append(".id-memo{break-inside:avoid;-webkit-column-break-inside:avoid;margin:0 0 16px;position:relative;")
                .append("border-radius:4px 4px 4px 14px;padding:18px 16px 14px;box-shadow:0 3px 8px rgba(0,0,0,.16);")
                .append("background:var(--paper,#fff8c5);color:#3f3f46;transform:rotate(var(--tilt,-1deg));transition:transform .16s ease;}")
                .append(".id-memo:hover{transform:rotate(0deg) scale(1.04);box-shadow:0 6px 16px rgba(0,0,0,.22);}")
                .append(".id-memo::before{content:'';position:absolute;top:-9px;left:50%;transform:translateX(-50%) rotate(-2deg);")
                .append("width:66px;height:17px;background:rgba(255,255,255,.5);border:1px solid rgba(128,128,128,.18);")
                .append("box-shadow:0 1px 2px rgba(0,0,0,.12);}")
                .append(".id-memo:nth-child(6n+1){--tilt:-1deg;--paper:#fff8c5;}")
                .append(".id-memo:nth-child(6n+2){--tilt:1.1deg;--paper:#ffd9e1;}")
                .append(".id-memo:nth-child(6n+3){--tilt:-.6deg;--paper:#d7f0ff;}")
                .append(".id-memo:nth-child(6n+4){--tilt:.9deg;--paper:#dcf5d3;}")
                .append(".id-memo:nth-child(6n+5){--tilt:-1.2deg;--paper:#ece2ff;}")
                .append(".id-memo:nth-child(6n+6){--tilt:.6deg;--paper:#ffe9c7;}")
                .append(".id-memo-title{font-weight:700;font-size:1.04rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;")
                .append("font-family:'Kaiti SC','KaiTi','STKaiti','PingFang SC',sans-serif;padding-right:56px;}")
                .append(".id-pin{flex:none;width:11px;height:11px;border-radius:50%;background:linear-gradient(135deg,#f43f5e,#be123c);")
                .append("box-shadow:0 2px 3px rgba(0,0,0,.3);}")
                .append(".id-memo-date{font-size:.86rem;opacity:.78;margin-top:7px;}")
                .append(".id-memo-sub{font-size:.8rem;opacity:.72;margin-top:6px;}")
                .append(".id-memo-days{position:absolute;top:16px;right:12px;text-align:right;color:#b45309;font-weight:800;")
                .append("font-size:1.2rem;line-height:1.05;padding-top:4px;background:rgba(255,255,255,.28);border-radius:8px;padding-left:6px;padding-right:6px;}")
                .append(".id-memo-days small{display:block;font-size:.62rem;font-weight:600;opacity:.72;text-transform:uppercase;letter-spacing:.04em;margin-top:1px;}")
                .append(".id-memo-people{font-size:.8rem;opacity:.78;margin-top:8px;}")
                .append(".id-memo-avatar{width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.55);")
                .append("color:#3f3f46;display:flex;align-items:center;justify-content:center;font-weight:700;")
                .append("margin-right:10px;flex:none;box-shadow:inset 0 0 0 1px rgba(128,128,128,.2);}")
                .append("@media (prefers-color-scheme: dark){.id-memo{box-shadow:0 3px 10px rgba(0,0,0,.5);}}")
                .append(".id-remind{background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);border-radius:12px;")
                .append("padding:10px 16px;margin-bottom:14px;}")
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
        <div class="id-wrap">
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
          <div class="id-board" th:unless="${#lists.isEmpty(dates)}">
            <div class="id-memo" th:each="d : ${dates}">
              <div class="id-memo-days">
                <span th:text="${d.daysUntil}">35</span>
                <small th:if="${d.nextSolarDate != null}" th:text="|天后 · ${d.nextSolarDate}|">天后 · 2026-10-02</small>
              </div>
              <div class="id-memo-title">
                <span class="id-pin" th:if="${showImportantTag != null and showImportantTag and d.important}"></span>
                <span th:text="${d.title}">结婚纪念日</span>
              </div>
              <div class="id-memo-date">
                <span th:text="${d.dateText}">2021-10-02</span>
                <span th:if="${d.dateType == 'LUNAR'}" th:text="（农历）">（农历）</span>
              </div>
              <div class="id-memo-people" th:if="${d.personNames != null && !d.personNames.isEmpty()}"
                   th:text="|❤ ${#strings.listJoin(d.personNames, '、')}|">❤ 老婆</div>
            </div>
          </div>

          <h2 class="id-block-title">重要的人 <span class="id-count" th:text="${#lists.size(people)}">1</span></h2>
          <p class="id-hero-sub" th:if="${#lists.isEmpty(people)}">还没有添加。</p>
          <div class="id-board" th:unless="${#lists.isEmpty(people)}">
            <div class="id-memo" th:each="p : ${people}">
              <div class="id-memo-days" th:if="${p.daysUntil >= 0}">
                <span th:text="${p.daysUntil}">61</span>
                <small>天后</small>
              </div>
              <div class="id-memo-title" style="padding-right:0;">
                <span class="id-memo-avatar" th:text="${#strings.substring(p.displayName, 0, 1)}">老</span>
                <span th:text="${p.displayName}">老婆</span>
                <span th:if="${p.relation}" style="font-size:.8em;opacity:.75;" th:text="|（${p.relation}）|">（配偶）</span>
              </div>
              <div class="id-memo-sub" th:if="${p.nickname != null && !p.nickname.isBlank()}"
                   th:text="|昵称：${p.nickname}|">昵称：三哥</div>
              <div class="id-memo-date">
                生日 <span th:text="${p.birthdayText}">1999-10-**</span>
                <span th:if="${p.nextSolarDate != null}" th:text="|（${p.nextSolarDate}）|">（2026-10-**）</span>
              </div>
            </div>
          </div>
        </div>
        """;
}
