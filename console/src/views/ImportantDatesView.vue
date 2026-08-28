<template>
  <VPageHeader title="重要日期">
    <template #actions>
      <VButton @click="openLogs">操作日志</VButton>
      <VButton @click="exportData">导出</VButton>
      <VButton @click="triggerImport">导入</VButton>
      <VButton type="secondary" @click="openCreate">
        <span style="margin-right: 4px">＋</span>{{ activeTab === "dates" ? "新增日期" : "新增人员" }}
      </VButton>
    </template>
  </VPageHeader>

  <input ref="fileInputRef" type="file" accept=".json,application/json" style="display: none" @change="onImportFile" />

  <div class="page-content">
    <!-- 页签 -->
    <div class="tabs">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'dates' }"
        @click="activeTab = 'dates'"
      >
        重要日期（{{ dates.length }}）
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'persons' }"
        @click="activeTab = 'persons'"
      >
        人员（{{ persons.length }}）
      </button>
    </div>

    <VLoading v-if="loading" />

    <!-- ================= 重要日期 ================= -->
    <template v-if="activeTab === 'dates' && !loading">
      <div v-if="!dates.length" style="padding: 60px 0">
        <VEmpty
          title="还没有重要日期"
          message="记录结婚纪念日、孩子的出生日期等重要日子，支持阳历/农历，每年自动循环。"
        >
          <template #actions>
            <VButton type="secondary" @click="openCreate">新增第一条</VButton>
          </template>
        </VEmpty>
      </div>

      <div v-else>
        <div class="filter-bar">
          <label class="filter-label">按人员筛选：</label>
          <select v-model="personFilter" class="input filter-select">
            <option value="">全部人员</option>
            <option v-for="p in persons" :key="p.metadata.name" :value="p.metadata.name">
              {{ personTitle(p) }}
            </option>
          </select>
          <span v-if="personFilter" class="filter-count">
            {{ filteredDates.length }} / {{ dates.length }} 条
          </span>
        </div>
        <VCard>
          <table class="dates-table">
            <thead>
              <tr>
                <th style="width: 16%">名称</th>
                <th style="width: 9%">类型</th>
                <th style="width: 17%">日期</th>
                <th style="width: 18%">最近一次</th>
                <th style="width: 14%">关联人</th>
                <th>备注</th>
                <th style="width: 110px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredDates" :key="item.metadata.name">
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
                    {{ lunarText(item.spec.lunarMonth || 1, item.spec.lunarDay || 1, !!item.spec.isLeapMonth) }}
                  </template>
                </td>
                <td>
                  <template v-if="item.spec.dateType === 'SOLAR'">
                    {{ yearlySolar(item.spec.solarDate) }}
                  </template>
                  <template v-else>
                    {{ nextSolar(item.spec)?.solarDate || "—" }}
                  </template>
                </td>
                <td>
                  <template v-if="item.spec.personNames?.length">
                    <VTag v-for="n in item.spec.personNames" :key="n" theme="default" class="person-tag">
                      {{ personTitleBy(n) }}
                    </VTag>
                  </template>
                  <span v-else>—</span>
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
      </div>
    </template>

    <!-- ================= 人员 ================= -->
    <template v-if="activeTab === 'persons' && !loading">
      <div v-if="!persons.length" style="padding: 60px 0">
        <VEmpty
          title="还没有人员"
          message="把张三、李四等家人朋友加进来，记录他们的生日、喜好、体重等信息，重要日期可以关联到人。"
        >
          <template #actions>
            <VButton type="secondary" @click="openPersonCreate">新增人员</VButton>
          </template>
        </VEmpty>
      </div>
      <div v-else class="persons-grid">
        <VCard v-for="p in persons" :key="p.metadata.name" class="person-card">
          <div class="person-head">
            <div class="person-name">{{ p.spec.displayName }}</div>
            <VSpace>
              <VTag v-if="p.spec.relation" theme="secondary">{{ p.spec.relation }}</VTag>
              <VTag v-if="p.spec.gender" theme="default">{{ p.spec.gender }}</VTag>
            </VSpace>
          </div>
          <div v-if="p.spec.nickname" class="person-line">昵称：{{ p.spec.nickname }}</div>
          <div class="person-line">
            生日：{{ personBirthdayText(p) }}
            <template v-if="personBirthdaySolar(p)">（最近一次 {{ personBirthdaySolar(p) }}）</template>
          </div>
          <div class="person-line">
            体重：{{ p.spec.weightKg != null ? p.spec.weightKg + " kg" : "—" }}
            <template v-if="p.spec.heightCm != null">｜身高：{{ p.spec.heightCm }} cm</template>
            <template v-if="p.spec.bloodType">｜血型：{{ p.spec.bloodType }} 型</template>
          </div>
          <div v-if="p.spec.hobbies" class="person-line">喜好：{{ p.spec.hobbies }}</div>
          <div v-if="p.spec.note" class="person-line note">备注：{{ p.spec.note }}</div>
          <div class="person-line person-rel-count">
            关联日期：{{ linkedDateCount(p.metadata.name) }} 条
          </div>
          <div class="person-actions">
            <VSpace>
              <VButton size="sm" @click="openPersonEdit(p)">编辑</VButton>
              <VButton size="sm" type="danger" @click="removePerson(p)">删除</VButton>
            </VSpace>
          </div>
        </VCard>
      </div>
    </template>

    <div class="storage-note">
      数据存储于 Halo 扩展存储（与站点数据库一致：H2 / MySQL / PostgreSQL）；操作日志会记录每一次新增、编辑与删除。
    </div>

    <!-- ================= 日期新增/编辑弹窗 ================= -->
    <VModal
      :visible="modalVisible"
      :title="editingName ? '编辑重要日期' : '新增重要日期'"
      width="600"
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

        <div class="field">
          <span class="label">关联人员（可多选）</span>
          <div v-if="persons.length" class="person-checks">
            <label v-for="p in persons" :key="p.metadata.name" class="person-check">
              <input
                type="checkbox"
                :checked="form.personNames.includes(p.metadata.name)"
                @change="togglePerson(p.metadata.name)"
              />
              <span>{{ personTitle(p) }}</span>
            </label>
          </div>
          <div v-else class="hint">
            暂无人员，请先到「人员」页签添加（如张三），再回来关联。
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

    <!-- 人员新增/编辑弹窗 -->
    <PersonFormModal
      :visible="personModalVisible"
      :person="editingPerson"
      @update:visible="(v: boolean) => (personModalVisible = v)"
      @saved="onPersonSaved"
    />

    <!-- ================= 操作日志 ================= -->
    <VModal :visible="logVisible" title="操作日志" width="760" @close="logVisible = false">
      <VLoading v-if="logLoading" />
      <div v-else-if="!logs.length" style="padding: 40px 0">
        <VEmpty title="暂无操作日志" message="新增、编辑、删除重要日期或人员后，这里会记录明细。" />
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

    <!-- ================= 导入 ================= -->
    <VModal :visible="importModalVisible" title="导入数据" width="560" @close="closeImportModal">
      <div v-if="!importResult" class="form">
        <div class="import-row">
          <span class="label">文件</span>
          <span class="hint">{{ importFileName }}</span>
        </div>
        <div class="import-row">
          <span class="label">校验结果</span>
          <span class="hint">
            重要日期：可导入 <b>{{ importValidCount }}</b> 条，跳过 <b>{{ importDuplicateCount }}</b> 条，无效 <b>{{ importInvalidCount }}</b> 条；
            人员：可导入 <b>{{ personImportValidCount }}</b> 条，跳过 <b>{{ personImportDuplicateCount }}</b> 条，无效 <b>{{ personImportInvalidCount }}</b> 条。
          </span>
        </div>
        <div class="hint">导入不会覆盖已有数据（按记录标识判重，已存在的自动跳过）。</div>
      </div>
      <div v-else class="form">
        <div class="import-row">
          <span class="label">导入结果</span>
          <span class="hint">
            人员：新增 <b>{{ importResult.personsImported }}</b>，跳过 <b>{{ importResult.personsSkipped }}</b>，失败 <b>{{ importResult.personsFailed }}</b>；
            重要日期：新增 <b>{{ importResult.imported }}</b>，跳过 <b>{{ importResult.skipped }}</b>，失败 <b>{{ importResult.failed }}</b>。
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
            :disabled="!importValidCount && !personImportValidCount"
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
  createPerson,
  deleteImportantDate,
  deletePerson,
  listImportantDates,
  listOperationLogs,
  listPersons,
  updateImportantDate,
  updatePerson,
  writeOperationLog,
} from "@/api";
import PersonFormModal from "@/components/PersonFormModal.vue";
import SunLunarPicker from "@/components/SunLunarPicker.vue";
import type { DateType, ImportantDate, LogAction, OperationLog, Person } from "@/types";
import { lunarMonthDayText, nextSolarDate } from "@/utils/lunar";

const loading = ref(true);
const saving = ref(false);
const dates = ref<ImportantDate[]>([]);
const persons = ref<Person[]>([]);
const activeTab = ref<"dates" | "persons">("dates");

const modalVisible = ref(false);
const editingName = ref<string | null>(null);

const personModalVisible = ref(false);
const editingPerson = ref<Person | null>(null);

const personFilter = ref("");

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
const personImportValidCount = ref(0);
const personImportDuplicateCount = ref(0);
const personImportInvalidCount = ref(0);
const personImportItems = ref<Array<{ name: string; spec: Person["spec"] }>>([]);
const importResult = ref<{
  imported: number;
  skipped: number;
  failed: number;
  personsImported: number;
  personsSkipped: number;
  personsFailed: number;
} | null>(null);

interface DateForm {
  title: string;
  dateType: DateType;
  solarDate: string;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  note: string;
  personNames: string[];
}

const emptyForm = (): DateForm => ({
  title: "",
  dateType: "SOLAR",
  solarDate: "",
  lunarMonth: 1,
  lunarDay: 1,
  isLeapMonth: false,
  note: "",
  personNames: [],
});

const form = reactive<DateForm>(emptyForm());

async function load() {
  loading.value = true;
  try {
    const [dateList, personList] = await Promise.all([listImportantDates(), listPersons()]);
    dates.value = dateList;
    persons.value = personList;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// ---------- 人员工具 ----------
function personTitle(p: Person): string {
  return p.spec.nickname ? `${p.spec.displayName}（${p.spec.nickname}）` : p.spec.displayName;
}

function personBy(name: string): Person | undefined {
  return persons.value.find((p) => p.metadata.name === name);
}

function personTitleBy(name: string): string {
  const p = personBy(name);
  return p ? personTitle(p) : name;
}

function personBirthdayText(p: Person): string {
  if (p.spec.dateType === "SOLAR") {
    return p.spec.solarDate || "—";
  }
  return lunarMonthDayText(p.spec.lunarMonth || 1, p.spec.lunarDay || 1, !!p.spec.isLeapMonth);
}

function personBirthdaySolar(p: Person): string {
  if (p.spec.dateType === "SOLAR") return "";
  const r = nextSolarDate(p.spec.lunarMonth || 1, p.spec.lunarDay || 1, !!p.spec.isLeapMonth);
  return r ? r.solarDate : "";
}

function linkedDateCount(personName: string): number {
  return dates.value.filter((d) => d.spec.personNames?.includes(personName)).length;
}

const filteredDates = computed(() => {
  if (!personFilter.value) return dates.value;
  return dates.value.filter((d) => d.spec.personNames?.includes(personFilter.value));
});

function togglePerson(name: string) {
  const idx = form.personNames.indexOf(name);
  if (idx >= 0) {
    form.personNames.splice(idx, 1);
  } else {
    form.personNames.push(name);
  }
}

// ---------- 人员操作 ----------
function openPersonCreate() {
  editingPerson.value = null;
  personModalVisible.value = true;
}

function openPersonEdit(p: Person) {
  editingPerson.value = p;
  personModalVisible.value = true;
}

async function onPersonSaved() {
  const p = editingPerson.value;
  await appendLog(
    p ? "UPDATE" : "CREATE",
    personTitleBy(p?.metadata.name || ""),
    p?.metadata.name || "",
    p ? `编辑人员信息` : "新增人员"
  );
  await load();
}

function removePerson(p: Person) {
  const linked = linkedDateCount(p.metadata.name);
  Dialog.warning({
    title: "删除确认",
    description:
      `确定要删除「${p.spec.displayName}」吗？` +
      (linked > 0 ? `该人员仍被 ${linked} 条日期记录关联，删除后这些记录仍保留，只是不再显示关联人。` : "删除后不可恢复。"),
    confirmText: "删除",
    cancelText: "取消",
    onConfirm: async () => {
      try {
        await deletePerson(p.metadata.name);
        Toast.success("已删除");
        await appendLog("DELETE", p.spec.displayName, p.metadata.name, "删除人员");
        await load();
      } catch (error) {
        Toast.error(`删除失败：${(error as Error)?.message || "未知错误"}`);
      }
    },
  });
}

// ---------- 日期操作 ----------
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
    personNames: [...(spec.personNames || [])],
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
  return nextSolarDate(spec.lunarMonth, spec.lunarDay, !!spec.isLeapMonth);
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
  const persons = (spec.personNames || [])
    .map((n) => personTitleBy(n))
    .filter((n) => n)
    .join("、");
  return `日期：${dateText(spec)}；关联人：${persons || "无"}；备注：${spec.note?.trim() ? spec.note.trim() : "无"}`;
}

function diffOf(oldSpec: ImportantDate["spec"] | undefined, newSpec: ImportantDate["spec"]): string {
  const oldSpecSafe = oldSpec || ({ dateType: "SOLAR" } as ImportantDate["spec"]);
  const parts: string[] = [];
  if (oldSpecSafe.title !== newSpec.title) {
    parts.push(`名称：${oldSpecSafe.title} → ${newSpec.title}`);
  }
  if (oldSpecSafe.dateType !== newSpec.dateType) {
    parts.push(`类型：${oldSpecSafe.dateType === "SOLAR" ? "阳历" : "农历"} → ${newSpec.dateType === "SOLAR" ? "阳历" : "农历"}`);
  }
  if (dateText(oldSpecSafe) !== dateText(newSpec)) {
    parts.push(`日期：${dateText(oldSpecSafe)} → ${dateText(newSpec)}`);
  }
  const oldP = (oldSpecSafe.personNames || []).join("、");
  const newP = (newSpec.personNames || []).join("、");
  if (oldP !== newP) {
    parts.push(`关联人：${oldP || "无"} → ${newP || "无"}`);
  }
  if ((oldSpecSafe.note || "") !== (newSpec.note || "")) {
    parts.push(`备注：${oldSpecSafe.note?.trim() || "无"} → ${newSpec.note?.trim() || "无"}`);
  }
  if (!parts.length) {
    return "无内容变化";
  }
  return parts.join("；");
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
          ? { ...(dates.value.find((d) => d.metadata.name === editingName.value)?.metadata || {}) }
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
        personNames: form.personNames.length ? [...form.personNames] : undefined,
      },
    };

    if (editingName.value) {
      const oldItem = dates.value.find((d) => d.metadata.name === editingName.value);
      await updateImportantDate(payload);
      Toast.success("已保存");
      await appendLog("UPDATE", payload.spec.title, payload.metadata.name, diffOf(oldItem?.spec, payload.spec));
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

// ---------- 导出 / 导入 ----------
function exportData() {
  const items = dates.value.map((d) => ({ name: d.metadata.name, spec: d.spec }));
  const people = persons.value.map((p) => ({ name: p.metadata.name, spec: p.spec }));
  const payload = {
    app: "plugin-important-dates",
    version: 2,
    exportedAt: new Date().toISOString(),
    persons: people,
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
  Toast.success(`已导出 ${items.length} 条日期、${people.length} 位人员`);
}

function triggerImport() {
  importResult.value = null;
  fileInputRef.value?.click();
}

function validatePersonSpec(spec: unknown): spec is Person["spec"] {
  const s = spec as Person["spec"];
  if (!s || typeof s.displayName !== "string" || !s.displayName.trim()) return false;
  if (s.dateType === "SOLAR") {
    return /^\d{4}-\d{2}-\d{2}$/.test(s.solarDate || "");
  }
  if (s.dateType === "LUNAR") {
    const m = s.lunarMonth;
    const d = s.lunarDay;
    return Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(d) && d >= 1 && d <= 30;
  }
  return false;
}

function validateDateSpec(spec: unknown): spec is ImportantDate["spec"] {
  const s = spec as ImportantDate["spec"];
  if (!s || typeof s.title !== "string" || !s.title.trim()) return false;
  if (s.dateType === "SOLAR") {
    return /^\d{4}-\d{2}-\d{2}$/.test(s.solarDate || "");
  }
  if (s.dateType === "LUNAR") {
    const m = s.lunarMonth;
    const d = s.lunarDay;
    return Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(d) && d >= 1 && d <= 30;
  }
  return false;
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  importFileName.value = file.name;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawDates = Array.isArray(parsed) ? parsed : parsed?.items;
    const rawPersons = parsed?.persons;
    if (!Array.isArray(rawDates)) {
      throw new Error("items 不是数组");
    }
    const existingPersons = new Set(persons.value.map((p) => p.metadata.name));
    const existingDates = new Set(dates.value.map((d) => d.metadata.name));

    let pValid = 0;
    let pDup = 0;
    let pInvalid = 0;
    const pList: Array<{ name: string; spec: Person["spec"] }> = [];
    const pSeen = new Set<string>();
    if (Array.isArray(rawPersons)) {
      for (const it of rawPersons) {
        const spec = it?.spec;
        if (!validatePersonSpec(spec)) {
          pInvalid++;
          continue;
        }
        const name =
          typeof it.name === "string" && it.name ? it.name : `person-import-${Date.now()}-${pValid}`;
        if (existingPersons.has(name) || pSeen.has(name)) {
          pDup++;
          continue;
        }
        pSeen.add(name);
        pList.push({ name, spec: { ...spec } });
        pValid++;
      }
    }

    let valid = 0;
    let dup = 0;
    let invalid = 0;
    const list: Array<{ name: string; spec: ImportantDate["spec"] }> = [];
    const seen = new Set<string>();
    for (const it of rawDates) {
      const spec = it?.spec;
      if (!validateDateSpec(spec)) {
        invalid++;
        continue;
      }
      const name =
        typeof it.name === "string" && it.name ? it.name : `important-date-import-${Date.now()}-${valid}`;
      if (existingDates.has(name) || seen.has(name)) {
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
    personImportItems.value = pList;
    personImportValidCount.value = pValid;
    personImportDuplicateCount.value = pDup;
    personImportInvalidCount.value = pInvalid;
    importModalVisible.value = true;
    if (!valid && !pValid) {
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
  let personsImported = 0;
  let personsFailed = 0;
  try {
    for (const item of personImportItems.value) {
      try {
        const created = await createPerson({
          apiVersion: "importantdates.halo.run/v1alpha1",
          kind: "Person",
          metadata: { name: item.name },
          spec: item.spec,
        });
        personsImported++;
        await appendLog("CREATE", created.spec.displayName, created.metadata.name, "导入：新增人员");
      } catch {
        personsFailed++;
      }
    }
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
      personsImported,
      personsSkipped: personImportDuplicateCount.value,
      personsFailed,
    };
    if (imported > 0 || personsImported > 0) {
      await load();
    }
    Toast.success(`导入完成：新增 ${personsImported} 位人员、${imported} 条日期`);
  }
}

function closeImportModal() {
  importModalVisible.value = false;
  importResult.value = null;
  importItems.value = [];
  personImportItems.value = [];
}

// ---------- 日志弹窗 ----------
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

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.tab-btn {
  padding: 7px 18px;
  font-size: 14px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #4b5563;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  border-bottom: 3px solid transparent;
}

.tab-btn.active {
  color: #4f7cff;
  border-color: #4f7cff;
  border-bottom: 3px solid #4f7cff;
  background: #f5f8ff;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.filter-label {
  font-size: 13px;
  color: #6b7280;
}

.filter-select {
  width: 220px;
}

.filter-count {
  font-size: 13px;
  color: #9ca3af;
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

.person-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.persons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.person-card {
  padding: 14px;
}

.person-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.person-name {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.person-line {
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 6px;
  line-height: 1.5;
}

.person-rel-count {
  color: #6b7280;
}

.person-actions {
  margin-top: 10px;
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

.person-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.person-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
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
