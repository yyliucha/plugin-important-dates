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
          <span class="label">注册日期</span>
          <input v-model="form.registeredDate" type="date" class="input" />
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
      <div v-for="(r, idx) in form.reminders" :key="idx" class="reminder-card">
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
          <label class="field third">
            <span class="label">到期日</span>
            <input v-model="r.date" type="date" class="input" />
          </label>
          <label class="field third">
            <span class="label">提前天数</span>
            <input v-model.number="r.remindDays" type="number" min="0" class="input" placeholder="默认" />
          </label>
        </div>

        <div v-if="isInsurance(r.key)" class="row">
          <label class="field half">
            <span class="label">保险公司（仅后台）</span>
            <input v-model="r.insurer" class="input" placeholder="例如：人保" />
          </label>
          <label class="field half">
            <span class="label">保单号（仅后台）</span>
            <input v-model="r.policyNo" class="input" placeholder="仅后台" />
          </label>
        </div>

        <div v-if="r.key === 'MAINTENANCE'" class="row">
          <label class="field third">
            <span class="label">上次保养日期</span>
            <input v-model="r.lastServiceDate" type="date" class="input" />
          </label>
          <label class="field third">
            <span class="label">间隔月数</span>
            <input v-model.number="r.intervalMonths" type="number" min="0" class="input" placeholder="例如：6" />
          </label>
          <label class="field third">
            <span class="label">上次保养里程</span>
            <input v-model.number="r.lastServiceKm" type="number" min="0" class="input" placeholder="例如：10000" />
          </label>
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

    <!-- 附件库多选浮层 -->
    <div v-if="libVisible" class="lib-overlay" @click.self="closeLib">
      <div class="lib-panel">
        <div class="lib-header">
          <span class="lib-title">从附件库选择照片（可多选）</span>
          <span class="lib-group-hint">{{ libGroupHint }}</span>
          <button type="button" class="lib-close" aria-label="Close" @click="closeLib">✕</button>
        </div>
        <div class="lib-body">
          <div v-if="libLoading" class="hint" style="padding: 20px 4px">加载中…</div>
          <div v-else-if="libError" class="lib-error">
            {{ libError }}
            <VButton size="sm" @click="fetchLibrary">重试</VButton>
          </div>
          <div v-else-if="!libItems.length" class="hint" style="padding: 20px 4px">
            附件库暂无可用图片，请先「上传图片」，或到「附件」页面添加。
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

const props = defineProps<{
  visible: boolean;
  car: Car | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "saved"): void;
}>();

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
  reminders: CarReminder[];
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
const dragIndex = ref(-1);

// 附件库多选
const libVisible = ref(false);
const libLoading = ref(false);
const libError = ref("");
const libItems = ref<{ name: string; displayName: string; permalink: string }[]>([]);
const libSelected = ref<string[]>([]);
const avatarGroupName = ref("");
const avatarPolicyName = ref("");

const libGroupHint = computed(() =>
  avatarGroupName.value || avatarPolicyName.value
    ? `范围：${avatarGroupName.value ? "分类 " + avatarGroupName.value : ""}${avatarGroupName.value && avatarPolicyName.value ? " + " : ""}${avatarPolicyName.value ? "策略 " + avatarPolicyName.value : ""}（取自插件设置）`
    : "不限定范围（插件设置未指定）"
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
  return key === "INSURANCE_COMPULSORY" || key === "INSURANCE_COMMERCIAL";
}

function addReminder() {
  form.reminders.push({ key: "INSURANCE_COMPULSORY", date: "", enabled: true });
}

function onReminderKeyChange(r: CarReminder) {
  const preset = REMINDER_PRESETS.find((p) => p.key === r.key);
  if (preset && (r.remindDays === undefined || r.remindDays === null)) {
    r.remindDays = preset.defaultDays;
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
    let obj: { avatarGroupName?: string; avatarPolicyName?: string } = {};
    const raw = (cfg as Record<string, unknown> | undefined)?.attachment;
    if (typeof raw === "string") {
      obj = raw ? JSON.parse(raw) : {};
    } else if (raw && typeof raw === "object") {
      obj = raw as { avatarGroupName?: string; avatarPolicyName?: string };
    }
    avatarGroupName.value = obj.avatarGroupName?.trim() || "";
    avatarPolicyName.value = obj.avatarPolicyName?.trim() || "";
  } catch {
    avatarGroupName.value = "";
    avatarPolicyName.value = "";
  }
}

async function resolvePolicyName(): Promise<string> {
  if (avatarPolicyName.value) return avatarPolicyName.value;
  try {
    const { data } = await axiosInstance.get("/apis/storage.halo.run/v1alpha1/policies");
    const items = data?.items || [];
    return items[0]?.metadata?.name || "default-policy";
  } catch {
    return "default-policy";
  }
}

function triggerUpload() {
  fileInput.value?.click();
}

async function uploadOne(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("policyName", await resolvePolicyName());
  if (avatarGroupName.value) {
    fd.append("groupName", avatarGroupName.value);
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
    const { data } = await axiosInstance.get<{
      items?: {
        metadata?: { name?: string };
        spec?: { displayName?: string; mediaType?: string; groupName?: string };
        status?: { permalink?: string };
      }[];
    }>("/apis/storage.halo.run/v1alpha1/attachments", {
      params: { page: 1, size: 100, sort: "metadata.creationTimestamp,desc" },
    });
    libItems.value = (data?.items || [])
      .filter((a) => {
        const url = a.status?.permalink || "";
        const mt = (a.spec?.mediaType || "").toLowerCase();
        const groupOk = !avatarGroupName.value || (a.spec?.groupName || "") === avatarGroupName.value;
        return (
          url &&
          groupOk &&
          (mt.startsWith("image/") || /\.(png|jpe?g|jpeg|gif|webp|svg|avif|bmp)$/i.test(url))
        );
      })
      .map((a) => ({
        name: a.metadata?.name || "",
        displayName: a.spec?.displayName || a.metadata?.name || "",
        permalink: a.status?.permalink || "",
      }));
  } catch (error) {
    libError.value = `加载附件库失败：${(error as Error)?.message || "请稍后重试"}`;
    libItems.value = [];
  } finally {
    libLoading.value = false;
  }
}

function openLibrary() {
  libVisible.value = true;
  libSelected.value = [];
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
        reminders: form.reminders.map((r) => ({
          key: r.key || "CUSTOM",
          label: r.label?.trim() || undefined,
          date: r.date || undefined,
          remindDays: r.remindDays ?? undefined,
          enabled: r.enabled !== false,
          insurer: r.insurer?.trim() || undefined,
          policyNo: r.policyNo?.trim() || undefined,
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
        reminders: (s.reminders || []).map((r) => ({ ...r })),
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
</style>
