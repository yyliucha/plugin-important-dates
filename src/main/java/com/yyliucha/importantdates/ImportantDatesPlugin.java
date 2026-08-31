package com.yyliucha.importantdates;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yyliucha.importantdates.support.ThemeTemplateSupport;
import com.yyliucha.importantdates.support.ToastCodeInjector;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ConfigMap;
import run.halo.app.extension.Extension;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.Scheme;
import run.halo.app.extension.SchemeManager;
import run.halo.app.extension.Watcher;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;

/**
 * 插件生命周期管理。
 *
 * <p>注册扩展模型，并在启动时尝试为当前激活主题自动生成适配模板
 * （{@link ThemeTemplateSupport}），使前台页面可自动在主题布局内打开。
 * 同时根据「全站悬浮提醒」设置维护站点代码注入（{@link ToastCodeInjector}）：
 * 插件配置 ConfigMap 更新时直接读取最新配置并同步（不依赖设置缓存，避免读到旧值）。
 *
 * @author yyliucha
 * @since 1.0.0
 */
@Component
public class ImportantDatesPlugin extends BasePlugin {

    private static final String CONFIG_MAP_NAME = "plugin-important-dates-configmap";

    // 悬浮提醒默认文案（与 extensions/settings.yaml 保持一致）
    private static final String TOAST_NEW_TITLE = "📅 重要日期提醒";
    private static final String TOAST_NEW_TEMPLATE = "「{title}」{whenText}（{dateText}）";
    private static final String TOAST_NEW_EMPTY_TEXT = "最近没有重要日期，生活照常美好～";
    // 旧版本默认文案（1.0.25 及以前），升级时做一次性替换
    private static final String TOAST_LEGACY_TITLE = "重要日期提醒";
    private static final String TOAST_LEGACY_TEMPLATE = "「{title}」还有 {daysUntil} 天（{dateText}）";
    private static final String TOAST_LEGACY_EMPTY_TEXT = "最近没有重要日期提醒";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final SchemeManager schemeManager;
    private final ThemeTemplateSupport themeTemplateSupport;
    private final ToastCodeInjector toastCodeInjector;
    private final ReactiveExtensionClient extensionClient;
    private final Watcher configWatcher = new Watcher() {
        @Override
        public void onUpdate(Extension oldExt, Extension newExt) {
            if (newExt instanceof ConfigMap cm
                && CONFIG_MAP_NAME.equals(cm.getMetadata().getName())) {
                syncToastInjection();
            }
        }

        @Override
        public void dispose() {
            // 监听注册随插件上下文整体释放，无需额外清理
        }
    };

    public ImportantDatesPlugin(PluginContext pluginContext, SchemeManager schemeManager,
        ThemeTemplateSupport themeTemplateSupport, ToastCodeInjector toastCodeInjector,
        ReactiveExtensionClient extensionClient) {
        super(pluginContext);
        this.schemeManager = schemeManager;
        this.themeTemplateSupport = themeTemplateSupport;
        this.toastCodeInjector = toastCodeInjector;
        this.extensionClient = extensionClient;
    }

    @Override
    public void start() {
        schemeManager.register(ImportantDate.class);
        schemeManager.register(OperationLog.class);
        schemeManager.register(Person.class);
        // 自动生成主题模板（异步，失败不影响插件启动）
        themeTemplateSupport.ensureThemeTemplate().subscribe();
        // 悬浮提醒旧默认文案一次性迁移
        migrateToastDefaults();
        // 全站悬浮提醒：按设置维护站点代码注入；设置变更时自动同步
        extensionClient.watch(configWatcher);
        syncToastInjection();
    }

    @Override
    public void stop() {
        schemeManager.unregister(Scheme.buildFromType(ImportantDate.class));
        schemeManager.unregister(Scheme.buildFromType(OperationLog.class));
        schemeManager.unregister(Scheme.buildFromType(Person.class));
        // 插件停止/停用/卸载时移除注入片段，避免页面引用失效脚本
        toastCodeInjector.sync(false).subscribe();
        configWatcher.dispose();
    }

    /**
     * 直接读取插件配置 ConfigMap（事件触发后即为最新值），
     * 避免使用 SettingFetcher 缓存导致的旧值误判。
     */
    /**
     * 直接把设置保存为旧默认文案的便签迁移为新默认文案（1.0.26 起，
     * 更人性化的措辞）。仅当值与旧默认文案完全一致时替换（尊重用户自定义），
     * 有变化才写库。
     */
    private void migrateToastDefaults() {
        extensionClient.fetch(ConfigMap.class, CONFIG_MAP_NAME)
            .flatMap(cm -> {
                if (cm.getData() == null || cm.getData().get("toast") == null) {
                    return Mono.empty();
                }
                try {
                    JsonNode node = OBJECT_MAPPER.readTree(cm.getData().get("toast"));
                    boolean titleChanged = TOAST_LEGACY_TITLE.equals(textOf(node, "toastTitle"));
                    boolean templateChanged = TOAST_LEGACY_TEMPLATE.equals(textOf(node, "toastTemplate"));
                    boolean emptyChanged = TOAST_LEGACY_EMPTY_TEXT.equals(textOf(node, "toastEmptyText"));
                    if (!titleChanged && !templateChanged && !emptyChanged) {
                        return Mono.empty();
                    }
                    com.fasterxml.jackson.databind.node.ObjectNode toast =
                        (com.fasterxml.jackson.databind.node.ObjectNode) node;
                    if (titleChanged) {
                        toast.put("toastTitle", TOAST_NEW_TITLE);
                    }
                    if (templateChanged) {
                        toast.put("toastTemplate", TOAST_NEW_TEMPLATE);
                    }
                    if (emptyChanged) {
                        toast.put("toastEmptyText", TOAST_NEW_EMPTY_TEXT);
                    }
                    cm.getData().put("toast", OBJECT_MAPPER.writeValueAsString(toast));
                    return extensionClient.update(cm).then();
                } catch (Exception e) {
                    return Mono.empty();
                }
            })
            .onErrorResume(e -> Mono.empty())
            .subscribe();
    }

    private static String textOf(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) {
            return "";
        }
        return node.get(field).asText("");
    }

    private void syncToastInjection() {
        extensionClient.fetch(ConfigMap.class, CONFIG_MAP_NAME)
            .map(ImportantDatesPlugin::toastEnabledOf)
            .defaultIfEmpty(false)
            .flatMap(toastCodeInjector::sync)
            .subscribe();
    }

    private static boolean toastEnabledOf(ConfigMap cm) {
        if (cm == null || cm.getData() == null) {
            return false;
        }
        String raw = cm.getData().get("toast");
        if (raw == null || raw.isBlank()) {
            return false;
        }
        try {
            JsonNode node = OBJECT_MAPPER.readTree(raw);
            JsonNode value = node.get("toastEnabled");
            return value != null && !value.isNull() && value.asBoolean(false);
        } catch (Exception e) {
            return false;
        }
    }
}
