<template>
  <VPageHeader title="重要日期">
    <template #actions>
      <VButton @click="openLogs">操作日志</VButton>
      <VButton @click="exportData">导出</VButton>
      <VButton @click="triggerImport">导入</VButton>
      <VButton type="secondary" @click="openCreate">
        <span style="margin-right: 4px">＋</span>新增
      </VButton>
    </template>
  </VPageHeader>

  <input ref="fileInputRef" type="file" accept=".json,application/json" style="display: none" @change="onImportFile" />

  <div class="page-content">
    <VLoading v-if="loading" />
    <template v-else>
      <div v-if="!dates.length" style="padding: 80px 0">
        <VEmpty
          title="还没有重要日期"
          message="记录结婚纪念日、孩子的出生日期等重要日子，支持阳历/农历，每年自动循环。"
        >
          <template #actions>
            <VButton type="secondary" @click="openCreate">新增第一条</VButton>
          </template>
        </VEmpty>
      </div>

      <VCard v-else>
        <table class="dates-table">
          <thead>
            <tr>
              <th style="width: 18%">名称</th>
              <th style="width: 10%">类型</th>
              <th style="width: 20%">日期</th>
              <th style="width: 22%">最近一次</th>
              <th>备注</th>
              <th style="width: 110px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in dates" :key="item.metadata.name">
              <td>
                <div class="title">{{ item.spec.title }}</div>
              </td>
              <td>
                <VTag :theme="item.spec.dateType === 'SOLAR' ? 'primary' : 'secondary'">
                  {{ item.spec.dateType === "SOLAR" ? "阳历" : "农历" }}
                </VTag>
              </td>
              <td>
                <template v-if="item.spec.dateType === 'SOLAR'">{{ item.spec.solarDate }}</template>
                <template v-else>
                  {{
                    lunarText(item.spec.lunarMonth || 1, item.spec.lunarDay || 1, !!item.spec.isLeapMonth)
                  }}
                </template>
              </td>
              <td>
                <template v-if="item.spec.dateType === 'SOLAR'">
                  {{ yearlySolar(item.spec.solarDate) }}
                </template>
                <template v-else>
                  <template v-if="nextSolar(item.spec)">{{ nextSolar(item.spec)?.solarDate }}</template>
                  <template v-else>—</template>
                </template>
              </td>
              <td>
                <span class="note">{{ item.spec.note || "—" }}</span>
              </td>
              <td>
                <VSpace>
                  <VButton size="sm" @click="openEdit(item)">编辑</VButton>
                  <VButton size="sm" type="danger" @click="remove(item)">删除</VButton>
                </VSpace>
              </td>
            </tr>
          </tbody>
        </table>
      </VCard>
    </template>

    <div class="storage-note">
      数据存储于 Halo 扩展存储（与站点数据库一致：H2 / MySQL / PostgreSQL）；操作日志会记录每一次新增、编辑与删除。
    </div>

    <VModal
      :visible="modalVisible"
      :title="editingName ? '编辑重要日期' : '新增重要日期'"
      width="520"
      @close="closeModal"
    >
      <div class="form">
        <label class="field">
          <span class="label">名称 *</span>
          <input v-model="form.title" class="input" placeholder="例如：结婚纪念日 / 孩子出生日期" />
        </label>

        <label class="field">
          <span class="label">日期类型</span>
          <select v-model="form.dateType" class="input" @change="resetDateFields">
            <option value="SOLAR">阳历</option>
            <option value="LUNAR">农历</option>
          </select>
        </label>

        <div class="field">
          <span class="label">{{ form.dateType === "SOLAR" ? "日期 *" : "农历日期 *" }}</span>
          <SunLunarPicker
            :date-type="form.dateType"
            :solar-date="form.solarDate"
            :lunar-month="form.lunarMonth"
            :lunar-day="form.lunarDay"
            :is-leap-month="form.isLeapMonth"
            @update:solar-date="(v: string) => (form.solarDate = v)"
            @update:lunar-month="(v: number) => (form.lunarMonth = v)"
            @update:lunar-day="(v: number) => (form.lunarDay = v)"
            @update:is-leap-month="(v: boolean) => (form.isLeapMonth = v)"
          />
          <div class="hint">
            阳历：日历网格中选择，网格中标注农历；农历：选择年、月（含闰月）与日。
          </div>
        </div>

        <label class="field">
          <span class="label">备注</span>
          <textarea
            v-model="form.note"
            class="input textarea"
            rows="4"
            placeholder="记录一些细节，例如：结婚 10 周年纪念、宝宝出生时间 8:32 等"
          ></textarea>
        </label>
      </div>

      <template #footer>
        <VSpace>
          <VButton @click="closeModal">取消</VButton>
          <VButton type="secondary" :loading="saving" @click="save">保存</VButton>
        </VSpace>
      </template>
    </VModal>

    <!-- 操作日志 -->
    <VModal :visible="logVisible" title="操作日志" width="760" @close="logVisible = false">
      <VLoading v-if="logLoading" />
      <div v-else-if="!logs.length" style="padding: 40px 0">
        <VEmpty title="暂无操作日志" message="新增、编辑、删除重要日期后，这里会记录明细。" />
      </div>
      <table v-else class="dates-table">
        <thead>
          <tr>
            <th style="width: 24%">时间</th>
            <th style="width: 12%">操作</th>
            <th style="width: 18%">目标</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.metadata.name">
            <td>{{ formatTime(log.metadata.creationTimestamp) }}</td>
            <td>
              <VTag :theme="logTheme(log.spec.action)">{{ logActionText(log.spec.action) }}</VTag>
            </td>
            <td>{{ log.spec.targetTitle || "—" }}</td>
            <td><span class="note">{{ log.spec.detail || "—" }}</span></td>
          </tr>
        </tbody>
      </table>
    </VModal>

    <!-- 导入 -->
    <VModal :visible="importModalVisible" title="导入重要日期" width="520" @close="closeImportModal">
      <div v-if="!importResult" class="form">
        <div class="import-row">
          <span class="label">文件</span>
          <span class="hint">{{ importFileName }}</span>
        </div>
        <div class="import-row">
          <span class="label">校验结果</span>
          <span class="hint">
            可导入 <b>{{ importValidCount }}</b> 条；已存在将跳过 <b>{{ importDuplicateCount }}</b> 条；
            格式无效 <b>{{ importInvalidCount }}</b> 条。
          </span>
        </div>
        <div class="hint">导入不会覆盖已有数据（按记录标识判重，已存在的自动跳过）。</div>
      </div>
      <div v-else class="form">
        <div class="import-row">
          <span class="label">导入结果</span>
          <span class="hint">
            成功新增 <b>{{ importResult.imported }}</b> 条；跳过重复 <b>{{ importResult.skipped }}</b> 条；
            失败 <b>{{ importResult.failed }}</b> 条。
          </span>
        </div>
      </div>
      <template #footer>
        <VSpace>
          <VButton @click="closeImportModal">取消</VButton>
          <VButton
            v-if="!importResult"
            type="secondary"
            :loading="importing"
            :disabled="!importValidCount"
            @click="doImport"
          >
            开始导入
          </VButton>
          <VButton v-else type="secondary" @click="closeImportModal">完成</VButton>
        </VSpace>
      </template>
    </VModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  Dialog,
  Toast,
  VButton,
  VCard,
  VEmpty,
  VLoading,
  VModal,
  VPageHeader,
  VSpace,
  VTag,
} from "@halo-dev/components";
import {
  createImportantDate,
  deleteImportantDate,
  listImportantDates,
  listOperationLogs,
  updateImportantDate,
  writeOperationLog,
} from "@/api";
import SunLunarPicker from "@/components/SunLunarPicker.vue";
import type { DateType, ImportantDate, LogAction, OperationLog } from "@/types";
import { lunarMonthDayText, nextSolarDate } from "@/utils/lunar";

const loading = ref(true);
const saving = ref(false);
const dates = ref<ImportantDate[]>([]);

const modalVisible = ref(false);
const editingName = ref<string | null>(null);

const logVisible = ref(false);
const logLoading = ref(false);
const logs = ref<OperationLog[]>([]);

const fileInputRef = ref<HTMLInputElement | null>(null);
const importModalVisible = ref(false);
const importing = ref(false);
const importFileName = ref("");
const importValidCount = ref(0);
const importDuplicateCount = ref(0);
const importInvalidCount = ref(0);
const importItems = ref<Array<{ name: string; spec: ImportantDate["spec"] }>>([]);
const importResult = ref<{ imported: number; skipped: number; failed: number } | null>(null);

interface DateForm {
  title: string;
  dateType: DateType;
  solarDate: string;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  note: string;
}

const emptyForm = (): DateForm => ({
  title: "",
  dateType: "SOLAR",
  solarDate: "",
  lunarMonth: 1,
  lunarDay: 1,
  isLeapMonth: false,
  note: "",
});

const form = reactive<DateForm>(emptyForm());

async function load() {
  loading.value = true;
  try {
    dates.value = await listImportantDates();
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function resetDateFields() {
  form.solarDate = "";
  form.lunarMonth = 1;
  form.lunarDay = 1;
  form.isLeapMonth = false;
}

function openCreate() {
  Object.assign(form, emptyForm());
  editingName.value = null;
  modalVisible.value = true;
}

function openEdit(item: ImportantDate) {
  const spec = item.spec;
  Object.assign(form, {
    title: spec.title || "",
    dateType: spec.dateType || "SOLAR",
    solarDate: spec.solarDate || "",
    lunarMonth: spec.lunarMonth || 1,
    lunarDay: spec.lunarDay || 1,
    isLeapMonth: !!spec.isLeapMonth,
    note: spec.note || "",
  });
  editingName.value = item.metadata.name;
  modalVisible.value = true;
}

function closeModal() {
  modalVisible.value = false;
}

function lunarText(month: number, day: number, isLeap: boolean) {
  return lunarMonthDayText(month, day, isLeap);
}

function dateText(spec: ImportantDate["spec"]): string {
  if (spec.dateType === "SOLAR") {
    return spec.solarDate || "—";
  }
  return lunarMonthDayText(spec.lunarMonth || 1, spec.lunarDay || 1, !!spec.isLeapMonth);
}

function nextSolar(spec: ImportantDate["spec"]) {
  if (!spec.lunarMonth || !spec.lunarDay) {
    return null;
  }
  const result = nextSolarDate(spec.lunarMonth, spec.lunarDay, !!spec.isLeapMonth);
  if (!result) {
    return null;
  }
  return { ...result, text: lunarMonthDayText(spec.lunarMonth, spec.lunarDay, !!spec.isLeapMonth) };
}

const currentYear = computed(() => new Date().getFullYear());

function yearlySolar(solarDate?: string) {
  if (!solarDate) {
    return "—";
  }
  return `${currentYear.value}-${solarDate.slice(5)}`;
}

// ---------- 操作日志 ----------
async function appendLog(action: LogAction, targetTitle: string, targetName: string, detail: string) {
  try {
    await writeOperationLog(action, targetTitle, targetName, detail);
  } catch {
    // 日志写入失败不影响主流程
  }
}

function summaryOf(spec: ImportantDate["spec"]): string {
  return `日期：${dateText(spec)}；备注：${spec.note?.trim() ? spec.note.trim() : "无"}`;
}

function diffOf(oldSpec: ImportantDate["spec"], newSpec: ImportantDate["spec"]): string {
  const parts: string[] = [];
  if (oldSpec.title !== newSpec.title) {
    parts.push(`名称：${oldSpec.title} → ${newSpec.title}`);
  }
  if (oldSpec.dateType !== newSpec.dateType) {
    parts.push(`类型：${oldSpec.dateType === "SOLAR" ? "阳历" : "农历"} → ${newSpec.dateType === "SOLAR" ? "阳历" : "农历"}`);
  }
  if (dateText(oldSpec) !== dateText(newSpec)) {
    parts.push(`日期：${dateText(oldSpec)} → ${dateText(newSpec)}`);
  }
  if ((oldSpec.note || "") !== (newSpec.note || "")) {
    parts.push(`备注：${oldSpec.note?.trim() || "无"} → ${newSpec.note?.trim() || "无"}`);
  }
  if (!parts.length) {
    return "无内容变化";
  }
  return parts.join("；");
}

// ---------- 导出 / 导入 ----------
function exportData() {
  const items = dates.value.map((d) => ({ name: d.metadata.name, spec: d.spec }));
  const payload = {
    app: "plugin-important-dates",
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `important-dates-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Toast.success(`已导出 ${items.length} 条记录`);
}

function triggerImport() {
  importResult.value = null;
  fileInputRef.value?.click();
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  importFileName.value = file.name;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawItems = Array.isArray(parsed) ? parsed : parsed?.items;
    if (!Array.isArray(rawItems)) {
      throw new Error("items 不是数组");
    }
    const existing = new Set(dates.value.map((d) => d.metadata.name));
    const seen = new Set<string>();
    let valid = 0;
    let dup = 0;
    let invalid = 0;
    const list: Array<{ name: string; spec: ImportantDate["spec"] }> = [];
    for (const it of rawItems) {
      const spec = it?.spec;
      if (!spec || typeof spec.title !== "string" || !spec.title.trim()) {
        invalid++;
        continue;
      }
      if (spec.dateType === "LUNAR") {
        const m = spec.lunarMonth;
        const d = spec.lunarDay;
        if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1 || d > 30) {
          invalid++;
          continue;
        }
      } else if (spec.dateType === "SOLAR") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(spec.solarDate || "")) {
          invalid++;
          continue;
        }
      } else {
        invalid++;
        continue;
      }
      const name =
        typeof it.name === "string" && it.name
          ? it.name
          : `important-date-import-${Date.now()}-${valid}`;
      if (existing.has(name) || seen.has(name)) {
        dup++;
        continue;
      }
      seen.add(name);
      list.push({ name, spec: { ...spec } });
      valid++;
    }
    importItems.value = list;
    importValidCount.value = valid;
    importDuplicateCount.value = dup;
    importInvalidCount.value = invalid;
    importModalVisible.value = true;
    if (!valid) {
      Toast.warning("文件中没有可导入的记录");
    }
  } catch {
    Toast.error("导入失败：不是有效的导出文件（JSON）");
  } finally {
    input.value = "";
  }
}

async function doImport() {
  importing.value = true;
  let imported = 0;
  let failed = 0;
  try {
    for (const item of importItems.value) {
      try {
        const created = await createImportantDate({
          apiVersion: "importantdates.halo.run/v1alpha1",
          kind: "ImportantDate",
          metadata: { name: item.name },
          spec: item.spec,
        });
        imported++;
        await appendLog("CREATE", created.spec.title, created.metadata.name, `导入：${summaryOf(created.spec)}`);
      } catch {
        failed++;
      }
    }
  } finally {
    importing.value = false;
    importResult.value = {
      imported,
      skipped: importDuplicateCount.value,
      failed,
    };
    if (imported > 0) {
      await load();
    }
    Toast.success(`导入完成：新增 ${imported} 条`);
  }
}

function closeImportModal() {
  importModalVisible.value = false;
  importResult.value = null;
  importItems.value = [];
}

async function save() {
  if (!form.title.trim()) {
    Toast.warning("请填写名称");
    return;
  }
  if (form.dateType === "SOLAR" && !form.solarDate) {
    Toast.warning("请选择阳历日期");
    return;
  }

  saving.value = true;
  try {
    const payload: ImportantDate = {
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "ImportantDate",
      metadata: {
        name: editingName.value || `important-date-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...(editingName.value
          ? {
              ...(dates.value.find((d) => d.metadata.name === editingName.value)?.metadata || {}),
            }
          : {}),
      },
      spec: {
        title: form.title.trim(),
        dateType: form.dateType,
        solarDate: form.dateType === "SOLAR" ? form.solarDate : undefined,
        lunarMonth: form.dateType === "LUNAR" ? form.lunarMonth : undefined,
        lunarDay: form.dateType === "LUNAR" ? form.lunarDay : undefined,
        isLeapMonth: form.dateType === "LUNAR" ? form.isLeapMonth : false,
        note: form.note.trim() || undefined,
      },
    };

    if (editingName.value) {
      const oldItem = dates.value.find((d) => d.metadata.name === editingName.value);
      await updateImportantDate(payload);
      Toast.success("已保存");
      await appendLog(
        "UPDATE",
        payload.spec.title,
        payload.metadata.name,
        diffOf(oldItem?.spec || ({} as ImportantDate["spec"]), payload.spec)
      );
    } else {
      await createImportantDate(payload);
      Toast.success("已新增");
      await appendLog("CREATE", payload.spec.title, payload.metadata.name, summaryOf(payload.spec));
    }
    closeModal();
    await load();
  } catch (error) {
    Toast.error(`保存失败：${(error as Error)?.message || "未知错误"}`);
  } finally {
    saving.value = false;
  }
}

function remove(item: ImportantDate) {
  Dialog.warning({
    title: "删除确认",
    description: `确定要删除「${item.spec.title}」吗？删除后不可恢复。`,
    confirmText: "删除",
    cancelText: "取消",
    onConfirm: async () => {
      try {
        await deleteImportantDate(item.metadata.name);
        Toast.success("已删除");
        await appendLog("DELETE", item.spec.title, item.metadata.name, summaryOf(item.spec));
        await load();
      } catch (error) {
        Toast.error(`删除失败：${(error as Error)?.message || "未知错误"}`);
      }
    },
  });
}

async function openLogs() {
  logVisible.value = true;
  logLoading.value = true;
  try {
    logs.value = await listOperationLogs();
  } finally {
    logLoading.value = false;
  }
}

function logTheme(action: LogAction): "primary" | "secondary" | "danger" {
  return action === "CREATE" ? "primary" : action === "UPDATE" ? "secondary" : "danger";
}

function logActionText(action: LogAction): string {
  return action === "CREATE" ? "新增" : action === "UPDATE" ? "编辑" : "删除";
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}
</script>

<style scoped>
.page-content {
  padding: 12px 16px;
}

.dates-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.dates-table th,
.dates-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}

.dates-table th {
  color: #6b7280;
  font-weight: 500;
  background: #f9fafb;
}

.title {
  font-weight: 600;
  color: #1f2937;
}

.note {
  color: #4b5563;
  white-space: pre-wrap;
  word-break: break-word;
}

.storage-note {
  margin-top: 14px;
  font-size: 12px;
  color: #9ca3af;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  color: #374151;
}

.input {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
}

.textarea {
  resize: vertical;
  font-family: inherit;
}

.hint {
  font-size: 13px;
  color: #9ca3af;
}

.import-row {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.import-row .label {
  flex: 0 0 56px;
}

.import-row .hint {
  word-break: break-all;
}
</style>
