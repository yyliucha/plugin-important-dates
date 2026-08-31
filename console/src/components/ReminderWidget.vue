<template>
  <WidgetCard :body-class="['!p-0']">
    <template #title>
      <div class="inline-flex items-center gap-2">
        <div class="text-base font-medium flex-1">📅 重要日期提醒</div>
      </div>
    </template>
    <div class="p-4">
      <div v-if="loading" class="text-gray-500 text-sm">提醒加载中…</div>
      <div v-else-if="reminders.length" class="space-y-2">
        <div
          v-for="r in reminders"
          :key="`${r.title}-${r.dateText}`"
          class="flex items-start justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2"
        >
          <div class="min-w-0">
            <div class="font-medium text-orange-800">{{ r.title }}</div>
            <div class="text-xs text-orange-600">
              {{ r.dateText }}
              <span v-if="r.nextSolarDate && r.nextSolarDate !== r.dateText">（{{ r.nextSolarDate }}）</span>
            </div>
          </div>
          <span class="whitespace-nowrap text-sm font-bold text-red-600">{{ daysLabel(r.daysUntil) }}</span>
        </div>
        <div class="text-xs text-gray-500">
          来自「重要日期」插件；提前天数与开关可在 插件 → 重要日期 → 设置 中调整
        </div>
      </div>
      <div v-else>
        <div class="text-gray-500">最近没有重要日期提醒</div>
        <a class="text-sm text-blue-600 hover:text-blue-700" href="/console/important-dates">去管理重要日期 →</a>
      </div>
    </div>
  </WidgetCard>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

defineProps<{
  editMode?: boolean;
  previewMode?: boolean;
  config?: Record<string, unknown>;
}>();

interface ReminderItem {
  title: string;
  daysUntil: number;
  dateText: string;
  nextSolarDate?: string;
}

const loading = ref(true);
const reminders = ref<ReminderItem[]>([]);
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    const res = await fetch("/important-dates-reminders");
    const data = await res.json();
    reminders.value = (data.reminders || []) as ReminderItem[];
  } catch {
    // 接口异常时保持现状
  } finally {
    loading.value = false;
  }
}

function daysLabel(days: number): string {
  const n = Number(days);
  if (n <= 0) return "今天 🎉";
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
