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
  /** 关联的人员（Person metadata.name 列表） */
  personNames?: string[];
  /** 是否重要（用于到期提醒等），默认 true */
  important?: boolean;
  /** 前台是否展示，默认 true */
  visible?: boolean;
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

export type LogAction = "CREATE" | "UPDATE" | "DELETE";

export interface OperationLogSpec {
  action: LogAction;
  targetTitle?: string;
  targetName?: string;
  detail?: string;
}

export interface OperationLog {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  spec: OperationLogSpec;
}

export interface PersonSpec {
  displayName: string;
  nickname?: string;
  relation?: string;
  dateType: DateType;
  solarDate?: string;
  lunarMonth?: number;
  lunarDay?: number;
  isLeapMonth?: boolean;
  gender?: string;
  bloodType?: string;
  heightCm?: number;
  weightKg?: number;
  hobbies?: string;
  note?: string;
  /** 前台是否展示，默认 true */
  visible?: boolean;
}

export interface Person {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  spec: PersonSpec;
}
