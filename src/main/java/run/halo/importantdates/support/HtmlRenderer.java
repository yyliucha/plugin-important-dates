package run.halo.importantdates.support;

import java.util.List;
import run.halo.importantdates.vo.ImportantDateVo;
import run.halo.importantdates.vo.PersonVo;

/**
 * 前台页面 HTML 渲染器（不依赖主题模板）。
 *
 * <p>仅在插件内部生成简单静态页面，包含全部重要日期（名称、日期、剩余天数、关联人）
 * 与人员卡片（姓名、昵称、关系、生日），不展示体重、备注等隐私字段。
 *
 * @author important-dates
 * @since 1.0.5
 */
public final class HtmlRenderer {

    private HtmlRenderer() {
    }

    public static String render(String title, List<ImportantDateVo> dates, List<PersonVo> people) {
        StringBuilder sb = new StringBuilder(8192);
        sb.append("<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\"/>\n")
            .append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/>\n")
            .append("<title>").append(esc(title)).append("</title>\n")
            .append("<style>")
            .append(":root{--id-text:#1f2937;--id-muted:#6b7280;--id-border:#e5e7eb;--id-primary:#4f7cff;--id-bg:#f9fafb;}")
            .append("body{margin:0;background:var(--id-bg);color:var(--id-text);font-family:-apple-system,BlinkMacSystemFont,")
            .append("\"Segoe UI\",\"PingFang SC\",\"Hiragino Sans GB\",\"Microsoft YaHei\",sans-serif;line-height:1.6;}")
            .append(".id-wrap{max-width:860px;margin:0 auto;padding:24px 16px 48px;}")
            .append(".id-heading{font-size:28px;font-weight:700;margin:8px 0 4px;}")
            .append(".id-sub{color:var(--id-muted);font-size:14px;margin-bottom:24px;}")
            .append(".id-section-title{font-size:18px;font-weight:600;margin:28px 0 12px;padding-left:10px;border-left:4px solid var(--id-primary);}")
            .append(".id-card{background:#fff;border:1px solid var(--id-border);border-radius:12px;padding:16px 18px;margin-bottom:12px;}")
            .append(".id-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;}")
            .append(".id-name{font-weight:600;font-size:16px;}")
            .append(".id-meta{color:var(--id-muted);font-size:13px;}")
            .append(".id-days{color:var(--id-primary);font-size:14px;font-weight:600;white-space:nowrap;}")
            .append(".id-tag{display:inline-block;background:#eef2ff;color:#4338ca;border-radius:999px;padding:1px 10px;font-size:12px;margin-left:6px;}")
            .append(".id-empty{color:var(--id-muted);text-align:center;padding:40px 0;}")
            .append(".id-people-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}")
            .append("</style>\n</head>\n<body>\n<div class=\"id-wrap\">\n")
            .append("<h1 class=\"id-heading\">").append(esc(title)).append("</h1>\n")
            .append("<p class=\"id-sub\">记录值得纪念的日子，以及身边重要的人。</p>\n");

        // 重要日期
        sb.append("<h2 class=\"id-section-title\">重要日期</h2>\n");
        if (dates.isEmpty()) {
            sb.append("<div class=\"id-card id-empty\">还没有记录重要日期。</div>\n");
        } else {
            for (ImportantDateVo d : dates) {
                sb.append("<div class=\"id-card\"><div class=\"id-row\"><div>")
                    .append("<span class=\"id-name\">").append(esc(d.getTitle())).append("</span>\n")
                    .append("<div class=\"id-meta\">").append(esc(d.getDateText()));
                if ("LUNAR".equals(d.getDateType())) {
                    sb.append("<span class=\"id-tag\">农历</span>");
                }
                if (d.getPersonNames() != null && !d.getPersonNames().isEmpty()) {
                    sb.append(" · ").append(esc(String.join("、", d.getPersonNames())));
                }
                sb.append("</div></div>\n")
                    .append("<div class=\"id-days\">").append(esc(d.getNextSolarDate()))
                    .append(" · 还有 ").append(d.getDaysUntil()).append(" 天</div>\n")
                    .append("</div></div>\n");
            }
        }

        // 人员
        sb.append("<h2 class=\"id-section-title\">重要的人</h2>\n");
        if (people.isEmpty()) {
            sb.append("<div class=\"id-card id-empty\">还没有添加人员。</div>\n");
        } else {
            sb.append("<div class=\"id-people-grid\">\n");
            for (PersonVo p : people) {
                sb.append("<div class=\"id-card\"><div class=\"id-row\">")
                    .append("<span class=\"id-name\">").append(esc(p.getDisplayName())).append("</span>");
                if (p.getDaysUntil() >= 0) {
                    sb.append("<span class=\"id-days\">还有 ").append(p.getDaysUntil()).append(" 天</span>");
                }
                sb.append("</div><div class=\"id-meta\">");
                if (p.getNickname() != null && !p.getNickname().isBlank()) {
                    sb.append("昵称：").append(esc(p.getNickname()));
                }
                if (p.getRelation() != null && !p.getRelation().isBlank()) {
                    sb.append("　").append(esc(p.getRelation()));
                }
                sb.append("</div><div class=\"id-meta\">生日：").append(esc(p.getBirthdayText()));
                if (p.getNextSolarDate() != null) {
                    sb.append("（").append(esc(p.getNextSolarDate())).append("）");
                }
                sb.append("</div></div>\n");
            }
            sb.append("</div>\n");
        }

        sb.append("<p class=\"id-sub\" style=\"margin-top:32px;text-align:center;\">本页面由「重要日期」插件提供</p>\n")
            .append("</div>\n</body>\n</html>\n");
        return sb.toString();
    }

    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }
}
