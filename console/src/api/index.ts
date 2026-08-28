import { axiosInstance } from "@halo-dev/api-client";
import type { ImportantDate, ListResult, LogAction, OperationLog } from "@/types";

const BASE = "/apis/importantdates.halo.run/v1alpha1/importantdates";
const LOG_BASE = "/apis/importantdates.halo.run/v1alpha1/operationlogs";

export async function listImportantDates(): Promise<ImportantDate[]> {
  const { data } = await axiosInstance.get<ListResult<ImportantDate>>(BASE, {
    params: {
      page: 1,
      size: 500,
      sort: "metadata.creationTimestamp,desc",
    },
  });
  return data.items || [];
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

export async function listOperationLogs(): Promise<OperationLog[]> {
  const { data } = await axiosInstance.get<ListResult<OperationLog>>(LOG_BASE, {
    params: {
      page: 1,
      size: 200,
      sort: "metadata.creationTimestamp,desc",
    },
  });
  return data.items || [];
}
