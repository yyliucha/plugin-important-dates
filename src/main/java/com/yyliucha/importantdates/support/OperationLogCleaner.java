package com.yyliucha.importantdates.support;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ConfigMap;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.plugin.ReactiveSettingFetcher;
import com.yyliucha.importantdates.OperationLog;

/**
 * 操作日志自动清理：按插件设置「日志保留天数」定时删除超期日志。
 *
 * <p>规则：保留最近 N 天的日志（以日志创建时间为准），N = 0 表示不清理。
 * 清理只操作本插件的 OperationLog 扩展，不影响任何其他数据；
 * 删除为 Halo 标准软删除，由系统 GC 最终物理清除。
 *
 * @author yyliucha
 * @since 1.2.0
 */
@Component
public class OperationLogCleaner {

    private final ReactiveExtensionClient client;
    private final ReactiveSettingFetcher settingFetcher;
    private ScheduledExecutorService scheduler;

    public OperationLogCleaner(ReactiveExtensionClient client, ReactiveSettingFetcher settingFetcher) {
        this.client = client;
        this.settingFetcher = settingFetcher;
    }

    public void start() {
        if (scheduler != null) {
            return;
        }
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "important-dates-log-cleaner");
            t.setDaemon(true);
            return t;
        });
        // 启动后延迟 1 分钟先跑一次，之后每 6 小时一次
        scheduler.scheduleWithFixedDelay(this::cleanupQuietly, 1, 6, TimeUnit.HOURS);
    }

    public void stop() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }
    }

    public void cleanupQuietly() {
        try {
            settingFetcher.get("log").flatMap(node -> {
                int retainDays = node == null ? 0 : node.path("logRetainDays").asInt(0);
                if (retainDays <= 0) {
                    return Mono.empty();
                }
                Instant cutoff = Instant.now().minus(retainDays, ChronoUnit.DAYS);
                return client.listAll(OperationLog.class, run.halo.app.extension.ListOptions.builder().build(),
                        org.springframework.data.domain.Sort.unsorted())
                    .filter(log -> {
                        java.time.Instant ts = log.getMetadata().getCreationTimestamp();
                        return ts != null && ts.isBefore(cutoff);
                    })
                    .collectList()
                    .flatMapMany(Flux::fromIterable)
                    .flatMap(client::delete)
                    .then();
            }).subscribe();
        } catch (Exception ignored) {
            // 清理失败不影响插件运行
        }
    }
}

