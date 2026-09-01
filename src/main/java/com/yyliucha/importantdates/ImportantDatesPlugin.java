package com.yyliucha.importantdates;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ConfigMap;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.Scheme;
import run.halo.app.extension.SchemeManager;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;

/**
 * 插件生命周期管理。
 *
 * <p>注册扩展模型。全站悬浮提醒的脚本注入由 {@link com.yyliucha.importantdates.support.ReminderHeadProcessor}
 * 通过官方 {@code TemplateHeadProcessor} 扩展点按设置输出（关闭即不输出、停用即卸载），
 * 插件不再读写任何系统配置（含 System ConfigMap）。
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
    // 旧版本默认文案（1.0.30 及以前），升级时做一次性替换（仅插件自身配置，不涉及系统配置）
    private static final String TOAST_LEGACY_TITLE = "重要日期提醒";
    private static final String TOAST_LEGACY_TEMPLATE = "「{title}」还有 {daysUntil} 天（{dateText}）";
    private static final String TOAST_LEGACY_EMPTY_TEXT = "最近没有重要日期提醒";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final SchemeManager schemeManager;
    private final ReactiveExtensionClient extensionClient;

    public ImportantDatesPlugin(PluginContext pluginContext, SchemeManager schemeManager,
        ReactiveExtensionClient extensionClient) {
        super(pluginContext);
        this.schemeManager = schemeManager;
        this.extensionClient = extensionClient;
    }

    @Override
    public void start() {
        schemeManager.register(ImportantDate.class);
        schemeManager.register(OperationLog.class);
        schemeManager.register(Person.class);
        // 悬浮提醒旧默认文案一次性迁移（仅写插件自身配置）
        migrateToastDefaults();
    }

    @Override
    public void stop() {
        schemeManager.unregister(Scheme.buildFromType(ImportantDate.class));
        schemeManager.unregister(Scheme.buildFromType(OperationLog.class));
        schemeManager.unregister(Scheme.buildFromType(Person.class));
    }

    /**
     * 直接把设置保存为旧默认文案的便签迁移为新默认文案（1.1.2 起）。
     * 仅当值与旧默认文案完全一致时替换（尊重用户自定义），有变化才写库。
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
}
