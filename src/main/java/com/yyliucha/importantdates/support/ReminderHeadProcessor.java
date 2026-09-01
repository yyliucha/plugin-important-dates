package com.yyliucha.importantdates.support;

import java.util.Map;
import org.springframework.stereotype.Component;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.model.AttributeValueQuotes;
import org.thymeleaf.model.IModel;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.ReactiveSettingFetcher;
import run.halo.app.theme.dialect.TemplateHeadProcessor;

/**
 * 全站悬浮提醒脚本注入（官方 {@link TemplateHeadProcessor} 扩展点）。
 *
 * <p>根据插件设置「全站悬浮提醒 → 启用」向主题端页面 &lt;head&gt; 输出脚本标签；
 * 关闭功能时输出为空；插件停用/卸载时本处理器随插件卸载，不再输出任何内容。
 * 不读写系统配置，不残留任何站点级改动。
 *
 * @author yyliucha
 * @since 1.1.2
 */
@Component
public class ReminderHeadProcessor implements TemplateHeadProcessor {

    private static final String TOAST_SCRIPT_URL =
        "/plugins/plugin-important-dates/assets/static/reminder-toast.js";

    private final ReactiveSettingFetcher settingFetcher;

    public ReminderHeadProcessor(ReactiveSettingFetcher settingFetcher) {
        this.settingFetcher = settingFetcher;
    }

    @Override
    public Mono<Void> process(ITemplateContext context, IModel model,
        IElementModelStructureHandler structureHandler) {
        return settingFetcher.get("toast")
            .map(node -> node == null ? false : node.path("toastEnabled").asBoolean(false))
            .defaultIfEmpty(false)
            .flatMap(enabled -> {
                if (!enabled) {
                    return Mono.empty();
                }
                var factory = context.getModelFactory();
                model.add(factory.createStandaloneElementTag(
                    "script",
                    Map.of("src", TOAST_SCRIPT_URL, "defer", ""),
                    AttributeValueQuotes.DOUBLE,
                    false,
                    true
                ));
                return Mono.empty();
            });
    }
}
