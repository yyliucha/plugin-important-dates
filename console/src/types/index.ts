export interface Metadata {
  name: string;
  generateName?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  version?: number;
  creationTimestamp?: string;
  deletionTimestamp?: string;
}

export type DateType = "SOLAR" | "LUNAR";

export interface ImportantDateSpec {
  title: string;
  dateType: DateType;
  solarDate?: string;
  lunarMonth?: number;
  lunarDay?: number;
  isLeapMonth?: boolean;
  note?: string;
}

export interface ImportantDate {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  spec: ImportantDateSpec;
}

export interface ListResult<T> {
  page: number;
  size: number;
  total: number;
  items: T[];
}
