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
    private final com.yyliucha.importantdates.support.ReminderStageMarker stageMarker;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper =
        new com.fasterxml.jackson.databind.ObjectMapper();

    public ImportantDateRouter(ImportantDateFinder importantDateFinder,
        ReactiveSettingFetcher settingFetcher,
        TemplateNameResolver templateNameResolver,
        com.yyliucha.importantdates.support.ReminderStageMarker stageMarker) {
        this.importantDateFinder = importantDateFinder;
        this.settingFetcher = settingFetcher;
        this.templateNameResolver = templateNameResolver;
        this.stageMarker = stageMarker;
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
                        importantDateFinder.cacheRemindDays(cfg.remindDays());
                        List<ImportantDateVo> dates = zip.getT2().getT1().getT1();
                        List<PersonVo> people = zip.getT2().getT1().getT2();
                        List<CarVo> cars = cfg.carFrontendSection()
                            ? zip.getT2().getT2()
                            : java.util.Collections.emptyList();
                        // 卡片上的到期徽章与横幅同一口径：只显示"待办且未逾期"，
                        // 已办 / 已忽略 / 逾期（需开关）都不出现在访客可见面。
                        for (CarVo car : cars) {
                            List<CarVo.CarEventVo> visibleEvents = car.getEvents().stream()
                                .filter(e -> "PENDING".equals(e.getStatus()))
                                .filter(e -> cfg.frontendShowOverdue() || e.getDaysUntil() >= 0)
                                .toList();
                            car.setEvents(visibleEvents);
                        }
                        Mono<List<ImportantDateVo>> dateEvents =
                            importantDateFinder.listUpcoming(cfg.remindDays()).collectList();
                        Mono<List<CarVo.CarEventVo>> carEvents =
                            cfg.carFrontendSection() && cfg.carEventsEnabled()
                                ? importantDateFinder.listUpcomingCarEvents(cfg.remindDays()).collectList()
                                : Mono.just(java.util.Collections.<CarVo.CarEventVo>emptyList());
                        return dateEvents.zipWith(carEvents)
                            .flatMap(tuple -> {
                                List<ImportantDateVo> allDates = tuple.getT1();
                                List<CarVo.CarEventVo> allEvents = tuple.getT2();
                                // 前台只展示"待办且未逾期"的座驾到期项：已办 / 已忽略 / 逾期 / 待处理都不出现在访客可见面
                                // （需要让家人也看到逾期项时，可在「提醒设置 → 前台显示逾期项」打开）
                                List<CarVo.CarEventVo> events = allEvents.stream()
                                    .filter(e -> "PENDING".equals(e.getStatus()))
                                    .filter(e -> cfg.frontendShowOverdue() || e.getDaysUntil() >= 0)
                                    .toList();
                                List<ImportantDateVo> reminders = allDates;
                                Map<String, Object> model = new LinkedHashMap<>();
                                model.put("title", "记得");
                                model.put("dates", dates);
                                model.put("people", people);
                                model.put("reminders", reminders);
                                model.put("showImportantTag", cfg.showImportantTag());
                                model.put("allowDismiss", cfg.allowDismiss());
                                model.put("frontendShowOverdue", cfg.frontendShowOverdue());
                                // 悬浮提示（选项 C：只在本页面弹出）：只弹"当前节点且尚未提醒过"的项
                                java.util.List<Map<String, Object>> toastItems = new java.util.ArrayList<>();
                                List<CarVo.CarEventVo> carToNotify = new java.util.ArrayList<>();
                                for (CarVo.CarEventVo e : allEvents) {
                                    if (!"PENDING".equals(e.getStatus()) || e.getStageCode() == null
                                        || e.isStageNotified()) {
                                        continue;
                                    }
                                    // 悬浮提示属于前台可见面：逾期项同样不出现（除非显式打开开关）
                                    if (!cfg.frontendShowOverdue() && e.getDaysUntil() < 0) {
                                        continue;
                                    }
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
                                    item.put("stageCode", e.getStageCode());
                                    item.put("text", e.getStageText());
                                    toastItems.add(item);
                                    carToNotify.add(e);
                                }
                                List<ImportantDateVo> dateToNotify = new java.util.ArrayList<>();
                                for (ImportantDateVo d : allDates) {
                                    if (d.getStageCode() == null || d.isStageNotified()) {
                                        continue;
                                    }
                                    Map<String, Object> item = new LinkedHashMap<>();
                                    item.put("type", "date");
                                    item.put("title", d.getTitle());
                                    item.put("daysUntil", d.getDaysUntil());
                                    item.put("dateText", d.getDateText());
                                    item.put("nextSolarDate", d.getNextSolarDate());
                                    item.put("stageCode", d.getStageCode());
                                    item.put("text", d.getStageText());
                                    toastItems.add(item);
                                    dateToNotify.add(d);
                                }
                                Map<String, Object> toast = new LinkedHashMap<>();
                                toast.put("toastEnabled", cfg.toastEnabled());
                                toast.put("toastPosition", cfg.toastPosition());
                                toast.put("toastTitle", cfg.toastTitle());
                                toast.put("toastTemplate", cfg.toastTemplate());
                                toast.put("toastEmptyText", cfg.toastEmptyText());
                                toast.put("toastCloseSeconds", cfg.toastCloseSeconds());
                                toast.put("toastDefaultClose", cfg.toastDefaultClose());
                                toast.put("toastCloseMenu", cfg.toastCloseMenu());
                                toast.put("reminders", toastItems);
                                model.put("idToastPage", Boolean.TRUE);
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
                                // 人员 → 爱车关系（用于「车主与驾驶人」区块的关系徽章，例如「车主 · 小白」）
                                java.util.Map<String, java.util.List<java.util.Map<String, String>>> personCars =
                                    new LinkedHashMap<>();
                                for (CarVo car : cars) {
                                    if (car.getOwnerName() != null && !car.getOwnerName().isBlank()) {
                                        personCars.computeIfAbsent(car.getOwnerName(), k -> new java.util.ArrayList<>())
                                            .add(java.util.Map.of(
                                                "role", "车主",
                                                "carName", car.getDisplayName() == null ? "" : car.getDisplayName(),
                                                "carIcon", car.getVehicleTypeIcon() == null ? "🚗" : car.getVehicleTypeIcon()));
                                    }
                                    if (car.getDriverNames() != null) {
                                        for (String driver : car.getDriverNames()) {
                                            if (driver == null || driver.isBlank() || driver.equals(car.getOwnerName())) {
                                                continue;
                                            }
                                            personCars.computeIfAbsent(driver, k -> new java.util.ArrayList<>())
                                                .add(java.util.Map.of(
                                                    "role", "驾驶人",
                                                    "carName", car.getDisplayName() == null ? "" : car.getDisplayName(),
                                                    "carIcon", car.getVehicleTypeIcon() == null ? "🚗" : car.getVehicleTypeIcon()));
                                        }
                                    }
                                }
                                List<PersonVo> carPeople = people.stream()
                                    .filter(p -> personCars.containsKey(p.getDisplayName()))
                                    .toList();
                                List<PersonVo> otherPeople = people.stream()
                                    .filter(p -> !personCars.containsKey(p.getDisplayName()))
                                    .toList();
                                model.put("personCars", personCars);
                                model.put("carPeople", carPeople);
                                model.put("otherPeople", otherPeople);
                                model.put(ModelConst.TEMPLATE_ID, TEMPLATE_ID);
                                // 节点写库：先记录"本次弹过了"，再渲染页面（写失败不影响渲染，只是下次可能再弹一次）
                                return stageMarker.markCarEvents(carToNotify)
                                    .then(stageMarker.markDateEvents(dateToNotify))
                                    .onErrorResume(e -> Mono.empty())
                                    .then(templateNameResolver
                                    .resolveTemplateNameOrDefault(request.exchange(), THEME_TEMPLATE)
                                    .defaultIfEmpty(THEME_TEMPLATE)
                                    .flatMap(templateName -> ServerResponse.ok()
                                        .render(templateName, model)));
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
                    result.put("toastScope", cfg.toastScope());
                    result.put("toastPosition", cfg.toastPosition());
                    result.put("toastTitle", cfg.toastTitle());
                    result.put("toastTemplate", cfg.toastTemplate());
                    result.put("toastEmptyText", cfg.toastEmptyText());
                    result.put("toastDefaultClose", cfg.toastDefaultClose());
                    result.put("toastCloseMenu", cfg.toastCloseMenu());
                    result.put("toastMaxPerType", cfg.toastMaxPerType());
                    result.put("dashboardPageSize", cfg.dashboardPageSize());
                    result.put("dashboardPagination", cfg.dashboardPagination());
                    result.put("allowDismiss", cfg.allowDismiss());
                    result.put("overdueRemindDays", cfg.overdueRemindDays());
                    result.put("frontendShowOverdue", cfg.frontendShowOverdue());
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
                            item.put("name", r.getName());
                            item.put("stageText", r.getStageText());
                            item.put("date", r.getNextSolarDate());
                            item.put("stageCode", r.getStageCode());
                            item.put("stageNotified", r.isStageNotified());
                            item.put("text", r.getStageText());
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
                            item.put("status", e.getStatus());
                            item.put("stageText", e.getStageText());
                            item.put("overdueDays", e.getOverdueDays());
                            // 控制台「已办 / 忽略」需要定位到具体到期项
                            item.put("carId", e.getCarId());
                            item.put("reminderIndex", e.getReminderIndex());
                            item.put("key", e.getKey());
                            item.put("date", e.getDate());
                            item.put("stageCode", e.getStageCode());
                            item.put("stageNotified", e.isStageNotified());
                            item.put("text", e.getStageText());
                            item.put("nextNoticeDate", e.getNextNoticeDate());
                            merged.add(item);
                        }
                        // 同一辆车、同一天到期的多个事项合并为一条（交强险 / 商业险 / 车船税 / 年检 同日时不再各占一行）
                        java.util.Map<String, java.util.Map<String, Object>> carGroups = new LinkedHashMap<>();
                        java.util.List<java.util.Map<String, Object>> mergedCar = new java.util.ArrayList<>();
                        for (java.util.Map<String, Object> item : merged) {
                            if (!"car".equals(item.get("type"))) {
                                mergedCar.add(item);
                                continue;
                            }
                            String groupKey = item.get("carName") + "|" + item.get("dateText");
                            java.util.Map<String, Object> exist = carGroups.get(groupKey);
                            if (exist == null) {
                                carGroups.put(groupKey, item);
                                mergedCar.add(item);
                            } else {
                                exist.put("label", exist.get("label") + " / " + item.get("label"));
                                exist.put("title", exist.get("carName") + " · " + exist.get("label"));
                            }
                        }
                        merged.clear();
                        merged.addAll(mergedCar);
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
                        // 悬浮提示数据：每次实时计算（不写进页面，避免页面缓存导致"后台已改、前台还弹"）。
                        // 只给"待办 + 未逾期 + 正好在节点上 + 该节点尚未提醒过"的项。
                        java.util.List<Map<String, Object>> toastItems = new java.util.ArrayList<>();
                        for (Map<String, Object> m : merged) {
                            if (!"PENDING".equals(m.get("status"))) {
                                continue;
                            }
                            Object daysObj = m.get("daysUntil");
                            if (!(daysObj instanceof Number num) || num.longValue() < 0) {
                                continue;
                            }
                            if (m.get("stageCode") == null || Boolean.TRUE.equals(m.get("stageNotified"))) {
                                continue;
                            }
                            toastItems.add(m);
                        }
                        result.put("toastItems", toastItems);
                        // 待处理（逾期超过窗口）：不再主动提醒，但计入总览，永远不会静默消失
                        long todoCount = merged.stream()
                            .filter(m -> "TODO".equals(m.get("status")))
                            .count();
                        result.put("todoCount", todoCount);
                        result.put("pendingCount", merged.stream()
                            .filter(m -> !"TODO".equals(m.get("status")))
                            .count());
                        // 完整列表（不做"每类最多 N 条"降噪）：供控制台仪表盘小组件分页展示，
                        // 口径与前台一致，仅页数由 dashboardPageSize 决定。
                        result.put("allReminders", merged);
                        return result;
                    })
                        .flatMap(map -> ServerResponse.ok()
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(map));
                })
            );
    }

    /**
     * 悬浮提示"已弹过"上报：数据实时取自 /important-dates-reminders，弹完由页面回报，服务端写库。
     */
    @Bean
    RouterFunction<ServerResponse> reminderSeenRouter() {
        return org.springframework.web.reactive.function.server.RouterFunctions.route(
            org.springframework.web.reactive.function.server.RequestPredicates
                .POST("/important-dates-reminder-seen"),
            request -> request.bodyToMono(new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
            })
                .flatMap(body -> {
                    Object raw = body.get("items");
                    java.util.List<Map<String, Object>> items = new java.util.ArrayList<>();
                    if (raw instanceof java.util.List<?> list) {
                        for (Object o : list) {
                            if (o instanceof Map<?, ?> map) {
                                Map<String, Object> item = new LinkedHashMap<>();
                                map.forEach((k, v) -> item.put(String.valueOf(k), v));
                                items.add(item);
                            }
                        }
                    }
                    return stageMarker.markSeen(items).onErrorResume(e -> Mono.empty());
                })
                .then(ServerResponse.noContent().build()));
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
            // 悬浮提示作用域：PAGE = 仅「记得」页面（默认）；SITE = 全站所有页面
            String toastScope = textValue(t, "toastScope", "PAGE");
            String toastTitle = textValue(t, "toastTitle", "📅 重要日期提醒");
            String toastTemplate = textValue(t, "toastTemplate",
                "「{title}」{whenText}（{dateText}）");
            String toastEmptyText = textValue(t, "toastEmptyText", "最近没有重要日期，生活照常美好～");
            String toastDefaultClose = textValue(t, "toastDefaultClose", "once");
            boolean toastCloseMenu = boolValue(t, "toastCloseMenu", true);
            boolean showAvatar = boolValue(p, "showAvatar", false);
            int dashboardPageSize = intValue(b, "dashboardPageSize", 5);
            boolean dashboardPagination = boolValue(b, "dashboardPagination", true);
            // 是否允许逐条忽略提醒（本周期内不再提示；状态存在访客浏览器）
            boolean allowDismiss = boolValue(r, "allowDismiss", true);
            // 逾期后继续主动提醒的天数（超过转"待处理"）与前台是否显示逾期项（1.2.6）
            int overdueRemindDays = com.yyliucha.importantdates.support.ReminderSupport
                .clampOverdueDays(intValue(r, "overdueRemindDays",
                    com.yyliucha.importantdates.support.ReminderSupport.DEFAULT_OVERDUE_DAYS));
            boolean frontendShowOverdue = boolValue(r, "frontendShowOverdue", false);
            boolean carEventsEnabled = boolValue(c, "carEventsEnabled", true);
            boolean carFrontendSection = boolValue(c, "carFrontendSection", true);
            boolean carSkinEnabled = boolValue(c, "carSkinEnabled", true);
            int toastMaxPerType = intValue(t, "toastMaxPerType", 2);
            return new ReminderConfig(days, frontendReminder, showImportantTag,
                toastCloseSeconds, toastEnabled, toastPosition, toastTitle, toastTemplate,
                toastEmptyText, toastDefaultClose, toastCloseMenu, showAvatar,
                carEventsEnabled, carFrontendSection, carSkinEnabled, toastMaxPerType,
                dashboardPageSize, dashboardPagination, allowDismiss, overdueRemindDays,
                frontendShowOverdue, toastScope);
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
        int toastMaxPerType, int dashboardPageSize, boolean dashboardPagination,
        boolean allowDismiss, int overdueRemindDays, boolean frontendShowOverdue,
        String toastScope) {
    }
}


