package com.yyliucha.importantdates;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.ReactiveSettingFetcher;
import com.yyliucha.importantdates.finders.ImportantDateFinder;
import com.yyliucha.importantdates.support.HtmlRenderer;
import com.yyliucha.importantdates.support.ThemeTemplateSupport;
import com.yyliucha.importantdates.vo.ImportantDateVo;
import com.yyliucha.importantdates.vo.PersonVo;

/**
 * 前台路由：/important-dates。
 *
 * <p>渲染策略：
 * <ul>
 *   <li>默认：使用插件内部渲染器（{@link HtmlRenderer}）生成完整 HTML，
 *       不依赖主题、不依赖插件模板机制，兼容全部 Halo 2.x 版本；</li>
 *   <li>开启插件设置「使用主题模板渲染」后：渲染当前激活主题的
 *       {@code important-dates.html} 模板（模板需自行放入主题 templates/ 目录且语法正确，
 *       页面将获得主题布局）；model 中提供 {@code title}/{@code dates}/{@code people}/
 *       {@code reminders}/{@code showImportantTag}。</li>
 * </ul>
 *
 * @author yyliucha
 * @since 1.0.5
 */
@Component
public class ImportantDateRouter {

    private static final String THEME_TEMPLATE = "important-dates";
    private static final int DEFAULT_REMIND_DAYS = 3;
    private static final int DEFAULT_TOAST_CLOSE_SECONDS = 8;

    private final ImportantDateFinder importantDateFinder;
    private final ReactiveSettingFetcher settingFetcher;
    private final ThemeTemplateSupport themeTemplateSupport;

    public ImportantDateRouter(ImportantDateFinder importantDateFinder,
        ReactiveSettingFetcher settingFetcher,
        ThemeTemplateSupport themeTemplateSupport) {
        this.importantDateFinder = importantDateFinder;
        this.settingFetcher = settingFetcher;
        this.themeTemplateSupport = themeTemplateSupport;
    }

    /**
     * 前台页面：/important-dates
     */
    @Bean
    RouterFunction<ServerResponse> importantDatesRouter() {
        return org.springframework.web.reactive.function.server.RouterFunctions
            .route(
                org.springframework.web.reactive.function.server.RequestPredicates.GET("/important-dates"),
                request -> reminderConfig()
                    .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                    .zipWith(themeTemplateSupport.ensureThemeTemplate()
                        .then(themeTemplateSupport.templateExists()))
                    .flatMap(zip -> {
                        ReminderConfig cfg = zip.getT1();
                        boolean themeTemplateReady = zip.getT2() && cfg.useThemeTemplate();
                        return Mono.zip(
                                importantDateFinder.listAll().collectList(),
                                importantDateFinder.listAllPeople().collectList(),
                                importantDateFinder.listUpcoming(cfg.remindDays()).collectList()
                            )
                            .flatMap(tuple -> {
                                List<ImportantDateVo> dates = tuple.getT1();
                                List<PersonVo> people = tuple.getT2();
                                List<ImportantDateVo> reminders = tuple.getT3();
                                if (themeTemplateReady) {
                                    Map<String, Object> model = new LinkedHashMap<>();
                                    model.put("title", "重要日期");
                                    model.put("dates", dates);
                                    model.put("people", people);
                                    model.put("reminders", reminders);
                                    model.put("showImportantTag", cfg.showImportantTag());
                                    return ServerResponse.ok().render(THEME_TEMPLATE, model);
                                }
                                return ServerResponse.ok()
                                    .contentType(MediaType.TEXT_HTML)
                                    .bodyValue(HtmlRenderer.render(
                                        "重要日期", dates, people, reminders,
                                        cfg.showImportantTag()));
                            });
                    })
            )
            // 全站提醒数据（供"代码注入"脚本获取；匿名公开）
            .andRoute(
                org.springframework.web.reactive.function.server.RequestPredicates.GET(
                    "/important-dates-reminders"),
                request -> reminderConfig().flatMap(cfg -> {
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("enabled", cfg.frontendReminder());
                    result.put("remindDays", cfg.remindDays());
                    result.put("toastCloseSeconds", cfg.toastCloseSeconds());
                    result.put("toastEnabled", cfg.toastEnabled());
                    result.put("toastPosition", cfg.toastPosition());
                    result.put("toastTitle", cfg.toastTitle());
                    result.put("toastTemplate", cfg.toastTemplate());
                    result.put("toastEmptyText", cfg.toastEmptyText());
                    result.put("toastDefaultClose", cfg.toastDefaultClose());
                    result.put("toastCloseMenu", cfg.toastCloseMenu());
                    // 页面横幅由 frontendReminder 控制；全站悬浮提醒由 toastEnabled 控制
                    if (!cfg.frontendReminder() && !cfg.toastEnabled()) {
                        result.put("reminders", java.util.Collections.emptyList());
                        return ServerResponse.ok()
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(result);
                    }
                    return importantDateFinder.listUpcoming(cfg.remindDays())
                        .collectList()
                        .map(upcoming -> {
                            List<Map<String, Object>> items = new java.util.ArrayList<>();
                            for (ImportantDateVo r : upcoming) {
                                Map<String, Object> item = new LinkedHashMap<>();
                                item.put("title", r.getTitle());
                                item.put("daysUntil", r.getDaysUntil());
                                item.put("dateText", r.getDateText());
                                item.put("nextSolarDate", r.getNextSolarDate());
                                items.add(item);
                            }
                            result.put("reminders", items);
                            return result;
                        })
                        .flatMap(map -> ServerResponse.ok()
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(map));
                })
            );
    }

    private Map<String, Object> buildModel(
        reactor.util.function.Tuple3<java.util.List<com.yyliucha.importantdates.vo.ImportantDateVo>,
            java.util.List<com.yyliucha.importantdates.vo.PersonVo>,
            java.util.List<com.yyliucha.importantdates.vo.ImportantDateVo>> tuple,
        ReminderConfig cfg) {
        Map<String, Object> model = new LinkedHashMap<>();
        model.put("title", "重要日期");
        model.put("dates", tuple.getT1());
        model.put("people", tuple.getT2());
        model.put("reminders", tuple.getT3());
        model.put("showImportantTag", cfg.showImportantTag());
        return model;
    }

    /**
     * 读取提醒与悬浮提示配置（默认：提前 3 天、前台提醒开启、显示重要标记、
     * 悬浮提醒关闭、右下角、标题"重要日期提醒"）。
     */
    private Mono<ReminderConfig> reminderConfig() {
        Mono<JsonNode> reminder = settingFetcher.get("reminder")
            .switchIfEmpty(Mono.just(emptyNode()));
        Mono<JsonNode> basic = settingFetcher.get("basic")
            .switchIfEmpty(Mono.just(emptyNode()));
        Mono<JsonNode> toast = settingFetcher.get("toast")
            .switchIfEmpty(Mono.just(emptyNode()));
        return Mono.zip(reminder, basic, toast).map(tuple -> {
            JsonNode r = tuple.getT1();
            JsonNode b = tuple.getT2();
            JsonNode t = tuple.getT3();
            int days = intValue(r, "remindDays", DEFAULT_REMIND_DAYS);
            boolean frontendReminder = boolValue(r, "frontendReminder", true);
            int toastCloseSeconds = intValue(r, "toastCloseSeconds", DEFAULT_TOAST_CLOSE_SECONDS);
            boolean showImportantTag = boolValue(b, "showImportantTag", true);
            boolean useThemeTemplate = boolValue(b, "useThemeTemplate", true);
            boolean toastEnabled = boolValue(t, "toastEnabled", false);
            String toastPosition = textValue(t, "toastPosition", "bottom-right");
            String toastTitle = textValue(t, "toastTitle", "重要日期提醒");
            String toastTemplate = textValue(t, "toastTemplate",
                "「{title}」还有 {daysUntil} 天（{dateText}）");
            String toastEmptyText = textValue(t, "toastEmptyText", "最近没有重要日期，生活照常美好～");
            String toastDefaultClose = textValue(t, "toastDefaultClose", "once");
            boolean toastCloseMenu = boolValue(t, "toastCloseMenu", true);
            return new ReminderConfig(days, frontendReminder, showImportantTag, useThemeTemplate,
                toastCloseSeconds, toastEnabled, toastPosition, toastTitle, toastTemplate,
                toastEmptyText, toastDefaultClose, toastCloseMenu);
        });
    }

    private static JsonNode emptyNode() {
        return com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
    }

    private static int intValue(JsonNode node, String field, int fallback) {
        if (node == null) {
            return fallback;
        }
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? fallback : value.asInt(fallback);
    }

    private static boolean boolValue(JsonNode node, String field, boolean fallback) {
        if (node == null) {
            return fallback;
        }
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? fallback : value.asBoolean(fallback);
    }

    private static String textValue(JsonNode node, String field, String fallback) {
        if (node == null) {
            return fallback;
        }
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return fallback;
        }
        String text = value.asText("");
        return text.isBlank() ? fallback : text;
    }

    record ReminderConfig(int remindDays, boolean frontendReminder, boolean showImportantTag,
        boolean useThemeTemplate, int toastCloseSeconds,
        boolean toastEnabled, String toastPosition, String toastTitle,
        String toastTemplate, String toastEmptyText, String toastDefaultClose,
        boolean toastCloseMenu) {
    }
}
