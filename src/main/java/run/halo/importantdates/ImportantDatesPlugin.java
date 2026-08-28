package run.halo.importantdates;

import org.springframework.stereotype.Component;
import run.halo.app.extension.Scheme;
import run.halo.app.extension.SchemeManager;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;
import run.halo.importantdates.support.ThemeTemplateSupport;

/**
 * 插件生命周期管理。
 *
 * <p>注册扩展模型，并在启动时尝试为当前激活主题自动生成适配模板
 * （{@link ThemeTemplateSupport}），使前台页面可自动在主题布局内打开。
 *
 * @author yyliucha
 * @since 1.0.0
 */
@Component
public class ImportantDatesPlugin extends BasePlugin {

    private final SchemeManager schemeManager;
    private final ThemeTemplateSupport themeTemplateSupport;

    public ImportantDatesPlugin(PluginContext pluginContext, SchemeManager schemeManager,
        ThemeTemplateSupport themeTemplateSupport) {
        super(pluginContext);
        this.schemeManager = schemeManager;
        this.themeTemplateSupport = themeTemplateSupport;
    }

    @Override
    public void start() {
        schemeManager.register(ImportantDate.class);
        schemeManager.register(OperationLog.class);
        schemeManager.register(Person.class);
        // 自动生成主题模板（异步，失败不影响插件启动）
        themeTemplateSupport.ensureThemeTemplate().subscribe();
    }

    @Override
    public void stop() {
        schemeManager.unregister(Scheme.buildFromType(ImportantDate.class));
        schemeManager.unregister(Scheme.buildFromType(OperationLog.class));
        schemeManager.unregister(Scheme.buildFromType(Person.class));
    }
}
