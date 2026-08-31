package com.yyliucha.importantdates.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ConfigMap;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.infra.SystemSetting;

/**
 * 全站悬浮提醒的站点代码注入支持。
 *
 * <p>在插件设置「全站悬浮提醒」开启时，向系统配置 {@code system} ConfigMap 的
 * {@code codeInjection.globalHead}（即「系统设置 → 代码注入 → 全局 head 标签」）
 * 追加插件脚本片段；关闭时仅移除该片段。
 *
 * <p>注入位置选择 {globalHead} 而非「页脚」：页脚注入（{@code footer}）只在主题
 * 模板包含 &lt;footer&gt; 元素时才会渲染，部分自定义主题不提供该元素导致注入即便
 * 写入也不会出现在页面里；而全局 head 注入对所有 Thymeleaf 渲染的页面（任何主题）
 * 都会生效，从而保证任意主题下悬浮提醒可见。
 *
 * <p>片段以 {@code id-toast} 标记包裹，互不影响用户手动写入的其他注入内容；
 * 内容相同时不会重复写入（避免版本号膨胀与并发冲突）。历史版本曾写入「页脚」，
 * 同步时会一并清理。
 *
 * <p>脚本本身位于插件静态资源（ReverseProxy 扩展提供）
 * {@code /plugins/plugin-important-dates/assets/static/reminder-toast.js}，
 * 随插件版本升级自动更新，无需改动站点注入内容。
 *
 * @author yyliucha
 * @since 1.0.22
 */
@Component
public class ToastCodeInjector {

    private static final String SYSTEM_CONFIG_NAME = "system";

    private static final String TOAST_START = "<!-- id-toast:start -->";
    private static final String TOAST_END = "<!-- id-toast:end -->";
    private static final String TOAST_SCRIPT =
        "<script src=\"/plugins/plugin-important-dates/assets/static/reminder-toast.js\" defer></script>";

    /** 匹配任意历史版本生成的 id-toast 片段。 */
    private static final Pattern TOAST_SEGMENT = Pattern.compile(
        "(?s)<!--\\s*id-toast:start\\s*-->[\\s\\S]*?<!--\\s*id-toast:end\\s*-->");

    private final ReactiveExtensionClient client;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final org.slf4j.Logger log =
        org.slf4j.LoggerFactory.getLogger(ToastCodeInjector.class);

    public ToastCodeInjector(ReactiveExtensionClient client) {
        this.client = client;
    }

    /**
     * 同步站点代码注入：enabled 时确保脚本片段存在于全局 head，关闭时移除。
     * 同时清理旧版本曾写入「页脚」的片段。内容无变化时不写库。
     */
    public Mono<Void> sync(boolean enabled) {
        return client.fetch(ConfigMap.class, SYSTEM_CONFIG_NAME)
            .flatMap(cm -> {
                SystemSetting.CodeInjection codeInjection = readCodeInjection(cm);
                String currentHead = nullableText(codeInjection == null ? null
                    : codeInjection.getGlobalHead());
                String currentFooter = nullableText(codeInjection == null ? null
                    : codeInjection.getFooter());
                String desiredHead = enabled ? withSegment(currentHead)
                    : withoutSegment(currentHead);
                boolean footerHasOldSegment = currentFooter.contains(TOAST_START)
                    || currentFooter.contains(TOAST_END);
                if (desiredHead.equals(currentHead) && !footerHasOldSegment) {
                    return Mono.empty();
                }
                try {
                    String desiredFooter = withoutSegment(currentFooter);
                    ObjectNode ci = parseCodeInjection(cm);
                    ci.put("globalHead", desiredHead);
                    ci.put("footer", desiredFooter);
                    cm.getData().put(SystemSetting.CodeInjection.GROUP,
                        objectMapper.writeValueAsString(ci));
                    return client.update(cm)
                        .doOnNext(saved -> log.info(
                            "[important-dates] code injection synced (enabled={})", enabled))
                        .then();
                } catch (Exception e) {
                    log.warn("[important-dates] toast injection update failed", e);
                    return Mono.empty();
                }
            })
            // 冲突（乐观锁）时重试：整体重订阅，重新读取最新 ConfigMap
            .retry(2)
            .onErrorResume(e -> {
                log.warn("[important-dates] toast injection sync failed", e);
                return Mono.empty();
            });
    }

    private static SystemSetting.CodeInjection readCodeInjection(ConfigMap cm) {
        try {
            return SystemSetting.get(cm, SystemSetting.CodeInjection.GROUP,
                SystemSetting.CodeInjection.class);
        } catch (Exception e) {
            return null;
        }
    }

    private static String nullableText(String s) {
        return s == null ? "" : s;
    }

    private ObjectNode parseCodeInjection(ConfigMap cm) throws Exception {
        String raw = cm.getData() == null ? null
            : cm.getData().get(SystemSetting.CodeInjection.GROUP);
        if (raw == null || raw.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return (ObjectNode) objectMapper.readTree(raw);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }

    static String withSegment(String content) {
        String base = withoutSegment(content);
        String segment = TOAST_START + "\n" + TOAST_SCRIPT + "\n" + TOAST_END;
        return base.isEmpty() ? segment : base + "\n\n" + segment;
    }

    static String withoutSegment(String content) {
        String s = content == null ? "" : content;
        Matcher matcher = TOAST_SEGMENT.matcher(s);
        if (!matcher.find()) {
            return s;
        }
        int start = matcher.start();
        int end = matcher.end();
        String head = s.substring(0, start);
        String tail = s.substring(end);
        // 去掉片段前/后残留的空行分隔
        String restored = head.replaceFirst("(?:\\r?\\n){1,2}$", "") + tail;
        return restored.replaceFirst("(?:\\r?\\n){1,2}$", "");
    }
}
