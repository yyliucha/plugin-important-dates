<template>
  <VPageHeader title="重要日期">
    <template #actions>
      <VButton type="secondary" @click="openCreate">
        <span style="margin-right: 4px">＋</span>新增
      </VButton>
    </template>
  </VPageHeader>

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
          <select v-model="form.dateType" class="input">
            <option value="SOLAR">阳历</option>
            <option value="LUNAR">农历</option>
          </select>
        </label>

        <label v-if="form.dateType === 'SOLAR'" class="field">
          <span class="label">阳历日期 *</span>
          <input v-model="form.solarDate" type="date" class="input" />
        </label>

        <div v-else class="field">
          <span class="label">农历日期 *</span>
          <div class="lunar-row">
            <select v-model.number="form.lunarMonth" class="input">
              <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
            </select>
            <select v-model.number="form.lunarDay" class="input">
              <option v-for="d in 30" :key="d" :value="d">{{ d }}日</option>
            </select>
            <label class="leap">
              <input v-model="form.isLeapMonth" type="checkbox" />
              闰月
            </label>
          </div>
          <div class="hint">
            当前记录：{{ lunarText(form.lunarMonth, form.lunarDay, !!form.isLeapMonth) }}
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
  updateImportantDate,
} from "@/api";
import type { DateType, ImportantDate } from "@/types";
import { lunarMonthDayText, nextSolarDate } from "@/utils/lunar";

const loading = ref(true);
const saving = ref(false);
const dates = ref<ImportantDate[]>([]);

const modalVisible = ref(false);
const editingName = ref<string | null>(null);

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
  // 阳历每年同日循环，展示包含年份的完整日期
  return `${currentYear.value}-${solarDate.slice(5)}`;
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
        name: editingName.value || `important-date-${Date.now()}`,
        ...(editingName.value
          ? {
              // 保留原元数据（版本号、创建时间等）
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
      await updateImportantDate(payload);
      Toast.success("已保存");
    } else {
      await createImportantDate(payload);
      Toast.success("已新增");
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
        await load();
      } catch (error) {
        Toast.error(`删除失败：${(error as Error)?.message || "未知错误"}`);
      }
    },
  });
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

.lunar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lunar-row .input {
  width: 110px;
}

.leap {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.hint {
  font-size: 13px;
  color: #9ca3af;
}
</style>
