/**
 * 附件库「来源范围」（分类 / 策略）解析（1.2.2）
 *
 * 背景：插件设置里可以为「人员大头贴」和「座驾相册」分别指定 分类（分组）与 存储策略。
 * 旧实现要求两个条件同时命中，站点里只要有一项与数据不一致（例如图片未分组、或使用了其它策略），
 * 附件库就会显示 0 张，看起来像"设置没生效"。
 *
 * 现在的语义：
 *   1. 分类 + 策略都配置 → 优先按二者同时命中；
 *   2. 二者命中为空时依次放宽为「仅分类」→「仅策略」→「全部图片」，并在界面上说明实际生效范围与各自命中数；
 *   3. 只配置了其中一项 → 直接按该项过滤；
 *   4. 都没配置（或不限定）→ 显示全部图片。
 * 另外 `__ungrouped__`（设置里的「未分组」选项）代表"没有分类的图片"，不能当成真实分组名比较。
 */
import { axiosInstance } from "@halo-dev/api-client";

/** 设置里「未分组」选项的值（Halo 附件库语义：groupName 为空的图片） */
export const UNGROUPED = "__ungrouped__";

export interface AttachmentItem {
  name: string;
  displayName: string;
  permalink: string;
  groupName: string;
  policyName: string;
}

interface RawAttachment {
  metadata?: { name?: string; deletionTimestamp?: string };
  spec?: { displayName?: string; mediaType?: string; policyName?: string; groupName?: string };
  status?: { permalink?: string };
}

const IMAGE_EXT = /\.(png|jpe?g|jpeg|gif|webp|svg|avif|bmp)$/i;

/** 读取附件库中的图片（按创建时间倒序，过滤软删除与隐藏项） */
export async function fetchImageLibrary(size = 200): Promise<AttachmentItem[]> {
  const { data } = await axiosInstance.get<{ items?: RawAttachment[] }>(
    "/apis/storage.halo.run/v1alpha1/attachments",
    { params: { page: 1, size, sort: "metadata.creationTimestamp,desc" } }
  );
  return (data?.items || [])
    .filter((a) => {
      if (!a.metadata?.name || a.metadata?.deletionTimestamp) return false;
      const url = a.status?.permalink || "";
      const mt = (a.spec?.mediaType || "").toLowerCase();
      // mediaType 可能是 application/octet-stream（部分上传链路），按扩展名兜底
      return !!url && (mt.startsWith("image/") || IMAGE_EXT.test(url));
    })
    .map((a) => ({
      name: a.metadata?.name || "",
      displayName: a.spec?.displayName || a.metadata?.name || "",
      permalink: a.status?.permalink || "",
      groupName: a.spec?.groupName || "",
      policyName: a.spec?.policyName || "",
    }));
}

export interface NamedOption {
  name: string;
  label: string;
}

/** 附件分组（过滤隐藏项与删除中的），name = metadata.name，label = 显示名 */
export async function fetchGroups(): Promise<NamedOption[]> {
  try {
    const { data } = await axiosInstance.get<{
      items?: {
        metadata?: { name?: string; labels?: Record<string, string>; deletionTimestamp?: string };
        spec?: { displayName?: string };
      }[];
    }>("/apis/storage.halo.run/v1alpha1/groups", { params: { page: 1, size: 100 } });
    return (data?.items || [])
      .filter(
        (it) =>
          it.metadata?.name &&
          !it.metadata?.deletionTimestamp &&
          it.metadata?.labels?.["halo.run/hidden"] !== "true"
      )
      .map((it) => ({ name: it.metadata?.name || "", label: it.spec?.displayName || it.metadata?.name || "" }));
  } catch {
    return [];
  }
}

/** 存储策略（过滤隐藏项与删除中的） */
export async function fetchPolicies(): Promise<NamedOption[]> {
  try {
    const { data } = await axiosInstance.get<{
      items?: {
        metadata?: { name?: string; labels?: Record<string, string>; deletionTimestamp?: string };
        spec?: { displayName?: string };
      }[];
    }>("/apis/storage.halo.run/v1alpha1/policies", { params: { page: 1, size: 100 } });
    return (data?.items || [])
      .filter(
        (it) =>
          it.metadata?.name &&
          !it.metadata?.deletionTimestamp &&
          it.metadata?.labels?.["halo.run/hidden"] !== "true"
      )
      .map((it) => ({ name: it.metadata?.name || "", label: it.spec?.displayName || it.metadata?.name || "" }));
  } catch {
    return [];
  }
}

/** 读取插件设置中的「照片设置（大头贴 / 座驾相册）」来源；car=true 时取座驾相册专用项（缺失回退人员大头贴） */
export async function readAttachmentScope(
  config: Record<string, unknown> | undefined,
  car: boolean
): Promise<{ groupName: string; policyName: string }> {
  let obj: { avatarGroupName?: string; avatarPolicyName?: string; carGroupName?: string; carPolicyName?: string } = {};
  const raw = config?.attachment;
  if (typeof raw === "string") {
    try {
      obj = raw ? JSON.parse(raw) : {};
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as typeof obj;
  }
  const groupName = car
    ? obj.carGroupName?.trim() || obj.avatarGroupName?.trim() || ""
    : obj.avatarGroupName?.trim() || "";
  const policyName = car
    ? obj.carPolicyName?.trim() || obj.avatarPolicyName?.trim() || ""
    : obj.avatarPolicyName?.trim() || "";
  return { groupName, policyName };
}

/** 图片是否属于指定分类（`__ungrouped__` = 未分组） */
export function matchesGroup(item: AttachmentItem, group?: string): boolean {
  const value = (group || "").trim();
  if (!value) return true;
  if (value === UNGROUPED) return !item.groupName;
  return item.groupName === value;
}

/** 图片是否属于指定存储策略 */
export function matchesPolicy(item: AttachmentItem, policy?: string): boolean {
  const value = (policy || "").trim();
  if (!value) return true;
  return item.policyName === value;
}

/** 实际生效的范围种类 */
export type ScopeKind = "all" | "group+policy" | "group" | "policy" | "none";

export interface ScopeResult {
  kind: ScopeKind;
  items: AttachmentItem[];
  /** 分类 + 策略同时命中数 */
  strictCount: number;
  /** 仅按分类命中数 */
  groupCount: number;
  /** 仅按策略命中数 */
  policyCount: number;
  /** 附件库（全部图片）总数 */
  total: number;
}

/**
 * 解析实际展示范围：优先「分类 + 策略」，命中为空时依次放宽，避免设置与数据不一致时显示 0 张。
 */
export function resolveScope(
  items: AttachmentItem[],
  groupName?: string,
  policyName?: string
): ScopeResult {
  const group = (groupName || "").trim();
  const policy = (policyName || "").trim();
  const total = items.length;
  const groupItems = group ? items.filter((i) => matchesGroup(i, group)) : items;
  const policyItems = policy ? items.filter((i) => matchesPolicy(i, policy)) : items;
  const strictItems = items.filter((i) => matchesGroup(i, group) && matchesPolicy(i, policy));
  const base = {
    strictCount: strictItems.length,
    groupCount: group ? groupItems.length : total,
    policyCount: policy ? policyItems.length : total,
    total,
  };
  if (!group && !policy) {
    return { kind: "all", items, ...base };
  }
  if (strictItems.length) {
    return { kind: "group+policy", items: strictItems, ...base };
  }
  if (group && groupItems.length) {
    return { kind: "group", items: groupItems, ...base };
  }
  if (policy && policyItems.length) {
    return { kind: "policy", items: policyItems, ...base };
  }
  return { kind: "none", items, ...base };
}

/** 把实际生效范围翻译成一句人话（含各自命中数，便于排查设置与数据不一致） */
export function scopeHint(
  scope: ScopeResult,
  labels: { group?: string; policy?: string }
): string {
  const groupLabel = labels.group || "未指定";
  const policyLabel = labels.policy || "未指定";
  const counts = `分类「${groupLabel}」命中 ${scope.groupCount} 张 · 策略「${policyLabel}」命中 ${scope.policyCount} 张`;
  switch (scope.kind) {
    case "all":
      return `不限定来源（显示全部 ${scope.total} 张）`;
    case "group+policy":
      return `按设置显示：分类「${groupLabel}」+ 策略「${policyLabel}」，命中 ${scope.strictCount} 张（${counts}）`;
    case "group":
      return `设置中「分类 + 策略」没有同时命中的图片，已放宽为仅按分类显示 ${scope.groupCount} 张（${counts}）`;
    case "policy":
      return `设置中「分类 + 策略」没有同时命中的图片，已放宽为仅按策略显示 ${scope.policyCount} 张（${counts}）`;
    default:
      return `设置的范围（分类「${groupLabel}」/ 策略「${policyLabel}」）下没有图片，已显示全部 ${scope.total} 张（${counts}）`;
  }
}

/** 分类名 → 界面可读名（`__ungrouped__` 显示为「未分组」，其余取系统显示名，缺失时原样显示） */
export function groupLabelOf(name: string, groups: NamedOption[]): string {
  const value = (name || "").trim();
  if (!value) return "";
  if (value === UNGROUPED) return "未分组";
  return groups.find((g) => g.name === value)?.label || value;
}

/** 策略名 → 界面可读名 */
export function policyLabelOf(name: string, policies: NamedOption[]): string {
  const value = (name || "").trim();
  if (!value) return "";
  return policies.find((p) => p.name === value)?.label || value;
}

// ---------- 「引用已失效」检测（1.2.5） ----------
//
// 我们存的是附件的访问地址（相册 photos[].url、大头贴 avatar）。附件在 Halo「附件」里被删除、
// 或存储策略变化 / 被其它插件（如防直链类）拦截导致文件不可访问后，这些地址就会变成 404 —— 前台与
// 后台显示裂图。这里在打开列表时**批量取一次附件清单**做比对（不是每张图发一次请求），把失效的
// 引用标出来。外部地址（非本站 /upload/**）无法判断，一律不标记，避免误报。

/** 去掉 query / hash，得到可比对的地址 */
export function permalinkKey(url?: string): string {
  if (!url) return "";
  return url.split("#")[0].split("?")[0].trim();
}

/** 取当前仍存在的附件地址集合；取不到时返回 null（此时不做任何标记） */
export async function fetchLivePermalinks(size = 500): Promise<Set<string> | null> {
  try {
    const { data } = await axiosInstance.get<{ items?: { status?: { permalink?: string } }[] }>(
      "/apis/storage.halo.run/v1alpha1/attachments",
      { params: { page: 1, size } }
    );
    const set = new Set<string>();
    for (const a of data?.items || []) {
      const key = permalinkKey(a.status?.permalink);
      if (key) set.add(key);
    }
    return set;
  } catch {
    return null;
  }
}

/**
 * 该地址是否已失效：只判断本站 `/upload/**` 且能拿到附件清单的情况。
 * @param live 附件清单（null = 没取到，一律返回 false，避免误报）
 */
export function isBrokenLocalImage(url: string | undefined, live: Set<string> | null): boolean {
  if (!live) return false;
  const key = permalinkKey(url);
  if (!key || !key.startsWith("/upload/")) return false;
  return !live.has(key);
}
