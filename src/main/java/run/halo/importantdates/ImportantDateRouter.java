package run.halo.importantdates;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.ReactiveSettingFetcher;
import run.halo.importantdates.finders.ImportantDateFinder;
import run.halo.importantdates.support.HtmlRenderer;

/**
 * 前台路由：/important-dates 独立页面，展示全部重要日期与人员（不含隐私字段）。
 *
 * <p>页面由插件自身渲染（HtmlRenderer），不依赖主题模板；同时提供 Finder API 供主题自由自定义。
 * 顶部显示到期提醒（由插件设置中的"提前提醒天数/前台提醒"控制）。
 *
 * @author important-dates
 * @since 1.0.5
 */
@Component
public class ImportantDateRouter {

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
                    .map(tuple -> HtmlRenderer.render(
                        "重要日期",
                        tuple.getT1(),
                        tuple.getT2(),
                        tuple.getT3(),
                        cfg.showImportantTag()
                    ))
                    .flatMap(html -> ServerResponse.ok()
                        .contentType(MediaType.TEXT_HTML)
                        .bodyValue(html))
            )
        );
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
            return new ReminderConfig(days, frontendReminder, showImportantTag);
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

    record ReminderConfig(int remindDays, boolean frontendReminder, boolean showImportantTag) {
    }
}
