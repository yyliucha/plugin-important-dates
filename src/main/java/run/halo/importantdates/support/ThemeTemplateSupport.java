package run.halo.importantdates.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ConfigMap;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.plugin.PluginContext;
import run.halo.app.plugin.PluginsRootGetter;

/**
 * 主题模板自动适配支持。
 *
 * <p>通过插件根目录（{@link PluginsRootGetter}，即 work-dir/plugins）推导 Halo 工作目录，
 * 结合系统设置中的激活主题名，自动探测主题布局并生成 {@code important-dates.html} 模板，
 * 供前台路由在主题内渲染页面使用。已存在模板：用户手放（无生成标记）不覆盖；
 * 插件自动生成的老版本（含标记且旧于当前版本）自动升级。
 *
 * @author yyliucha
 * @since 1.0.11
 */
@Component
public class ThemeTemplateSupport {

    private static final List<String> LAYOUT_CANDIDATES =
        Arrays.asList("modules/layout.html", "layout.html", "base.html");

    private static final Pattern GEN_MARK = Pattern.compile("<!-- id-gen:([0-9.]+) -->");

    private final PluginsRootGetter pluginsRootGetter;
    private final ReactiveExtensionClient client;
    private final PluginContext pluginContext;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ThemeTemplateSupport(PluginsRootGetter pluginsRootGetter,
        ReactiveExtensionClient client,
        PluginContext pluginContext) {
        this.pluginsRootGetter = pluginsRootGetter;
        this.client = client;
        this.pluginContext = pluginContext;
    }

    private String pluginVersion() {
        String version = pluginContext.getVersion();
        return version == null ? "0.0.0" : version;
    }

    /**
     * 读取激活主题名（系统设置 ConfigMap system → data.theme.active）。
     */
    public Mono<String> activeThemeName() {
        return client.fetch(ConfigMap.class, "system")
            .flatMap(cm -> Mono.justOrEmpty(parseActiveTheme(cm)))
            .switchIfEmpty(client.fetch(ConfigMap.class, "system-default")
                .flatMap(cm -> Mono.justOrEmpty(parseActiveTheme(cm))))
            .onErrorResume(e -> Mono.empty());
    }

    private String parseActiveTheme(ConfigMap cm) {
        if (cm == null || cm.getData() == null) {
            return null;
        }
        String themeJson = cm.getData().get("theme");
        if (themeJson == null || themeJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(themeJson);
            String active = node.path("active").asText("");
            return active.isBlank() ? null : active;
        } catch (IOException e) {
            return null;
        }
    }

    /**
     * 主题模板是否已存在。
     */
    public Mono<Boolean> templateExists() {
        return activeThemeName()
            .map(theme -> {
                Path path = templatePath(theme);
                return path != null && Files.isRegularFile(path);
            })
            .defaultIfEmpty(false);
    }

    private Path templatePath(String themeName) {
        Path base = themeTemplatesPath(themeName);
        return base == null ? null : base.resolve("important-dates.html");
    }

    private Path themeTemplatesPath(String themeName) {
        if (themeName == null || themeName.isBlank()) {
            return null;
        }
        Path p = workDir().resolve("themes").resolve(themeName).resolve("templates");
        return Files.isDirectory(p) ? p : null;
    }

    /**
     * Halo 工作目录 = 插件根目录（work-dir/plugins）的父目录。
     */
    private Path workDir() {
        Path pluginsRoot = pluginsRootGetter.get();
        return pluginsRoot == null ? null : pluginsRoot.getParent();
    }

    /**
     * 确保主题模板存在：不存在时自动生成；自动生成的老版本（标记版本旧于当前）自动升级；
     * 用户手放的模板（无标记）不覆盖。
     *
     * @return 生成或升级后的模板路径；无需处理时为 null
     */
    public Mono<Path> ensureThemeTemplate() {
        String currentVersion = pluginVersion();
        return activeThemeName().flatMap(theme -> {
            Path templatesDir = themeTemplatesPath(theme);
            if (templatesDir == null) {
                return Mono.empty();
            }
            Path target = templatesDir.resolve("important-dates.html");
            if (Files.exists(target)) {
                // 用户手放（无标记）或版本足够新 → 跳过
                String existingVersion = genVersionOf(target);
                if (existingVersion == null || compareVersion(existingVersion, currentVersion) >= 0) {
                    return Mono.empty();
                }
            }
            for (String candidate : LAYOUT_CANDIDATES) {
                Path layoutFile = templatesDir.resolve(candidate);
                if (!Files.isRegularFile(layoutFile)) {
                    continue;
                }
                try {
                    String layoutContent = new String(
                        Files.readAllBytes(layoutFile), StandardCharsets.UTF_8);
                    String layoutName = candidate.substring(0, candidate.length() - 5);
                    String template = ThemeTemplateGenerator.generate(
                        layoutContent, layoutName, currentVersion);
                    if (template != null) {
                        Files.writeString(target, template, StandardCharsets.UTF_8);
                        return Mono.just(target);
                    }
                } catch (Exception e) {
                    // 继续尝试下一个候选布局
                }
            }
            return Mono.empty();
        }).onErrorResume(e -> Mono.empty());
    }

    private static String genVersionOf(Path target) {
        try {
            String head = Files.readString(target, StandardCharsets.UTF_8);
            if (head.length() > 200) {
                head = head.substring(0, 200);
            }
            Matcher matcher = GEN_MARK.matcher(head);
            return matcher.find() ? matcher.group(1) : null;
        } catch (IOException e) {
            return null;
        }
    }

    private static int compareVersion(String a, String b) {
        String[] pa = a.split("\\.");
        String[] pb = b.split("\\.");
        for (int i = 0; i < Math.max(pa.length, pb.length); i++) {
            int va = i < pa.length ? parseIntSafe(pa[i]) : 0;
            int vb = i < pb.length ? parseIntSafe(pb[i]) : 0;
            if (va != vb) {
                return Integer.compare(va, vb);
            }
        }
        return 0;
    }

    private static int parseIntSafe(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
