/**
 * 到期项的三个用户动作（1.2.6）：已办 / 忽略 / 恢复。
 *
 * 一切状态变化都由用户指令触发；写入走 1.2.5 统一的 JSON Patch 通道
 * （只改变化字段、带 429/5xx 退避重试），不整对象覆盖。
 */
import { patchCar, patchImportantDate, type PatchOp, writeOperationLog } from "@/api";
import type { Car } from "@/types";
import { defaultRepeatMonths, formatYmd, parseYmd, resolveDueDate, startOfToday } from "@/utils/vehicle";

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
  let detail = `已办（原到期日 ${from || "—"}）`;
  if (months > 0) {
    const base = parseYmd(from) || startOfToday();
    const next = new Date(base.getFullYear(), base.getMonth() + months, base.getDate());
    const nextText = formatYmd(next);
    ops.push({ op: "add", path: "/date", value: nextText });
    ops.push({ op: "add", path: "/ackState", value: "PENDING" });
    detail = `已办并顺延 ${months} 个月：${from || "—"} → ${nextText}`;
  } else {
    // 一次性项：办完即完成
    ops.push({ op: "add", path: "/ackState", value: "DONE" });
    detail = `已办（一次性事项已完成，不再提醒；原到期日 ${from || "—"}）`;
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
