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
        return client.listAll(Person.class, ListOptions.builder().build(), Sort.unsorted())
            .collectList()
            .flatMapMany(people -> {
                Map<String, Person> byName = new HashMap<>();
                for (Person p : people) {
                    byName.put(p.getMetadata().getName(), p);
                }
                return client.listAll(Car.class, ListOptions.builder().build(), Sort.unsorted())
                    .map(car -> toCarVo(car, byName, today))
                    .filter(CarVo::isFrontendVisible)
                    .sort(Comparator.comparingInt(CarVo::getSortOrder)
                        .thenComparing(Comparator.comparing(CarVo::getCreatedAt,
                            Comparator.nullsLast(Comparator.reverseOrder()))));
            });
    }

    @Override
    public Flux<CarVo.CarEventVo> listUpcomingCarEvents(int days) {
        return carDefaultRemindDays().flatMapMany(defaultDays ->
            listAllCars()
                .filter(CarVo::isImportant)
                .filter(vo -> vo.getStatus() == null || "IN_USE".equals(vo.getStatus()))
                .flatMap(vo -> Flux.fromIterable(vo.getEvents())
                    // 每项优先用自己的提前天数；未设置则用「座驾设置」默认；再退回全局提醒天数
                    .filter(event -> {
                        int window = event.getRemindDays() != null ? event.getRemindDays()
                            : (defaultDays > 0 ? defaultDays : days);
                        return event.getDaysUntil() <= window && event.getDaysUntil() >= -30;
                    })
                    .sort(Comparator.comparingLong(CarVo.CarEventVo::getDaysUntil)
                        .thenComparing(CarVo.CarEventVo::getLabel))));
    }

    /** 座驾默认提前提醒天数（设置「座驾设置 → 默认提前提醒天数」）。 */
    private Mono<Integer> carDefaultRemindDays() {
        return settingFetcher.get("car")
            .map(node -> node.path("carDefaultRemindDays").asInt(15))
            .defaultIfEmpty(15);
    }

    private CarVo toCarVo(Car car, Map<String, Person> people, LocalDate today) {
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
        Person owner = spec.getOwnerName() == null ? null : people.get(spec.getOwnerName());
        if (owner != null && owner.getSpec() != null && !Boolean.FALSE.equals(owner.getSpec().getVisible())) {
            vo.setOwnerName(owner.getSpec().getDisplayName());
            vo.setOwnerGender(owner.getSpec().getGender());
            vo.setSkin(VehicleSupport.skinOf(owner.getSpec().getGender()));
        } else {
            vo.setSkin("neutral");
        }
        List<String> drivers = new ArrayList<>();
        if (spec.getDriverNames() != null) {
            for (String name : spec.getDriverNames()) {
                Person p = people.get(name);
                if (p != null && p.getSpec() != null && !Boolean.FALSE.equals(p.getSpec().getVisible())) {
                    drivers.add(p.getSpec().getDisplayName());
                }
            }
        }
        vo.setDriverNames(drivers);

        // 到期事项
        List<CarVo.CarEventVo> events = new ArrayList<>();
        if (spec.getReminders() != null) {
            for (Car.Reminder r : spec.getReminders()) {
                if (r == null || Boolean.FALSE.equals(r.getEnabled())) {
                    continue;
                }
                LocalDate due = resolveDueDate(r, today);
                if (due == null) {
                    continue;
                }
                CarVo.CarEventVo ev = new CarVo.CarEventVo();
                ev.setKey(r.getKey());
                ev.setLabel(VehicleSupport.reminderLabel(r.getKey(), r.getLabel()));
                ev.setDate(due.toString());
                ev.setDateText(due.toString());
                long daysUntil = java.time.temporal.ChronoUnit.DAYS.between(today, due);
                ev.setDaysUntil(daysUntil);
                ev.setOverdue(daysUntil < 0);
                ev.setRemindDays(r.getRemindDays());
                ev.setCarName(spec.getDisplayName());
                ev.setCarIcon(VehicleSupport.typeIcon(spec.getVehicleType()));
                ev.setCarType(spec.getVehicleType());
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
        if (VehicleSupport.isYearly(r.getKey())) {
            int guard = 0;
            while (due.isBefore(today) && guard++ < 3) {
                due = due.plusYears(1);
            }
        }
        return due;
    }

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
        return vo;
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

