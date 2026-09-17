/**
 * 自检信息（1.2.5）：把"排查靠翻日志"变成后台一眼可见。
 *
 * 检查项：
 *   ① 插件状态：版本 / 是否启用 / 提醒条数
 *   ② 设置完整性：提前提醒天数、展示设置、照片设置里几个关键项是否读到
 *   ③ 失效引用：座驾相册、人员大头贴里指向"已不存在附件"的数量
 *   ④ 附件范围命中：照片设置里的分类 / 策略实际命中多少张
 *   ⑤ 即将到期：N 天内到期的提醒条数（与前台/小组件同口径）
 * 所有数据都来自已有接口，不额外写任何系统配置。
 */
import { axiosInstance } from "@halo-dev/api-client";
import { fetchGroups, fetchImageLibrary, fetchPolicies, readAttachmentScope, resolveScope } from "@/utils/attachmentLibrary";
import { isBrokenLocalImage } from "@/utils/attachmentLibrary";
import { resolveDueDate, startOfToday } from "@/utils/vehicle";
import type { Car, ImportantDate, Person } from "@/types";

export type CheckLevel = "ok" | "warn" | "error";

export interface CheckItem {
  label: string;
  value: string;
  level: CheckLevel;
  hint?: string;
}

export interface SelfCheckResult {
  items: CheckItem[];
  checkedAt: string;
}

interface PluginJsonConfig {
  [group: string]: unknown;
}

function parseGroup<T>(config: PluginJsonConfig, group: string): T {
  const raw = config[group];
  if (typeof raw === "string") {
    try {
      return (raw ? JSON.parse(raw) : {}) as T;
    } catch {
      return {} as T;
    }
  }
  if (raw && typeof raw === "object") return raw as T;
  return {} as T;
}

/** 运行自检：读取现有接口后做本地比对，不修改任何数据 */
export async function runSelfCheck(input: {
  dates: ImportantDate[];
  persons: Person[];
  cars: Car[];
  remindDays: number;
  backendReminder: boolean;
}): Promise<SelfCheckResult> {
  const items: CheckItem[] = [];
  const today = startOfToday();

  // ① 插件版本
  try {
    const { data } = await axiosInstance.get<{ spec?: { version?: string; enabled?: boolean } }>(
      "/apis/plugin.halo.run/v1alpha1/plugins/plugin-important-dates"
    );
    items.push({
      label: "插件版本",
      value: `${data?.spec?.version || "未知"}${data?.spec?.enabled === false ? "（已停用）" : ""}`,
      level: data?.spec?.enabled === false ? "warn" : "ok",
      hint: "装包后请在浏览器里强刷一次（Ctrl+Shift+R），否则控制台可能仍跑旧包",
    });
  } catch {
    items.push({ label: "插件版本", value: "读取失败", level: "warn" });
  }

  // ② 数据量
  items.push({
    label: "数据量",
    value: `重要日期 ${input.dates.length} 条 · 人员 ${input.persons.length} 位 · 座驾 ${input.cars.length} 辆`,
    level: "ok",
  });

  // ③ 设置读取
  let config: PluginJsonConfig = {};
  try {
    const res = await axiosInstance.get<{ data?: PluginJsonConfig }>(
      "/apis/api.console.halo.run/v1alpha1/plugins/plugin-important-dates/json-config"
    );
    config = (res.data?.data ?? res.data ?? {}) as PluginJsonConfig;
  } catch {
    config = {};
  }
  const basic = parseGroup<{ dashboardPageSize?: number; dashboardPagination?: boolean }>(config, "basic");
  const reminder = parseGroup<{ allowDismiss?: boolean; frontendReminder?: boolean }>(config, "reminder");
  items.push({
    label: "提醒与展示设置",
    value: `提前 ${input.remindDays} 天 · 后台提醒${input.backendReminder ? "开" : "关"} · 前台提醒${
      reminder.frontendReminder === false ? "关" : "开"
    } · 仪表盘每页 ${Number(basic.dashboardPageSize) > 0 ? basic.dashboardPageSize : 5} 条 · 逐条忽略${
      reminder.allowDismiss === false ? "关" : "开"
    }`,
    level: "ok",
  });

  // ④ 附件范围命中 + 失效引用
  let live: Set<string> | null = null;
  try {
    const [library, groups, policies] = await Promise.all([fetchImageLibrary(500), fetchGroups(), fetchPolicies()]);
    const carScope = await readAttachmentScope(config, true);
    const avatarScope = await readAttachmentScope(config, false);
    const carResolved = resolveScope(library, carScope.groupName, carScope.policyName);
    const avatarResolved = resolveScope(library, avatarScope.groupName, avatarScope.policyName);
    items.push({
      label: "照片设置 · 座驾相册范围",
      value:
        `分类「${carScope.groupName || "不限定"}」/ 策略「${carScope.policyName || "默认"}」→ 命中 ${carResolved.items.length} 张` +
        (carResolved.kind === "group+policy" ? "（分类+策略）" : carResolved.kind === "group" ? "（已放宽为仅分类）" : carResolved.kind === "policy" ? "（已放宽为仅策略）" : carResolved.kind === "all" ? "（显示全部）" : "（无命中，已显示全部）"),
      level: carResolved.items.length ? "ok" : "warn",
      hint: carResolved.items.length ? undefined : "该范围下没有图片：检查「设置 → 照片设置」的分类 / 策略",
    });
    items.push({
      label: "照片设置 · 人员大头贴范围",
      value:
        `分类「${avatarScope.groupName || "不限定"}」/ 策略「${avatarScope.policyName || "默认"}」→ 命中 ${avatarResolved.items.length} 张`,
      level: avatarResolved.items.length ? "ok" : "warn",
    });
    // 附件清单（用于失效引用判断）
    const { data } = await axiosInstance.get<{ items?: { status?: { permalink?: string } }[] }>(
      "/apis/storage.halo.run/v1alpha1/attachments",
      { params: { page: 1, size: 500 } }
    );
    live = new Set<string>();
    for (const a of data?.items || []) {
      const url = (a.status?.permalink || "").split("#")[0].split("?")[0];
      if (url) live.add(url);
    }
    items.push({ label: "附件库", value: `可访问图片 ${library.length} 张`, level: library.length ? "ok" : "warn" });
  } catch {
    items.push({ label: "附件库", value: "读取失败", level: "warn" });
  }

  const brokenPhotos = input.cars.reduce(
    (sum, c) => sum + (c.spec.photos || []).filter((p) => isBrokenLocalImage(p.url, live)).length,
    0
  );
  const brokenCovers = input.cars.filter(
    (c) => (c.spec.photos || []).length > 0 && (c.spec.photos || []).every((p) => isBrokenLocalImage(p.url, live))
  ).length;
  const brokenAvatars = input.persons.filter((p) => isBrokenLocalImage(p.spec.avatar, live)).length;
  const brokenTotal = brokenPhotos + brokenAvatars;
  items.push({
    label: "图片引用失效",
    value: brokenTotal
      ? `相册 ${brokenPhotos} 张${brokenCovers ? `（其中 ${brokenCovers} 辆车已无可用封面）` : ""} · 大头贴 ${brokenAvatars} 个`
      : "未发现",
    level: brokenTotal ? "warn" : "ok",
    hint: brokenTotal
      ? "在座驾 / 人员里点「编辑」即可看到标记并一键移除或重新选择；前台已自动降级显示，不会出现破图"
      : undefined,
  });

  // ⑤ 即将到期（与前台/小组件同口径）
  let dueSoon = 0;
  for (const d of input.dates) {
    if (d.spec.important === false) continue;
    let next: Date | null = null;
    if (d.spec.dateType === "SOLAR" && d.spec.solarDate) {
      const [, m, day] = d.spec.solarDate.split("-").map(Number);
      let cand = new Date(today.getFullYear(), m - 1, day);
      if (cand.getTime() < today.getTime()) cand = new Date(today.getFullYear() + 1, m - 1, day);
      next = cand;
    }
    if (!next) continue;
    const days = Math.round((next.getTime() - today.getTime()) / 86400000);
    if (days <= input.remindDays) dueSoon++;
  }
  for (const c of input.cars) {
    if (c.spec.important === false || (c.spec.status && c.spec.status !== "IN_USE")) continue;
    for (const r of c.spec.reminders || []) {
      if (r.enabled === false) continue;
      const resolved = resolveDueDate(r, {
        registeredDate: c.spec.registeredDate || c.spec.purchaseDate,
        vehicleType: c.spec.vehicleType,
        today,
      });
      if (!resolved) continue;
      const days = Math.round((new Date(`${resolved.date}T00:00:00`).getTime() - today.getTime()) / 86400000);
      const window = r.remindDays != null ? Number(r.remindDays) : 15;
      if (days <= window && days >= -30) dueSoon++;
    }
  }
  items.push({
    label: `即将到期（${input.remindDays} 天内）`,
    value: `${dueSoon} 条`,
    level: "ok",
    hint: "与前台横幅、仪表盘小组件同一口径（含座驾到期项）",
  });

  return { items, checkedAt: new Date().toLocaleString("zh-CN", { hour12: false }) };
}
