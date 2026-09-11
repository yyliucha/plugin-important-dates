import { axiosInstance } from "@halo-dev/api-client";
import type { Car, ImportantDate, ListResult, LogAction, LogTargetType, OperationLog, Person } from "@/types";

const BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const LOG_BASE = "/apis/importantdates.halo.run/v1alpha1/operationlogs";
const PERSON_BASE = "/apis/importantdates.halo.run/v1alpha1/persons";
const CAR_BASE = "/apis/importantdates.halo.run/v1alpha1/cars";

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
 * 扩展更新通用处理：先用服务端最新 metadata.version 覆盖，再提交；
 * 若仍返回 409（并发冲突，例如列表打开后记录被其他页面/操作更新过），
 * 自动拉取最新版本重试一次，避免用户看到 "code 409" 这类难以理解的报错。
 */
async function putExtension<T extends { metadata: { name: string; version?: number } }>(
  base: string,
  item: T
): Promise<T> {
  const doPut = async (payload: T) => {
    const { data } = await axiosInstance.put<T>(`${base}/${payload.metadata.name}`, payload);
    return data;
  };
  let payload = item;
  try {
    const { data: latest } = await axiosInstance.get<T>(`${base}/${item.metadata.name}`);
    payload = { ...item, metadata: { ...item.metadata, ...latest.metadata } };
  } catch {
    // 取不到最新版本时按原样提交，由下面的重试兜底
  }
  try {
    return await doPut(payload);
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status !== 409) {
      throw error;
    }
    const { data: latest } = await axiosInstance.get<T>(`${base}/${item.metadata.name}`);
    const retried = { ...item, metadata: { ...item.metadata, ...latest.metadata } };
    return await doPut(retried);
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

