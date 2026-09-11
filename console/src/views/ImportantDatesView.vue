<template>
  <VPageHeader title="重要日期">
    <template #actions>
      <VButton :loading="logLoading" @click="openLogs">操作日志</VButton>
      <VButton @click="exportData">导出</VButton>
      <VButton @click="triggerImport">导入</VButton>
      <VButton type="secondary" @click="onPrimaryAction">
        <span style="margin-right: 4px">＋</span>{{ primaryActionLabel }}
      </VButton>
    </template>
  </VPageHeader>

  <input ref="fileInputRef" type="file" accept=".json,application/json" style="display: none" @change="onImportFile" />

  <div class="page-content">
    <!-- 到期提醒横幅（后台） -->
    <div v-if="showBackendReminder && reminders.length" class="remind-banner">
      <div v-for="r in reminders" :key="r.metadata.name" class="remind-item">
        {{ remindText(r) }}
      </div>
    </div>

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
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'cars' }"
        @click="activeTab = 'cars'"
      >
        座驾（{{ cars.length }}）
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
                <th style="width: 14%">名称</th>
                <th style="width: 8%">类型</th>
                <th style="width: 15%">日期</th>
                <th style="width: 16%">最近一次</th>
                <th style="width: 12%">关联人</th>
                <th style="width: 8%">重要</th>
                <th style="width: 8%">前台</th>
                <th>备注</th>
                <th style="width: 110px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, idx) in filteredDates"
                :key="item.metadata.name"
                draggable="true"
                class="drag-row"
                @dragstart="dragStartDate(item)"
                @dragover.prevent
                @drop="dropDate(idx)"
              >
                <td>
                  <div class="title">
                    <span class="drag-handle" title="拖拽排序">⠿</span>
                    {{ item.spec.title }}
                  </div>
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
                  <VTag v-if="item.spec.important !== false" theme="secondary">重要</VTag>
                  <span v-else class="muted">普通</span>
                </td>
                <td>
                  <VSwitch
                    :model-value="item.spec.visible !== false"
                    @change="(v: boolean) => toggleDateVisible(item, v)"
                  />
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
        <VCard
          v-for="(p, idx) in sortedPersons"
          :key="p.metadata.name"
          class="person-card drag-row"
          draggable="true"
          @dragstart="dragStartPerson(p)"
          @dragover.prevent
          @drop="dropPerson(idx)"
        >
          <div class="person-head">
            <div class="person-name">
              <img v-if="p.spec.avatar" class="person-avatar" :src="p.spec.avatar" alt=""
               onerror="this.style.display='none';var s=document.createElement('span');s.className='person-avatar person-avatar-char';s.style.display='inline-flex';s.textContent=this.closest('.person-name')?.querySelector('span')?.textContent?.slice(0,1)||'?';this.parentNode.insertBefore(s,this);" />
              <span>{{ p.spec.displayName }}</span>
              <VTag v-if="p.spec.visible === false" theme="danger" class="hidden-tag">已隐藏</VTag>
            </div>
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
            <span class="privacy-tag">仅后台</span>
          </div>
          <div v-if="p.spec.hobbies" class="person-line">
            喜好：{{ p.spec.hobbies }}
            <span class="privacy-tag">仅后台</span>
          </div>
          <div v-if="p.spec.note" class="person-line note">
            备注：{{ p.spec.note }}
            <span class="privacy-tag" style="vertical-align: middle;">仅后台</span>
          </div>
          <div class="person-line person-rel-count">
            关联日期：{{ linkedDateCount(p.metadata.name) }} 条
          </div>
          <div class="person-actions">
            <VSpace>
              <VButton size="sm" @click="openPersonEdit(p)">编辑</VButton>
              <label class="visible-toggle">
                <VSwitch
                  :model-value="p.spec.visible !== false"
                  @change="(v: boolean) => togglePersonVisible(p, v)"
                />
                <span class="muted">前台展示</span>
              </label>
              <VButton size="sm" type="danger" @click="removePerson(p)">删除</VButton>
            </VSpace>
          </div>
        </VCard>
      </div>
    </template>

    <!-- ================= 座驾 ================= -->
    <template v-if="activeTab === 'cars' && !loading">
      <div v-if="!cars.length" style="padding: 60px 0">
        <VEmpty
          title="还没添加座驾"
          message="把爱车、电瓶车或自行车记下来吧：保险、年检、保养到期会自动提醒你。"
        >
          <template #actions>
            <VButton type="secondary" @click="openCarCreate">先记一辆</VButton>
          </template>
        </VEmpty>
      </div>
      <div v-else class="cars-grid">
        <VCard
          v-for="(c, idx) in sortedCars"
          :key="c.metadata.name"
          class="car-card drag-row"
          draggable="true"
          @dragstart="dragStartCar(c)"
          @dragover.prevent
          @drop="dropCar(idx)"
        >
          <div class="car-head">
            <div class="car-cover" :class="`car-cover-${skinOf(c)}`">
              <img v-if="carCover(c)" :src="carCover(c) || ''" alt="" />
              <span v-else class="car-cover-icon">{{ carIcon(c) }}</span>
            </div>
            <div class="car-title">
              <div class="car-name">
                {{ c.spec.displayName }}
                <VTag v-if="c.spec.status === 'SOLD'" theme="secondary">已出售</VTag>
                <VTag v-else-if="c.spec.status === 'SCRAPPED'" theme="danger">已报废</VTag>
                <VTag v-if="c.spec.visible !== true" theme="danger" class="hidden-tag">未展示</VTag>
              </div>
              <div class="car-sub">
                {{ carTypeLabel(c) }}<template v-if="c.spec.brand || c.spec.model"> · {{ [c.spec.brand, c.spec.model].filter(Boolean).join(" ") }}</template>
                <template v-if="c.spec.energyType"> · {{ energyLabel(c.spec.energyType) }}</template>
              </div>
              <div class="car-sub">
                车牌：{{ c.spec.plateNo || "—" }}
                <span v-if="c.spec.mileageKm != null">｜里程：{{ c.spec.mileageKm }} km</span>
              </div>
            </div>
          </div>

          <div v-if="carEventsOf(c).length" class="car-events">
            <span
              v-for="e in carEventsOf(c).slice(0, 3)"
              :key="e.label + e.date"
              class="car-event"
              :class="{ overdue: e.daysUntil < 0, soon: e.daysUntil >= 0 && e.daysUntil <= 15 }"
            >
              {{ e.label }} · {{ e.daysUntil < 0 ? `已过期 ${-e.daysUntil} 天` : e.daysUntil === 0 ? "今天到期" : `${e.daysUntil} 天后` }}
            </span>
            <span v-if="carEventsOf(c).length > 3" class="car-event more">+{{ carEventsOf(c).length - 3 }}</span>
          </div>
          <div v-else class="car-sub muted">暂无启用的到期项</div>

          <div class="car-sub">
            车主：{{ personTitleBy(c.spec.ownerName) || "未关联" }}
            <template v-if="c.spec.driverNames?.length">
              ｜驾驶人：{{ c.spec.driverNames.map((n) => personTitleBy(n)).filter(Boolean).join("、") }}
            </template>
          </div>
          <div v-if="c.spec.note" class="car-sub note">备注：{{ c.spec.note }}</div>

          <div class="car-actions">
            <VSpace>
              <VButton size="sm" @click="openCarEdit(c)">编辑</VButton>
              <label class="visible-toggle">
                <VSwitch
                  :model-value="c.spec.visible === true"
                  @change="(v: boolean) => toggleCarVisible(c, v)"
                />
                <span class="muted">前台展示</span>
              </label>
              <VButton size="sm" type="danger" @click="removeCar(c)">删除</VButton>
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

        <div class="field">
          <span class="label">属性</span>
          <div class="person-checks">
            <label class="person-check">
              <input v-model="form.important" type="checkbox" />
              <span>重要（参与到期提醒）</span>
            </label>
            <label class="person-check">
              <input v-model="form.visible" type="checkbox" />
              <span>前台展示（/important-dates 页面）</span>
            </label>
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

    <CarFormModal
      :visible="carModalVisible"
      :car="editingCar"
      @update:visible="(v: boolean) => (carModalVisible = v)"
      @saved="onCarSaved"
    />

    <!-- ================= 操作日志 ================= -->
    <VModal :visible="logVisible" title="操作日志" width="760" @close="logVisible = false">
      <!-- 保持单一 table 结构：内容分支只发生在 tbody 内，避免弹窗过渡/滚动条初始化期间
           切换节点导致 Vue insertBefore 报错（NotFoundError） -->
      <table class="dates-table">
        <thead>
          <tr>
            <th style="width: 24%">时间</th>
            <th style="width: 12%">操作</th>
            <th style="width: 18%">目标</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="logError">
            <td colspan="4" class="log-state">{{ logError }}</td>
          </tr>
          <template v-else-if="!logs.length">
            <tr>
              <td colspan="4" class="log-empty">
                <div class="log-empty-title">暂无操作日志</div>
                <div class="log-empty-sub">新增、编辑、删除重要日期或人员后，这里会记录明细。</div>
              </td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="log in logs" :key="log.metadata.name">
              <td>{{ formatTime(log.metadata.creationTimestamp) }}</td>
              <td>
                <span
                  class="log-action"
                  :class="`log-action-${(log.spec.action || 'CREATE').toLowerCase()}`"
                >
                  {{ logActionText(log.spec.action) }}
                </span>
              </td>
              <td>{{ log.spec.targetTitle || "—" }}</td>
              <td><span class="note">{{ log.spec.detail || "—" }}</span></td>
            </tr>
          </template>
        </tbody>
      </table>
      <div v-if="logsTotal > 0" class="log-pager">
        <VSpace>
          <VButton size="sm" :disabled="logsPage <= 1" @click="changeLogPage(logsPage - 1)">上一页</VButton>
          <span class="muted">第 {{ logsPage }} / {{ logsTotalPages }} 页 · 共 {{ logsTotal }} 条</span>
          <VButton size="sm" :disabled="logsPage >= logsTotalPages" @click="changeLogPage(logsPage + 1)">下一页</VButton>
        </VSpace>
      </div>
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
            人员：可导入 <b>{{ personImportValidCount }}</b> 条，跳过 <b>{{ personImportDuplicateCount }}</b> 条，无效 <b>{{ personImportInvalidCount }}</b> 条；
            座驾：可导入 <b>{{ carImportValidCount }}</b> 辆，跳过 <b>{{ carImportDuplicateCount }}</b> 辆，无效 <b>{{ carImportInvalidCount }}</b> 辆。
          </span>
        </div>
        <div class="hint">导入不会覆盖已有数据（按记录标识判重，已存在的自动跳过）。</div>
      </div>
      <div v-else class="form">
        <div class="import-row">
          <span class="label">导入结果</span>
          <span class="hint">
            人员：新增 <b>{{ importResult.personsImported }}</b>，跳过 <b>{{ importResult.personsSkipped }}</b>，失败 <b>{{ importResult.personsFailed }}</b>；
            重要日期：新增 <b>{{ importResult.imported }}</b>，跳过 <b>{{ importResult.skipped }}</b>，失败 <b>{{ importResult.failed }}</b>；
            座驾：新增 <b>{{ importResult.carsImported }}</b>，跳过 <b>{{ importResult.carsSkipped }}</b>，失败 <b>{{ importResult.carsFailed }}</b>。
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
            :disabled="!importValidCount && !personImportValidCount && !carImportValidCount"
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
  VSwitch,
  VTag,
} from "@halo-dev/components";
import {
  createCar,
  createImportantDate,
  createPerson,
  deleteCar,
  deleteImportantDate,
  deletePerson,
  fetchPluginJsonConfig,
  listCars,
  listImportantDates,
  listOperationLogs,
  listPersons,
  updateCar,
  updateImportantDate,
  updatePerson,
  writeOperationLog,
} from "@/api";
import CarFormModal from "@/components/CarFormModal.vue";
import PersonFormModal from "@/components/PersonFormModal.vue";
import SunLunarPicker from "@/components/SunLunarPicker.vue";
import type { Car, CarReminder, DateType, ImportantDate, LogAction, LogTargetType, OperationLog, Person } from "@/types";
import { VEHICLE_TYPES } from "@/types";
import { lunarMonthDayText, nextSolarDate } from "@/utils/lunar";

const loading = ref(true);
const saving = ref(false);
const dates = ref<ImportantDate[]>([]);
const persons = ref<Person[]>([]);
const cars = ref<Car[]>([]);
const activeTab = ref<"dates" | "persons" | "cars">("dates");

const modalVisible = ref(false);
const editingName = ref<string | null>(null);

const personModalVisible = ref(false);
const editingPerson = ref<Person | null>(null);

const carModalVisible = ref(false);
const editingCar = ref<Car | null>(null);

const personFilter = ref("");

const logVisible = ref(false);
const logLoading = ref(false);
const logError = ref("");
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
const carImportItems = ref<Array<{ name: string; spec: Car["spec"] }>>([]);
const carImportValidCount = ref(0);
const carImportDuplicateCount = ref(0);
const carImportInvalidCount = ref(0);
const personImportDuplicateCount = ref(0);
const personImportInvalidCount = ref(0);
const personImportItems = ref<Array<{ name: string; spec: Person["spec"] }>>([]);
const importResult = ref<{
  carsImported: number;
  carsSkipped: number;
  carsFailed: number;
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
  important: boolean;
  visible: boolean;
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
  important: true,
  visible: true,
});

const form = reactive<DateForm>(emptyForm());

async function load() {
  loading.value = true;
  try {
    const [dateList, personList, carList] = await Promise.all([
      listImportantDates(),
      listPersons(),
      listCars(),
    ]);
    dates.value = dateList;
    persons.value = personList;
    cars.value = carList;
    await loadRemindConfig();
  } finally {
    loading.value = false;
  }
}

function personTitleBy(name?: string): string {
  if (!name) return "";
  const p = personBy(name);
  return p ? personTitle(p) : name;
}

onMounted(load);

// ---------- 人员工具 ----------
function personTitle(p: Person): string {
  return p.spec.nickname ? `${p.spec.displayName}（${p.spec.nickname}）` : p.spec.displayName;
}

function personBy(name: string): Person | undefined {
  return persons.value.find((p) => p.metadata.name === name);
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
  const sorted = sortedDates.value;
  if (!personFilter.value) return sorted;
  return sorted.filter((d) => d.spec.personNames?.includes(personFilter.value));
});

/** 排序：拖拽权重（sortOrder）升序，创建时间倒序（同级） */
function sortByOrder<T extends { metadata: { creationTimestamp?: string }; spec: { sortOrder?: number } }>(
  arr: T[]
): T[] {
  return [...arr].sort((a, b) => {
    const oa = a.spec.sortOrder || 0;
    const ob = b.spec.sortOrder || 0;
    if (oa !== ob) return oa - ob;
    return (b.metadata.creationTimestamp || "").localeCompare(a.metadata.creationTimestamp || "");
  });
}

const sortedDates = computed(() => sortByOrder(dates.value));
const sortedPersons = computed(() => sortByOrder(persons.value));
const sortedCars = computed(() => sortByOrder(cars.value));

/** 主按钮文案：随页签变化 */
const primaryActionLabel = computed(() => {
  if (activeTab.value === "cars") return "新增座驾";
  if (activeTab.value === "persons") return "新增人员";
  return "新增日期";
});

function onPrimaryAction() {
  if (activeTab.value === "cars") {
    openCarCreate();
  } else if (activeTab.value === "persons") {
    openPersonCreate();
  } else {
    openCreate();
  }
}

// ---------- 座驾展示辅助 ----------
function carTypeInfo(type?: string) {
  return VEHICLE_TYPES.find((t) => t.value === type) || VEHICLE_TYPES[0];
}

function carTypeLabel(c: Car): string {
  return carTypeInfo(c.spec.vehicleType).label;
}

function carIcon(c: Car): string {
  return carTypeInfo(c.spec.vehicleType).icon;
}

function energyLabel(type?: string): string {
  const map: Record<string, string> = {
    FUEL: "燃油",
    EV: "纯电",
    PHEV: "插电混动",
    HEV: "油电混动",
    HUMAN: "人力",
  };
  return map[type || ""] || "燃油";
}

function carCover(c: Car): string | undefined {
  const photos = c.spec.photos || [];
  if (!photos.length) return undefined;
  const cover = photos.find((p) => p.isCover);
  return (cover || photos[0]).url;
}

/** 统一徽章：车主性别决定卡片风格（男=酷 / 女=可爱 / 其他=中性） */
function skinOf(c: Car): "cool" | "cute" | "neutral" {
  const owner = (persons.value || []).find((p) => p.metadata.name === c.spec.ownerName);
  const gender = owner?.spec?.gender || "";
  if (gender === "男") return "cool";
  if (gender === "女") return "cute";
  return "neutral";
}

const YEARLY_REMINDER_KEYS = ["INSURANCE_COMPULSORY", "INSURANCE_COMMERCIAL", "INSPECTION", "TAX", "LICENSE"];

function reminderLabelOf(r: CarReminder): string {
  if (r.label && r.label.trim()) return r.label.trim();
  const map: Record<string, string> = {
    INSURANCE_COMPULSORY: "交强险",
    INSURANCE_COMMERCIAL: "商业险",
    INSPECTION: "年检",
    MAINTENANCE: "保养",
    TAX: "车船税",
    LICENSE: "驾照换证",
    CUSTOM: "自定义",
  };
  return map[r.key || ""] || "到期事项";
}

function daysUntil(dateText: string): number | null {
  if (!dateText) return null;
  const due = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/** 后台列表用：计算启用的到期项（含按年滚动与保养推算），按剩余天数升序 */
function carEventsOf(c: Car): { label: string; date: string; daysUntil: number }[] {
  const list: { label: string; date: string; daysUntil: number }[] = [];
  for (const r of c.spec.reminders || []) {
    if (r.enabled === false) continue;
    let dueText = r.date || "";
    if (!dueText && r.key === "MAINTENANCE" && r.lastServiceDate && r.intervalMonths) {
      const last = new Date(`${r.lastServiceDate}T00:00:00`);
      if (!Number.isNaN(last.getTime())) {
        last.setMonth(last.getMonth() + Number(r.intervalMonths));
        dueText = last.toISOString().slice(0, 10);
      }
    }
    if (!dueText) continue;
    let due = new Date(`${dueText}T00:00:00`);
    if (Number.isNaN(due.getTime())) continue;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (YEARLY_REMINDER_KEYS.includes(r.key || "")) {
      let guard = 0;
      while (due.getTime() < today.getTime() && guard++ < 3) {
        due = new Date(due.setFullYear(due.getFullYear() + 1));
      }
    }
    const days = daysUntil(due.toISOString().slice(0, 10));
    if (days === null) continue;
    list.push({ label: reminderLabelOf(r), date: due.toISOString().slice(0, 10), daysUntil: days });
  }
  return list.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ---------- 拖拽排序（重要日期 / 人员 / 座驾） ----------
let dragDateName: string | null = null;
let dragPersonName: string | null = null;
let dragCarName: string | null = null;

function dragStartDate(item: ImportantDate) {
  dragDateName = item.metadata.name;
}

function dropDate(targetIndex: number) {
  if (!dragDateName) return;
  const arr = filteredDates.value;
  const srcIdx = arr.findIndex((d) => d.metadata.name === dragDateName);
  dragDateName = null;
  if (srcIdx < 0 || srcIdx === targetIndex) return;
  const reordered = [...arr];
  const [moved] = reordered.splice(srcIdx, 1);
  reordered.splice(targetIndex, 0, moved);
  void persistOrder("date", reordered.map((d) => d.metadata.name));
}

function dragStartPerson(p: Person) {
  dragPersonName = p.metadata.name;
}

function dropPerson(targetIndex: number) {
  if (!dragPersonName) return;
  const arr = sortedPersons.value;
  const srcIdx = arr.findIndex((p) => p.metadata.name === dragPersonName);
  dragPersonName = null;
  if (srcIdx < 0 || srcIdx === targetIndex) return;
  const reordered = [...arr];
  const [moved] = reordered.splice(srcIdx, 1);
  reordered.splice(targetIndex, 0, moved);
  void persistOrder("person", reordered.map((p) => p.metadata.name));
}

function dragStartCar(c: Car) {
  dragCarName = c.metadata.name;
}

function dropCar(targetIndex: number) {
  if (!dragCarName) return;
  const arr = sortedCars.value;
  const srcIdx = arr.findIndex((c) => c.metadata.name === dragCarName);
  dragCarName = null;
  if (srcIdx < 0 || srcIdx === targetIndex) return;
  const reordered = [...arr];
  const [moved] = reordered.splice(srcIdx, 1);
  reordered.splice(targetIndex, 0, moved);
  void persistOrder("car", reordered.map((c) => c.metadata.name));
}

/** 把顺序落库：已排序列（按新顺序）+ 其余（按当前顺序），统一写入 1..n */
async function persistOrder(kind: "date" | "person" | "car", orderedNames: string[]) {
  try {
    if (kind === "date") {
      const byName = new Map(dates.value.map((d) => [d.metadata.name, d]));
      const ordered = orderedNames.map((n) => byName.get(n)!).filter(Boolean);
      const rest = sortedDates.value.filter((d) => !orderedNames.includes(d.metadata.name));
      const full = [...ordered, ...rest];
      let order = 1;
      const toUpdate: ImportantDate[] = [];
      for (const d of full) {
        const next = { ...d, spec: { ...d.spec, sortOrder: order++ } };
        if ((d.spec.sortOrder || 0) !== next.spec.sortOrder) toUpdate.push(next);
      }
      if (toUpdate.length) {
        await Promise.all(toUpdate.map((u) => updateImportantDate(u)));
      }
      Toast.success("已保存排序");
    } else {
      const isCar = kind === "car";
      const source: { metadata: { name: string }; spec: { sortOrder?: number } }[] = isCar
        ? cars.value
        : persons.value;
      const sortedList = isCar ? sortedCars.value : sortedPersons.value;
      const byName = new Map(source.map((p) => [p.metadata.name, p]));
      const ordered = orderedNames.map((n) => byName.get(n)!).filter(Boolean);
      const rest = sortedList.filter((p) => !orderedNames.includes(p.metadata.name));
      const full = [...ordered, ...rest];
      let order = 1;
      const toUpdate: { item: Person | Car; next: Person | Car }[] = [];
      for (const p of full) {
        const next = { ...p, spec: { ...p.spec, sortOrder: order++ } } as Person | Car;
        if ((p.spec.sortOrder || 0) !== next.spec.sortOrder) toUpdate.push({ item: p as Person | Car, next });
      }
      if (toUpdate.length) {
        await Promise.all(
          toUpdate.map(({ next }) => (isCar ? updateCar(next as Car) : updatePerson(next as Person)))
        );
      }
      Toast.success("已保存排序");
    }
    await load();
  } catch (error) {
    Toast.error(`保存排序失败：${(error as Error)?.message || "未知错误"}`);
    await load();
  }
}

function togglePerson(name: string) {
  const idx = form.personNames.indexOf(name);
  if (idx >= 0) {
    form.personNames.splice(idx, 1);
  } else {
    form.personNames.push(name);
  }
}

// ---------- 座驾操作 ----------
function openCarCreate() {
  editingCar.value = null;
  carModalVisible.value = true;
}

function openCarEdit(c: Car) {
  editingCar.value = c;
  carModalVisible.value = true;
}

async function onCarSaved() {
  const c = editingCar.value;
  await appendLog(
    c ? "UPDATE" : "CREATE",
    c?.spec.displayName || "座驾",
    c?.metadata.name || "",
    c ? "编辑座驾信息" : "新增座驾",
    "CAR"
  );
  await load();
}

function removeCar(c: Car) {
  Dialog.warning({
    title: "删除确认",
    description: `确定要删除「${c.spec.displayName}」吗？相册与到期项会一并删除，删除后不可恢复。`,
    confirmText: "删除",
    cancelText: "取消",
    onConfirm: async () => {
      try {
        await deleteCar(c.metadata.name);
        cars.value = cars.value.filter((x) => x.metadata.name !== c.metadata.name);
        Toast.success("已删除");
        await appendLog("DELETE", c.spec.displayName, c.metadata.name, "删除座驾", "CAR");
        await load();
      } catch (error) {
        Toast.error(`删除失败：${(error as Error)?.message || "未知错误"}`);
      }
    },
  });
}

async function toggleCarVisible(c: Car, visibleValue: boolean) {
  try {
    const next: Car = { ...c, spec: { ...c.spec, visible: visibleValue } };
    await updateCar(next);
    c.spec.visible = visibleValue;
    Toast.success(visibleValue ? "已在前台展示（车牌自动脱敏）" : "已取消前台展示");
    await appendLog(
      "UPDATE",
      c.spec.displayName,
      c.metadata.name,
      visibleValue ? "开启前台展示" : "关闭前台展示",
      "CAR"
    );
  } catch (error) {
    Toast.error(`操作失败：${(error as Error)?.message || "未知错误"}`);
    await load();
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
    p ? `编辑人员信息` : "新增人员",
    "PERSON"
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
        // 立即从本地列表移除（Halo 软删除后索引清理存在微小延迟，避免依赖时序）
        persons.value = persons.value.filter((x) => x.metadata.name !== p.metadata.name);
        Toast.success("已删除");
        await appendLog("DELETE", p.spec.displayName, p.metadata.name, "删除人员", "PERSON");
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
    important: spec.important !== false,
    visible: spec.visible !== false,
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

// ---------- 到期提醒 ----------
const remindConfig = ref({ remindDays: 3, backendReminder: true });

async function loadRemindConfig() {
  try {
    const config = await fetchPluginJsonConfig("plugin-important-dates");
    const days = Number.parseInt(config["remindDays"] || "", 10);
    remindConfig.value = {
      remindDays: Number.isFinite(days) ? Math.max(0, Math.min(30, days)) : 3,
      backendReminder: config["backendReminder"] !== "false",
    };
  } catch {
    remindConfig.value = { remindDays: 3, backendReminder: true };
  }
}

function daysUntilOf(spec: ImportantDate["spec"]): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next: Date | null = null;
  if (spec.dateType === "SOLAR" && spec.solarDate) {
    const [, m, d] = spec.solarDate.split("-").map(Number);
    let cand = new Date(today.getFullYear(), m - 1, d);
    if (cand.getTime() < today.getTime()) {
      cand = new Date(today.getFullYear() + 1, m - 1, d);
    }
    next = cand;
  } else if (spec.dateType === "LUNAR") {
    const r = nextSolarDate(spec.lunarMonth || 1, spec.lunarDay || 1, !!spec.isLeapMonth);
    if (r) {
      next = new Date(`${r.solarDate}T00:00:00`);
    }
  }
  if (!next) return null;
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

const reminders = computed(() => {
  const days = remindConfig.value.remindDays;
  return dates.value
    .filter(
      (d) =>
        d.spec.important !== false &&
        d.spec.visible !== false &&
        (() => {
          const n = daysUntilOf(d.spec);
          return n !== null && n >= 0 && n <= days;
        })()
    )
    .sort((a, b) => (daysUntilOf(a.spec) ?? 9999) - (daysUntilOf(b.spec) ?? 9999));
});

const showBackendReminder = computed(() => remindConfig.value.backendReminder);

function remindText(item: ImportantDate): string {
  const n = daysUntilOf(item.spec) ?? 0;
  if (n <= 0) return `「${item.spec.title}」就是今天呀 🎉`;
  if (n === 1) return `「${item.spec.title}」明天就到啦～`;
  return `「${item.spec.title}」还有 ${n} 天就到啦～`;
}

async function toggleDateVisible(item: ImportantDate, visibleValue: boolean) {
  try {
    const next: ImportantDate = {
      ...item,
      spec: { ...item.spec, visible: visibleValue },
    };
    await updateImportantDate(next);
    await appendLog(
      "UPDATE",
      item.spec.title,
      item.metadata.name,
      `前台展示：${item.spec.visible !== false ? "是" : "否"} → ${visibleValue ? "是" : "否"}`
    );
    await load();
  } catch (error) {
    Toast.error(`切换失败：${(error as Error)?.message || "未知错误"}`);
    await load();
  }
}

async function togglePersonVisible(p: Person, visibleValue: boolean) {
  try {
    const next: Person = {
      ...p,
      spec: { ...p.spec, visible: visibleValue },
    };
    await updatePerson(next);
    await appendLog(
      "UPDATE",
      p.spec.displayName,
      p.metadata.name,
      `前台展示：${p.spec.visible !== false ? "是" : "否"} → ${visibleValue ? "是" : "否"}`
    );
    await load();
  } catch (error) {
    Toast.error(`切换失败：${(error as Error)?.message || "未知错误"}`);
    await load();
  }
}

// ---------- 操作日志 ----------
async function appendLog(
  action: LogAction,
  targetTitle: string,
  targetName: string,
  detail: string,
  targetType: LogTargetType = "DATE"
) {
  try {
    await writeOperationLog(action, targetTitle, targetName, detail, targetType);
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
  const oldImportant = oldSpecSafe.important !== false;
  const newImportant = newSpec.important !== false;
  if (oldImportant !== newImportant) {
    parts.push(`重要：${oldImportant ? "是" : "否"} → ${newImportant ? "是" : "否"}`);
  }
  const oldVisible = oldSpecSafe.visible !== false;
  const newVisible = newSpec.visible !== false;
  if (oldVisible !== newVisible) {
    parts.push(`前台展示：${oldVisible ? "是" : "否"} → ${newVisible ? "是" : "否"}`);
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
        important: form.important,
        visible: form.visible,
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
        // 立即从本地列表移除（Halo 软删除后索引清理存在微小延迟，避免依赖时序）
        dates.value = dates.value.filter((d) => d.metadata.name !== item.metadata.name);
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
  const vehicles = cars.value.map((c) => ({ name: c.metadata.name, spec: c.spec }));
  const payload = {
    app: "plugin-important-dates",
    version: 3,
    exportedAt: new Date().toISOString(),
    persons: people,
    cars: vehicles,
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
  Toast.success(
    `已导出 ${items.length} 条日期、${people.length} 位人员、${vehicles.length} 辆座驾`
  );
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

function validateCarSpec(spec: unknown): spec is Car["spec"] {
  const s = spec as Car["spec"];
  return !!s && typeof s.displayName === "string" && !!s.displayName.trim();
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

    // 座驾（v3 导出文件；旧文件无 cars 字段则跳过）
    const rawCars = parsed?.cars;
    const existingCars = new Set(cars.value.map((x) => x.metadata.name));
    let cValid = 0;
    let cDup = 0;
    let cInvalid = 0;
    const cList: Array<{ name: string; spec: Car["spec"] }> = [];
    const cSeen = new Set<string>();
    if (Array.isArray(rawCars)) {
      for (const it of rawCars) {
        const spec = it?.spec;
        if (!validateCarSpec(spec)) {
          cInvalid++;
          continue;
        }
        const name = typeof it.name === "string" && it.name ? it.name : `car-import-${Date.now()}-${cValid}`;
        if (existingCars.has(name) || cSeen.has(name)) {
          cDup++;
          continue;
        }
        cSeen.add(name);
        cList.push({ name, spec: { ...spec } });
        cValid++;
      }
    }
    carImportItems.value = cList;
    carImportValidCount.value = cValid;
    carImportDuplicateCount.value = cDup;
    carImportInvalidCount.value = cInvalid;

    importItems.value = list;
    importValidCount.value = valid;
    importDuplicateCount.value = dup;
    importInvalidCount.value = invalid;
    personImportItems.value = pList;
    personImportValidCount.value = pValid;
    personImportDuplicateCount.value = pDup;
    personImportInvalidCount.value = pInvalid;
    importModalVisible.value = true;
    if (!valid && !pValid && !cValid) {
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
  let carsImported = 0;
  let carsFailed = 0;
  try {
    for (const item of carImportItems.value) {
      try {
        const created = await createCar({
          apiVersion: "importantdates.halo.run/v1alpha1",
          kind: "Car",
          metadata: { name: item.name },
          spec: item.spec,
        });
        carsImported++;
        await appendLog("CREATE", created.spec.displayName, created.metadata.name, "导入：新增座驾", "CAR");
      } catch {
        carsFailed++;
      }
    }
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
      carsImported,
      carsSkipped: carImportDuplicateCount.value,
      carsFailed,
    };
    if (imported > 0 || personsImported > 0 || carsImported > 0) {
      await load();
    }
    Toast.success(`导入完成：新增 ${personsImported} 位人员、${imported} 条日期、${carsImported} 辆座驾`);
  }
}

function closeImportModal() {
  importModalVisible.value = false;
  importResult.value = null;
  importItems.value = [];
  personImportItems.value = [];
  carImportItems.value = [];
}

// ---------- 日志弹窗（分页） ----------
const LOG_PAGE_SIZE = 20;
const logsPage = ref(1);
const logsTotal = ref(0);
const logsTotalPages = computed(() => Math.max(1, Math.ceil(logsTotal.value / LOG_PAGE_SIZE)));

async function loadLogs(page: number) {
  logLoading.value = true;
  logError.value = "";
  try {
    const result = await listOperationLogs(page, LOG_PAGE_SIZE);
    logs.value = result.items;
    logsTotal.value = result.total;
    logsPage.value = page;
  } catch (error) {
    logError.value = `日志加载失败：${(error as Error)?.message || "请稍后重试"}`;
  } finally {
    logLoading.value = false;
  }
}

async function openLogs() {
  // 先加载数据再打开弹窗：内容在弹窗打开前定型，避免打开动画期间切换节点
  await loadLogs(1);
  logVisible.value = true;
}

function changeLogPage(page: number) {
  if (page < 1 || page > logsTotalPages.value) return;
  void loadLogs(page);
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

.remind-banner {
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-radius: 10px;
  padding: 10px 16px;
  margin-bottom: 12px;
}

.remind-item {
  color: #9a3412;
  font-size: 14px;
  line-height: 1.9;
}

.remind-item::before {
  content: "★ ";
  color: #f59e0b;
}

.muted {
  color: #9ca3af;
  font-size: 13px;
}

.privacy-tag {
  display: inline-block;
  margin-left: 6px;
  font-size: 11px;
  line-height: 1.6;
  color: #9ca3af;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 0 7px;
  vertical-align: middle;
}

.hidden-tag {
  margin-left: 6px;
}

.visible-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.log-state {
  padding: 48px 0;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

.log-empty {
  padding: 48px 0;
  text-align: center;
}

.log-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
}

.log-empty-sub {
  margin-top: 6px;
  font-size: 13px;
  color: #9ca3af;
}

.log-action {
  display: inline-block;
  font-size: 12px;
  line-height: 1.6;
  border-radius: 999px;
  padding: 1px 10px;
}

.log-action-create {
  background: #eef2ff;
  color: #4338ca;
}

.log-action-update {
  background: #f0fdf4;
  color: #15803d;
}

.log-action-delete {
  background: #fef2f2;
  color: #b91c1c;
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

.drag-row {
  cursor: grab;
}

.drag-row:active {
  cursor: grabbing;
}

.drag-handle {
  display: inline-block;
  margin-right: 6px;
  color: #9ca3af;
  user-select: none;
  cursor: grab;
}

.person-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
  vertical-align: middle;
  margin-right: 8px;
  box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.2);
}

.log-pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>


.person-avatar-char {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #eef2ff;
  color: #4f7cff;
  font-weight: 700;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  margin-right: 8px;
}

/* ===== 座驾（1.2.0） ===== */
.cars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.car-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.car-head {
  display: flex;
  gap: 12px;
  align-items: center;
}

.car-cover {
  width: 84px;
  height: 62px;
  border-radius: 10px;
  flex: none;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
}

.car-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.car-cover-icon {
  font-size: 30px;
}

/* 性别统一徽章：男=酷（冷色硬朗）/ 女=可爱（粉彩圆润）/ 未关联=中性 */
.car-cover-cool {
  background: linear-gradient(135deg, #1f2937, #0f172a 60%, #1e3a8a);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.45);
}

.car-cover-cool .car-cover-icon {
  filter: drop-shadow(0 0 6px rgba(96, 165, 250, 0.65));
}

.car-cover-cute {
  background: linear-gradient(135deg, #ffe4ef, #ffd1e6 55%, #fff1f7);
  box-shadow: inset 0 0 0 1px rgba(244, 114, 182, 0.35);
}

.car-cover-neutral {
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
}

.car-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.car-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.car-sub {
  font-size: 12.5px;
  color: #4b5563;
  overflow: hidden;
  text-overflow: ellipsis;
}

.car-sub.note {
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.car-sub.muted {
  color: #9ca3af;
}

.car-events {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.car-event {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
}

.car-event.soon {
  background: #fff7ed;
  color: #c2410c;
}

.car-event.overdue {
  background: #fef2f2;
  color: #b91c1c;
}

.car-event.more {
  background: #f3f4f6;
  color: #6b7280;
}

.car-actions {
  margin-top: 4px;
}

