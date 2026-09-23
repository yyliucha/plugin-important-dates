import { axiosInstance } from "@halo-dev/api-client";
import type { Car, ImportantDate, ListResult, LogAction, LogTargetType, OperationLog, Person } from "@/types";

const BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const LOG_BASE = "/apis/importantdates.halo.run/v1alpha1/operationlogs";
const PERSON_BASE = "/apis/importantdates.halo.run/v1alpha1/persons";
const CAR_BASE = "/apis/importantdates.halo.run/v1alpha1/cars";

// ---------- 统一写操作通道（1.2.5）----------
//
// 站点常部署在反向代理之后（nginx / CDN）。代理的 limit_req / limit_conn 默认用 502/503 拒绝，
// 且由代理自己回复（Halo 日志里看不到），因此控制台侧统一遵守三条：
//   ① 尽量用 JSON Patch 只改变化字段（不再「GET 最新版本 → PUT 整对象」）；
//   ② 批量写**串行**提交并留出间隔，绝不并发打出一串请求；
//   ③ 对 429 / 5xx / 网络中断做退避重试。

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PatchOp {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

/** 是否值得重试（限流 / 网关 / 网络中断） */
function isRetriable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status ?? 0;
  return status === 0 || status === 429 || (status >= 500 && status <= 599);
}

/** 带退避重试执行 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelay = 300): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i === attempts || !isRetriable(error)) throw error;
      await sleep(baseDelay * i);
    }
  }
  throw lastError;
}

/** 批量写：**串行**执行（带间隔），避免一次操作并发打出一串请求被代理限流 */
export async function runSequential<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  gapMs = 40
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await worker(items[i], i);
    if (i < items.length - 1) await sleep(gapMs);
  }
}

/** 把接口错误翻译成可操作的中文提示（避免用户只看到 "code 503"） */
export function describeError(error: unknown, fallback = "未知错误"): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const message = (error as Error)?.message || "";
  switch (status) {
    case 400:
      return "填写内容有误，请检查后重试";
    case 401:
      return "登录已过期，请重新登录后再试";
    case 403:
      return "当前账号没有这个操作权限";
    case 404:
      return "这条记录可能已被删除，请刷新后重试";
    case 409:
      return "这条记录刚在别处被改过，请再试一次";
    case 413:
      return "图片或附件太大了，请压缩后再试";
    case 429:
      return "操作太频繁了，请稍等片刻再试";
    case 502:
    case 503:
    case 504:
      return "站点暂时不可用（已自动重试过），请稍后再试";
    default:
      return status ? "操作没有成功，请稍后再试" : message || fallback;
  }
}

/** 用 JSON Patch 只改指定字段（写路径的默认方式） */
export async function patchExtension(base: string, name: string, ops: PatchOp[]): Promise<void> {
  await withRetry(() =>
    axiosInstance.patch(`${base}/${name}`, ops, {
      headers: { "Content-Type": "application/json-patch+json" },
    })
  );
}

// ---------- 单字段写操作的便捷封装（避免整对象 PUT） ----------

export async function patchImportantDate(name: string, ops: PatchOp[]): Promise<void> {
  await patchExtension(BASE, name, ops);
}

export async function patchPerson(name: string, ops: PatchOp[]): Promise<void> {
  await patchExtension(PERSON_BASE, name, ops);
}

export async function patchCar(name: string, ops: PatchOp[]): Promise<void> {
  await patchExtension(CAR_BASE, name, ops);
}

export async function listImportantDates(): Promise<ImportantDate[]> {
  const { data } = await axiosInstance.get<ListResult<ImportantDate>>(BASE, {
    params: {
      page: 1,
      size: 500,
    },
  });
  // Halo 删除为软删除：索引清理前列表可能短暂携带 deletionTimestamp，一律过滤
  // 排序由界面按拖拽权重（sortOrder）处理
  return (data.items || []).filter((i) => !i.metadata?.deletionTimestamp);
}

export async function createImportantDate(item: ImportantDate): Promise<ImportantDate> {
  const { data } = await axiosInstance.post<ImportantDate>(BASE, item);
  return data;
}

export async function updateImportantDate(item: ImportantDate): Promise<ImportantDate> {
  const { data } = await axiosInstance.put<ImportantDate>(`${BASE}/${item.metadata.name}`, item);
  return data;
}

export async function deleteImportantDate(name: string): Promise<void> {
  await axiosInstance.delete(`${BASE}/${name}`);
}

export async function writeOperationLog(
  action: LogAction,
  targetTitle: string,
  targetName: string,
  detail: string,
  targetType: LogTargetType = "DATE"
): Promise<void> {
  await axiosInstance.post<OperationLog>(LOG_BASE, {
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "OperationLog",
    metadata: {
      name: `operation-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    spec: { action, targetTitle, targetName, targetType, detail },
  });
}

export async function listOperationLogs(
  page = 1,
  size = 20
): Promise<{ items: OperationLog[]; total: number }> {
  const { data } = await axiosInstance.get<ListResult<OperationLog>>(LOG_BASE, {
    params: {
      page,
      size,
      sort: "metadata.creationTimestamp,desc",
    },
  });
  return { items: (data.items || []).filter((i) => !i.metadata?.deletionTimestamp), total: data.total || 0 };
}

/**
 * 扩展更新通用处理（整对象保存场景，例如表单保存）：
 * 先用服务端最新 metadata.version 覆盖，再提交；对 429/5xx 退避重试；
 * 若返回 409（并发冲突）自动拉取最新版本重试一次。
 * 说明：单字段修改请走 patchXxx（JSON Patch），不要再整对象 PUT。
 */
async function putExtension<T extends { metadata: { name: string; version?: number } }>(
  base: string,
  item: T
): Promise<T> {
  const doPut = async (payload: T) => {
    const { data } = await axiosInstance.put<T>(`${base}/${payload.metadata.name}`, payload);
    return data;
  };
  const withLatestVersion = async (): Promise<T> => {
    try {
      const { data: latest } = await axiosInstance.get<T>(`${base}/${item.metadata.name}`);
      return { ...item, metadata: { ...item.metadata, ...latest.metadata } };
    } catch {
      return item;
    }
  };
  const payload = await withLatestVersion();
  try {
    return await withRetry(() => doPut(payload));
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status !== 409) {
      throw error;
    }
    const retried = await withLatestVersion();
    return await withRetry(() => doPut(retried));
  }
}
export async function listPersons(): Promise<Person[]> {
  const { data } = await axiosInstance.get<ListResult<Person>>(PERSON_BASE, {
    params: {
      page: 1,
      size: 500,
    },
  });
  // 同 importantdates：过滤软删除中的对象；排序由界面按拖拽权重（sortOrder）处理
  return (data.items || []).filter((i) => !i.metadata?.deletionTimestamp);
}

export async function createPerson(item: Person): Promise<Person> {
  const { data } = await axiosInstance.post<Person>(PERSON_BASE, item);
  return data;
}

export async function updatePerson(item: Person): Promise<Person> {
  return putExtension<Person>(PERSON_BASE, item);
}

export async function deletePerson(name: string): Promise<void> {
  await axiosInstance.delete(`${PERSON_BASE}/${name}`);
}

// ---------- 座驾（1.2.0） ----------

/** 排序（拖拽）保存：只改 spec.sortOrder，用 JSON Patch 一步到位（避免 GET+PUT 双倍请求） */
export type SortKind = "date" | "person" | "car";

const SORT_BASE: Record<SortKind, string> = {
  date: BASE,
  person: PERSON_BASE,
  car: CAR_BASE,
};

/**
 * 写入单个对象的 sortOrder（拖拽排序用）。
 *
 * 站点常有反向代理限速或限制并发连接，一次拖拽若并发打出十几个请求会被直接 502/503
 * （此时服务端没有日志）。因此这里只改一个字段，并由调用方**串行**调用。
 */
export async function patchSortOrder(kind: SortKind, name: string, sortOrder: number): Promise<void> {
  await patchExtension(SORT_BASE[kind], name, [{ op: "add", path: "/spec/sortOrder", value: sortOrder }]);
}

export async function listCars(): Promise<Car[]> {
  const { data } = await axiosInstance.get<ListResult<Car>>(CAR_BASE, {
    params: {
      page: 1,
      size: 500,
    },
  });
  return (data.items || []).filter((i) => !i.metadata?.deletionTimestamp);
}

export async function createCar(item: Car): Promise<Car> {
  const { data } = await axiosInstance.post<Car>(CAR_BASE, item);
  return data;
}

export async function updateCar(item: Car): Promise<Car> {
  return putExtension<Car>(CAR_BASE, item);
}

export async function deleteCar(name: string): Promise<void> {
  await axiosInstance.delete(`${CAR_BASE}/${name}`);
}

/**
 * 读取插件配置（json-config 接口），返回配置数据对象。
 */
export async function fetchPluginJsonConfig(
  pluginName: string
): Promise<Record<string, string>> {
  const { data } = await axiosInstance.get(
    `/apis/api.console.halo.run/v1alpha1/plugins/${pluginName}/json-config`
  );
  const config = data?.data ?? data ?? {};
  return config as Record<string, string>;
}

