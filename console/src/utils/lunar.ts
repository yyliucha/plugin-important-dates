import { LunarUtil, LunarYear, Solar } from "lunar-javascript";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * 查找某年中指定的农历月（闰月使用负月号，如 -6 表示闰六月）。
 */
function findMonth(year: number, month: number, isLeap: boolean) {
  const target = isLeap ? -month : month;
  return (
    LunarYear.fromYear(year)
      .getMonthsInYear()
      .find((m) => m.getMonth() === target) || null
  );
}

/**
 * 农历月日文本，例如：六月初六、闰六月十五。
 */
export function lunarMonthDayText(month: number, day: number, isLeap: boolean): string {
  if (month >= 1 && month <= 12 && day >= 1 && day <= 30) {
    return `${isLeap ? "闰" : ""}${LunarUtil.MONTH[month]}月${LunarUtil.DAY[day]}`;
  }
  return `${isLeap ? "闰" : ""}${month}月${day}日`;
}

/**
 * 计算指定农历月日最近一次出现的阳历日期（今年或明年）。
 *
 * @param month 农历月 1-12
 * @param day 农历日 1-30
 * @param isLeap 是否闰月
 * @param now 当前时间
 */
export function nextSolarDate(
  month: number,
  day: number,
  isLeap: boolean,
  now: Date = new Date()
): { solarDate: string; year: number } | null {
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const currentYear = now.getFullYear();
  for (let year = currentYear; year <= currentYear + 5; year++) {
    const monthObj = findMonth(year, month, isLeap);
    if (!monthObj) {
      // 该年没有此（闰）月，尝试下一年
      continue;
    }
    if (day > monthObj.getDayCount()) {
      continue;
    }
    try {
      const solar = Solar.fromJulianDay(monthObj.getFirstJulianDay() + (day - 1));
      const solarStr = `${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())}`;
      if (solarStr >= todayStr) {
        return { solarDate: solarStr, year };
      }
    } catch {
      // 忽略异常，继续尝试下一年
    }
  }
  return null;
}
