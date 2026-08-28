package run.halo.importantdates;

import org.springframework.stereotype.Component;
import run.halo.app.extension.Scheme;
import run.halo.app.extension.SchemeManager;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;

/**
 * 插件生命周期管理。
 *
 * <p>负责在插件启动时注册 {@link ImportantDate} 与 {@link OperationLog} 扩展模型，
 * 停止时注销。
 *
 * @author important-dates
 * @since 1.0.0
 */
@Component
public class ImportantDatesPlugin extends BasePlugin {

    private final SchemeManager schemeManager;

    public ImportantDatesPlugin(PluginContext pluginContext, SchemeManager schemeManager) {
        super(pluginContext);
        this.schemeManager = schemeManager;
    }

    @Override
    public void start() {
        schemeManager.register(ImportantDate.class);
        schemeManager.register(OperationLog.class);
        schemeManager.register(Person.class);
    }

    @Override
    public void stop() {
        schemeManager.unregister(Scheme.buildFromType(ImportantDate.class));
        schemeManager.unregister(Scheme.buildFromType(OperationLog.class));
        schemeManager.unregister(Scheme.buildFromType(Person.class));
    }
}
