package com.yyliucha.importantdates.support;

import com.yyliucha.importantdates.Car;
import com.yyliucha.importantdates.ImportantDate;
import com.yyliucha.importantdates.vo.CarVo;
import com.yyliucha.importantdates.vo.ImportantDateVo;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ReactiveExtensionClient;

/**
 * 节点记录（「记得」1.2.6）：把"本次已经主动提醒过的节点"写回数据。
 *
 * <p>节点式提醒的核心是**每个节点只弹一次**，而且关浏览器、换设备都不重置 ——
 * 所以记录必须写库。写入时机只有一个：「记得」前台页面渲染、且确实要弹悬浮提示时
 * （选项 C：悬浮提示只在该页面出现），因此不会因为访客浏览其它页面而消耗节点。
 *
 * <p>写入失败不影响页面渲染（只是下次可能再弹一次），一律静默降级。
 *
 * @author yyliucha
 * @since 1.2.6
 */
@Component
public class ReminderStageMarker {

    private final ReactiveExtensionClient client;

    public ReminderStageMarker(ReactiveExtensionClient client) {
        this.client = client;
    }

    /**
     * 标记座驾到期项的节点。
     *
     * @param items 本次已弹出的事件（需带 carId / reminderIndex / stageCode / date）
     */
    public Mono<Void> markCarEvents(List<CarVo.CarEventVo> items) {
        if (items == null || items.isEmpty()) {
            return Mono.empty();
        }
        Map<String, List<CarVo.CarEventVo>> byCar = new LinkedHashMap<>();
        for (CarVo.CarEventVo item : items) {
            if (item.getCarId() == null || item.getStageCode() == null || item.getReminderIndex() < 0) {
                continue;
            }
            byCar.computeIfAbsent(item.getCarId(), k -> new ArrayList<>()).add(item);
        }
        return Flux.fromIterable(byCar.entrySet())
            .concatMap(entry -> client.fetch(Car.class, entry.getKey())
                .flatMap(car -> {
                    var spec = car.getSpec();
                    if (spec == null || spec.getReminders() == null) {
                        return Mono.empty();
                    }
                    boolean changed = false;
                    for (CarVo.CarEventVo item : entry.getValue()) {
                        int idx = item.getReminderIndex();
                        if (idx < 0 || idx >= spec.getReminders().size()) {
                            continue;
                        }
                        Car.Reminder r = spec.getReminders().get(idx);
                        if (r == null) {
                            continue;
                        }
                        // 到期日变了（顺延/手改）→ 节点记录作废，重新开始
                        if (!item.getDate().equals(r.getNotifiedForDate())) {
                            r.setNotifiedStages(new ArrayList<>());
                            r.setNotifiedForDate(item.getDate());
                        }
                        List<String> stages = r.getNotifiedStages() == null
                            ? new ArrayList<>() : new ArrayList<>(r.getNotifiedStages());
                        if (!stages.contains(item.getStageCode())) {
                            stages.add(item.getStageCode());
                            r.setNotifiedStages(stages);
                            r.setNotifiedForDate(item.getDate());
                            changed = true;
                        }
                    }
                    return changed ? client.update(car) : Mono.just(car);
                })
                .onErrorResume(e -> Mono.empty()))
            .then();
    }

    /**
     * 标记重要日期（纪念日/生日）的节点。
     */
    public Mono<Void> markDateEvents(List<ImportantDateVo> items) {
        if (items == null || items.isEmpty()) {
            return Mono.empty();
        }
        return Flux.fromIterable(items)
            .filter(item -> item.getName() != null && item.getStageCode() != null)
            .concatMap(item -> client.fetch(ImportantDate.class, item.getName())
                .flatMap(date -> {
                    var spec = date.getSpec();
                    if (spec == null) {
                        return Mono.empty();
                    }
                    String next = item.getNextSolarDate();
                    if (next == null) {
                        return Mono.empty();
                    }
                    if (!next.equals(spec.getNotifiedForDate())) {
                        spec.setNotifiedStages(new ArrayList<>());
                        spec.setNotifiedForDate(next);
                    }
                    List<String> stages = spec.getNotifiedStages() == null
                        ? new ArrayList<>() : new ArrayList<>(spec.getNotifiedStages());
                    if (stages.contains(item.getStageCode())) {
                        return Mono.just(date);
                    }
                    stages.add(item.getStageCode());
                    spec.setNotifiedStages(stages);
                    spec.setNotifiedForDate(next);
                    return client.update(date);
                })
                .onErrorResume(e -> Mono.empty()))
            .then();
    }
}
