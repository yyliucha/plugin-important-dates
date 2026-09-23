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
 * 悬浮提醒脚本注入（官方 {@link TemplateHeadProcessor} 扩展点）。
 *
 * <p><b>作用域可配（1.2.6）</b>：设置「悬浮提醒 → 显示范围」：
 * <ul>
 *   <li>{@code PAGE}（默认）：只在「记得」前台页面注入 —— 访客浏览其它页面看不到站主的提醒；</li>
 *   <li>{@code SITE}：全站所有页面注入（旧行为）。</li>
 * </ul>
 *
 * <p><b>数据实时获取</b>：注入的只是一段脚本，提醒内容由脚本每次实时请求
 * {@code /important-dates-reminders} 得到，不写进页面 HTML ——
 * 这样即使站点装了页面缓存，也不会出现"后台已经改到明年，前台还在弹旧提醒"。
 * 弹出后脚本回报 {@code /important-dates-reminder-seen}，服务端把"这个节点弹过了"写库
 * （与浏览器无关，换设备也只弹一次）。
 *
 * <p>插件停用/卸载时本处理器随插件卸载，不输出任何内容；不读写系统配置，不残留站点级改动。
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
        boolean onMemoryPage = Boolean.TRUE.equals(context.getVariable("idToastPage"));
        return settingFetcher.get("toast")
            .map(node -> {
                if (node == null || !node.path("toastEnabled").asBoolean(false)) {
                    return false;
                }
                // 作用域：PAGE 只在本插件页面；SITE 全站
                String scope = node.path("toastScope").asText("PAGE");
                return "SITE".equalsIgnoreCase(scope) || onMemoryPage;
            })
            .defaultIfEmpty(false)
            .flatMap(inject -> {
                if (!inject) {
                    return Mono.empty();
                }
                var factory = context.getModelFactory();
                // 注意：必须输出成对的 <script ...></script>。自闭合写法（<script ... />）在 HTML 里
                // 不会自闭合，解析器会把后续整段文档当作脚本文本吞掉 —— 1.2.6 修复。
                model.add(factory.createOpenElementTag(
                    "script",
                    Map.of("src", TOAST_SCRIPT_URL, "defer", ""),
                    AttributeValueQuotes.DOUBLE,
                    false
                ));
                model.add(factory.createCloseElementTag("script"));
                return Mono.empty();
            });
    }
}
