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
 * {@code codeInjection.footer}（即「系统设置 → 代码注入 → 页脚」）追加插件脚本片段；
 * 关闭时仅移除该片段。片段以 {@code id-toast} 标记包裹，互不影响用户手动写入的其他
 * 注入内容；内容相同时不会重复写入（避免版本号膨胀与并发冲突）。
 *
 * <p>脚本本身位于插件静态资源 {@code /plugins/plugin-important-dates/assets/reminder-toast.js}，
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

    public ToastCodeInjector(ReactiveExtensionClient client) {
        this.client = client;
    }

    /**
     * 同步站点代码注入：enabled 时确保片段存在，关闭时移除片段。
     * 内容无变化时不写库。
     */
    public Mono<Void> sync(boolean enabled) {
        return client.fetch(ConfigMap.class, SYSTEM_CONFIG_NAME)
            .flatMap(cm -> {
                String current = footerOf(cm);
                String desired = enabled ? withSegment(current) : withoutSegment(current);
                if (desired.equals(current)) {
                    log.debug("[important-dates] toast injection unchanged (enabled={})", enabled);
                    return Mono.empty();
                }
                try {
                    ObjectNode codeInjection = parseCodeInjection(cm);
                    codeInjection.put("footer", desired);
                    cm.getData().put(SystemSetting.CodeInjection.GROUP,
                        objectMapper.writeValueAsString(codeInjection));
                    log.info("[important-dates] updating system configmap: footer len {} → {}",
                        current.length(), desired.length());
                    return client.update(cm)
                        .doOnNext(saved -> log.info(
                            "[important-dates] system configmap updated, footer len: {}",
                            footerOf(saved).length()))
                        .then();
                } catch (Exception e) {
                    log.warn("[important-dates] toast injection update failed", e);
                    return Mono.empty();
                }
            })
            .onErrorResume(e -> {
                log.warn("[important-dates] toast injection error", e);
                return Mono.empty();
            })
            .retry(1);
    }

    private static final org.slf4j.Logger log =
        org.slf4j.LoggerFactory.getLogger(ToastCodeInjector.class);

    private static String footerOf(ConfigMap cm) {
        try {
            SystemSetting.CodeInjection codeInjection = SystemSetting.get(
                cm, SystemSetting.CodeInjection.GROUP, SystemSetting.CodeInjection.class);
            if (codeInjection == null || codeInjection.getFooter() == null) {
                return "";
            }
            return codeInjection.getFooter();
        } catch (Exception e) {
            return "";
        }
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

    static String withSegment(String footer) {
        String base = withoutSegment(footer);
        String segment = TOAST_START + "\n" + TOAST_SCRIPT + "\n" + TOAST_END;
        return base.isEmpty() ? segment : base + "\n\n" + segment;
    }

    static String withoutSegment(String footer) {
        String s = footer == null ? "" : footer;
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
