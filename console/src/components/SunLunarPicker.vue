<template>
  <div class="sun-lunar-picker" ref="rootRef">
    <!-- 显示区域 -->
    <button type="button" class="picker-field" @click="toggle">
      <span :class="{ placeholder: !displayText }">{{ displayText || "点击选择日期" }}</span>
      <span class="caret" :class="{ open: open }">▾</span>
    </button>

    <!-- 弹出面板：Teleport 到 body，fixed 定位，避免被弹窗容器裁剪 -->
    <Teleport to="body">
      <div
        v-if="open"
        ref="popupRef"
        class="picker-popup"
        :style="{ top: popupPos.top + 'px', left: popupPos.left + 'px' }"
      >
      <!-- 阳历模式：公历网格 + 农历标注 -->
      <template v-if="dateType === 'SOLAR'">
        <div class="picker-header">
          <button type="button" class="nav-btn" @click="shiftMonth(-1)">‹</button>
          <div class="header-title">
            {{ viewYear }} 年 {{ viewMonth }} 月
          </div>
          <button type="button" class="nav-btn" @click="shiftMonth(1)">›</button>
        </div>
        <div class="week-row">
          <span v-for="w in weekLabels" :key="w" class="week-cell">{{ w }}</span>
        </div>
        <div class="day-grid">
          <span v-for="i in leadingBlanks" :key="'b' + i" class="day-cell blank"></span>
          <button
            v-for="d in daysInViewMonth"
            :key="d"
            type="button"
            class="day-cell"
            :class="{
              today: isTodaySolar(viewYear, viewMonth, d),
              selected: solarDate === solarStr(viewYear, viewMonth, d),
            }"
            @click="pickSolar(d)"
          >
            <span class="day-num">{{ d }}</span>
            <span class="day-lunar">{{ lunarLabelFor(viewYear, viewMonth, d) }}</span>
          </button>
        </div>
      </template>

      <!-- 农历模式：年份导航 + 月选择（含闰月）+ 日网格 -->
      <template v-else>
        <div class="picker-header">
          <button type="button" class="nav-btn" @click="viewYear--">‹</button>
          <div class="header-title">{{ viewYear }} 年</div>
          <button type="button" class="nav-btn" @click="viewYear++">›</button>
        </div>
        <div class="lunar-months">
          <button
            v-for="m in lunarMonthOptions"
            :key="m.key"
            type="button"
            class="month-btn"
            :class="{ active: m.month === lunarMonth && m.leap === isLeapMonth }"
            @click="selectLunarMonth(m.month, m.leap)"
          >
            {{ m.label }}
          </button>
        </div>
        <div class="week-row">
          <span v-for="w in weekLabels" :key="w" class="week-cell">{{ w }}</span>
        </div>
        <div class="day-grid">
          <span v-for="i in leadingLunarBlanks" :key="'b' + i" class="day-cell blank"></span>
          <button
            v-for="d in lunarDayCount"
            :key="d"
            type="button"
            class="day-cell"
            :class="{ selected: lunarDay === d && lunarMonth === viewLunarMonth && isLeapMonth === viewLunarLeap }"
            @click="pickLunarDay(d)"
          >
            <span class="day-num">{{ lunarDayChinese(d) }}</span>
            <span class="day-lunar">{{ lunarDaySolar(viewLunarMonth, viewLunarLeap, d) }}</span>
          </button>
        </div>
      </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { LunarUtil, LunarYear, Solar } from "lunar-javascript";
import type { DateType } from "@/types";

const props = defineProps<{
  dateType: DateType;
  solarDate?: string;
  lunarMonth?: number;
  lunarDay?: number;
  isLeapMonth?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:solarDate", v: string): void;
  (e: "update:lunarMonth", v: number): void;
  (e: "update:lunarDay", v: number): void;
  (e: "update:isLeapMonth", v: boolean): void;
}>();

const rootRef = ref<HTMLDivElement | null>(null);
const popupRef = ref<HTMLDivElement | null>(null);
const open = ref(false);
const popupPos = ref({ top: 0, left: 0 });
const POPUP_HEIGHT = 440;
const now = new Date();
const viewYear = ref(now.getFullYear());
const viewMonth = ref(now.getMonth() + 1);
const viewLunarMonth = ref(props.lunarMonth || 1);
const viewLunarLeap = ref(!!props.isLeapMonth);

const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function solarStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

// ---------- 阳历模式 ----------
const daysInViewMonth = computed(() => new Date(viewYear.value, viewMonth.value, 0).getDate());
const leadingBlanks = computed(() => new Date(viewYear.value, viewMonth.value - 1, 1).getDay());

function shiftMonth(delta: number) {
  let y = viewYear.value;
  let m = viewMonth.value + delta;
  if (m === 0) {
    y -= 1;
    m = 12;
  } else if (m === 13) {
    y += 1;
    m = 1;
  }
  viewYear.value = y;
  viewMonth.value = m;
}

function lunarLabelFor(y: number, m: number, d: number): string {
  try {
    const lunar = Solar.fromYmdHms(y, m, d, 0, 0, 0).getLunar();
    return `${LunarUtil.DAY[lunar.getDay()]}`;
  } catch {
    return "";
  }
}

function isTodaySolar(y: number, m: number, d: number): boolean {
  return y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();
}

function pickSolar(d: number) {
  emit("update:solarDate", solarStr(viewYear.value, viewMonth.value, d));
  open.value = false;
}

// ---------- 农历模式 ----------
function findLunarMonth(year: number, month: number, isLeap: boolean) {
  const target = isLeap ? -month : month;
  return (
    LunarYear.fromYear(year)
      .getMonthsInYear()
      .find((m) => m.getMonth() === target) || null
  );
}

const lunarMonthOptions = computed(() => {
  const months = LunarYear.fromYear(viewYear.value)
    .getMonthsInYear()
    .filter((m) => m.getYear() === viewYear.value);
  return months.map((m) => {
    const month = Math.abs(m.getMonth());
    const leap = m.getMonth() < 0;
    return {
      key: `${month}-${leap}`,
      month,
      leap,
      label: `${leap ? "闰" : ""}${LunarUtil.MONTH[month]}月`,
    };
  });
});

function selectLunarMonth(month: number, leap: boolean) {
  viewLunarMonth.value = month;
  viewLunarLeap.value = leap;
}

const lunarDayCount = computed(() => {
  const m = findLunarMonth(viewYear.value, viewLunarMonth.value, viewLunarLeap.value);
  return m ? m.getDayCount() : 30;
});

// 农历月初一的小 星期几 偏移（从公历周日历对齐，方便展示）
const leadingLunarBlanks = computed(() => {
  const m = findLunarMonth(viewYear.value, viewLunarMonth.value, viewLunarLeap.value);
  if (!m) return 0;
  try {
    const solar = Solar.fromJulianDay(m.getFirstJulianDay());
    return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay()).getDay();
  } catch {
    return 0;
  }
});

function lunarDayChinese(d: number): string {
  return LunarUtil.DAY[d] || `${d}`;
}

function lunarDaySolar(month: number, leap: boolean, d: number): string {
  const m = findLunarMonth(viewYear.value, month, leap);
  if (!m) return "";
  try {
    const solar = Solar.fromJulianDay(m.getFirstJulianDay() + (d - 1));
    return `${pad(solar.getMonth())}-${pad(solar.getDay())}`;
  } catch {
    return "";
  }
}

function pickLunarDay(d: number) {
  emit("update:lunarMonth", viewLunarMonth.value);
  emit("update:lunarDay", d);
  emit("update:isLeapMonth", viewLunarLeap.value);
  open.value = false;
}

// ---------- 显示文本 ----------
const displayText = computed(() => {
  if (props.dateType === "SOLAR") {
    if (!props.solarDate) return "";
    const [y, m, d] = props.solarDate.split("-").map(Number);
    let lunarText = "";
    try {
      const lunar = Solar.fromYmdHms(y, m, d, 0, 0, 0).getLunar();
      lunarText = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
    } catch {
      lunarText = "";
    }
    return `${props.solarDate}${lunarText ? `（农历${lunarText}）` : ""}`;
  }
  const month = props.lunarMonth || 1;
  const day = props.lunarDay || 1;
  const leap = !!props.isLeapMonth;
  const text = `${leap ? "闰" : ""}${LunarUtil.MONTH[month] || month}月${LunarUtil.DAY[day] || day}`;
  // 今年对应阳历
  let solar = "";
  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    const m = findLunarMonth(year, month, leap);
    if (!m) continue;
    try {
      const s = Solar.fromJulianDay(m.getFirstJulianDay() + (day - 1));
      solar = `${s.getYear()}-${pad(s.getMonth())}-${pad(s.getDay())}`;
      break;
    } catch {
      continue;
    }
  }
  return `${text}（${solar || "—"}）`;
});

// ---------- 弹层开关 ----------
function computePopupPos() {
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const width = 300;
  let top = rect.bottom + 6;
  let left = rect.left;
  if (top + POPUP_HEIGHT > window.innerHeight) {
    // 下方空间不足，向上翻
    top = Math.max(8, rect.top - POPUP_HEIGHT - 6);
  }
  if (left + width > window.innerWidth) {
    left = Math.max(8, window.innerWidth - width - 8);
  }
  popupPos.value = { top, left };
}

function toggle() {
  // 打开时与当前选择同步
  viewYear.value = now.getFullYear();
  viewMonth.value = now.getMonth() + 1;
  viewLunarMonth.value = props.lunarMonth || 1;
  viewLunarLeap.value = !!props.isLeapMonth;
  if (!open.value) {
    computePopupPos();
  }
  open.value = !open.value;
  if (open.value) {
    window.addEventListener("scroll", close, { capture: true, once: false });
  } else {
    window.removeEventListener("scroll", close, { capture: true });
  }
}

function close() {
  open.value = false;
  window.removeEventListener("scroll", close, { capture: true });
}

function onDocClick(e: MouseEvent) {
  const target = e.target as Node;
  if (rootRef.value?.contains(target) || popupRef.value?.contains(target)) {
    return;
  }
  close();
}

onMounted(() => document.addEventListener("click", onDocClick));
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  window.removeEventListener("scroll", close, { capture: true });
});
</script>

<style scoped>
.sun-lunar-picker {
  position: relative;
  display: inline-block;
  width: 100%;
}

.picker-field {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  color: #1f2937;
  cursor: pointer;
}

.picker-field:hover {
  border-color: #9ca3af;
}

.picker-field .placeholder {
  color: #9ca3af;
}

.caret {
  font-size: 12px;
  color: #6b7280;
  transition: transform 0.15s;
}

.caret.open {
  transform: rotate(180deg);
}

.picker-popup {
  position: fixed;
  z-index: 3000;
  width: 300px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 10px;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.nav-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #4b5563;
  font-size: 16px;
  border-radius: 6px;
  cursor: pointer;
}

.nav-btn:hover {
  background: #f3f4f6;
}

.week-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}

.week-cell {
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
  padding: 3px 0;
}

.lunar-months {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
  max-height: 72px;
  overflow-y: auto;
}

.month-btn {
  flex: 0 0 auto;
  padding: 3px 8px;
  font-size: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #4b5563;
  border-radius: 6px;
  cursor: pointer;
}

.month-btn:hover {
  border-color: #4f7cff;
  color: #4f7cff;
}

.month-btn.active {
  background: #4f7cff;
  border-color: #4f7cff;
  color: #fff;
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  height: 44px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
}

.day-cell:hover {
  background: #eff6ff;
}

.day-cell.blank {
  cursor: default;
}

.day-cell.today .day-num {
  color: #4f7cff;
  font-weight: 700;
}

.day-cell.selected {
  background: #4f7cff;
}

.day-cell.selected .day-num,
.day-cell.selected .day-lunar {
  color: #fff !important;
}

.day-num {
  font-size: 13px;
  color: #1f2937;
  line-height: 1.2;
}

.day-cell.blank .day-num,
.day-lunar {
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.2;
}
</style>
