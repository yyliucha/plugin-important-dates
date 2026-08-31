package com.yyliucha.importantdates;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yyliucha.importantdates.support.ThemeTemplateSupport;
import com.yyliucha.importantdates.support.ToastCodeInjector;
import org.springframework.stereotype.Component;
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
