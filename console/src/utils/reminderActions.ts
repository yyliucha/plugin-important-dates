/**
 * 到期项的三个用户动作（1.2.6）：已办 / 忽略 / 恢复。
 *
 * 一切状态变化都由用户指令触发；写入走 1.2.5 统一的 JSON Patch 通道
 * （只改变化字段、带 429/5xx 退避重试），不整对象覆盖。
 */
import { patchCar, patchImportantDate, type PatchOp, writeOperationLog } from "@/api";
import type { Car } from "@/types";
import { addMonths, defaultRepeatMonths, formatYmd, parseYmd, resolveDueDate, startOfToday } from "@/utils/vehicle";

/**
 * 软提示：动作结果的年份不是当前年份时，附一句提醒（不阻断操作）。
 * 用于防误操作 —— 例如连点多次顺延后日期滚到几年以后。
 */
function yearHint(date?: string | null): string {
  const text = (date || "").trim();
  if (!text || text.length < 4) return "";
  const year = Number(text.slice(0, 4));
  const now = new Date().getFullYear();
  if (!Number.isFinite(year) || year === now) return "";
  return `（${year} 年，不是今年 ${now} 年，请确认无误）`;
}
/** 由到期项算出"当前生效的到期日" */
export function resolvedDateOf(car: Car, reminderIndex: number): string | undefined {
  const r = car.spec.reminders?.[reminderIndex];
  if (!r) return undefined;
  const resolved = resolveDueDate(r, {
    registeredDate: car.spec.registeredDate || car.spec.purchaseDate,
    vehicleType: car.spec.vehicleType,
    today: startOfToday(),
  });
  return resolved?.date ?? r.date ?? undefined;
}

function repeatMonthsOf(car: Car, reminderIndex: number): number {
  const r = car.spec.reminders?.[reminderIndex];
  if (!r) return 0;
  if (r.repeatMonths != null) return Number(r.repeatMonths);
  return defaultRepeatMonths(r.key);
}

function basePatch(index: number, ops: PatchOp[]): PatchOp[] {
  return ops.map((op) => ({ ...op, path: `/spec/reminders/${index}${op.path}` }));
}

/** 已办：循环项顺延一期；一次性项标记完成（不再提醒）。 */
export async function markReminderDone(car: Car, reminderIndex: number, displayLabel: string): Promise<string> {
  const r = car.spec.reminders?.[reminderIndex];
  if (!r) throw new Error("到期项不存在");
  const from = resolvedDateOf(car, reminderIndex) || "";
  const months = repeatMonthsOf(car, reminderIndex);
  const now = new Date();
  const stamp = `${formatYmd(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const ops: PatchOp[] = [
    { op: "add", path: "/lastDoneAt", value: stamp },
    { op: "add", path: "/lastDoneFrom", value: from },
    // 新周期：节点记录清空，重新按节点提醒
    { op: "add", path: "/notifiedStages", value: [] },
    { op: "add", path: "/notifiedForDate", value: "" },
    { op: "add", path: "/skippedForDate", value: "" },
  ];
  let detail = "已办";
  let logDetail = detail;
  // 保养类：语义是"我刚保养完" —— 更新上次保养日期，并按保养间隔推算下次到期
  const interval = r.intervalMonths != null ? Number(r.intervalMonths) : 0;
  if (r.key === "MAINTENANCE" && interval > 0) {
    const today = startOfToday();
    const next = addMonths(today, interval);
    ops.push({ op: "add", path: "/lastServiceDate", value: formatYmd(today) });
    ops.push({ op: "add", path: "/date", value: formatYmd(next) });
    ops.push({ op: "add", path: "/lastDoneFromService", value: r.lastServiceDate || "" });
    ops.push({ op: "add", path: "/lastDoneTo", value: formatYmd(next) });
    ops.push({ op: "add", path: "/ackState", value: "PENDING" });
    await patchCar(car.metadata.name, basePatch(reminderIndex, ops));
    const detailText = `已办：下次保养 ${formatYmd(next)}${yearHint(formatYmd(next))}`;
    const logText = `已办（刚保养完）：上次保养日期 ${r.lastServiceDate || "—"} → ${formatYmd(today)}，下次保养 ${formatYmd(next)}（间隔 ${interval} 个月）`;
    await writeOperationLog("UPDATE", `${car.spec.displayName} · ${displayLabel}`, car.metadata.name, logText, "CAR");
    return detailText;
  }
  if (months > 0) {
    const base = parseYmd(from) || startOfToday();
    const next = new Date(base.getFullYear(), base.getMonth() + months, base.getDate());
    const nextText = formatYmd(next);
    ops.push({ op: "add", path: "/date", value: nextText });
    ops.push({ op: "add", path: "/ackState", value: "PENDING" });
    // 记录"顺延到哪天"：本期已办过 → 按钮改为「撤销顺延」，防止同一期被反复点击滚到很远的年份
    ops.push({ op: "add", path: "/lastDoneTo", value: nextText });
    detail = `已办：下次到期 ${nextText}${yearHint(nextText)}`;
    logDetail = `已办并顺延 ${months} 个月：${from || "—"} → ${nextText}`;
  } else {
    // 一次性项：办完即完成
    ops.push({ op: "add", path: "/ackState", value: "DONE" });
    detail = "已办：这项以后不会再提醒了";
    logDetail = `已办（一次性事项已完成，不再提醒；原到期日 ${from || "—"}）`;
  }
  await patchCar(car.metadata.name, basePatch(reminderIndex, ops));
  await writeOperationLog(
    "UPDATE",
    `${car.spec.displayName} · ${displayLabel}`,
    car.metadata.name,
    detail,
    "CAR"
  );
  return detail;
}

/** 忽略：本周期内不再提醒（到期日变化后自动恢复）。 */
export async function skipReminder(car: Car, reminderIndex: number, displayLabel: string): Promise<void> {
  const from = resolvedDateOf(car, reminderIndex) || "";
  await patchCar(
    car.metadata.name,
    basePatch(reminderIndex, [
      { op: "add", path: "/ackState", value: "SKIPPED" },
      { op: "add", path: "/skippedForDate", value: from },
    ])
  );
  await writeOperationLog(
    "UPDATE",
    `${car.spec.displayName} · ${displayLabel}`,
    car.metadata.name,
    `本周期忽略提醒（到期日 ${from || "—"}）`,
    "CAR"
  );
}

/** 恢复：撤销忽略 / 撤销"已完成"。 */
export async function restoreReminder(car: Car, reminderIndex: number, displayLabel: string): Promise<void> {
  await patchCar(
    car.metadata.name,
    basePatch(reminderIndex, [
      { op: "add", path: "/ackState", value: "PENDING" },
      { op: "add", path: "/skippedForDate", value: "" },
    ])
  );
  await writeOperationLog(
    "UPDATE",
    `${car.spec.displayName} · ${displayLabel}`,
    car.metadata.name,
    "恢复提醒",
    "CAR"
  );
}

/** 纪念日：忽略 / 恢复（纪念日不会逾期，只有"本周期不再提示"） */
export async function skipDateReminder(name: string, title: string): Promise<void> {
  await patchImportantDate(name, [{ op: "add", path: "/spec/notifiedForDate", value: "__skipped__" }]);
  await writeOperationLog("UPDATE", title, name, "本周期忽略提醒", "DATE");
}

export async function restoreDateReminder(name: string, title: string): Promise<void> {
  await patchImportantDate(name, [
    { op: "add", path: "/spec/notifiedForDate", value: "" },
    { op: "add", path: "/spec/notifiedStages", value: [] },
  ]);
  await writeOperationLog("UPDATE", title, name, "恢复提醒", "DATE");
}

/**
 * 撤销「已办」：把到期日还原到办理前那一天（lastDoneFrom），并清空办理痕迹。
 * 用于误操作——例如连续点了多次「已办，顺延一期」，把日期滚到了很远的年份。
 */
export async function undoReminderDone(car: Car, reminderIndex: number, displayLabel: string): Promise<string> {
  const r = car.spec.reminders?.[reminderIndex];
  if (!r) throw new Error("到期项不存在");
  const restore = r.lastDoneFrom || "";
  if (!restore) throw new Error("没有可撤销的办理记录");
  await patchCar(
    car.metadata.name,
    basePatch(reminderIndex, [
      { op: "add", path: "/date", value: restore },
      { op: "add", path: "/ackState", value: "PENDING" },
      { op: "add", path: "/lastDoneAt", value: "" },
      { op: "add", path: "/lastDoneFrom", value: "" },
      { op: "add", path: "/lastDoneTo", value: "" },
      { op: "add", path: "/lastServiceDate", value: r.lastDoneFromService || r.lastServiceDate || "" },
      { op: "add", path: "/lastDoneFromService", value: "" },
      { op: "add", path: "/notifiedStages", value: [] },
      { op: "add", path: "/notifiedForDate", value: "" },
      { op: "add", path: "/skippedForDate", value: "" },
    ])
  );
  await writeOperationLog(
    "UPDATE",
    `${car.spec.displayName} · ${displayLabel}`,
    car.metadata.name,
    `撤销办理：到期日恢复为 ${restore}（原记录 ${from2Text(r.lastDoneTo)}）`,
    "CAR"
  );
  return `已撤销办理，到期日恢复为 ${restore}${yearHint(restore)}`;
}

function from2Text(value?: string): string {
  return value && value.trim() ? value : "—";
}

/** 本期是否已经办过（顺延后的日期就是当前生效的到期日） */
export function isDoneThisCycle(car: Car, reminderIndex: number): boolean {
  const r = car.spec.reminders?.[reminderIndex];
  if (!r) return false;
  if (r.ackState === "DONE") return true;
  const to = (r.lastDoneTo || "").trim();
  if (!to) return false;
  return to === (resolvedDateOf(car, reminderIndex) || "");
}