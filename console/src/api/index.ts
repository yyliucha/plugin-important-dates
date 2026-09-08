import { axiosInstance } from "@halo-dev/api-client";
import type { ImportantDate, ListResult, LogAction, OperationLog, Person } from "@/types";

const BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const LOG_BASE = "/apis/importantdates.halo.run/v1alpha1/operationlogs";
const PERSON_BASE = "/apis/importantdates.halo.run/v1alpha1/persons";

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
  detail: string
): Promise<void> {
  await axiosInstance.post<OperationLog>(LOG_BASE, {
    apiVersion: "importantdates.halo.run/v1alpha1",
    kind: "OperationLog",
    metadata: {
      name: `operation-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    spec: { action, targetTitle, targetName, detail },
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
  const { data } = await axiosInstance.put<Person>(`${PERSON_BASE}/${item.metadata.name}`, item);
  return data;
}

export async function deletePerson(name: string): Promise<void> {
  await axiosInstance.delete(`${PERSON_BASE}/${name}`);
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
