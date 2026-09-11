package com.yyliucha.importantdates;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.Setting;
import run.halo.app.core.extension.attachment.Group;
import run.halo.app.core.extension.attachment.Policy;
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

    private static final String SETTING_NAME = "plugin-important-dates-settings";
    private static final String CONFIG_MAP_NAME = "plugin-important-dates-configmap";
    private static final String ATTACHMENT_GROUP = "attachment";

    // 悬浮提醒默认文案（与 extensions/settings.yaml 保持一致）
    private static final String TOAST_NEW_TITLE = "📅 重要日期提醒";
    private static final String TOAST_NEW_TEMPLATE = "「{title}」{whenText}（{dateText}）";
    private static final String TOAST_NEW_EMPTY_TEXT = "最近没有重要日期，生活照常美好～";
    // 旧版本默认文案（1.0.30 及以前），升级时做一次性替换（仅插件自身配置，不涉及系统配置）
    private static final String TOAST_LEGACY_TITLE = "重要日期提醒";
    private static final String TOAST_LEGACY_TEMPLATE = "「{title}」还有 {daysUntil} 天（{dateText}）";
    private static final String TOAST_LEGACY_EMPTY_TEXT = "最近没有重要日期提醒";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper()
        .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    private final SchemeManager schemeManager;
    private final ReactiveExtensionClient extensionClient;
    private final com.yyliucha.importantdates.support.OperationLogCleaner logCleaner;

    public ImportantDatesPlugin(PluginContext pluginContext, SchemeManager schemeManager,
        ReactiveExtensionClient extensionClient,
        com.yyliucha.importantdates.support.OperationLogCleaner logCleaner) {
        super(pluginContext);
        this.schemeManager = schemeManager;
        this.extensionClient = extensionClient;
        this.logCleaner = logCleaner;
    }

    @Override
    public void start() {
        schemeManager.register(ImportantDate.class);
        schemeManager.register(OperationLog.class);
        schemeManager.register(Person.class);
        schemeManager.register(Car.class);
        // 悬浮提醒旧默认文案一次性迁移（仅写插件自身配置）
        migrateToastDefaults();
        // 操作日志自动清理（按设置保留天数）
        logCleaner.start();
        // 附件设置下拉动态化：把系统真实的「分类/策略」注入到插件 Setting 表单选项
        startAttachmentOptionsRefresher();
    }

    @Override
    public void stop() {
        stopAttachmentOptionsRefresher();
        logCleaner.stop();
        schemeManager.unregister(Scheme.buildFromType(ImportantDate.class));
        schemeManager.unregister(Scheme.buildFromType(OperationLog.class));
        schemeManager.unregister(Scheme.buildFromType(Person.class));
        schemeManager.unregister(Scheme.buildFromType(Car.class));
    }

    // ---------- 附件设置下拉动态化（实时同步） ----------
    private run.halo.app.extension.Watcher attachmentWatcher;

    private void startAttachmentOptionsRefresher() {
        // 安装/启动时立即注入一次
        refreshAttachmentOptions();
        // 实时同步：Watch 系统变更，仅关注 存储策略/附件分组 事件，变化即刷新下拉选项
        attachmentWatcher = new run.halo.app.extension.Watcher() {
            @Override
            public void onAdd(run.halo.app.extension.Extension e) {
                if (isAttachmentScope(e) || isOurSetting(e)) {
                    refreshAttachmentOptions();
                }
            }

            @Override
            public void onUpdate(run.halo.app.extension.Extension oldExt, run.halo.app.extension.Extension newExt) {
                // PluginReconciler 会在插件状态变化时用 jar 默认 Setting 覆盖我们注入的选项，
                // 因此监听自己的 Setting 变更，被覆盖后毫秒级重注入（无变化时不会写库，无循环）
                if (isAttachmentScope(newExt) || isOurSetting(newExt)) {
                    refreshAttachmentOptions();
                }
            }

            @Override
            public void onDelete(run.halo.app.extension.Extension e) {
                if (isAttachmentScope(e)) {
                    refreshAttachmentOptions();
                }
            }

            @Override
            public void dispose() {
                // Watch 注册由客户端管理；此处无需额外清理
            }
        };
        extensionClient.watch(attachmentWatcher);
    }

    private static boolean isAttachmentScope(run.halo.app.extension.Extension e) {
        return e instanceof run.halo.app.core.extension.attachment.Policy
            || e instanceof run.halo.app.core.extension.attachment.Group;
    }

    private static boolean isOurSetting(run.halo.app.extension.Extension e) {
        return e instanceof run.halo.app.core.extension.Setting
            && SETTING_NAME.equals(e.getMetadata() == null ? null : e.getMetadata().getName());
    }

    private void stopAttachmentOptionsRefresher() {
        if (attachmentWatcher != null) {
            attachmentWatcher.dispose();
            attachmentWatcher = null;
        }
    }

    /**
     * 把系统存储策略 &amp; 附件分组注入到插件 Setting(attachment 组) 的两个 select options。
     * 仅更新自身 Setting 扩展（官方扩展 API），不触碰任何系统资源。
     */
    private void refreshAttachmentOptions() {
        try {
            refreshAttachmentOptionsInner();
        } catch (Throwable t) {
            markStatus("同步失败: " + t);
        }
    }

    /** 失败时把原因写入两个字段的 help 文本，便于在设置页直接看到诊断信息 */
    private void markStatus(String message) {
        try {
            extensionClient.fetch(Setting.class, SETTING_NAME)
                .flatMap(setting -> {
                    try {
                        JsonNode root = OBJECT_MAPPER.valueToTree(setting);
                        JsonNode forms = root.path("spec").path("forms");
                        if (forms.isArray()) {
                            for (JsonNode form : forms) {
                                if (!ATTACHMENT_GROUP.equals(form.path("group").asText())) {
                                    continue;
                                }
                                JsonNode schema = form.path("formSchema");
                                if (!schema.isArray()) {
                                    continue;
                                }
                                for (JsonNode field : schema) {
                                    String name = field.path("name").asText();
                                    if ("avatarGroupName".equals(name) || "avatarPolicyName".equals(name)) {
                                        ((ObjectNode) field).put("help", message);
                                    }
                                }
                            }
                        }
                        Setting updated = OBJECT_MAPPER.treeToValue(root, Setting.class);
                        return extensionClient.update(updated).then();
                    } catch (Exception e) {
                        return Mono.empty();
                    }
                })
                .subscribe();
        } catch (Throwable ignored) {
        }
    }


    private void refreshAttachmentOptionsInner() {
        Mono.zip(
                extensionClient.listAll(Policy.class, run.halo.app.extension.ListOptions.builder().build(),
                        org.springframework.data.domain.Sort.unsorted()).collectList(),
                extensionClient.listAll(Group.class, run.halo.app.extension.ListOptions.builder().build(),
                        org.springframework.data.domain.Sort.unsorted()).collectList())
            
            .flatMap(tuple -> extensionClient.fetch(Setting.class, SETTING_NAME)
                
                .flatMap(setting -> {
                try {
                    List<Group> groups = tuple.getT2();
                    List<Policy> policies = tuple.getT1();
                    JsonNode root = OBJECT_MAPPER.valueToTree(setting);
                    JsonNode forms = root.path("spec").path("forms");
                    boolean changed = false;
                    if (forms.isArray()) {
                        for (JsonNode form : forms) {
                            if (!ATTACHMENT_GROUP.equals(form.path("group").asText())) {
                                continue;
                            }
                            JsonNode schema = form.path("formSchema");
                            if (!schema.isArray()) {
                                continue;
                            }
                            for (JsonNode field : schema) {
                                String name = field.path("name").asText();
                                boolean isGroupField = "avatarGroupName".equals(name) || "carGroupName".equals(name);
                                boolean isPolicyField = "avatarPolicyName".equals(name) || "carPolicyName".equals(name);
                                if (!isGroupField && !isPolicyField) {
                                    continue;
                                }
                                // 人员大头贴与座驾相册分别注入（各自的分类 / 策略），互不影响
                                String target = "carGroupName".equals(name) || "carPolicyName".equals(name)
                                    ? "座驾相册" : "人员大头贴";
                                ArrayNode newOpts = isGroupField ? groupOptions(groups) : policyOptions(policies);
                                String newHelp = isGroupField
                                    ? "实时同步 ✓ " + target + "可选分组 " + groups.size() + " 个（已过滤隐藏项）。点击可查看：不限定 / 未分组 / 全部可见分组。"
                                    : "实时同步 ✓ " + target + "可选策略 " + policies.size() + " 个（已过滤隐藏项）。点击可查看：默认策略 / 全部可见策略。";
                                boolean optionChanged = !field.path("options").toString().equals(newOpts.toString())
                                    || !newHelp.equals(field.path("help").asText(""));
                                // 首次安装默认选中第一个真实项（未配置时），避免用户不选导致无可选项
                                if (optionChanged || field.path("value").asText("").isEmpty()) {
                                    ((ObjectNode) field).set("options", newOpts);
                                    ((ObjectNode) field).put("help", newHelp);
                                    if (field.path("value").asText("").isEmpty()) {
                                        for (JsonNode opt : newOpts) {
                                            String v = opt.path("value").asText();
                                            if (!v.isEmpty()) {
                                                ((ObjectNode) field).put("value", v);
                                                break;
                                            }
                                        }
                                    }
                                    changed = true;
                                }
                            }
                        }
                    }
                    // 无变化则不写库（避免自身更新触发 Setting 事件造成循环）
                    if (!changed) {
                        return Mono.empty();
                    }
                    Setting updated = OBJECT_MAPPER.treeToValue(root, Setting.class);
                    return extensionClient.update(updated)
                        
                        .then();
                } catch (Exception e) {
                    
                    return Mono.empty();
                }
            }))
            .onErrorResume(e -> {
                
                return Mono.empty();
            })
            .subscribe();
    }

    private static ArrayNode groupOptions(List<Group> groups) {
        ArrayNode arr = OBJECT_MAPPER.createArrayNode();
        // 与官方附件库「分组」一致：全部(不看) / 未分组 / 可见分组（隐藏项与删除中的不展示）
        arr.addObject().put("label", "不限定").put("value", "");
        arr.addObject().put("label", "未分组").put("value", "__ungrouped__");
        for (Group g : groups) {
            if (g.getMetadata().getDeletionTimestamp() != null || isHidden(g)) {
                continue;
            }
            ObjectNode opt = arr.addObject();
            String name = g.getMetadata().getName();
            opt.put("label", g.getSpec() == null || g.getSpec().getDisplayName() == null
                ? name : g.getSpec().getDisplayName());
            opt.put("value", name);
        }
        return arr;
    }

    private static ArrayNode policyOptions(List<Policy> policies) {
        ArrayNode arr = OBJECT_MAPPER.createArrayNode();
        // 与官方附件库「存储策略」一致：默认策略 / 可见策略（隐藏项与删除中的不展示）
        arr.addObject().put("label", "默认策略").put("value", "");
        for (Policy p : policies) {
            if (p.getMetadata().getDeletionTimestamp() != null || isHidden(p)) {
                continue;
            }
            ObjectNode opt = arr.addObject();
            String name = p.getMetadata().getName();
            opt.put("label", p.getSpec() == null || p.getSpec().getDisplayName() == null
                ? name : p.getSpec().getDisplayName());
            opt.put("value", name);
        }
        return arr;
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

    /** 与官方一致的隐藏标记：label halo.run/hidden=true（系统/隐藏项不展示） */
    private static boolean isHidden(run.halo.app.extension.Extension e) {

    /** 与官方一致的隐藏标记：label halo.run/hidden=true（系统/隐藏项不展示） */
        var labels = e.getMetadata().getLabels();
        return labels != null && "true".equalsIgnoreCase(labels.get(run.halo.app.core.extension.attachment.Group.HIDDEN_LABEL));
    }
}

