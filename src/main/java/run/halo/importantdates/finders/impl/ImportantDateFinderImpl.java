package run.halo.importantdates.finders.impl;

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
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.theme.finders.Finder;
import run.halo.importantdates.ImportantDate;
import run.halo.importantdates.Person;
import run.halo.importantdates.finders.ImportantDateFinder;
import run.halo.importantdates.support.DateCalc;
import run.halo.importantdates.vo.ImportantDateVo;
import run.halo.importantdates.vo.PersonVo;

/**
 * {@link ImportantDateFinder} 实现。
 *
 * @author important-dates
 * @since 1.0.5
 */
@Finder("importantDateFinder")
@Component
@RequiredArgsConstructor
public class ImportantDateFinderImpl implements ImportantDateFinder {

    private final ReactiveExtensionClient client;

    @Override
    public Flux<ImportantDateVo> listAll() {
        return listDateVos(false);
    }

    @Override
    public Flux<ImportantDateVo> listUpcoming(int days) {
        LocalDate today = LocalDate.now();
        return listDateVos(true)
            .filter(vo -> vo.getDaysUntil() >= 0 && vo.getDaysUntil() <= days);
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
                    .filter(vo -> !importantOnly || vo.isImportant())
                    .sort(Comparator.comparing(ImportantDateVo::getDaysUntil)
                        .thenComparing(ImportantDateVo::getTitle));
            });
    }

    @Override
    public Flux<PersonVo> listAllPeople() {
        LocalDate today = LocalDate.now();
        return client.listAll(Person.class, ListOptions.builder().build(), Sort.unsorted())
            .map(p -> toPersonVo(p, today))
            .filter(vo -> vo.getDisplayName() != null && !vo.getDisplayName().isBlank())
            .sort(Comparator.comparing(PersonVo::getDaysUntil)
                .thenComparing(PersonVo::getDisplayName));
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
        return vo;
    }

    private PersonVo toPersonVo(Person person, LocalDate today) {
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
        return vo;
    }
}
