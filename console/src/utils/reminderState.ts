/**
 * 到期项的「办理状态」与前台/后台一致的文案（1.2.6）。
 *
 * 与后端 support/ReminderSupport.java 保持同一套规则：
 *   - 状态：PENDING（待办）/ TODO（逾期超窗口，待处理）/ DONE（已办）/ SKIPPED（本周期忽略）
 *   - 阶段（节点式）：进入提醒期后按 提前天数/15/7/3/1/0 天与逾期 1..N 天各弹一次
 *   - 一切状态变化都由用户操作触发：插件不自动顺延、不猜测"办没办"
 */

export const STATUS_PENDING = "PENDING";
export const STATUS_TODO = "TODO";
export const STATUS_DONE = "DONE";
export const STATUS_SKIPPED = "SKIPPED";

export type ReminderStatus =
  | typeof STATUS_PENDING
  | typeof STATUS_TODO
  | typeof STATUS_DONE
  | typeof STATUS_SKIPPED;

/** 提前期固定节点（天） */
const BASE_NODES = [15, 7, 3, 1, 0];

/** 提前期节点：按该项提前天数裁剪（提前 30 天 → 30/15/7/3/1/0） */
export function advanceNodes(remindDays: number): number[] {
  const window = Math.max(0, remindDays || 0);
  const set = new Set<number>([window]);
  // 节奏 B：窗口内每 7 天一个节点，进入最后 15 天后按 15/7/3/1/0 加密
  for (let d = window - 7; d > 15; d -= 7) set.add(d);
  for (const n of BASE_NODES) {
    if (n <= window) set.add(n);
  }
  return [...set].sort((a, b) => b - a);
}

/** 当前阶段编码；不在节点日返回 null */
export function stageCodeOf(daysUntil: number, remindDays: number, overdueDays: number): string | null {
  if (daysUntil >= 0) {
    return advanceNodes(remindDays).includes(daysUntil) ? `D${daysUntil}` : null;
  }
  const overdue = -daysUntil;
  return overdue <= Math.max(0, overdueDays) ? `O${overdue}` : null;
}

/** 是否已进入「待处理」（逾期超过窗口） */
export function isTodo(daysUntil: number, overdueDays: number): boolean {
  return daysUntil < 0 && -daysUntil > Math.max(0, overdueDays);
}

/** 生效状态：忽略只针对当时那个到期日，日期一变自动恢复待办 */
export function effectiveAck(
  ackState: string | undefined,
  skippedForDate: string | undefined,
  resolvedDate: string | undefined
): ReminderStatus {
  const state = (ackState || STATUS_PENDING) as ReminderStatus;
  if (state === STATUS_SKIPPED && skippedForDate && resolvedDate && skippedForDate !== resolvedDate) {
    return STATUS_PENDING;
  }
  return state;
}

/** 状态计算 */
export function statusOf(
  ackState: string | undefined,
  skippedForDate: string | undefined,
  resolvedDate: string | undefined,
  daysUntil: number,
  overdueDays: number
): ReminderStatus {
  const ack = effectiveAck(ackState, skippedForDate, resolvedDate);
  if (ack === STATUS_DONE || ack === STATUS_SKIPPED) return ack;
  return isTodo(daysUntil, overdueDays) ? STATUS_TODO : STATUS_PENDING;
}

/**
 * 阶段文案（与后端 ReminderSupport.stageText 完全一致，逐日不同）。
 * @param who 车辆名（纪念日传 null）
 */
export function stageTextOf(
  who: string | null | undefined,
  label: string | null | undefined,
  daysUntil: number,
  overdueDays: number
): string {
  const name = who && who.trim() ? who.trim() : "";
  const item = label && label.trim() ? label.trim() : "这项";
  const prefix = name ? `「${name}」的${item}` : `「${item}」`;
  if (daysUntil > 1) {
    if (daysUntil === 15) return `${prefix}还有半个月到期，可以先安排一下`;
    if (daysUntil === 7) return `${prefix}还剩一周，记得抽空办`;
    if (daysUntil === 3) return `${prefix}还有 3 天就到期了`;
    return `${prefix}还有 ${daysUntil} 天到期`;
  }
  if (daysUntil === 1) return `${prefix}明天到期`;
  if (daysUntil === 0) return `${prefix}就是今天到期，别忘了处理哦`;
  const overdue = -daysUntil;
  if (overdue === 1) return `${prefix}昨天到期了，记得安排一下~`;
  if (overdue === 2) return `${prefix}已经逾期 2 天，别忘了办呀`;
  if (overdue === 3) return `${prefix}逾期 3 天了，尽快抽空处理吧（这是最后一次主动提醒，之后可在后台查看）`;
  if (overdue <= Math.max(0, overdueDays)) return `${prefix}已逾期 ${overdue} 天，尽快抽空处理吧`;
  return `${prefix}已逾期 ${overdue} 天 · 待处理`;
}

/** 2026-09-23 → 9 月 23 日（今年则省略年份） */
function shortCnDate(date?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((date || "").trim());
  if (!m) return (date || "").trim();
  const sameYear = Number(m[1]) === new Date().getFullYear();
  return sameYear ? `${Number(m[2])} 月 ${Number(m[3])} 日` : `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`;
}

/** 状态说明（列表上给人的一句话） */
export function stateTextOf(
  status: ReminderStatus,
  lastDoneAt?: string,
  lastDoneFrom?: string,
  overdueDays?: number
): string {
  if (status === STATUS_DONE) {
    const when = lastDoneAt ? shortCnDate(lastDoneAt.slice(0, 10)) : "";
    if (!when) return "已办好";
    const from = lastDoneFrom ? `，原来到期日是 ${shortCnDate(lastDoneFrom)}` : "";
    return `${when}办的${from}`;
  }
  if (status === STATUS_SKIPPED) return "这次先不提醒了";
  if (status === STATUS_TODO) return `已经逾期 ${overdueDays ?? 0} 天，还等着你处理`;
  return "";
}

/** 纪念日 / 生日的阶段文案：保持插件原有温暖措辞 */
export function dateStageTextOf(title: string | null | undefined, daysUntil: number): string {
  const name = title && title.trim() ? title.trim() : "这一天";
  if (daysUntil <= 0) return `「${name}」就是今天呀 🎉`;
  if (daysUntil === 1) return `「${name}」明天就到啦～`;
  return `「${name}」还有 ${daysUntil} 天就到啦～`;
}