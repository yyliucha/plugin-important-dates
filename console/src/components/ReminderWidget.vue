<template>
  <WidgetCard :body-class="['!p-0']">
    <template #title>
      <div class="inline-flex items-center gap-2">
        <div class="text-base font-medium flex-1">📅 记得 · 到期提醒</div>
      </div>
    </template>
    <div class="p-4">
      <div v-if="loading" class="text-gray-500 text-sm">提醒加载中…</div>
      <div v-else-if="visibleItems.length" class="space-y-2">
        <div
          v-for="r in pagedReminders"
          :key="itemKey(r)"
          class="flex items-start justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2"
        >
          <div class="min-w-0">
            <div class="font-medium text-orange-800">{{ r.title }}</div>
            <div class="text-xs text-orange-600">
              {{ r.dateText }}
              <span v-if="r.nextSolarDate && r.nextSolarDate !== r.dateText">（{{ r.nextSolarDate }}）</span>
            </div>
          </div>
          <div class="flex flex-none items-center gap-2">
            <span class="whitespace-nowrap text-sm font-bold text-red-600">{{ daysLabel(r.daysUntil) }}</span>
            <button
              v-if="allowDismiss"
              type="button"
              class="dismiss-btn"
              title="本次到期周期内不再提示（记录在本浏览器）"
              @click="dismiss(r)"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- 底部：完整条数 + 小分页（数据一次拉全，翻页只切本地状态，不重新请求） -->
        <div class="pager">
          <template v-if="paginationEnabled">
            <button
              type="button"
              class="pager-btn"
              :disabled="page <= 1"
              :title="totalPages > 1 ? '上一页' : '已是第一页'"
              @click="changePage(page - 1)"
            >
              ‹
            </button>
            <span class="pager-text">{{ page }} / {{ totalPages }}</span>
            <button
              type="button"
              class="pager-btn"
              :disabled="page >= totalPages"
              :title="totalPages > 1 ? '下一页' : '只有一页'"
              @click="changePage(page + 1)"
            >
              ›
            </button>
          </template>
          <span class="pager-total">
            共 {{ visibleItems.length }} 条<template v-if="paginationEnabled"> · 每页 {{ pageSize }} 条</template>
          </span>
        </div>

        <div v-if="dismissedCount" class="text-xs text-gray-400">
          已忽略 {{ dismissedCount }} 条（本浏览器）
          <button type="button" class="link-btn" @click="restoreDismissed">恢复显示</button>
        </div>

        <div class="text-xs text-gray-500">
          来自「记得」插件；提前天数与开关可在 插件 → 记得 → 设置 中调整
        </div>
      </div>
      <div v-else-if="items.length">
        <div class="text-gray-500">提醒都已忽略（本浏览器）</div>
        <button type="button" class="link-btn" @click="restoreDismissed">恢复显示</button>
      </div>
      <div v-else>
        <div class="text-gray-500">最近没有重要日期提醒</div>
        <a class="text-sm text-blue-600 hover:text-blue-700" href="/console/important-dates">去管理记得 →</a>
      </div>
    </div>
  </WidgetCard>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

defineProps<{
  editMode?: boolean;
  previewMode?: boolean;
  config?: Record<string, unknown>;
}>();

interface ReminderItem {
  type?: string;
  title: string;
  daysUntil: number;
  dateText: string;
  nextSolarDate?: string;
}

const loading = ref(true);
/** 完整提醒（与前台同一口径，不受"每类最多 N 条"降噪限制） */
const items = ref<ReminderItem[]>([]);
/** 每页条数（插件设置 dashboardPageSize，默认 5） */
const pageSize = ref(5);
/** 是否显示分页（插件设置 dashboardPagination，默认开） */
const paginationEnabled = ref(true);
/** 是否允许逐条忽略（插件设置 allowDismiss，默认开） */
const allowDismiss = ref(true);
const page = ref(1);
let timer: ReturnType<typeof setInterval> | null = null;

// 逐条忽略：状态存在本浏览器（到期日变化后 key 变化 → 自动重新提醒）
const DISMISS_KEY = "important-dates:hidden-reminders";
const dismissed = ref<Record<string, number>>(readDismissed());

function readDismissed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function itemKey(r: ReminderItem): string {
  return `${r.type || ""}|${r.title}|${r.nextSolarDate || r.dateText || ""}`;
}

function dismiss(r: ReminderItem) {
  dismissed.value = { ...dismissed.value, [itemKey(r)]: 1 };
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed.value));
  } catch {
    // 隐私模式下忽略
  }
}

function restoreDismissed() {
  dismissed.value = {};
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore
  }
}

const visibleItems = computed(() => items.value.filter((r) => !dismissed.value[itemKey(r)]));
const dismissedCount = computed(() => items.value.length - visibleItems.value.length);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(visibleItems.value.length / Math.max(1, pageSize.value)))
);

const pagedReminders = computed(() => {
  const size = Math.max(1, pageSize.value);
  if (!paginationEnabled.value) {
    return visibleItems.value.slice(0, size);
  }
  const start = (page.value - 1) * size;
  return visibleItems.value.slice(start, start + size);
});

// 数据变化（到期项被删/新增、设置调整）导致当前页越界时回退到最后一页
watch(totalPages, (n) => {
  if (page.value > n) page.value = n;
  if (page.value < 1) page.value = 1;
});

function changePage(target: number) {
  if (target < 1 || target > totalPages.value) return;
  page.value = target;
}

async function load() {
  try {
    const res = await fetch("/important-dates-reminders");
    const data = await res.json();
    // allReminders = 完整列表；旧版本接口没有该字段时退回 reminders
    items.value = (data.allReminders || data.reminders || []) as ReminderItem[];
    const size = Number(data.dashboardPageSize);
    pageSize.value = Number.isFinite(size) && size > 0 ? size : 5;
    paginationEnabled.value = data.dashboardPagination !== false;
    allowDismiss.value = data.allowDismiss !== false;
    if (page.value > totalPages.value) {
      page.value = totalPages.value;
    }
  } catch {
    // 接口异常时保持现状
  } finally {
    loading.value = false;
  }
}

function daysLabel(days: number): string {
  const n = Number(days);
  if (n < 0) return `已过期 ${-n} 天`;
  if (n === 0) return "今天 🎉";
  if (n === 1) return "明天";
  return `${n} 天后`;
}

onMounted(() => {
  load();
  // 每 60 秒自动刷新，保证提醒始终是最新的
  timer = setInterval(load, 60000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

.pager-btn {
  min-width: 24px;
  height: 24px;
  line-height: 1;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
}

.pager-btn:hover:not(:disabled) {
  border-color: #4f7cff;
  color: #4f7cff;
}

.pager-btn:disabled {
  color: #d1d5db;
  cursor: not-allowed;
  background: #fafafa;
}

.pager-text {
  font-size: 12px;
  color: #6b7280;
}

.pager-total {
  font-size: 12px;
  color: #9ca3af;
}

.dismiss-btn {
  border: 0;
  background: transparent;
  color: #f59e0b;
  opacity: 0.55;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 2px 3px;
}

.dismiss-btn:hover {
  opacity: 1;
}

.link-btn {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
  text-decoration: underline;
}</style>
