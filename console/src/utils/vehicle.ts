/**
 * 座驾到期规则（1.2.1）：与后端 VehicleSupport / ImportantDateFinderImpl 保持同一口径。
 *
 * - 年检：按「首次登记日期 + 车型规则」自动推算（第 2/4 年免检申领 → 第 6/10 年上线 → 第 11 年起每年）；
 * - 循环间隔：显式设置优先，未设置时取项目默认（保险 / 车船税 / 驾照换证 / 年检 = 每年，保养 / 自定义 = 不循环）；
 * - 若后端规则调整，这里需同步修改（界面仅用于展示与表单校验，最终以服务端计算结果为准）。
 */
import type { CarReminder } from "@/types";

/** 按年循环的到期项（默认 12 个月滚动一次） */
export const YEARLY_REMINDER_KEYS = [
  "INSURANCE_COMPULSORY",
  "INSURANCE_COMMERCIAL",
  "INSPECTION",
  "TAX",
  "LICENSE",
];

/** 默认循环间隔（月）；0 表示不循环 */
export function defaultRepeatMonths(key?: string): number {
  if (!key) return 0;
  switch (key) {
    case "INSURANCE_COMPULSORY":
    case "INSURANCE_COMMERCIAL":
    case "TAX":
    case "LICENSE":
    case "INSPECTION":
      return 12;
    default:
      return 0;
  }
}

/** 循环间隔下拉项（自定义月数由表单单独处理） */
export const REPEAT_OPTIONS: { value: number; label: string }[] = [
  { value: 12, label: "每年（12 个月）" },
  { value: 24, label: "每两年（24 个月）" },
  { value: 36, label: "每三年（36 个月）" },
  { value: 0, label: "不循环（一次性）" },
];

/** 下拉里「自定义月数」的哨兵值 */
export const REPEAT_CUSTOM = -1;

/** 常用保险公司（仅快捷提示，不限制输入） */
export const COMMON_INSURERS = [
  "中国人保",
  "中国平安",
  "太平洋保险",
  "国寿财险",
  "中华联合",
  "大地保险",
  "阳光保险",
  "太平保险",
  "众安保险",
  "泰康在线",
];

/** 可与交强险同期的到期项（年检 / 车船税） */
export function syncableKey(key?: string): boolean {
  return key === "INSPECTION" || key === "TAX";
}

// ---------- 车型能力（1.2.8）：按「有没有发动机 / 有没有牌照」分档，决定表单显示哪些字段与到期项 ----------

export interface VehicleCapability {
  /** 有发动机：显示能源类型、车架号 VIN、发动机号 */
  hasEngine: boolean;
  /** 有机动车号牌：显示车牌号 */
  hasPlate: boolean;
  /** 走机动车管理：有保险 / 年检 / 车船税 */
  isMotorVehicle: boolean;
  /** 记里程：人力车没有里程概念 */
  tracksMileage: boolean;
  /** 可选的到期项模板 key（按 REMINDER_PRESETS 的顺序过滤，未列出的不显示） */
  reminderKeys: string[];
}

/**
 * 三轮/四轮机动车（保险、年检、车船税齐全）。
 * 注意：驾照换证是「人」的事、不是车的事（同一人开两辆车会重复提醒），已从座驾到期项中移除；
 * 老数据里已有的 LICENSE 项会走「保留但不展示」（见 CarFormModal 的 hiddenReminders）。
 */
const MOTOR_KEYS = ["INSURANCE_COMPULSORY", "INSURANCE_COMMERCIAL", "INSPECTION", "TAX", "MAINTENANCE"];
/** 电瓶车：多数地区不需要保险与年检，按当地规定可自定义 */
const EBIKE_KEYS = ["MAINTENANCE", "CUSTOM"];
/** 自行车：只有保养（刹车/链条/轮胎）值得记 */
const BICYCLE_KEYS = ["MAINTENANCE", "CUSTOM"];

export function vehicleCapability(type?: string | null): VehicleCapability {
  switch (type || "") {
    case "EBIKE":
      return { hasEngine: true, hasPlate: true, isMotorVehicle: false, tracksMileage: true, reminderKeys: EBIKE_KEYS };
    case "BICYCLE":
      return { hasEngine: false, hasPlate: false, isMotorVehicle: false, tracksMileage: false, reminderKeys: BICYCLE_KEYS };
    default:
      // 汽车、摩托车、货车、客车等一律按机动车处理
      return { hasEngine: true, hasPlate: true, isMotorVehicle: true, tracksMileage: true, reminderKeys: MOTOR_KEYS };
  }
}

/** 该车型是否适用某个到期项（不适用 = 表单不显示；已有数据保留但不展示） */
export function vehicleSupportsReminder(type: string | null | undefined, key?: string): boolean {
  return !!key && vehicleCapability(type).reminderKeys.includes(key);
}

/**
 * 车型对应的合理能源类型（用于切换车型时的兜底）：
 * - 自行车 → 人力；电瓶车 → 纯电；
 * - 机动车（汽车/摩托等）→ 若当前是"人力"则回到"燃油"。
 * 返回 null 表示该车型对能源没有强制要求（保持用户当前选择）。
 */
export function normalizeEnergyType(type: string | null | undefined, energy?: string | null): string | null {
  if (type === "BICYCLE") return "HUMAN";
  // 电瓶车只有纯电：任何内燃机相关的值（或空值）都归一到纯电
  if (type === "EBIKE") return energy === "EV" ? null : "EV";
  // 机动车挂着"人力"是自行车改过来的残留，回到燃油；其余保持不动
  return energy === "HUMAN" ? "FUEL" : null;
}

/** 能源类型是否由车型锁死（电瓶车=纯电、自行车=人力） */
export function isEnergyLocked(type?: string | null): boolean {
  return type === "EBIKE" || type === "BICYCLE";
}

/** 能源类型显示名；无值时不给"燃油"这种会误导的兜底（自行车不应显示燃油） */
export function energyLabelOf(energy?: string | null): string {
  const labels: Record<string, string> = {
    FUEL: "燃油",
    EV: "纯电",
    PHEV: "插电混动",
    HEV: "油电混动",
    HUMAN: "人力",
  };
  return labels[energy || ""] || "";
}

/**
 * 展示用能源标签：按车型纠偏后再取名字。
 * 老数据的 energyType 常是默认的 "FUEL"（自行车/电瓶车都会中招），
 * 这里在**展示时**按车型规则纠偏，不去改写用户已存的数据。
 */
export function energyLabelFor(type: string | null | undefined, energy?: string | null): string {
  return energyLabelOf(normalizeEnergyType(type, energy) ?? energy);
}

/** 保险类到期项（可填保单号、可单独指定保险公司） */
export function insuranceKey(key?: string): boolean {
  return key === "INSURANCE_COMPULSORY" || key === "INSURANCE_COMMERCIAL";
}

// ---------- 日期工具（本地时区，按"年月日"处理，避免 UTC 偏移） ----------

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseYmd(text?: string | null): Date | null {
  if (!text) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 加月（月末不足时取当月最后一天，等同 Java LocalDate.plusMonths） */
export function addMonths(date: Date, months: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth() + months;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const lastDay = new Date(targetY, targetM + 1, 0).getDate();
  return new Date(targetY, targetM, Math.min(date.getDate(), lastDay));
}

/** 加年（2/29 落在非闰年时取 2/28，等同 Java LocalDate.plusYears） */
export function addYears(date: Date, years: number): Date {
  const targetY = date.getFullYear() + years;
  const m = date.getMonth();
  const lastDay = new Date(targetY, m + 1, 0).getDate();
  return new Date(targetY, m, Math.min(date.getDate(), lastDay));
}

export function daysUntil(dateText?: string | null, today: Date = startOfToday()): number | null {
  const due = parseYmd(dateText);
  if (!due) return null;
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// ---------- 年检推算 ----------

export interface InspectionNext {
  /** 推算出的下一次年检日期（无法推算时为 null） */
  date: string | null;
  /** 阶段：免检申领 / 上线检验 */
  phase: string;
  /** 依据说明（表单与提醒中展示） */
  rule: string;
  /** 是否需要人工填写（缺登记日期、或电瓶车/自行车免年检） */
  manualNeeded: boolean;
}

const RULE_CAR =
  "按非营运小微型载客汽车规则推算（第 2、4 年申领免检标志；第 6、10 年上线检验；第 11 年起每年上线检验）";
const RULE_MOTORCYCLE =
  "按摩托车规则推算（前 4 年每 2 年申领免检标志，之后每年上线检验；以当地车管所为准）";
const RULE_NO_BASE = "缺少首次登记日期，无法自动推算，请手动填写";
const RULE_NO_INSPECTION = "电瓶车 / 自行车通常无需年检，可按当地规定手动填写";

export interface InspectionRuleOptions {
  /** 年检节点（年）：默认 [2,4,6,10] */
  nodes?: number[];
  /** 从第几年起每年上线检验：默认 11 */
  yearlyFrom?: number;
}

/** 默认年检节点（与后端 VehicleSupport.DEFAULT_INSPECTION_NODES 一致） */
export const DEFAULT_INSPECTION_NODES = [2, 4, 6, 10];
/** 默认「从第 N 年起每年上线检验」 */
export const DEFAULT_INSPECTION_YEARLY_FROM = 11;

/** 解析设置里的年检节点文本（形如 "2,4,6,10"）；非法或为空回退默认 */
export function parseInspectionNodes(text?: string | null): number[] {
  if (!text) return [...DEFAULT_INSPECTION_NODES];
  const nodes = (text.match(/\d+/g) || [])
    .map((n) => Number(n))
    .filter((n) => n >= 1 && n <= 30);
  const unique = [...new Set(nodes)].sort((a, b) => a - b);
  return unique.length ? unique : [...DEFAULT_INSPECTION_NODES];
}

/**
 * 按「首次登记日期 + 车辆分类」推算下一个年检节点（与后端 VehicleSupport.nextInspection 一致）：
 * 默认第 2、4 年免检申领，第 6、10 年上线检验，第 11 年起每年上线；节点与起始年份可在设置里改。
 */
export function nextInspection(
  registeredDate?: string | null,
  vehicleType?: string | null,
  today: Date = startOfToday(),
  options: InspectionRuleOptions = {}
): InspectionNext {
  const type = vehicleType || "";
  if (type === "EBIKE" || type === "BICYCLE") {
    return { date: null, phase: "", rule: RULE_NO_INSPECTION, manualNeeded: true };
  }
  const base = parseYmd(registeredDate);
  if (!base) {
    return { date: null, phase: "", rule: RULE_NO_BASE, manualNeeded: true };
  }
  const motorcycle = type === "MOTORCYCLE";
  const nodes = options.nodes?.length ? options.nodes : DEFAULT_INSPECTION_NODES;
  const yearlyFrom =
    options.yearlyFrom && options.yearlyFrom >= 1 && options.yearlyFrom <= 30
      ? options.yearlyFrom
      : DEFAULT_INSPECTION_YEARLY_FROM;
  const rule = motorcycle
    ? RULE_MOTORCYCLE
    : `按非营运小微型载客汽车规则推算（第 ${nodes.join("、")} 年检验；第 ${yearlyFrom} 年起每年上线检验；可在「座驾设置 → 年检节点」中按当地规则调整）`;
  let best: Date | null = null;
  let bestPhase = "";
  for (let year = 2; year <= 30; year++) {
    let node: boolean;
    let phase: string;
    if (motorcycle) {
      node = year <= 4 ? year % 2 === 0 : true;
      phase = year <= 4 ? "免检申领" : "上线检验";
    } else if (year >= yearlyFrom) {
      node = true;
      phase = "上线检验";
    } else if (nodes.includes(year)) {
      node = true;
      phase = year >= 6 ? "上线检验" : "免检申领";
    } else {
      node = false;
      phase = "";
    }
    if (!node) continue;
    const candidate = addYears(base, year);
    if (candidate.getTime() >= today.getTime()) {
      best = candidate;
      bestPhase = phase;
      break;
    }
    best = candidate;
    bestPhase = phase;
  }
  if (!best) {
    return { date: null, phase: "", rule: "无法推算，请手动填写", manualNeeded: true };
  }
  return { date: formatYmd(best), phase: bestPhase, rule, manualNeeded: false };
}

export interface InspectionNotice {
  /** 去重键：同一阶段只提示一次（写入 Car.spec.inspectionNoticeAck） */
  key: "ONSITE" | "YEARLY";
  /** 车龄（整年） */
  years: number;
  /** 说明文案（不含车辆名） */
  text: string;
}

/**
 * 车辆是否已进入「上线检验期」或「每年上线检验期」，用于后台一次性提示（E）。
 * 非营运小微型载客汽车：第 6 年起不再免检（第 6/10 年上线检验）、第 11 年起每年一次；
 * 摩托车：前 4 年每 2 年申领免检标志，之后每年上线检验。
 */
export function inspectionNotice(
  registeredDate?: string | null,
  vehicleType?: string | null,
  today: Date = startOfToday()
): InspectionNotice | null {
  const type = vehicleType || "";
  if (type === "EBIKE" || type === "BICYCLE") return null;
  const base = parseYmd(registeredDate);
  if (!base) return null;
  let years = today.getFullYear() - base.getFullYear();
  if (addYears(base, years).getTime() > today.getTime()) years -= 1;
  if (years < 0) return null;
  if (type === "MOTORCYCLE") {
    if (years <= 4) return null;
    return {
      key: "YEARLY",
      years,
      text: "已进入每年上线检验期（摩托车前 4 年每 2 年申领免检标志，之后每年上线检验），年检提醒已按规则自动滚动",
    };
  }
  if (years >= 11) {
    return {
      key: "YEARLY",
      years,
      text: "年检已切换为每年一次（第 11 年起），请留意每年按期上线检验",
    };
  }
  if (years >= 6) {
    return {
      key: "ONSITE",
      years,
      text: "已进入上线检验期（第 6 年起不再免检：第 6、10 年需上线检验，第 11 年起每年一次），年检提醒已按规则自动滚动",
    };
  }
  return null;
}

// ---------- 到期日解析（与后端 ImportantDateFinderImpl.resolveDueDate 一致） ----------

/**
 * 解析到期项实际到期日：直接日期优先；保养项按"上次保养 + 间隔月数"推算；
 * 按循环间隔（显式 > 项目默认）自动滚动到下一次；年检未填日期时按规则推算。
 */
export function resolveDueDate(
  reminder: CarReminder,
  options: { registeredDate?: string | null; vehicleType?: string | null; today?: Date } = {}
): { date: string; phase?: string; rule?: string } | null {
  const today = options.today ?? startOfToday();
  let due = parseYmd(reminder.date);
  if (!due && reminder.key === "MAINTENANCE" && reminder.intervalMonths && reminder.intervalMonths > 0) {
    const last = parseYmd(reminder.lastServiceDate);
    if (last) {
      due = addMonths(last, Number(reminder.intervalMonths));
    }
  }
  if (!due && reminder.key === "INSPECTION") {
    const next = nextInspection(options.registeredDate, options.vehicleType, today);
    if (!next.date) return null;
    return { date: next.date, phase: next.phase, rule: next.rule };
  }
  if (!due) return null;
  // 1.2.6：不再自动滚动 —— 过期即逾期，直到用户点「已办」才顺延（与后端同一口径）
  return { date: formatYmd(due) };
}
