package run.halo.importantdates.support;

import com.nlf.calendar.LunarYear;
import com.nlf.calendar.Solar;
import com.nlf.calendar.util.LunarUtil;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 日期计算工具：阳历/农历的每年循环换算与剩余天数。
 *
 * @author important-dates
 * @since 1.0.5
 */
public final class DateCalc {

    private DateCalc() {
    }

    /**
     * 阳历日期（yyyy-MM-dd）下一次出现的日期（今年或明年，2 月 29 日非闰年按 2 月 28 日）。
     */
    public static LocalDate nextSolar(LocalDate today, String solarDate) {
        if (solarDate == null || solarDate.isBlank()) {
            return null;
        }
        String[] parts = solarDate.split("-");
        if (parts.length != 3) {
            return null;
        }
        int month = parseInt(parts[1]);
        int day = parseInt(parts[2]);
        if (month < 1 || month > 12 || day < 1 || day > 31) {
            return null;
        }
        int year = today.getYear();
        LocalDate candidate = safeDate(year, month, day);
        if (candidate == null) {
            // 非闰年 2 月 29 日 → 2 月 28 日
            candidate = safeDate(year, month, Math.min(day, 28));
        }
        if (candidate == null) {
            return null;
        }
        if (candidate.isBefore(today)) {
            candidate = safeDate(year + 1, month, candidate.getDayOfMonth());
            if (candidate == null) {
                candidate = safeDate(year + 1, month, Math.min(day, 28));
            }
        }
        return candidate;
    }

    /**
     * 农历月日下一次出现的阳历日期（今年起 5 年内查找，闰月不存在则该年跳过）。
     *
     * @param month     农历月 1-12
     * @param day       农历日 1-30
     * @param isLeap    是否闰月
     */
    public static LocalDate nextSolarForLunar(LocalDate today, int month, int day, boolean isLeap) {
        if (month < 1 || month > 12 || day < 1 || day > 30) {
            return null;
        }
        int target = isLeap ? -month : month;
        for (int year = today.getYear(); year <= today.getYear() + 5; year++) {
            LocalDate candidate = lunarToSolar(year, target, day);
            if (candidate != null && !candidate.isBefore(today)) {
                return candidate;
            }
        }
        return null;
    }

    /**
     * 农历月日文本，例如：六月初六、闰六月十五。
     */
    public static String lunarText(int month, int day, boolean isLeap) {
        if (month < 1 || month > 12 || day < 1 || day > 30) {
            return "";
        }
        return (isLeap ? "闰" : "") + LunarUtil.MONTH[month] + "月" + LunarUtil.DAY[day];
    }

    /**
     * 剩余天数。
     */
    public static long daysUntil(LocalDate today, LocalDate next) {
        if (next == null) {
            return -1;
        }
        return ChronoUnit.DAYS.between(today, next);
    }

    private static LocalDate lunarToSolar(int year, int lunarMonthWithLeapSign, int day) {
        try {
            var months = LunarYear.fromYear(year).getMonthsInYear();
            var monthObj = months.stream()
                .filter(m -> m.getMonth() == lunarMonthWithLeapSign)
                .findFirst()
                .orElse(null);
            if (monthObj == null || day > monthObj.getDayCount()) {
                return null;
            }
            Solar solar = Solar.fromJulianDay(monthObj.getFirstJulianDay() + (day - 1));
            return LocalDate.of(solar.getYear(), solar.getMonth(), solar.getDay());
        } catch (Exception e) {
            return null;
        }
    }

    private static LocalDate safeDate(int year, int month, int day) {
        try {
            return LocalDate.of(year, month, day);
        } catch (Exception e) {
            return null;
        }
    }

    private static int parseInt(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return -1;
        }
    }
}
