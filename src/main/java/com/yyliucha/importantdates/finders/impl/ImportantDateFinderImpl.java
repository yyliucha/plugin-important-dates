package com.yyliucha.importantdates.finders.impl;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.plugin.ReactiveSettingFetcher;
import run.halo.app.theme.finders.Finder;
import com.yyliucha.importantdates.Car;
import com.yyliucha.importantdates.ImportantDate;
import com.yyliucha.importantdates.Person;
import com.yyliucha.importantdates.finders.ImportantDateFinder;
import com.yyliucha.importantdates.support.DateCalc;
import com.yyliucha.importantdates.support.VehicleSupport;
import com.yyliucha.importantdates.vo.CarVo;
import com.yyliucha.importantdates.vo.ImportantDateVo;
import com.yyliucha.importantdates.support.ReminderSupport;
import com.yyliucha.importantdates.vo.PersonVo;

/**
 * {@link ImportantDateFinder} 实现。
 *
 * @author yyliucha
 * @since 1.0.5
 */
@Finder("importantDateFinder")
@Component
@RequiredArgsConstructor
public class ImportantDateFinderImpl implements ImportantDateFinder {

    private final ReactiveExtensionClient client;
    private final ReactiveSettingFetcher settingFetcher;

    /**
     * 前台是否展示完整生日（默认 false = 脱敏显示）。
     */
    private Mono<Boolean> showBirthday() {
        return settingFetcher.get("privacy")
            .map(node -> node.path("showBirthday").asBoolean(false))
            .switchIfEmpty(Mono.just(false));
    }

    @Override
    public Flux<ImportantDateVo> listAll() {
        return listDateVos(false)
            .sort(boardComparator());
    }

    @Override
    public Flux<ImportantDateVo> listUpcoming(int days) {
        LocalDate today = LocalDate.now();
        return listDateVos(true)
            .filter(vo -> vo.getDaysUntil() >= 0 && vo.getDaysUntil() <= days)
            .sort(Comparator.comparingLong(ImportantDateVo::getDaysUntil)
                .thenComparing(ImportantDateVo::getTitle));
    }

    /**
     * 面板排序：拖拽权重（sortOrder）升序，创建时间倒序（同级）。
     */
    private static Comparator<ImportantDateVo> boardComparator() {
        return Comparator.comparingInt(ImportantDateVo::getSortOrder)
            .thenComparing(Comparator.comparing(ImportantDateVo::getCreatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
    }

    private static Comparator<PersonVo> personBoardComparator() {
        return Comparator.comparingInt(PersonVo::getSortOrder)
            .thenComparing(Comparator.comparing(PersonVo::getCreatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
    }

    private Flux<ImportantDateVo> listDateVos(boolean importantOnly) {
        LocalDate today = LocalDate.now();
        return client.listAll(Person.class, ListOptions.builder().build(), Sort.unsorted())
            .collectList()
            .flatMapMany(people -> {
                Map<String, Person> byName = new HashMap<>();
                people.forEach(p -> byName.put(p.getMetadata().getName(), p));
                return client.listAll(ImportantDate.class, ListOptions.builder().build(), Sort.unsorted())
                    .map(d -> toDateVo(d, byName, today))
                    .filter(vo -> vo.getNextSolarDate() != null)
                    .filter(vo -> vo.isFrontendVisible())
                    .filter(vo -> !importantOnly || vo.isImportant());
            });
    }

    @Override
    public Flux<PersonVo> listAllPeople() {
        LocalDate today = LocalDate.now();
        return showBirthday()
            .flatMapMany(show ->
                client.listAll(Person.class, ListOptions.builder().build(), Sort.unsorted())
                    .map(p -> toPersonVo(p, today, show))
                    .filter(vo -> vo.getDisplayName() != null && !vo.getDisplayName().isBlank())
                    .filter(PersonVo::isFrontendVisible)
                    .sort(personBoardComparator())
            );
    }

    // ---------- 座驾（1.2.0）----------

    @Override
    public Flux<CarVo> listAllCars() {
        LocalDate today = LocalDate.now();
        return carInspectionRule().flatMapMany(rule ->
            client.listAll(Person.class, ListOptions.builder().build(), Sort.unsorted())
            .collectList()
            .flatMapMany(people -> {
                Map<String, Person> byName = new HashMap<>();
                for (Person p : people) {
                    byName.put(p.getMetadata().getName(), p);
                }
                return client.listAll(Car.class, ListOptions.builder().build(), Sort.unsorted())
                    .map(car -> toCarVo(car, byName, today, rule, rule.overdueDays()))
                    .filter(CarVo::isFrontendVisible)
                    .sort(Comparator.comparingInt(CarVo::getSortOrder)
                        .thenComparing(Comparator.comparing(CarVo::getCreatedAt,
                            Comparator.nullsLast(Comparator.reverseOrder()))));
            }));
    }

    /**
     * 座驾提醒规则（全部来自设置）：
     * ① 年检节点与「起每年上线年份」（座驾设置）；② 逾期后继续提醒天数（提醒设置，默认 3）；
     * ③ 默认提前提醒天数（座驾设置，默认 15）。
     */
    private record InspectionRule(java.util.List<Integer> nodes, int yearlyFrom, int overdueDays,
        int defaultRemindDays) {
    }

    private Mono<InspectionRule> carInspectionRule() {
        Mono<Integer> overdue = settingFetcher.get("reminder")
            .map(node -> node.path("overdueRemindDays")
                .asInt(com.yyliucha.importantdates.support.ReminderSupport.DEFAULT_OVERDUE_DAYS))
            .defaultIfEmpty(com.yyliucha.importantdates.support.ReminderSupport.DEFAULT_OVERDUE_DAYS)
            .map(com.yyliucha.importantdates.support.ReminderSupport::clampOverdueDays);
        Mono<InspectionRule> base = settingFetcher.get("car")
            .map(node -> new InspectionRule(
                com.yyliucha.importantdates.support.VehicleSupport
                    .parseInspectionNodes(node.path("inspectionNodes").asText(null)),
                node.path("inspectionYearlyFrom")
                    .asInt(com.yyliucha.importantdates.support.VehicleSupport.DEFAULT_INSPECTION_YEARLY_FROM),
                com.yyliucha.importantdates.support.ReminderSupport.DEFAULT_OVERDUE_DAYS,
                node.path("carDefaultRemindDays").asInt(15)))
            .defaultIfEmpty(new InspectionRule(
                com.yyliucha.importantdates.support.VehicleSupport.DEFAULT_INSPECTION_NODES,
                com.yyliucha.importantdates.support.VehicleSupport.DEFAULT_INSPECTION_YEARLY_FROM,
                com.yyliucha.importantdates.support.ReminderSupport.DEFAULT_OVERDUE_DAYS,
                15));
        return base.zipWith(overdue,
            (rule, days) -> new InspectionRule(rule.nodes(), rule.yearlyFrom(), days, rule.defaultRemindDays()));
    }

    @Override
    public Flux<CarVo.CarEventVo> listUpcomingCarEvents(int days) {
        return carDefaultRemindDays().flatMapMany(defaultDays ->
            listAllCars()
                .filter(CarVo::isImportant)
                .filter(vo -> vo.getStatus() == null || "IN_USE".equals(vo.getStatus()))
                .flatMap(vo -> Flux.fromIterable(vo.getEvents())
                    // 已办 / 已忽略：不再进入提醒面
                    .filter(event -> !"DONE".equals(event.getStatus()) && !"SKIPPED".equals(event.getStatus()))
                    // 待办：提前 N 天内 ~ 逾期窗口内主动提醒；待处理（逾期超窗口）不主动提醒但保留
                    .filter(event -> {
                        // 待处理：不再主动提醒，但保留在后台列表与总览里，直到用户「已办」或「忽略」
                        if ("TODO".equals(event.getStatus())) {
                            return true;
                        }
                        int window = event.getRemindDays() != null ? event.getRemindDays()
                            : (defaultDays > 0 ? defaultDays : days);
                        return event.getDaysUntil() <= window;
                    })
                    .sort(Comparator.comparingLong(CarVo.CarEventVo::getDaysUntil)
                        .thenComparing(CarVo.CarEventVo::getLabel))));
    }

    /** 该项的提前提醒天数（未设置时用默认值） */
    private static int windowOf(Car.Reminder r, int defaultDays) {
        if (r.getRemindDays() != null) {
            return Math.max(0, r.getRemindDays());
        }
        return defaultDays > 0 ? defaultDays : ReminderSupport.DEFAULT_OVERDUE_DAYS;
    }
    /** 座驾默认提前提醒天数（设置「座驾设置 → 默认提前提醒天数」）。 */
    private Mono<Integer> carDefaultRemindDays() {
        return settingFetcher.get("car")
            .map(node -> node.path("carDefaultRemindDays").asInt(15))
            .defaultIfEmpty(15);
    }

    private CarVo toCarVo(Car car, Map<String, Person> people, LocalDate today, InspectionRule rule,
        int overdueDays) {
        var spec = car.getSpec();
        CarVo vo = new CarVo();
        vo.setName(car.getMetadata().getName());
        vo.setDisplayName(spec.getDisplayName());
        vo.setBrand(spec.getBrand());
        vo.setModel(spec.getModel());
        vo.setPlateMasked(VehicleSupport.maskPlate(spec.getPlateNo()));
        vo.setVehicleType(spec.getVehicleType());
        vo.setVehicleTypeLabel(VehicleSupport.typeLabel(spec.getVehicleType()));
        vo.setVehicleTypeIcon(VehicleSupport.typeIcon(spec.getVehicleType()));
        vo.setEnergyType(spec.getEnergyType());
        vo.setEnergyTypeLabel(VehicleSupport.energyLabel(spec.getEnergyType()));
        vo.setColor(spec.getColor());
        vo.setStatus(spec.getStatus() == null ? "IN_USE" : spec.getStatus());
        vo.setSortOrder(spec.getSortOrder() == null ? 0 : spec.getSortOrder());
        vo.setCreatedAt(car.getMetadata().getCreationTimestamp() == null ? null
            : car.getMetadata().getCreationTimestamp().toString());
        vo.setFrontendVisible(!Boolean.FALSE.equals(spec.getVisible()));
        vo.setImportant(!Boolean.FALSE.equals(spec.getImportant()));

        // 相册：仅前台可见照片（封面优先）
        List<CarVo.PhotoVo> photos = new ArrayList<>();
        if (spec.getPhotos() != null) {
            List<Car.Photo> visible = spec.getPhotos().stream()
                .filter(p -> p != null && p.getUrl() != null && !p.getUrl().isBlank())
                .filter(p -> !Boolean.FALSE.equals(p.getFrontVisible()))
                .sorted(Comparator.comparingInt(p -> p.getSortOrder() == null ? 0 : p.getSortOrder()))
                .toList();
            String cover = null;
            for (Car.Photo p : visible) {
                CarVo.PhotoVo pv = new CarVo.PhotoVo();
                pv.setUrl(p.getUrl());
                pv.setName(p.getName());
                pv.setCover(Boolean.TRUE.equals(p.getIsCover()));
                photos.add(pv);
                if (cover == null || pv.isCover()) {
                    cover = p.getUrl();
                }
            }
            vo.setCoverUrl(cover);
        }
        vo.setPhotos(photos);
        vo.setPhotoCount(photos.size());

        // 车主 / 驾驶人（仅前台可见人员才输出姓名）
        // 卡片风格规则：① 有车主 → 按车主性别；② 无车主但有驾驶人 → 驾驶人性别一致时按该性别，男女混合则中性；③ 都没有 → 中性
        Person owner = spec.getOwnerName() == null ? null : people.get(spec.getOwnerName());
        List<String> drivers = new ArrayList<>();
        java.util.Set<String> driverSkins = new java.util.LinkedHashSet<>();
        if (spec.getDriverNames() != null) {
            for (String name : spec.getDriverNames()) {
                Person p = people.get(name);
                if (p != null && p.getSpec() != null && !Boolean.FALSE.equals(p.getSpec().getVisible())) {
                    drivers.add(p.getSpec().getDisplayName());
                    String driverSkin = VehicleSupport.skinOf(p.getSpec().getGender());
                    if (!"neutral".equals(driverSkin)) {
                        driverSkins.add(driverSkin);
                    }
                }
            }
        }
        if (owner != null && owner.getSpec() != null && !Boolean.FALSE.equals(owner.getSpec().getVisible())) {
            vo.setOwnerName(owner.getSpec().getDisplayName());
            vo.setOwnerGender(owner.getSpec().getGender());
            vo.setSkin(VehicleSupport.skinOf(owner.getSpec().getGender()));
        } else if (driverSkins.size() == 1) {
            // 共同使用且性别一致（如两位男生 / 两位女生）→ 采用该风格
            vo.setSkin(driverSkins.iterator().next());
        } else {
            // 无车主且驾驶人性别混合（或都未填）→ 中性，避免偏向任何一方
            vo.setSkin("neutral");
        }
        vo.setDriverNames(drivers);
        // 共同持有标记（车主 + 驾驶人 ≥ 2 人时，前台可提示"共同使用"）
        vo.setSharedPeople(drivers.size() + (vo.getOwnerName() == null ? 0 : 1));

        // 到期事项（默认提前天数来自设置，用于计算阶段节点）
        int defaultRemindDays = rule == null ? 15 : rule.defaultRemindDays();
        List<CarVo.CarEventVo> events = new ArrayList<>();
        if (spec.getReminders() != null) {
            for (Car.Reminder r : spec.getReminders()) {
                if (r == null || Boolean.FALSE.equals(r.getEnabled())) {
                    continue;
                }
                String ruleNote = null;
                String label = VehicleSupport.reminderLabel(r.getKey(), r.getLabel());
                LocalDate due = resolveDueDate(r, today);
                if (due == null && "INSPECTION".equals(r.getKey())) {
                    // 年检：未手填日期时按「首次登记日期 + 车型规则」自动推算
                    String baseDate = spec.getRegisteredDate() != null && !spec.getRegisteredDate().isBlank()
                        ? spec.getRegisteredDate() : spec.getPurchaseDate();
                    var next = VehicleSupport.nextInspection(baseDate, spec.getVehicleType(), today,
                        rule == null ? null : rule.nodes(),
                        rule == null ? VehicleSupport.DEFAULT_INSPECTION_YEARLY_FROM : rule.yearlyFrom());
                    if (next.date() == null) {
                        continue;
                    }
                    due = parseDate(next.date());
                    ruleNote = next.rule();
                    if (next.phase() != null && !next.phase().isBlank()) {
                        label = label + "·" + next.phase();
                    }
                }
                if (due == null) {
                    continue;
                }
                CarVo.CarEventVo ev = new CarVo.CarEventVo();
                ev.setKey(r.getKey());
                ev.setLabel(label);
                ev.setDate(due.toString());
                ev.setDateText(due.toString());
                long daysUntil = java.time.temporal.ChronoUnit.DAYS.between(today, due);
                ev.setDaysUntil(daysUntil);
                ev.setOverdue(daysUntil < 0);
                ev.setOverdueDays(daysUntil < 0 ? -daysUntil : 0);
                ev.setRemindDays(r.getRemindDays());
                ev.setRuleNote(ruleNote);
                ev.setCarName(spec.getDisplayName());
                ev.setCarIcon(VehicleSupport.typeIcon(spec.getVehicleType()));
                ev.setCarType(spec.getVehicleType());
                ev.setCarId(car.getMetadata().getName());
                ev.setReminderIndex(spec.getReminders().indexOf(r));
                // 提醒状态与文案（1.2.6）：状态由用户操作决定，阶段由到期日决定
                String ack = ReminderSupport.effectiveAck(r.getAckState(), r.getSkippedForDate(), due.toString());
                ev.setAckState(ack);
                ev.setStatus(ReminderSupport.status(ack, daysUntil, overdueDays));
                ev.setLastDoneAt(r.getLastDoneAt());
                ev.setLastDoneFrom(r.getLastDoneFrom());
                ev.setLastDoneTo(r.getLastDoneTo());
                int window = windowOf(r, defaultRemindDays);
                ev.setNextNoticeDays(window);
                ev.setNextNoticeDate(due.minusDays(window).toString());
                String stage = ReminderSupport.stageCode(daysUntil, window, overdueDays);
                ev.setStageCode(stage);
                ev.setStageNotified(stage != null && r.getNotifiedStages() != null
                    && due.toString().equals(r.getNotifiedForDate()) && r.getNotifiedStages().contains(stage));
                ev.setStageText(ReminderSupport.stageText(spec.getDisplayName(), label, daysUntil, overdueDays));
                ev.setStateText(ReminderSupport.stateText(ev.getStatus(), r.getLastDoneAt(), r.getLastDoneFrom(),
                    ev.getOverdueDays()));
                events.add(ev);
            }
            events.sort(Comparator.comparingLong(CarVo.CarEventVo::getDaysUntil)
                .thenComparing(CarVo.CarEventVo::getLabel));
        }
        vo.setEvents(events);
        return vo;
    }

    /**
     * 解析到期项实际到期日：直接日期优先；保养项按"上次保养 + 间隔月数"推算；
     * 保险/年检/车船税/驾照等按年循环项自动滚动到下一次。
     */
    private static LocalDate resolveDueDate(Car.Reminder r, LocalDate today) {
        LocalDate due = parseDate(r.getDate());
        if (due == null && "MAINTENANCE".equals(r.getKey()) && r.getIntervalMonths() != null
            && r.getIntervalMonths() > 0) {
            LocalDate last = parseDate(r.getLastServiceDate());
            if (last != null) {
                due = last.plusMonths(r.getIntervalMonths());
            }
        }
        if (due == null) {
            return null;
        }
        // 循环间隔（月）：显式设置优先；未设置时取项目默认（保险/车船税/驾照=每年，年检=每年，保养=不循环）
        // 1.2.6：**不再自动滚动**——到期日过了就是"逾期"，直到用户点「已办」才按循环间隔顺延到未来。
        // （此前"过期即视为进入下一期"会让逾期彻底静默，用户既看不到提醒也看不到异常。）
        return due;    }

    private static LocalDate parseDate(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private ImportantDateVo toDateVo(ImportantDate date, Map<String, Person> people, LocalDate today) {
        var spec = date.getSpec();
        ImportantDateVo vo = new ImportantDateVo();
        vo.setName(date.getMetadata().getName());
        vo.setTitle(spec.getTitle());
        vo.setDateType(spec.getDateType());
        LocalDate next = null;
        if ("LUNAR".equals(spec.getDateType())) {
            int month = spec.getLunarMonth() == null ? 1 : spec.getLunarMonth();
            int day = spec.getLunarDay() == null ? 1 : spec.getLunarDay();
            boolean leap = Boolean.TRUE.equals(spec.getIsLeapMonth());
            vo.setDateText(DateCalc.lunarText(month, day, leap));
            next = DateCalc.nextSolarForLunar(today, month, day, leap);
        } else {
            vo.setDateText(spec.getSolarDate() == null ? "" : spec.getSolarDate());
            next = DateCalc.nextSolar(today, spec.getSolarDate());
        }
        vo.setNextSolarDate(next == null ? null : next.toString());
        vo.setDaysUntil(DateCalc.daysUntil(today, next));
        vo.setDaysValid(next != null);
        vo.setImportant(!Boolean.FALSE.equals(spec.getImportant()));
        vo.setFrontendVisible(!Boolean.FALSE.equals(spec.getVisible()));
        List<String> names = new ArrayList<>();
        if (spec.getPersonNames() != null) {
            for (String name : spec.getPersonNames()) {
                Person p = people.get(name);
                if (p != null && p.getSpec() != null && !Boolean.FALSE.equals(p.getSpec().getVisible())) {
                    names.add(p.getSpec().getDisplayName());
                }
            }
        }
        vo.setPersonNames(names);
        vo.setSortOrder(spec.getSortOrder() == null ? 0 : spec.getSortOrder());
        vo.setCreatedAt(date.getMetadata().getCreationTimestamp() == null ? null : date.getMetadata().getCreationTimestamp().toString());
        // 节点式提醒（1.2.6）：纪念日/生日按「提前天数 / 1 天 / 当天」三个节点各弹一次
        int dateWindow = dateRemindDays();
        String stage = ReminderSupport.stageCode(vo.getDaysUntil(), dateWindow, 0);
        vo.setStageCode(stage);
        vo.setStageNotified(stage != null && vo.getNextSolarDate() != null
            && vo.getNextSolarDate().equals(spec.getNotifiedForDate())
            && spec.getNotifiedStages() != null && spec.getNotifiedStages().contains(stage));
        vo.setStageText(ReminderSupport.dateStageText(vo.getTitle(), vo.getDaysUntil()));
        return vo;
    }

    /** 纪念日/生日的提前提醒天数（设置「提醒设置 → 提前提醒天数」，默认 3） */
    private int dateRemindDays() {
        return cachedRemindDays > 0 ? cachedRemindDays : 3;
    }

    /** 提前提醒天数缓存（渲染前由路由层注入，保证与前台/接口口径一致） */
    private volatile int cachedRemindDays = 0;

    /** 由路由层在渲染前注入提前天数 */
    public void cacheRemindDays(int days) {
        this.cachedRemindDays = days;
    }
    private PersonVo toPersonVo(Person person, LocalDate today, boolean showBirthday) {
        var spec = person.getSpec();
        PersonVo vo = new PersonVo();
        vo.setName(person.getMetadata().getName());
        vo.setDisplayName(spec.getDisplayName());
        vo.setNickname(spec.getNickname());
        vo.setRelation(spec.getRelation());
        LocalDate next = null;
        if ("LUNAR".equals(spec.getDateType())) {
            int month = spec.getLunarMonth() == null ? 1 : spec.getLunarMonth();
            int day = spec.getLunarDay() == null ? 1 : spec.getLunarDay();
            boolean leap = Boolean.TRUE.equals(spec.getIsLeapMonth());
            vo.setBirthdayText(DateCalc.lunarText(month, day, leap));
            next = DateCalc.nextSolarForLunar(today, month, day, leap);
        } else {
            vo.setBirthdayText(spec.getSolarDate() == null ? "" : spec.getSolarDate());
            next = DateCalc.nextSolar(today, spec.getSolarDate());
        }
        vo.setNextSolarDate(next == null ? null : next.toString());
        vo.setDaysUntil(DateCalc.daysUntil(today, next));
        vo.setFrontendVisible(!Boolean.FALSE.equals(spec.getVisible()));
        // 隐私：前台默认不展示完整生日（脱敏 * 处理），开启设置「前台展示生日」后完整展示
        if (!showBirthday) {
            vo.setBirthdayText(maskBirthday(vo.getBirthdayText()));
            vo.setNextSolarDate(maskBirthday(vo.getNextSolarDate()));
        }
        vo.setAvatar(spec.getAvatar());
        vo.setSortOrder(spec.getSortOrder() == null ? 0 : spec.getSortOrder());
        vo.setCreatedAt(person.getMetadata().getCreationTimestamp() == null ? null : person.getMetadata().getCreationTimestamp().toString());
        return vo;
    }

    /**
     * 生日脱敏：阳历 yyyy-MM-dd → yyyy-MM-**；农历 X 月 X 日 → X 月**；其他保持。
     */
    private static String maskBirthday(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String masked = text.replaceAll("^(\\d{4}-\\d{2})-\\d{2}$", "$1-**");
        if (!masked.equals(text)) {
            return masked;
        }
        masked = text.replaceAll("^(\\S+月)\\S+$", "$1**");
        return masked.equals(text) ? text : masked;
    }
}

