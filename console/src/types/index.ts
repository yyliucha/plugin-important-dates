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
  /** 拖拽排序权重（越小越靠前） */
  sortOrder?: number;
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

/** 日志目标类型（旧数据为空按 DATE 处理） */
export type LogTargetType = "DATE" | "PERSON" | "CAR";

export interface OperationLogSpec {
  action: LogAction;
  targetTitle?: string;
  targetName?: string;
  targetType?: LogTargetType;
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
  /** 大头贴照片地址（单张；前台是否显示由设置控制） */
  avatar?: string;
  /** 拖拽排序权重（越小越靠前） */
  sortOrder?: number;
}

export interface Person {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  spec: PersonSpec;
}

// ---------- 座驾（1.2.0）----------

/** 车辆分类（含电瓶车/自行车） */
export type VehicleType =
  | "SEDAN"
  | "SUV"
  | "MPV"
  | "SPORTS"
  | "ORV"
  | "PICKUP"
  | "WAGON"
  | "HATCHBACK"
  | "CROSSOVER"
  | "VAN"
  | "RV"
  | "TRUCK"
  | "BUS"
  | "MOTORCYCLE"
  | "EBIKE"
  | "BICYCLE"
  | "OTHER";

/** 能源类型 */
export type EnergyType = "FUEL" | "EV" | "PHEV" | "HEV" | "HUMAN";

/** 车辆状态 */
export type VehicleStatus = "IN_USE" | "SOLD" | "SCRAPPED";

export const VEHICLE_TYPES: { value: VehicleType; label: string; icon: string }[] = [
  { value: "SEDAN", label: "轿车", icon: "🚗" },
  { value: "SUV", label: "SUV", icon: "🚙" },
  { value: "MPV", label: "MPV", icon: "🚐" },
  { value: "SPORTS", label: "跑车", icon: "🏎️" },
  { value: "ORV", label: "越野车", icon: "🚙" },
  { value: "PICKUP", label: "皮卡", icon: "🚛" },
  { value: "WAGON", label: "旅行车", icon: "🚗" },
  { value: "HATCHBACK", label: "两厢车", icon: "🚗" },
  { value: "CROSSOVER", label: "跨界车", icon: "🚙" },
  { value: "VAN", label: "微面/面包车", icon: "🚐" },
  { value: "RV", label: "房车", icon: "🚌" },
  { value: "TRUCK", label: "货车", icon: "🚚" },
  { value: "BUS", label: "客车", icon: "🚌" },
  { value: "MOTORCYCLE", label: "摩托车", icon: "🏍️" },
  { value: "EBIKE", label: "电瓶车", icon: "🛵" },
  { value: "BICYCLE", label: "自行车", icon: "🚲" },
  { value: "OTHER", label: "其他", icon: "🚘" },
];

export const ENERGY_TYPES: { value: EnergyType; label: string }[] = [
  { value: "FUEL", label: "燃油" },
  { value: "EV", label: "纯电" },
  { value: "PHEV", label: "插电混动" },
  { value: "HEV", label: "油电混动" },
  { value: "HUMAN", label: "人力" },
];

export const VEHICLE_STATUSES: { value: VehicleStatus; label: string }[] = [
  { value: "IN_USE", label: "在用车" },
  { value: "SOLD", label: "已出售" },
  { value: "SCRAPPED", label: "已报废" },
];

/** 到期项模板 */
export const REMINDER_PRESETS: { key: string; label: string; defaultDays: number }[] = [
  { key: "INSURANCE_COMPULSORY", label: "交强险", defaultDays: 15 },
  { key: "INSURANCE_COMMERCIAL", label: "商业险", defaultDays: 15 },
  { key: "INSPECTION", label: "年检", defaultDays: 30 },
  { key: "MAINTENANCE", label: "保养", defaultDays: 14 },
  { key: "TAX", label: "车船税", defaultDays: 15 },
  { key: "LICENSE", label: "驾照换证", defaultDays: 30 },
  { key: "CUSTOM", label: "自定义", defaultDays: 7 },
];

export interface CarPhoto {
  url: string;
  name?: string;
  isCover?: boolean;
  sortOrder?: number;
  /** 前台是否展示（默认 true；取消勾选仅后台可见） */
  frontVisible?: boolean;
}

export interface CarReminder {
  key?: string;
  label?: string;
  date?: string;
  remindDays?: number;
  enabled?: boolean;
  insurer?: string;
  policyNo?: string;
  intervalMonths?: number;
  intervalKm?: number;
  lastServiceDate?: string;
  lastServiceKm?: number;
}

export interface CarSpec {
  displayName: string;
  brand?: string;
  model?: string;
  /** 车牌号（敏感：前台永远脱敏） */
  plateNo?: string;
  vehicleType?: VehicleType;
  energyType?: EnergyType;
  color?: string;
  vin?: string;
  engineNo?: string;
  registeredDate?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  mileageKm?: number;
  mileageUpdatedAt?: string;
  status?: VehicleStatus;
  photos?: CarPhoto[];
  ownerName?: string;
  driverNames?: string[];
  note?: string;
  visible?: boolean;
  important?: boolean;
  sortOrder?: number;
  reminders?: CarReminder[];
}

export interface Car {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  spec: CarSpec;
}

