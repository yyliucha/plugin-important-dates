package run.halo.importantdates;

import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;
import run.halo.importantdates.finders.ImportantDateFinder;
import run.halo.importantdates.support.HtmlRenderer;

/**
 * 前台路由：/important-dates 独立页面，展示全部重要日期与人员（不含隐私字段）。
 *
 * <p>页面由插件自身渲染（HtmlRenderer），不依赖主题模板；同时提供 Finder API 供主题自由自定义。
 *
 * @author important-dates
 * @since 1.0.5
 */
@Component
public class ImportantDateRouter {

    private final ImportantDateFinder importantDateFinder;

    public ImportantDateRouter(ImportantDateFinder importantDateFinder) {
        this.importantDateFinder = importantDateFinder;
    }

    /**
     * 前台页面：/important-dates
     */
    @Bean
    RouterFunction<ServerResponse> importantDatesRouter() {
        return org.springframework.web.reactive.function.server.RouterFunctions.route(
            org.springframework.web.reactive.function.server.RequestPredicates.GET("/important-dates"),
            request -> Mono.zip(
                    importantDateFinder.listAll().collectList(),
                    importantDateFinder.listAllPeople().collectList()
                )
                .map(tuple -> HtmlRenderer.render(
                    "重要日期", tuple.getT1(), tuple.getT2()))
                .flatMap(html -> ServerResponse.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .bodyValue(html))
        );
    }
}
