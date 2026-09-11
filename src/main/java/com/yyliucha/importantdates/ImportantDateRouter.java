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
import run.halo.app.theme.TemplateNameResolver;
import run.halo.app.theme.router.ModelConst;
import com.yyliucha.importantdates.finders.ImportantDateFinder;
import com.yyliucha.importantdates.vo.CarVo;
import com.yyliucha.importantdates.vo.ImportantDateVo;
import com.yyliucha.importantdates.vo.PersonVo;

/**
 * 前台路由：/important-dates。
 *
 * <p>渲染策略（符合 Halo 官方「与主题集成」指南）：
 * <ul>
 *   <li>插件自带默认 Thymeleaf 模板（{@code resources/templates/important-dates.html}），
 *       不依赖、不修改任何主题文件；</li>
 *   <li>通过 {@link TemplateNameResolver} 解析模板名：主题如提供同名模板（主题作者/用户主动
 *       放置 {@code templates/important-dates.html}）则使用主题模板，否则使用插件默认模板；</li>
 *   <li>页面模型设置 {@code _templateId}（{@link ModelConst#TEMPLATE_ID}）为
 *       {@code plugin:plugin-important-dates:important-dates}，供 Head 处理器、SEO 等扩展识别。</li>
 * </ul>
 *
 * @author yyliucha
 * @since 1.0.5
 */
@Component
public class ImportantDateRouter {

    private static final String THEME_TEMPLATE = "important-dates";
    private static final String TEMPLATE_ID = "plugin:plugin-important-dates:important-dates";
    private static final int DEFAULT_REMIND_DAYS = 3;
    private static final int DEFAULT_TOAST_CLOSE_SECONDS = 8;

    private final ImportantDateFinder importantDateFinder;
    private final ReactiveSettingFetcher settingFetcher;
    private final TemplateNameResolver templateNameResolver;

    public ImportantDateRouter(ImportantDateFinder importantDateFinder,
        ReactiveSettingFetcher settingFetcher,
        TemplateNameResolver templateNameResolver) {
        this.importantDateFinder = importantDateFinder;
        this.settingFetcher = settingFetcher;
        this.templateNameResolver = templateNameResolver;
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
                    .zipWith(importantDateFinder.listAll().collectList()
                        .zipWith(importantDateFinder.listAllPeople().collectList())
                        .zipWith(importantDateFinder.listAllCars().collectList()))
                    .flatMap(zip -> {
                        ReminderConfig cfg = zip.getT1();
                        List<ImportantDateVo> dates = zip.getT2().getT1().getT1();
                        List<PersonVo> people = zip.getT2().getT1().getT2();
                        List<CarVo> cars = cfg.carFrontendSection()
                            ? zip.getT2().getT2()
                            : java.util.Collections.emptyList();
                        Mono<List<ImportantDateVo>> dateEvents =
                            importantDateFinder.listUpcoming(cfg.remindDays()).collectList();
                        Mono<List<CarVo.CarEventVo>> carEvents =
                            cfg.carFrontendSection() && cfg.carEventsEnabled()
                                ? importantDateFinder.listUpcomingCarEvents(cfg.remindDays()).collectList()
                                : Mono.just(java.util.Collections.<CarVo.CarEventVo>emptyList());
                        return dateEvents.zipWith(carEvents)
                            .flatMap(tuple -> {
                                List<ImportantDateVo> reminders = tuple.getT1();
                                List<CarVo.CarEventVo> events = tuple.getT2();
                                Map<String, Object> model = new LinkedHashMap<>();
                                model.put("title", "记得");
                                model.put("dates", dates);
                                model.put("people", people);
                                model.put("reminders", reminders);
                                model.put("showImportantTag", cfg.showImportantTag());
                                model.put("showAvatar", cfg.showAvatar());
                                // 座驾（1.2.0）：生活/爱车双视图数据
                                model.put("cars", cars);
                                model.put("carEvents", events);
                                model.put("view", "life");
                                model.put("showCarSection", cfg.carFrontendSection());
                                model.put("carSkinEnabled", cfg.carSkinEnabled());
                                List<String> carOwners = cars.stream()
                                    .map(CarVo::getOwnerName)
                                    .filter(n -> n != null && !n.isBlank())
                                    .distinct()
                                    .toList();
                                List<String> carDrivers = cars.stream()
                                    .flatMap(c -> c.getDriverNames() == null
                                        ? java.util.stream.Stream.<String>empty()
                                        : c.getDriverNames().stream())
                                    .distinct()
                                    .toList();
                                model.put("carOwners", carOwners);
                                model.put("carDrivers", carDrivers);
                                model.put(ModelConst.TEMPLATE_ID, TEMPLATE_ID);
                                return templateNameResolver
                                    .resolveTemplateNameOrDefault(request.exchange(), THEME_TEMPLATE)
                                    .defaultIfEmpty(THEME_TEMPLATE)
                                    .flatMap(templateName -> ServerResponse.ok()
                                        .render(templateName, model));
                            });
                    })
            )
            // 全站提醒数据（供 TemplateHeadProcessor 输出的脚本获取；匿名公开）
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
                    result.put("toastMaxPerType", cfg.toastMaxPerType());
                    // 页面横幅由 frontendReminder 控制；全站悬浮提醒由 toastEnabled 控制
                    if (!cfg.frontendReminder() && !cfg.toastEnabled()) {
                        result.put("reminders", java.util.Collections.emptyList());
                        return ServerResponse.ok()
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(result);
                    }
                    Mono<List<ImportantDateVo>> dateEvents =
                        importantDateFinder.listUpcoming(cfg.remindDays()).collectList();
                    Mono<List<CarVo.CarEventVo>> carEvents = cfg.carEventsEnabled()
                        ? importantDateFinder.listUpcomingCarEvents(cfg.remindDays()).collectList()
                        : Mono.just(java.util.Collections.emptyList());
                    return dateEvents.zipWith(carEvents).map(tuple -> {
                        List<Map<String, Object>> merged = new java.util.ArrayList<>();
                        for (ImportantDateVo r : tuple.getT1()) {
                            Map<String, Object> item = new LinkedHashMap<>();
                            item.put("type", "date");
                            item.put("title", r.getTitle());
                            item.put("daysUntil", r.getDaysUntil());
                            item.put("dateText", r.getDateText());
                            item.put("nextSolarDate", r.getNextSolarDate());
                            merged.add(item);
                        }
                        for (CarVo.CarEventVo e : tuple.getT2()) {
                            Map<String, Object> item = new LinkedHashMap<>();
                            item.put("type", "car");
                            item.put("carName", e.getCarName());
                            item.put("carIcon", e.getCarIcon());
                            item.put("title", e.getCarName() == null || e.getCarName().isBlank()
                                ? e.getLabel() : e.getCarName() + " · " + e.getLabel());
                            item.put("label", e.getLabel());
                            item.put("daysUntil", e.getDaysUntil());
                            item.put("dateText", e.getDateText());
                            item.put("overdue", e.isOverdue());
                            merged.add(item);
                        }
                        // 谁近谁靠前（同级时日期事件优先）
                        merged.sort(java.util.Comparator
                            .comparingLong((Map<String, Object> m) -> ((Number) m.get("daysUntil")).longValue())
                            .thenComparing(m -> "date".equals(m.get("type")) ? 0 : 1));
                        // 降噪：每类型最多 N 条，其余合并计数
                        int max = Math.max(1, cfg.toastMaxPerType());
                        List<Map<String, Object>> limited = new java.util.ArrayList<>();
                        int dateShown = 0;
                        int carShown = 0;
                        int overflow = 0;
                        for (Map<String, Object> item : merged) {
                            boolean isDate = "date".equals(item.get("type"));
                            if (isDate ? dateShown < max : carShown < max) {
                                limited.add(item);
                                if (isDate) {
                                    dateShown++;
                                } else {
                                    carShown++;
                                }
                            } else {
                                overflow++;
                            }
                        }
                        result.put("reminders", limited);
                        result.put("overflowCount", overflow);
                        return result;
                    })
                        .flatMap(map -> ServerResponse.ok()
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(map));
                })
            );
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
        Mono<JsonNode> privacy = settingFetcher.get("privacy")
            .switchIfEmpty(Mono.just(emptyNode()));
        Mono<JsonNode> car = settingFetcher.get("car")
            .switchIfEmpty(Mono.just(emptyNode()));
        return Mono.zip(reminder, basic, toast, privacy, car).map(tuple -> {
            JsonNode r = tuple.getT1();
            JsonNode b = tuple.getT2();
            JsonNode t = tuple.getT3();
            JsonNode p = tuple.getT4();
            JsonNode c = tuple.getT5();
            int days = intValue(r, "remindDays", DEFAULT_REMIND_DAYS);
            boolean frontendReminder = boolValue(r, "frontendReminder", true);
            int toastCloseSeconds = intValue(r, "toastCloseSeconds", DEFAULT_TOAST_CLOSE_SECONDS);
            boolean showImportantTag = boolValue(b, "showImportantTag", true);
            boolean toastEnabled = boolValue(t, "toastEnabled", false);
            String toastPosition = textValue(t, "toastPosition", "bottom-right");
            String toastTitle = textValue(t, "toastTitle", "📅 重要日期提醒");
            String toastTemplate = textValue(t, "toastTemplate",
                "「{title}」{whenText}（{dateText}）");
            String toastEmptyText = textValue(t, "toastEmptyText", "最近没有重要日期，生活照常美好～");
            String toastDefaultClose = textValue(t, "toastDefaultClose", "once");
            boolean toastCloseMenu = boolValue(t, "toastCloseMenu", true);
            boolean showAvatar = boolValue(p, "showAvatar", false);
            boolean carEventsEnabled = boolValue(c, "carEventsEnabled", true);
            boolean carFrontendSection = boolValue(c, "carFrontendSection", true);
            boolean carSkinEnabled = boolValue(c, "carSkinEnabled", true);
            int toastMaxPerType = intValue(t, "toastMaxPerType", 2);
            return new ReminderConfig(days, frontendReminder, showImportantTag,
                toastCloseSeconds, toastEnabled, toastPosition, toastTitle, toastTemplate,
                toastEmptyText, toastDefaultClose, toastCloseMenu, showAvatar,
                carEventsEnabled, carFrontendSection, carSkinEnabled, toastMaxPerType);
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
        int toastCloseSeconds,
        boolean toastEnabled, String toastPosition, String toastTitle,
        String toastTemplate, String toastEmptyText, String toastDefaultClose,
        boolean toastCloseMenu, boolean showAvatar,
        boolean carEventsEnabled, boolean carFrontendSection, boolean carSkinEnabled,
        int toastMaxPerType) {
    }
}


