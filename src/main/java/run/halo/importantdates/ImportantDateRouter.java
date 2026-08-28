package run.halo.importantdates;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.ReactiveSettingFetcher;
import run.halo.importantdates.finders.ImportantDateFinder;

/**
 * 前台路由：/important-dates。
 *
 * <p>渲染策略（配置化）：
 * <ul>
 *   <li>默认使用插件自带模板（{@code plugin:plugin-important-dates:important-dates}），
 *       独立页面样式，不依赖主题；</li>
 *   <li>开启插件设置「使用主题模板渲染」后，渲染主题模板 {@code important-dates.html}
 *       （模板放在当前激活主题的 templates/ 目录，自动获得主题布局：导航、页脚等）；
 *       model 中提供 {@code title}/{@code dates}/{@code people}/{@code reminders}/
 *       {@code showImportantTag}，主题模板可直接消费。</li>
 * </ul>
 *
 * @author yyliucha
 * @since 1.0.5
 */
@Component
public class ImportantDateRouter {

    private static final String THEME_TEMPLATE = "important-dates";
    private static final String PLUGIN_TEMPLATE = "plugin:plugin-important-dates:important-dates";
    private static final int DEFAULT_REMIND_DAYS = 3;

    private final ImportantDateFinder importantDateFinder;
    private final ReactiveSettingFetcher settingFetcher;

    public ImportantDateRouter(ImportantDateFinder importantDateFinder,
        ReactiveSettingFetcher settingFetcher) {
        this.importantDateFinder = importantDateFinder;
        this.settingFetcher = settingFetcher;
    }

    /**
     * 前台页面：/important-dates
     */
    @Bean
    RouterFunction<ServerResponse> importantDatesRouter() {
        return org.springframework.web.reactive.function.server.RouterFunctions.route(
            org.springframework.web.reactive.function.server.RequestPredicates.GET("/important-dates"),
            request -> reminderConfig().flatMap(cfg ->
                Mono.zip(
                        importantDateFinder.listAll().collectList(),
                        importantDateFinder.listAllPeople().collectList(),
                        importantDateFinder.listUpcoming(cfg.remindDays()).collectList()
                    )
                    .map(tuple -> buildModel(tuple, cfg))
                    .flatMap(model -> ServerResponse.ok().render(
                        cfg.useThemeTemplate() ? THEME_TEMPLATE : PLUGIN_TEMPLATE,
                        model))
            )
        );
    }

    private Map<String, Object> buildModel(
        reactor.util.function.Tuple3<java.util.List<run.halo.importantdates.vo.ImportantDateVo>,
            java.util.List<run.halo.importantdates.vo.PersonVo>,
            java.util.List<run.halo.importantdates.vo.ImportantDateVo>> tuple,
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
     * 读取提醒配置（默认：提前 3 天、前台提醒开启、显示重要标记）。
     */
    private Mono<ReminderConfig> reminderConfig() {
        Mono<JsonNode> reminder = settingFetcher.get("reminder")
            .switchIfEmpty(Mono.just(emptyNode()));
        Mono<JsonNode> basic = settingFetcher.get("basic")
            .switchIfEmpty(Mono.just(emptyNode()));
        return Mono.zip(reminder, basic).map(tuple -> {
            JsonNode r = tuple.getT1();
            JsonNode b = tuple.getT2();
            int days = intValue(r, "remindDays", DEFAULT_REMIND_DAYS);
            boolean frontendReminder = boolValue(r, "frontendReminder", true);
            boolean showImportantTag = boolValue(b, "showImportantTag", true);
            boolean useThemeTemplate = boolValue(b, "useThemeTemplate", false);
            return new ReminderConfig(days, frontendReminder, showImportantTag, useThemeTemplate);
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

    record ReminderConfig(int remindDays, boolean frontendReminder, boolean showImportantTag,
        boolean useThemeTemplate) {
    }
}
