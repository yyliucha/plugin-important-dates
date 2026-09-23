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
        <VButton v-if="brokenCount" size="sm" type="danger" @click="removeBrokenPhotos">
          移除失效图片（{{ brokenCount }}）
        </VButton>
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
          <img
            v-if="!isBrokenPhoto(p.url)"
            :src="thumb(p.url)"
            alt=""
            class="thumb"
            loading="lazy"
            @error="markPhotoFailed(p.url)"
          />
          <span v-else class="thumb thumb-broken" title="图片地址已失效">🚫</span>
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
              <span v-if="isBrokenPhoto(p.url)" class="broken-note">
                图片已不可用（附件可能已被删除）
                <button type="button" class="link-btn" @click="openLibraryFor(idx)">重新选择</button>
              </span>
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
          <VSpace>
            <span v-if="noNextNotice(r)" class="next-notice">已完成，不再提醒</span>
            <span v-else-if="nextNoticeOf(r)" class="next-notice">
              下次提醒：{{ nextNoticeOf(r) }}
            </span>
            <VButton
              v-if="r.date && !dateLocked(r) && !isDone(r)"
              size="sm"
              @click="applyDoneNow(r)"
            >
              {{ effectiveRepeat(r) > 0 ? "已办，顺延一期" : "已办（一次性，完成后不再提醒）" }}
            </VButton>
            <VButton v-if="isDone(r)" size="sm" @click="applyUndoNow(r)">撤销办理</VButton>
            <VButton size="sm" type="danger" @click="form.reminders.splice(idx, 1)">删除此项</VButton>
          </VSpace>
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
              <img :src="thumb(a.permalink)" alt="" loading="lazy" />
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
import { createCar, describeError, fetchPluginJsonConfig, listCars, listPersons, updateCar } from "@/api";
import { markReminderDone, undoReminderDone } from "@/utils/reminderActions";
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
  DEFAULT_INSPECTION_NODES,
  DEFAULT_INSPECTION_YEARLY_FROM,
  addMonths,
  defaultRepeatMonths,
  formatYmd,
  insuranceKey,
  nextInspection,
  parseInspectionNodes,
  parseYmd,
  resolveDueDate,
  startOfToday,
  syncableKey,
} from "@/utils/vehicle";
import {
  UNGROUPED,
  fetchGroups,
  fetchImageLibrary,
  fetchLivePermalinks,
  isBrokenLocalImage,
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
import { compressImage, humanSize, preloadImage, thumbUrl } from "@/utils/image";

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
  /** 载入时的原始到期日（用于在已保存数据里定位这一项） */
  originalDate?: string;
  /** 载入时的原始到期日（用于在已保存数据里定位这一项，动作立即生效时用） */
  originalDate?: string;
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

// ---------- 相册图片「引用已失效」标记（1.2.5）----------
const livePermalinks = ref<Set<string> | null>(null);
const compressUpload = ref(true);
const compressMaxWidth = ref(1920);
const thumbWidth = ref(480);
const inspectionNodes = ref<number[]>([...DEFAULT_INSPECTION_NODES]);
const inspectionYearlyFrom = ref(DEFAULT_INSPECTION_YEARLY_FROM);
const failedPhotoUrls = ref<Set<string>>(new Set());

/** 图片不可用：附件清单判定失效，或本次加载失败 */
function isBrokenPhoto(url: string): boolean {
  return isBrokenLocalImage(url, livePermalinks.value) || failedPhotoUrls.value.has(url);
}
function markPhotoFailed(url: string) {
  const next = new Set(failedPhotoUrls.value);
  next.add(url);
  failedPhotoUrls.value = next;
}
async function loadAttachmentIndex() {
  livePermalinks.value = await fetchLivePermalinks();
}

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
  return nextInspection(registrationBase.value, form.vehicleType, startOfToday(), {
    nodes: inspectionNodes.value,
    yearlyFrom: inspectionYearlyFrom.value,
  });
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

/** 本期是否已经办过（顺延后的日期就是当前到期日） */
function isDone(r: FormReminder): boolean {
  if (r.ackState === "DONE") return true;
  const to = (r.lastDoneTo || "").trim();
  return !!to && to === (r.date || "");
}

/**
 * 下次提醒日期 = **生效的到期日** − 提前天数。
 * 生效到期日与插件同一口径：保养按「上次保养 + 间隔月数」、年检按登记日期与车型规则推算，
 * 手填日期优先。已完成（一次性办完）时返回空字符串。
 */
function nextNoticeOf(r: FormReminder): string {
  // 注意：本期已办过（isDone）仍然要显示"下次提醒"——循环项/保养项办完还有下一期；
  // 只有一次性办完（ackState=DONE）才由 noNextNotice 判定为"没有下次"。
  const days = r.remindDays != null ? Number(r.remindDays) : defaultHeadDays();
  const resolved = resolveDueDate(r, {
    registeredDate: form.registeredDate || form.purchaseDate,
    vehicleType: form.vehicleType,
    today: startOfToday(),
  });
  const base = parseYmd(resolved?.date || r.date);
  if (!base) return "";
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - (Number.isFinite(days) ? days : 15));
  return formatYmd(d);
}

/**
 * 该到期项是否"没有下次"：只有**一次性事项已办完**（ackState=DONE）才是。
 * 循环项与保养项办完后依然有下一期，必须继续显示"下次提醒"。
 */
function noNextNotice(r: FormReminder): boolean {
  return r.ackState === "DONE";
}

function defaultHeadDays(): number {
  return 15;
}

/**
 * 「已办」：循环项 → 按循环间隔顺延一期；不循环（一次性）→ 标记完成，不再提醒。
 * 同一期只能办一次：办过之后按钮变为「撤销」，避免误点多次把日期滚到很远的年份。
 */
function postponeReminder(r: FormReminder) {
  const now = new Date();
  // 保养类：语义是"我刚保养完" —— 更新上次保养日期，并按保养间隔推到下次
  if (r.key === "MAINTENANCE" && r.intervalMonths != null && Number(r.intervalMonths) > 0) {
    const today = startOfToday();
    const interval = Number(r.intervalMonths);
    const previousDate = r.date || "";
    r.lastDoneFromService = r.lastServiceDate || undefined;
    r.lastServiceDate = formatYmd(today);
    r.date = formatYmd(addMonths(today, interval));
    // 记录办理前的到期日，撤销时才能还原
    r.lastDoneFrom = previousDate;
    r.lastDoneAt = `${formatYmd(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    r.lastDoneTo = r.date;
    r.ackState = "PENDING";
    r.skippedForDate = undefined;
    r.notifiedStages = [];
    r.notifiedForDate = undefined;
    Toast.success(`已办：上次保养日期更新为 ${formatYmd(today)}，下次保养 ${r.date}（间隔 ${interval} 个月）`);
    return;
  }
  const months = effectiveRepeat(r);
  const stamp = `${formatYmd(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const from = r.date || "";
  r.lastDoneAt = stamp;
  r.lastDoneFrom = from;
  r.skippedForDate = "";
  r.notifiedStages = [];
  r.notifiedForDate = "";
  if (months > 0) {
    const base = parseYmd(from) || startOfToday();
    const next = addMonths(base, months);
    r.date = formatYmd(next);
    r.lastDoneTo = r.date;
    r.ackState = "PENDING";
    Toast.success(`已办并顺延 ${months} 个月：${from || "—"} → ${r.date}（可撤销）`);
  } else {
    // 一次性事项：办完即完成
    r.ackState = "DONE";
    r.lastDoneTo = "";
    Toast.success(`已办：一次性事项已完成，不再提醒（原到期日 ${from || "—"}）`);
  }
}

/** 撤销办理：到期日还原到办理前，清空办理痕迹 */
function undoReminder(r: FormReminder) {
  const restore = r.lastDoneFrom || "";
  if (!restore) {
    Toast.error("没有可撤销的办理记录");
    return;
  }
  r.date = restore;
  if (r.lastDoneFromService !== undefined && r.lastDoneFromService !== null) {
    r.lastServiceDate = r.lastDoneFromService || undefined;
  }
  r.ackState = "PENDING";
  r.lastDoneAt = undefined;
  r.lastDoneFromService = undefined;
  r.lastDoneFrom = undefined;
  r.lastDoneTo = undefined;
  r.notifiedStages = [];
  r.notifiedForDate = undefined;
  Toast.success(`已撤销：到期日还原为 ${restore}`);
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
    const raw = (cfg as Record<string, unknown> | undefined)?.attachment;
    let obj: { compressUpload?: boolean; compressMaxWidth?: number; thumbWidth?: number } = {};
    if (typeof raw === "string") {
      try {
        obj = raw ? JSON.parse(raw) : {};
      } catch {
        obj = {};
      }
    } else if (raw && typeof raw === "object") {
      obj = raw as typeof obj;
    }
    compressUpload.value = obj.compressUpload !== false;
    const width = Number(obj.compressMaxWidth);
    compressMaxWidth.value = Number.isFinite(width) && width >= 640 ? width : 1920;
    const tw = Number(obj.thumbWidth);
    thumbWidth.value = Number.isFinite(tw) && tw >= 0 ? tw : 480;
    // 年检规则（座驾设置 → 年检节点 / 起每年上线年份）：用于表单预览，与后端一致
    const carCfg = (cfg as Record<string, unknown> | undefined)?.car;
    let carObj: { inspectionNodes?: string; inspectionYearlyFrom?: number } = {};
    if (typeof carCfg === "string") {
      try { carObj = carCfg ? JSON.parse(carCfg) : {}; } catch { carObj = {}; }
    } else if (carCfg && typeof carCfg === "object") {
      carObj = carCfg as typeof carObj;
    }
    inspectionNodes.value = parseInspectionNodes(carObj.inspectionNodes);
    const yf = Number(carObj.inspectionYearlyFrom);
    inspectionYearlyFrom.value = Number.isFinite(yf) && yf >= 1 && yf <= 30 ? yf : DEFAULT_INSPECTION_YEARLY_FROM;
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

/** 缩略图地址（设置 thumbWidth=0 时用原图） */
function thumb(url: string): string {
  return thumbWidth.value > 0 ? thumbUrl(url, thumbWidth.value) : url;
}

/** 失效图片数量 + 一键移除 */
const brokenCount = computed(() => form.photos.filter((p) => isBrokenPhoto(p.url)).length);
function removeBrokenPhotos() {
  const before = form.photos.length;
  form.photos = form.photos.filter((p) => !isBrokenPhoto(p.url));
  const removed = before - form.photos.length;
  if (removed > 0) {
    if (!form.photos.some((p) => p.isCover) && form.photos.length) {
      form.photos[0].isCover = true;
    }
    Toast.success(`已移除 ${removed} 张失效图片`);
  }
}

/** 「重新选择」：打开附件库并把选中的第一张替换到该行 */
const replaceIndex = ref(-1);
function openLibraryFor(idx: number) {
  replaceIndex.value = idx;
  openLibrary();
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
  const url = data?.status?.permalink || null;
  // 上传后自检：确认地址真的能打开再写进记录，避免"存进去却打不开"
  if (url && !(await preloadImage(url))) {
    throw new Error("上传成功但图片无法访问：可能被存储策略或其它插件拦截，请检查站点附件设置");
  }
  return url;
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
    let savedBytes = 0;
    for (const raw of files) {
      // 上传前按需压缩（设置里可关）
      let file = raw;
      if (compressUpload.value && raw.type.startsWith("image/")) {
        const result = await compressImage(raw, { maxWidth: compressMaxWidth.value, quality: 0.86 });
        file = result.file;
        if (result.compressed) savedBytes += result.originalSize - result.size;
      }
      const url = await uploadOne(file);
      if (url) {
        form.photos.push({
          url,
          name: raw.name,
          isCover: form.photos.length === 0,
          sortOrder: form.photos.length,
          frontVisible: true,
        });
        added++;
      }
    }
    const saved = savedBytes > 0 ? `，压缩节省 ${humanSize(savedBytes)}` : "";
    Toast.success(`已上传 ${added} 张照片${saved}`);
  } catch (error) {
    Toast.error(`上传失败：${describeError(error, "请稍后重试")}`);
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
  replaceIndex.value = -1;
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
  // 「重新选择」模式：用选中的第一张替换目标行
  if (replaceIndex.value >= 0 && libSelected.value.length) {
    const idx = replaceIndex.value;
    const url = libSelected.value[0];
    replaceIndex.value = -1;
    if (idx < form.photos.length) {
      form.photos[idx] = {
        ...form.photos[idx],
        url,
        name: url.split("/").pop() || "",
      };
      const nextFailed = new Set(failedPhotoUrls.value);
      nextFailed.delete(url);
      failedPhotoUrls.value = nextFailed;
      libVisible.value = false;
      libSelected.value = [];
      Toast.success("已替换这张照片");
      return;
    }
  }
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
  replaceIndex.value = -1;
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
          // 提醒状态（1.2.6）：保存时必须原样带回，否则已办/忽略/节点记录会被清掉
          ackState: r.ackState || "PENDING",
          lastDoneAt: r.lastDoneAt || undefined,
          lastDoneFrom: r.lastDoneFrom || undefined,
          lastDoneTo: r.lastDoneTo || undefined,
          lastDoneFromService: r.lastDoneFromService || undefined,
          skippedForDate: r.skippedForDate || undefined,
          notifiedStages: r.notifiedStages || [],
          notifiedForDate: r.notifiedForDate || undefined,
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
    void loadAttachmentIndex();
    failedPhotoUrls.value = new Set();
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
/** 在已保存的数据里定位这个到期项（弹窗内可能新增/删除过，按"项目 + 原到期日"匹配） */
function storedIndex(r: FormReminder): number {
  const car = props.car;
  if (!car?.spec.reminders) return -1;
  const list = car.spec.reminders;
  const wantDate = r.originalDate || r.date || "";
  const byKeyAndDate = list.findIndex((x) => x.key === r.key && (x.date || "") === wantDate);
  if (byKeyAndDate >= 0) return byKeyAndDate;
  return list.findIndex((x) => x.key === r.key);
}

/**
 * 「已办」立即生效：直接按列表卡片同一套动作写库（不再依赖"先改表单再点保存"），
 * 完成后关闭弹窗并让列表刷新。
 */
async function applyDoneNow(r: FormReminder) {
  const car = props.car;
  if (!car) {
    Toast.warning("请先保存这辆车，再使用「已办」");
    return;
  }
  const idx = storedIndex(r);
  if (idx < 0) {
    Toast.warning("这项还没保存过，请先保存车辆后再点「已办」");
    return;
  }
  try {
    const label = r.label || "这项";
    const detail = await markReminderDone(car, idx, label);
    Toast.success(detail);
    emit("saved");
    // 原地生效：回读最新状态刷新本行，不关闭弹窗
    await refreshReminderRow(r, idx);
  } catch (error) {
    Toast.error(`操作失败：${describeError(error)}`);
  }
}

/** 「撤销办理」立即生效 */
async function applyUndoNow(r: FormReminder) {
  const car = props.car;
  if (!car) return;
  const idx = storedIndex(r);
  if (idx < 0) return;
  try {
    const label = r.label || "这项";
    const detail = await undoReminderDone(car, idx, label);
    Toast.success(detail);
    emit("saved");
    await refreshReminderRow(r, idx);
  } catch (error) {
    Toast.error(`撤销失败：${describeError(error)}`);
  }
}
/**
 * 动作后回读这一项的最新状态（不关闭弹窗）：
 * 只刷新"状态类"字段，不影响你在其它行未保存的编辑。
 */
async function refreshReminderRow(r: FormReminder, index: number) {
  try {
    const cars = await listCars();
    const fresh = cars.find((c) => c.metadata.name === props.car?.metadata.name);
    const src = fresh?.spec.reminders?.[index];
    if (!src) return;
    r.date = src.date;
    r.lastServiceDate = src.lastServiceDate;
    r.ackState = src.ackState;
    r.lastDoneAt = src.lastDoneAt;
    r.lastDoneFrom = src.lastDoneFrom;
    r.lastDoneTo = src.lastDoneTo;
    r.lastDoneFromService = src.lastDoneFromService;
    r.skippedForDate = src.skippedForDate;
    r.notifiedStages = src.notifiedStages;
    r.notifiedForDate = src.notifiedForDate;
    r.originalDate = src.date;
  } catch {
    // 回读失败不影响已完成的写入
  }
}
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
}
/* 相册图片「引用已失效」标记（1.2.5） */
.thumb-broken {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: #fef2f2;
  border: 1px dashed #fca5a5;
  color: #b91c1c;
  flex: none;
}

.next-notice {
  font-size: 12px;
  color: #64748b;
}

.broken-note {
  font-size: 12px;
  color: #b91c1c;
}</style>
