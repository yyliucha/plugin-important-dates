package com.yyliucha.importantdates.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.model.AttributeValueQuotes;
import org.thymeleaf.model.IModel;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import reactor.core.publisher.Mono;
import run.halo.app.theme.dialect.TemplateHeadProcessor;

/**
 * 悬浮提醒脚本注入（官方 {@link TemplateHeadProcessor} 扩展点）。
 *
 * <p><b>1.2.6 起的作用域</b>：悬浮提示只在「记得」前台页面弹出（用户确认的方案 C）——
 * 处理器只在当前模板正是本插件页面、且路由层已经准备好本次要弹的节点数据
 * （{@code idToastPayload}）时输出脚本；其它页面一律不输出，因此访客浏览站点时不会看到站主的提醒。
 *
 * <p>因为节点数据由服务端在页面渲染时下发（{@code window.__ID_TOAST__}），
 * "每个节点只弹一次"的记录也就在那次渲染写库，与浏览器无关。
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

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Mono<Void> process(ITemplateContext context, IModel model,
        IElementModelStructureHandler structureHandler) {
        Object payload = context.getVariable("idToastPayload");
        if (!(payload instanceof Map<?, ?> data)) {
            // 不是「记得」页面（或本次没有提醒数据）→ 不输出任何内容
            return Mono.empty();
        }
        if (Boolean.FALSE.equals(data.get("toastEnabled"))) {
            return Mono.empty();
        }
        String json;
        try {
            // 转义 "<" 避免 JSON 文本中出现 </script> 之类序列
            json = objectMapper.writeValueAsString(data).replace("<", "\\u003c");
        } catch (Exception e) {
            return Mono.empty();
        }
        var factory = context.getModelFactory();
        model.add(factory.createOpenElementTag("script"));
        model.add(factory.createText("window.__ID_TOAST__=" + json + ";"));
        model.add(factory.createCloseElementTag("script"));
        // 注意：必须输出成对的 <script ...></script>。
        // 自闭合写法（<script ... />）在 HTML 里不会自闭合，解析器会把后续整段文档当作脚本文本吞掉，
        // 表现为「开启悬浮提醒后页面内容消失」——1.2.6 修复。
        model.add(factory.createOpenElementTag(
            "script",
            Map.of("src", TOAST_SCRIPT_URL, "defer", ""),
            AttributeValueQuotes.DOUBLE,
            false
        ));
        model.add(factory.createCloseElementTag("script"));
        return Mono.empty();
    }
}
