<template>
  <VModal
    :visible="visible"
    :title="car ? '编辑座驾' : '新增座驾'"
    width="760"
    @close="close"
  >
    <div class="form">
      <!-- ===== 基本信息 ===== -->
      <div class="section-title">基本信息</div>
      <div class="row">
        <label class="field half">
          <span class="label">名称/昵称 *</span>
          <input v-model="form.displayName" class="input" placeholder="例如：小白" />
        </label>
        <label class="field half">
          <span class="label">车牌号</span>
          <input v-model="form.plateNo" class="input" placeholder="例如：粤B12345（前台永远脱敏显示）" />
        </label>
      </div>
      <div class="row">
        <label class="field half">
          <span class="label">品牌</span>
          <input v-model="form.brand" class="input" placeholder="例如：比亚迪" />
        </label>
        <label class="field half">
          <span class="label">车系型号</span>
          <input v-model="form.model" class="input" placeholder="例如：汉 EV 2024 款" />
        </label>
      </div>
      <div class="row">
        <label class="field half">
          <span class="label">车辆分类</span>
          <select v-model="form.vehicleType" class="input">
            <option v-for="t in VEHICLE_TYPES" :key="t.value" :value="t.value">
              {{ t.icon }} {{ t.label }}
            </option>
          </select>
        </label>
        <label class="field half">
          <span class="label">能源类型</span>
          <select v-model="form.energyType" class="input">
            <option v-for="e in ENERGY_TYPES" :key="e.value" :value="e.value">{{ e.label }}</option>
          </select>
        </label>
      </div>
      <div class="row">
        <label class="field half">
          <span class="label">颜色</span>
          <input v-model="form.color" class="input" placeholder="例如：珍珠白" />
        </label>
        <label class="field half">
          <span class="label">状态</span>
          <select v-model="form.status" class="input">
            <option v-for="s in VEHICLE_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </label>
      </div>

      <!-- ===== 证照与里程 ===== -->
      <div class="section-title">证照与里程（敏感字段仅后台可见）</div>
      <div class="row">
        <label class="field half">
          <span class="label">车架号 VIN</span>
          <input v-model="form.vin" class="input" placeholder="仅后台" />
        </label>
        <label class="field half">
          <span class="label">发动机号</span>
          <input v-model="form.engineNo" class="input" placeholder="仅后台" />
        </label>
      </div>
      <div class="row">
        <label class="field half">
          <span class="label">首次登记日期（用于年检推算）</span>
          <input ref="registeredDateInput" v-model="form.registeredDate" type="date" class="input" />
        </label>
        <label class="field half">
          <span class="label">购买日期</span>
          <input v-model="form.purchaseDate" type="date" class="input" />
        </label>
      </div>
      <div class="row">
        <label class="field half">
          <span class="label">购买价格（元，仅后台）</span>
          <input v-model.number="form.purchasePrice" type="number" min="0" step="100" class="input" placeholder="可选" />
        </label>
        <label class="field half">
          <span class="label">当前里程（km）</span>
          <input v-model.number="form.mileageKm" type="number" min="0" step="100" class="input" placeholder="例如：12000" />
        </label>
      </div>
      <label class="field">
        <span class="label">里程更新日期</span>
        <input v-model="form.mileageUpdatedAt" type="date" class="input" />
      </label>

      <!-- ===== 保险公司（车辆级） ===== -->
      <div class="field">
        <span class="label">保险公司（车辆级：车下所有险种共用，仅后台可见）</span>
        <input
          v-model="form.insurer"
          class="input"
          list="insurer-options"
          placeholder="例如：中国人保（留空表示未填写，逐个险种仍可单独指定）"
        />
        <datalist id="insurer-options">
          <option v-for="name in COMMON_INSURERS" :key="name" :value="name" />
        </datalist>
        <div class="chip-row">
          <span class="hint">常用：</span>
          <button
            v-for="name in COMMON_INSURERS.slice(0, 6)"
            :key="name"
            type="button"
            class="chip"
            @click="form.insurer = name"
          >
            {{ name }}
          </button>
          <button v-if="form.insurer" type="button" class="chip chip-clear" @click="form.insurer = ''">
            清空
          </button>
        </div>
      </div>

      <!-- ===== 关联人员 ===== -->
      <div class="section-title">关联人员（可选，用于统一徽章与前台显示）</div>
      <div class="row">
        <label class="field half">
          <span class="label">车主</span>
          <select v-model="form.ownerName" class="input">
            <option value="">不关联</option>
            <option v-for="p in persons" :key="p.metadata.name" :value="p.metadata.name">
              {{ personTitle(p) }}
            </option>
          </select>
        </label>
        <div class="field half">
          <span class="label">常用驾驶人（可多选）</span>
          <div class="person-checks">
            <label v-for="p in persons" :key="p.metadata.name" class="check">
              <input
                type="checkbox"
                :checked="form.driverNames.includes(p.metadata.name)"
                @change="toggleDriver(p.metadata.name)"
              />
              <span>{{ p.displayName || p.spec.displayName }}</span>
            </label>
            <span v-if="!persons.length" class="hint">暂无人员，可先到「人员」页签添加。</span>
          </div>
        </div>
      </div>

      <!-- ===== 相册 ===== -->
      <div class="section-title">相册（多图，可勾选是否在前台展示）</div>
      <div class="album-actions">
        <VButton size="sm" :loading="uploading" @click="triggerUpload">上传图片</VButton>
        <VButton size="sm" @click="openLibrary">从附件库选择</VButton>
        <span class="hint">
          使用「附件设置」中的存储策略与分类；勾选「展示」的照片才会出现在前台相册，未勾选的仅后台可见（适合证件类照片）。
        </span>
      </div>
      <input ref="fileInput" type="file" accept="image/*" multiple class="hidden-file" @change="onFileChange" />
      <div v-if="!form.photos.length" class="hint" style="padding: 6px 0">还没有照片，先加几张吧～</div>
      <div v-else class="album-list">
        <div
          v-for="(p, idx) in form.photos"
          :key="p.url + idx"
          class="album-item"
          draggable="true"
          @dragstart="dragIndex = idx"
          @dragover.prevent
          @drop="dropPhoto(idx)"
        >
          <span class="drag-handle" title="拖拽排序">⠿</span>
          <img :src="p.url" alt="" class="thumb" />
          <div class="album-meta">
            <span class="album-name">{{ p.name || "未命名" }}</span>
            <div class="album-tags">
              <label class="check">
                <input type="radio" :checked="p.isCover" @change="setCover(idx)" />
                <span>封面</span>
              </label>
              <label class="check">
                <input v-model="p.frontVisible" type="checkbox" />
                <span>展示</span>
              </label>
            </div>
          </div>
          <VButton size="sm" type="danger" @click="form.photos.splice(idx, 1)">移除</VButton>
        </div>
      </div>

      <!-- ===== 到期提醒 ===== -->
      <div class="section-title">到期提醒（保险 / 年检 / 保养 / 车船税…）</div>
      <p class="hint">
        年检默认提前 30 天提醒（办理含上线检验通常需 2–3 个工作日，建议提前安排）；保险类默认每年循环，
        年检按首次登记日期与车型规则自动推算，均可手动覆盖；循环间隔选「不循环」表示提醒一次后不再滚动。
      </p>
      <div v-for="(r, idx) in form.reminders" :key="idx" class="reminder-card">
        <!-- 第 1 行：项目 / 名称 / 保单号 / 到期日 -->
        <div class="row">
          <label class="field third">
            <span class="label">项目</span>
            <select v-model="r.key" class="input" @change="onReminderKeyChange(r)">
              <option v-for="p in REMINDER_PRESETS" :key="p.key" :value="p.key">{{ p.label }}</option>
            </select>
          </label>
          <label v-if="r.key === 'CUSTOM'" class="field third">
            <span class="label">名称</span>
            <input v-model="r.label" class="input" placeholder="例如：轮胎更换" />
          </label>
          <label v-if="isInsurance(r.key)" class="field third">
            <span class="label">保单号（仅后台）</span>
            <input v-model="r.policyNo" class="input" placeholder="仅后台" />
          </label>
          <label class="field third">
            <span class="label">到期日</span>
            <input v-if="dateLocked(r)" class="input locked" :value="lockedDateText(r)" disabled />
            <input v-else v-model="r.date" type="date" class="input" />
          </label>
        </div>

        <!-- 第 2 行：提前天数 / 循环间隔 -->
        <div class="row">
          <label class="field third">
            <span class="label">提前提醒天数</span>
            <input
              v-model.number="r.remindDays"
              type="number"
              min="0"
              class="input"
              :placeholder="`默认 ${presetDays(r.key)}`"
            />
          </label>
          <label class="field third">
            <span class="label">循环间隔</span>
            <select class="input" :value="repeatSelectValue(r)" @change="onRepeatSelect(r, $event)">
              <option v-for="o in REPEAT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              <option :value="REPEAT_CUSTOM">自定义月数…</option>
            </select>
          </label>
          <label v-if="isCustomRepeat(r)" class="field third">
            <span class="label">自定义月数</span>
            <input v-model.number="r.customMonths" type="number" min="1" class="input" placeholder="例如：18" />
          </label>
        </div>

        <!-- B 年检：按规则自动推算 / 手动指定 -->
        <div v-if="r.key === 'INSPECTION'" class="sub-box">
          <label class="check">
            <input type="checkbox" :checked="r.manualDate === true" @change="toggleManualDate(r, $event)" />
            <span>手动指定日期</span>
          </label>
          <template v-if="r.manualDate !== true">
            <div v-if="inspectionPreview().date" class="hint strong">
              按规则自动推算：{{ inspectionPreview().date }}（{{ inspectionPreview().phase }}）
            </div>
            <div class="hint" :class="{ warn: !inspectionPreview().date }">{{ inspectionPreview().rule }}</div>
            <div v-if="!registrationBase" class="hint warn">
              请先填写首次登记日期（或购买日期）用于自动推算；
              <button type="button" class="link-btn" @click="focusRegisteredDate">去填写</button>
            </div>
            <div v-else class="hint">
              推算依据：首次登记日期 {{ registrationBase }}
              <template v-if="!form.registeredDate">（暂无登记日期，暂用购买日期，建议补充更准确）</template>
            </div>
          </template>
          <div v-else class="hint">已改为手动指定：以上方「到期日」为准，清空则不提醒年检。</div>
        </div>

        <!-- C 与保险同期 -->
        <div v-if="isSyncable(r.key)" class="sub-box">
          <label class="check">
            <input type="checkbox" :checked="syncChecked(r)" @change="toggleSync(r, $event)" />
            <span>与保险同期（跟随交强险到期日）</span>
          </label>
          <div v-if="syncChecked(r)" class="hint">
            <template v-if="compulsoryDate">已联动：{{ compulsoryDate }}（与交强险同日）</template>
            <template v-else>还没有交强险到期日：请先在「交强险」项填写，或取消勾选后独立填写。</template>
          </div>
        </div>

        <!-- 保养：按上次保养推算 -->
        <div v-if="r.key === 'MAINTENANCE'" class="sub-box">
          <div class="row">
            <label class="field third">
              <span class="label">上次保养日期</span>
              <input v-model="r.lastServiceDate" type="date" class="input" />
            </label>
            <label class="field third">
              <span class="label">保养间隔月数</span>
              <input v-model.number="r.intervalMonths" type="number" min="0" class="input" placeholder="例如：6" />
            </label>
            <label class="field third">
              <span class="label">上次保养里程</span>
              <input v-model.number="r.lastServiceKm" type="number" min="0" class="input" placeholder="例如：10000" />
            </label>
          </div>
          <div class="hint">「保养间隔月数」用于按上次保养日期推算下次到期日；「循环间隔」用于到期后是否继续滚动。</div>
        </div>

        <!-- 保险：可选覆盖车辆级保险公司 -->
        <div v-if="isInsurance(r.key)" class="sub-box">
          <label class="check">
            <input type="checkbox" :checked="r.overrideInsurer === true" @change="toggleOverrideInsurer(r, $event)" />
            <span>使用其他保险公司</span>
          </label>
          <div v-if="r.overrideInsurer === true" class="row">
            <label class="field half">
              <span class="label">本项保险公司（覆盖车辆级）</span>
              <input v-model="r.insurer" class="input" list="insurer-options" placeholder="例如：中国平安" />
            </label>
          </div>
          <div v-else class="hint">本项使用车辆级保险公司：{{ form.insurer || "（车辆级尚未填写）" }}</div>
        </div>

        <div class="reminder-footer">
          <label class="check">
            <input v-model="r.enabled" type="checkbox" />
            <span>启用提醒</span>
          </label>
          <VButton size="sm" type="danger" @click="form.reminders.splice(idx, 1)">删除此项</VButton>
        </div>
      </div>
      <div>
        <VButton size="sm" @click="addReminder">+ 添加到期项</VButton>
      </div>

      <!-- ===== 备注与属性 ===== -->
      <label class="field">
        <span class="label">备注</span>
        <textarea v-model="form.note" class="input textarea" rows="3" placeholder="例如：首保已做、轮胎品牌等"></textarea>
      </label>
      <div class="field">
        <span class="label">属性</span>
        <div class="person-checks">
          <label class="check">
            <input v-model="form.important" type="checkbox" />
            <span>参与提醒（保险/年检/保养等到期会出现在仪表盘与弹窗）</span>
          </label>
          <label class="check">
            <input v-model="form.visible" type="checkbox" />
            <span>前台展示（「爱车」视图可见，车牌自动脱敏）</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 附件库多选浮层（Teleport 到 body：避免 VModal 插槽内的 DOM 插入冲突） -->
    <Teleport to="body">
    <div v-if="libVisible" class="lib-overlay" @click.self="closeLib">
      <div class="lib-panel">
        <div class="lib-header">
          <span class="lib-title">从附件库选择照片（可多选）</span>
          <button type="button" class="lib-close" aria-label="Close" @click="closeLib">✕</button>
        </div>
        <div class="lib-scope-note lib-group-hint">{{ libGroupHint }}</div>
        <div class="lib-scope-bar">
          <label class="check">
            <input type="checkbox" :checked="showAllLib" @change="toggleShowAll" />
            <span>显示全部图片（忽略分类 / 策略）</span>
          </label>
          <span class="hint">
            当前显示 <b>{{ libItems.length }}</b> 张 · 附件库共 <b>{{ libScope.total }}</b> 张图片
          </span>
        </div>
        <div class="lib-body">
          <div v-if="libLoading" class="lib-loading">正在读取附件库…</div>
          <div v-else-if="libError" class="lib-error">
            {{ libError }}
            <VButton size="sm" @click="fetchLibrary">重试</VButton>
          </div>
          <div v-else-if="!libItems.length" class="lib-empty">
            <template v-if="libScope.total === 0">
              附件库里还没有图片：点上方「上传图片」，或到后台「附件」页面添加后再回来。
            </template>
            <template v-else>
              没有符合条件的图片（{{ libGroupHint }}）。
              <VButton size="sm" @click="toggleShowAll">显示全部图片</VButton>
            </template>
          </div>
          <div v-else class="lib-grid">
            <div
              v-for="a in libItems"
              :key="a.name"
              class="lib-item"
              :class="{ selected: libSelected.includes(a.permalink) }"
              @click="toggleLibItem(a.permalink)"
            >
              <img :src="a.permalink" alt="" loading="lazy" />
              <span class="lib-name">{{ a.displayName }}</span>
            </div>
          </div>
        </div>
        <div class="lib-footer">
          <VSpace>
            <VButton @click="closeLib">取消</VButton>
            <VButton type="secondary" :disabled="!libSelected.length" @click="chooseLib">
              添加所选（{{ libSelected.length }}）
            </VButton>
          </VSpace>
        </div>
      </div>
    </div>
    </Teleport>

    <template #footer>
      <VSpace>
        <VButton @click="close">取消</VButton>
        <VButton type="secondary" :loading="saving" @click="save">保存</VButton>
      </VSpace>
    </template>
  </VModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Toast, VButton, VModal, VSpace } from "@halo-dev/components";
import { axiosInstance } from "@halo-dev/api-client";
import { createCar, fetchPluginJsonConfig, listPersons, updateCar } from "@/api";
import {
  ENERGY_TYPES,
  REMINDER_PRESETS,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  type Car,
  type CarPhoto,
  type CarReminder,
  type EnergyType,
  type Person,
  type VehicleStatus,
  type VehicleType,
} from "@/types";
import {
  COMMON_INSURERS,
  REPEAT_CUSTOM,
  REPEAT_OPTIONS,
  defaultRepeatMonths,
  insuranceKey,
  nextInspection,
  syncableKey,
} from "@/utils/vehicle";
import {
  UNGROUPED,
  fetchGroups,
  fetchImageLibrary,
  fetchPolicies,
  groupLabelOf,
  policyLabelOf,
  readAttachmentScope,
  resolveScope,
  scopeHint,
  type AttachmentItem,
  type NamedOption,
  type ScopeResult,
} from "@/utils/attachmentLibrary";

const props = defineProps<{
  visible: boolean;
  car: Car | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "saved"): void;
}>();

/** 表单内的到期项：在存储字段之外附带若干界面状态（保存时不写入） */
interface FormReminder extends CarReminder {
  /** 年检：手动指定日期（关闭时按登记日期 + 车型规则自动推算） */
  manualDate?: boolean;
  /** 年检 / 车船税：与交强险同期（默认开） */
  syncInsurance?: boolean;
  /** 循环间隔：选择「自定义月数」 */
  customRepeat?: boolean;
  /** 循环间隔：自定义月数输入值 */
  customMonths?: number;
  /** 保险项：覆盖车辆级保险公司 */
  overrideInsurer?: boolean;
}

interface CarForm {
  displayName: string;
  brand: string;
  model: string;
  plateNo: string;
  vehicleType: VehicleType;
  energyType: EnergyType;
  color: string;
  vin: string;
  engineNo: string;
  registeredDate: string;
  purchaseDate: string;
  insurer: string;
  purchasePrice: number | null;
  mileageKm: number | null;
  mileageUpdatedAt: string;
  status: VehicleStatus;
  photos: CarPhoto[];
  ownerName: string;
  driverNames: string[];
  note: string;
  visible: boolean;
  important: boolean;
  reminders: FormReminder[];
}

const empty = (): CarForm => ({
  displayName: "",
  brand: "",
  model: "",
  plateNo: "",
  vehicleType: "SEDAN",
  energyType: "FUEL",
  color: "",
  vin: "",
  engineNo: "",
  registeredDate: "",
  purchaseDate: "",
  insurer: "",
  purchasePrice: null,
  mileageKm: null,
  mileageUpdatedAt: "",
  status: "IN_USE",
  photos: [],
  ownerName: "",
  driverNames: [],
  note: "",
  visible: false,
  important: true,
  reminders: [],
});

const form = reactive<CarForm>(empty());
const saving = ref(false);
const uploading = ref(false);
const persons = ref<Person[]>([]);
const fileInput = ref<HTMLInputElement>();
const registeredDateInput = ref<HTMLInputElement>();
const dragIndex = ref(-1);

// 附件库多选
const libVisible = ref(false);
const libLoading = ref(false);
const libError = ref("");
const libAllItems = ref<AttachmentItem[]>([]);
const libItems = ref<AttachmentItem[]>([]);
const libSelected = ref<string[]>([]);
const showAllLib = ref(false);
const libScope = ref<ScopeResult>({
  kind: "all",
  items: [],
  strictCount: 0,
  groupCount: 0,
  policyCount: 0,
  total: 0,
});
const libGroups = ref<NamedOption[]>([]);
const libPolicies = ref<NamedOption[]>([]);
const libGroupName = ref("");
const libPolicyName = ref("");

const libGroupLabel = computed(() => groupLabelOf(libGroupName.value, libGroups.value));
const libPolicyLabel = computed(() => policyLabelOf(libPolicyName.value, libPolicies.value));

const libGroupHint = computed(() =>
  scopeHint(libScope.value, { group: libGroupLabel.value, policy: libPolicyLabel.value })
);

function personTitle(p: Person): string {
  return p.spec.nickname ? `${p.spec.displayName}（${p.spec.nickname}）` : p.spec.displayName;
}

function toggleDriver(name: string) {
  const idx = form.driverNames.indexOf(name);
  if (idx >= 0) {
    form.driverNames.splice(idx, 1);
  } else {
    form.driverNames.push(name);
  }
}

function isInsurance(key?: string): boolean {
  return insuranceKey(key);
}

function isSyncable(key?: string): boolean {
  return syncableKey(key);
}

function presetDays(key?: string): number {
  return REMINDER_PRESETS.find((p) => p.key === key)?.defaultDays ?? 7;
}

/** 交强险到期日（年检 / 车船税「与保险同期」的联动基准） */
const compulsoryDate = computed(
  () => form.reminders.find((r) => r.key === "INSURANCE_COMPULSORY" && r.enabled !== false)?.date || ""
);

/** 年检推算基准：首次登记日期优先，其次购买日期 */
const registrationBase = computed(() => form.registeredDate || form.purchaseDate || "");

/** 年检规则推算结果（展示用；最终以服务端计算为准） */
function inspectionPreview() {
  return nextInspection(registrationBase.value, form.vehicleType);
}

function focusRegisteredDate() {
  registeredDateInput.value?.scrollIntoView({ behavior: "smooth", block: "center" });
  registeredDateInput.value?.focus();
}

function syncChecked(r: FormReminder): boolean {
  return isSyncable(r.key) && r.syncInsurance !== false;
}

/** 到期日是否由规则决定（与保险同期 / 年检自动推算），此时手填输入框禁用 */
function dateLocked(r: FormReminder): boolean {
  if (syncChecked(r) && compulsoryDate.value) return true;
  return r.key === "INSPECTION" && r.manualDate !== true;
}

function lockedDateText(r: FormReminder): string {
  if (syncChecked(r) && compulsoryDate.value) return compulsoryDate.value;
  if (r.key === "INSPECTION" && r.manualDate !== true) return inspectionPreview().date || "";
  return "";
}

function toggleSync(r: FormReminder, e: Event) {
  const on = (e.target as HTMLInputElement).checked;
  r.syncInsurance = on;
  // 「与保险同期」= 日期由交强险决定；勾选时自然取消「手动指定日期」
  if (on && r.key === "INSPECTION") {
    r.manualDate = false;
  }
}

function toggleManualDate(r: FormReminder, e: Event) {
  const manual = (e.target as HTMLInputElement).checked;
  r.manualDate = manual;
  if (manual) {
    // 「手动指定日期」= 自行填写；必须取消与保险同期，否则日期仍被联动锁住
    r.syncInsurance = false;
    // 用推算结果预填，方便微调
    if (!r.date) {
      r.date = inspectionPreview().date || "";
    }
    return;
  }
  // 取消手动指定 → 回到自动：年检/车船税恢复默认「与保险同期」，手填日期不再保留
  r.date = "";
  r.syncInsurance = isSyncable(r.key) ? true : undefined;
}

function toggleOverrideInsurer(r: FormReminder, e: Event) {
  const on = (e.target as HTMLInputElement).checked;
  r.overrideInsurer = on;
  if (!on) {
    r.insurer = undefined;
  }
}

function repeatSelectValue(r: FormReminder): number {
  if (r.customRepeat) return REPEAT_CUSTOM;
  return r.repeatMonths != null ? Number(r.repeatMonths) : defaultRepeatMonths(r.key);
}

function isCustomRepeat(r: FormReminder): boolean {
  return r.customRepeat === true;
}

function onRepeatSelect(r: FormReminder, e: Event) {
  const value = Number((e.target as HTMLSelectElement).value);
  if (value === REPEAT_CUSTOM) {
    r.customRepeat = true;
    if (r.customMonths == null) {
      r.customMonths = r.repeatMonths != null && r.repeatMonths > 0 ? Number(r.repeatMonths) : 18;
    }
    return;
  }
  r.customRepeat = false;
  r.customMonths = undefined;
  r.repeatMonths = value;
}

/** 保存时使用的循环间隔（月）：0 = 不循环 */
function effectiveRepeat(r: FormReminder): number {
  if (r.customRepeat) {
    const months = Number(r.customMonths);
    return Number.isFinite(months) && months > 0 ? Math.floor(months) : 12;
  }
  return r.repeatMonths != null ? Number(r.repeatMonths) : defaultRepeatMonths(r.key);
}

/** 保存时写入的到期日：同期项取交强险日期；年检自动推算时留空交给服务端 */
function saveDate(r: FormReminder): string | undefined {
  if (syncChecked(r) && compulsoryDate.value) return compulsoryDate.value;
  if (r.key === "INSPECTION" && r.manualDate !== true) return undefined;
  return r.date || undefined;
}

function addReminder() {
  form.reminders.push({
    key: "INSURANCE_COMPULSORY",
    date: "",
    enabled: true,
    remindDays: presetDays("INSURANCE_COMPULSORY"),
    repeatMonths: defaultRepeatMonths("INSURANCE_COMPULSORY"),
  });
}

function onReminderKeyChange(r: FormReminder) {
  const preset = REMINDER_PRESETS.find((p) => p.key === r.key);
  if (preset && (r.remindDays === undefined || r.remindDays === null)) {
    r.remindDays = preset.defaultDays;
  }
  // 项目切换后回到该项目的默认规则
  r.repeatMonths = defaultRepeatMonths(r.key);
  r.customRepeat = false;
  r.customMonths = undefined;
  r.manualDate = r.key === "INSPECTION" ? false : undefined;
  r.syncInsurance = isSyncable(r.key) ? true : undefined;
  if (!insuranceKey(r.key)) {
    r.overrideInsurer = undefined;
    r.insurer = undefined;
  }
}

function setCover(idx: number) {
  form.photos.forEach((p, i) => {
    p.isCover = i === idx;
  });
}

function dropPhoto(target: number) {
  const from = dragIndex.value;
  dragIndex.value = -1;
  if (from < 0 || from === target) return;
  const arr = [...form.photos];
  const [moved] = arr.splice(from, 1);
  arr.splice(target, 0, moved);
  form.photos = arr;
}

async function loadSettings() {
  try {
    const cfg = await fetchPluginJsonConfig("plugin-important-dates");
    const scope = await readAttachmentScope(cfg as Record<string, unknown> | undefined, true);
    libGroupName.value = scope.groupName;
    libPolicyName.value = scope.policyName;
  } catch {
    libGroupName.value = "";
    libPolicyName.value = "";
  }
}

/** 上传用的存储策略：设置中指定优先，否则取系统第一条可见策略 */
async function resolvePolicyName(): Promise<string> {
  if (libPolicyName.value && libPolicyName.value !== UNGROUPED) return libPolicyName.value;
  const policies = await fetchPolicies();
  return policies[0]?.name || "default-policy";
}

function triggerUpload() {
  fileInput.value?.click();
}

async function uploadOne(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("policyName", await resolvePolicyName());
  // __ungrouped__（未分组）不应作为分组名提交
  if (libGroupName.value && libGroupName.value !== UNGROUPED) {
    fd.append("groupName", libGroupName.value);
  }
  const { data } = await axiosInstance.post<{ status?: { permalink?: string } }>(
    "/apis/api.console.halo.run/v1alpha1/attachments/upload",
    fd
  );
  return data?.status?.permalink || null;
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = "";
  if (!files.length) return;
  uploading.value = true;
  try {
    await loadSettings();
    let added = 0;
    for (const f of files) {
      const url = await uploadOne(f);
      if (url) {
        form.photos.push({
          url,
          name: f.name,
          isCover: form.photos.length === 0,
          sortOrder: form.photos.length,
          frontVisible: true,
        });
        added++;
      }
    }
    Toast.success(`已上传 ${added} 张照片`);
  } catch (error) {
    Toast.error(`上传失败：${(error as Error)?.message || "请稍后重试"}`);
  } finally {
    uploading.value = false;
  }
}

async function fetchLibrary() {
  libLoading.value = true;
  libError.value = "";
  try {
    await loadSettings();
    const [items, groups, policies] = await Promise.all([
      fetchImageLibrary(),
      fetchGroups(),
      fetchPolicies(),
    ]);
    libAllItems.value = items;
    libGroups.value = groups;
    libPolicies.value = policies;
    applyScope();
  } catch (error) {
    libError.value = `加载附件库失败：${(error as Error)?.message || "请稍后重试"}`;
    libAllItems.value = [];
    libItems.value = [];
  } finally {
    libLoading.value = false;
  }
}

/** 按「分类 + 策略」解析展示范围：命中为空时依次放宽并说明，避免显示 0 张 */
function applyScope() {
  const scope = resolveScope(libAllItems.value, libGroupName.value, libPolicyName.value);
  libScope.value = scope;
  libItems.value = showAllLib.value ? libAllItems.value : scope.items;
}

function toggleShowAll() {
  showAllLib.value = !showAllLib.value;
  libSelected.value = [];
  applyScope();
}
function openLibrary() {
  libVisible.value = true;
  libSelected.value = [];
  showAllLib.value = false;
  void fetchLibrary();
}

function toggleLibItem(url: string) {
  const idx = libSelected.value.indexOf(url);
  if (idx >= 0) {
    libSelected.value.splice(idx, 1);
  } else {
    libSelected.value.push(url);
  }
}

function chooseLib() {
  let added = 0;
  for (const url of libSelected.value) {
    if (form.photos.some((p) => p.url === url)) continue;
    form.photos.push({
      url,
      name: url.split("/").pop() || "",
      isCover: form.photos.length === 0,
      sortOrder: form.photos.length,
      frontVisible: true,
    });
    added++;
  }
  libVisible.value = false;
  Toast.success(added ? `已添加 ${added} 张照片` : "所选照片已在相册中");
}

function closeLib() {
  libVisible.value = false;
  libSelected.value = [];
}

function close() {
  emit("update:visible", false);
}

const REQUIRED_MESSAGE = "请填写名称";

async function save() {
  if (!form.displayName.trim()) {
    Toast.warning(REQUIRED_MESSAGE);
    return;
  }
  saving.value = true;
  try {
    const photos = form.photos.map((p, i) => ({
      url: p.url,
      name: p.name || undefined,
      isCover: !!p.isCover || (i === 0 && !form.photos.some((x) => x.isCover)),
      sortOrder: i,
      frontVisible: p.frontVisible !== false,
    }));
    const payload: Car = {
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "Car",
      metadata: {
        name: props.car?.metadata.name || `car-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...(props.car?.metadata || {}),
      },
      spec: {
        displayName: form.displayName.trim(),
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        plateNo: form.plateNo.trim() || undefined,
        vehicleType: form.vehicleType,
        energyType: form.energyType,
        color: form.color.trim() || undefined,
        vin: form.vin.trim() || undefined,
        engineNo: form.engineNo.trim() || undefined,
        registeredDate: form.registeredDate || undefined,
        purchaseDate: form.purchaseDate || undefined,
        insurer: form.insurer.trim() || undefined,
        purchasePrice: form.purchasePrice ?? undefined,
        mileageKm: form.mileageKm ?? undefined,
        mileageUpdatedAt: form.mileageUpdatedAt || undefined,
        status: form.status,
        photos,
        ownerName: form.ownerName || undefined,
        driverNames: [...form.driverNames],
        note: form.note.trim() || undefined,
        visible: form.visible,
        important: form.important,
        sortOrder: props.car?.spec.sortOrder ?? 0,
        // 车辆级字段之外，保留非表单字段（如年检提示确认标记）
        inspectionNoticeAck: props.car?.spec.inspectionNoticeAck,
        reminders: form.reminders.map((r) => ({
          key: r.key || "CUSTOM",
          label: r.label?.trim() || undefined,
          date: saveDate(r),
          remindDays: r.remindDays ?? undefined,
          enabled: r.enabled !== false,
          insurer: insuranceKey(r.key) && r.overrideInsurer === true ? r.insurer?.trim() || undefined : undefined,
          policyNo: insuranceKey(r.key) ? r.policyNo?.trim() || undefined : undefined,
          repeatMonths: effectiveRepeat(r),
          intervalMonths: r.intervalMonths ?? undefined,
          intervalKm: r.intervalKm ?? undefined,
          lastServiceDate: r.lastServiceDate || undefined,
          lastServiceKm: r.lastServiceKm ?? undefined,
        })),
      },
    };
    if (props.car) {
      await updateCar(payload);
      Toast.success("已保存");
    } else {
      await createCar(payload);
      Toast.success("已新增");
    }
    emit("saved");
    close();
  } catch (error) {
    Toast.error(`保存失败：${(error as Error)?.message || "未知错误"}`);
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.visible,
  async (v) => {
    if (!v) return;
    void loadSettings();
    try {
      persons.value = await listPersons();
    } catch {
      persons.value = [];
    }
    const c = props.car;
    if (c) {
      const s = c.spec;
      const rawReminders = s.reminders || [];
      const compulsoryRaw = rawReminders.find(
        (r) => r.key === "INSURANCE_COMPULSORY" && r.enabled !== false
      );
      const compulsoryRawDate = compulsoryRaw?.date || "";
      Object.assign(form, {
        displayName: s.displayName || "",
        brand: s.brand || "",
        model: s.model || "",
        plateNo: s.plateNo || "",
        vehicleType: s.vehicleType || "SEDAN",
        energyType: s.energyType || "FUEL",
        color: s.color || "",
        vin: s.vin || "",
        engineNo: s.engineNo || "",
        registeredDate: s.registeredDate || "",
        purchaseDate: s.purchaseDate || "",
        insurer: s.insurer || "",
        purchasePrice: s.purchasePrice ?? null,
        mileageKm: s.mileageKm ?? null,
        mileageUpdatedAt: s.mileageUpdatedAt || "",
        status: s.status || "IN_USE",
        photos: (s.photos || []).map((p, i) => ({ ...p, sortOrder: p.sortOrder ?? i })),
        ownerName: s.ownerName || "",
        driverNames: [...(s.driverNames || [])],
        note: s.note || "",
        visible: s.visible === true,
        important: s.important !== false,
        reminders: rawReminders.map((r) => {
          const item: FormReminder = { ...r };
          // 循环间隔：未设置时按项目默认展示；非预设值视为「自定义月数」
          if (r.repeatMonths == null) {
            item.repeatMonths = defaultRepeatMonths(r.key);
          } else if (!REPEAT_OPTIONS.some((o) => o.value === Number(r.repeatMonths))) {
            item.customRepeat = true;
            item.customMonths = Number(r.repeatMonths);
          }
          if (isSyncable(r.key)) {
            // 未填日期或与交强险同日 → 视为「与保险同期」（1.2.1 默认口径）
            const synced = !r.date || (!!compulsoryRawDate && r.date === compulsoryRawDate);
            item.syncInsurance = synced;
            if (r.key === "INSPECTION") {
              item.manualDate = synced ? false : !!r.date;
            }
          }
          if (r.key === "INSPECTION" && item.manualDate === undefined) {
            item.manualDate = !!r.date;
          }
          if (insuranceKey(r.key)) {
            item.overrideInsurer = !!(r.insurer && r.insurer.trim());
          }
          return item;
        }),
      });
    } else {
      Object.assign(form, empty());
    }
  }
);
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 64vh;
  overflow: auto;
  padding-right: 4px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #4f7cff;
  margin-top: 6px;
}

.row {
  display: flex;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.half {
  flex: 1;
}

.third {
  flex: 1;
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

.person-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 6px 0;
}

.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}

.hint {
  font-size: 12px;
  color: #6b7280;
}

.album-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.hidden-file {
  display: none;
}

.album-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.album-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 10px;
  background: #fafafa;
}

.drag-handle {
  color: #9ca3af;
  cursor: grab;
  user-select: none;
}

.thumb {
  width: 56px;
  height: 42px;
  object-fit: cover;
  border-radius: 6px;
  flex: none;
}

.album-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.album-name {
  font-size: 13px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-tags {
  display: flex;
  gap: 14px;
}

.reminder-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fbfbfd;
}

.reminder-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lib-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lib-panel {
  width: 760px;
  max-width: calc(100vw - 40px);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lib-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
}

.lib-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.lib-group-hint {
  margin-left: auto;
  font-size: 12px;
  color: #6b7280;
}

.lib-close {
  border: none;
  background: transparent;
  font-size: 15px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.lib-scope-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
  font-size: 12px;
  flex-wrap: wrap;
}

.lib-empty {
  padding: 22px 4px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.9;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.lib-loading {
  padding: 22px 4px;
  color: #6b7280;
  font-size: 13px;
}

.lib-loading::after {
  content: "";
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-left: 8px;
  border: 2px solid #c7d2fe;
  border-top-color: #4f7cff;
  border-radius: 50%;
  animation: lib-spin .8s linear infinite;
  vertical-align: middle;
}

@keyframes lib-spin {
  to { transform: rotate(360deg); }
}

.lib-body {
  padding: 16px 18px;
  max-height: 420px;
  overflow: auto;
}

.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 150px);
  gap: 12px;
}

.lib-item {
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background: #f9fafb;
  text-align: center;
}

.lib-item.selected {
  border-color: #4f7cff;
}

.lib-item img {
  width: 150px;
  height: 110px;
  object-fit: cover;
  display: block;
}

.lib-name {
  display: block;
  font-size: 12px;
  color: #6b7280;
  padding: 5px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lib-error {
  padding: 20px 4px;
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 12px;
}

.lib-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 18px;
  border-top: 1px solid #e5e7eb;
}

/* ===== 1.2.1：保险公司快捷输入、到期项子块 ===== */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.chip {
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #4b5563;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  cursor: pointer;
}

.chip:hover {
  border-color: #4f7cff;
  color: #4f7cff;
}

.chip-clear {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

.input.locked {
  background: #f3f4f6;
  color: #6b7280;
  cursor: not-allowed;
}

.sub-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px dashed #e5e7eb;
  padding-top: 8px;
}

.hint.strong {
  color: #1d4ed8;
}

.hint.warn {
  color: #b45309;
}

.link-btn {
  border: none;
  background: transparent;
  color: #4f7cff;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

/* 附件库范围说明：单独一行，避免长文案挤压标题（1.2.2） */
.lib-scope-note {
  padding: 6px 18px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
  line-height: 1.6;
  color: #6b7280;
}</style>

