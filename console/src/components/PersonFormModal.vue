<template>
  <VModal
    :visible="visible"
    :title="person ? '编辑人员' : '新增人员'"
    width="600"
    @close="close"
  >
    <div class="form">
      <div class="row">
        <label class="field half">
          <span class="label">姓名 *</span>
          <input v-model="form.displayName" class="input" placeholder="例如：张三" />
        </label>
        <label class="field half">
          <span class="label">昵称/称呼</span>
          <input v-model="form.nickname" class="input" placeholder="例如：三哥" />
        </label>
      </div>

      <div class="row">
        <label class="field half">
          <span class="label">关系</span>
          <select v-model="form.relation" class="input">
            <option value="">未填写</option>
            <option value="本人">本人</option>
            <option value="配偶">配偶</option>
            <option value="子女">子女</option>
            <option value="父亲">父亲</option>
            <option value="母亲">母亲</option>
            <option value="朋友">朋友</option>
            <option value="其他">其他</option>
          </select>
        </label>
        <label class="field half">
          <span class="label">性别</span>
          <select v-model="form.gender" class="input">
            <option value="">未填写</option>
            <option value="男">男</option>
            <option value="女">女</option>
            <option value="保密">保密</option>
          </select>
        </label>
      </div>

      <div class="field">
        <span class="label">生日 {{ form.dateType === "SOLAR" ? "（阳历）" : "（农历）" }}</span>
        <div class="row">
          <select v-model="form.dateType" class="input type-select">
            <option value="SOLAR">阳历</option>
            <option value="LUNAR">农历</option>
          </select>
          <SunLunarPicker
            class="pick-wrap"
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
        </div>
      </div>

      <div class="row">
        <label class="field half">
          <span class="label">血型</span>
          <select v-model="form.bloodType" class="input">
            <option value="">未填写</option>
            <option value="A">A 型</option>
            <option value="B">B 型</option>
            <option value="AB">AB 型</option>
            <option value="O">O 型</option>
            <option value="未知">不详</option>
          </select>
        </label>
        <label class="field half">
          <span class="label">身高（cm）</span>
          <input v-model.number="form.heightCm" type="number" min="0" step="0.1" class="input" placeholder="例如：170" />
        </label>
      </div>

      <div class="row">
        <label class="field half">
          <span class="label">体重（kg，最新值）</span>
          <input v-model.number="form.weightKg" type="number" min="0" step="0.1" class="input" placeholder="例如：62.5" />
        </label>
      </div>

      <label class="field">
        <span class="label">喜好/兴趣</span>
        <textarea v-model="form.hobbies" class="input textarea" rows="2" placeholder="例如：篮球、看电影、钓鱼"></textarea>
      </label>

      <label class="field">
        <span class="label">备注</span>
        <textarea v-model="form.note" class="input textarea" rows="2" placeholder="其他想记录的信息"></textarea>
      </label>

      <div class="field">
        <span class="label">大头贴（选填，仅一张）</span>
        <div class="avatar-row">
          <div class="avatar-preview" :class="{ 'avatar-empty': !form.avatar || avatarBroken }">
            <img v-if="form.avatar && !avatarBroken" :src="form.avatar" alt="大头贴预览" @error="avatarBroken = true" />
            <span v-else class="avatar-char">{{ (form.displayName || "?").slice(0, 1) }}</span>
          </div>
          <div class="avatar-inputs">
            <div class="avatar-btns">
              <VButton size="sm" :loading="uploading" @click="triggerUpload">上传图片</VButton>
              <VButton size="sm" @click="openLibrary">从附件库选择</VButton>
              <VButton v-if="form.avatar" size="sm" type="danger" @click="form.avatar = ''">移除</VButton>
            </div>
            <input ref="fileInput" type="file" accept="image/*" class="hidden-file" @change="onFileChange" />
            <div class="hint">
              仅允许一张。上传使用默认存储策略，并存入「设置 → 附件设置 → 大头贴附件分组」指定的分组（留空则不入分组）；后台管理端始终显示，前台是否展示由「设置 → 隐私 → 前台展示大头贴」统一控制（默认关闭）。
            </div>
          </div>
        </div>
      </div>

      <!-- 附件库选择(自绘浮层:避免嵌套 VModal 的关闭/交互问题) -->
      <div v-if="libVisible" class="lib-overlay" @click.self="closeLib">
        <div class="lib-panel">
          <div class="lib-header">
            <span class="lib-title">从附件库选择图片</span>
            <span class="lib-group-hint">
              {{ libGroupHint }}
            </span>
            <button type="button" class="lib-close" aria-label="Close" @click="closeLib">✕</button>
          </div>
          <div class="lib-body">
            <div v-if="libLoading" class="hint" style="padding: 20px 4px;">加载中…</div>
            <div v-else-if="libError" class="lib-error">
              {{ libError }}
              <VButton size="sm" @click="openLibrary">重试</VButton>
            </div>
            <div v-else-if="!libItems.length" class="hint" style="padding: 20px 4px;">
              附件库暂无可用图片。请先点「上传图片」，或到「附件」管理页面上传后再选择。
            </div>
            <div v-else class="lib-grid">
              <div
                v-for="a in filteredLibItems"
                :key="a.name"
                class="lib-item"
                :class="{ selected: libSelected?.name === a.name }"
                @click="libSelected = a"
              >
                <img :src="a.permalink" alt="" loading="lazy" />
                <span class="lib-name">{{ a.displayName }}</span>
              </div>
            </div>
          </div>
          <div class="lib-footer">
            <VSpace>
              <VButton @click="closeLib">取消</VButton>
              <VButton type="secondary" :disabled="!libSelected" @click="chooseLib">选择此图片</VButton>
            </VSpace>
          </div>
        </div>
      </div>

      <div class="field">
        <span class="label">属性</span>
        <div class="checks">
          <label class="check">
            <input v-model="form.visible" type="checkbox" />
            <span>前台展示（/important-dates 页面）</span>
          </label>
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
import SunLunarPicker from "@/components/SunLunarPicker.vue";
import { createPerson, fetchPluginJsonConfig, updatePerson } from "@/api";
import type { DateType, Person } from "@/types";

const props = defineProps<{
  visible: boolean;
  person: Person | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "saved"): void;
}>();

const saving = ref(false);
const avatarBroken = ref(false);

// ---------- 大头贴：官方附件上传 / 附件库选择 ----------
const fileInput = ref<HTMLInputElement>();
const uploading = ref(false);
const libVisible = ref(false);
const libLoading = ref(false);
const libError = ref("");
const libItems = ref<{ name: string; displayName: string; permalink: string; policyName: string }[]>([]);
const libSelected = ref<{ name: string; displayName: string; permalink: string; policyName: string } | null>(null);
const avatarGroupName = ref("");
const avatarPolicyName = ref("");

const libGroupHint = computed(() => {
  const parts: string[] = [];
  if (avatarGroupName.value) parts.push(`分类：${displayOf(groupLabelMap.value, avatarGroupName.value)}`);
  if (avatarPolicyName.value) parts.push(`策略：${displayOf(policyLabelMap.value, avatarPolicyName.value)}`);
  return parts.length ? `仅显示：${parts.join(" + ")}（取自插件设置）` : "不限定来源（插件设置未指定）";
});

const filteredLibItems = computed(() => {
  let items = libItems.value;
  if (avatarGroupName.value) {
    items = items.filter((a) => a.groupName === avatarGroupName.value);
  }
  if (avatarPolicyName.value) {
    items = items.filter((a) => a.policyName === avatarPolicyName.value);
  }
  return items;
});

/** 加载插件设置中的来源（分类 / 策略） */
async function loadGroups() {
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
  // 首次使用/未配置时,回退到系统第一个可见项(仅本次生效,不写配置)
  if (!avatarGroupName.value && groupNames.value.length) {
    avatarGroupName.value = groupNames.value[0];
  }
  if (!avatarPolicyName.value && policyNames.value.length) {
    avatarPolicyName.value = policyNames.value[0];
  }
}

function triggerUpload() {
  fileInput.value?.click();
}

/** 存储策略：设置中指定的策略优先，否则取列表第一条 */
async function resolvePolicyName(): Promise<string> {
  if (avatarPolicyName.value) {
    return avatarPolicyName.value;
  }
  try {
    const { data } = await axiosInstance.get("/apis/storage.halo.run/v1alpha1/policies");
    const items = data?.items || [];
    return items[0]?.metadata?.name || "default-policy";
  } catch {
    return "default-policy";
  }
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  uploading.value = true;
  // 上传前重读插件设置（用户可能在弹窗打开后修改过默认 分类/策略）
  await loadGroups();
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("policyName", await resolvePolicyName());
    if (avatarGroupName.value && avatarGroupName.value !== "__ungrouped__") {
      fd.append("groupName", avatarGroupName.value);
    }
    const { data } = await axiosInstance.post<{ status?: { permalink?: string } }>(
      "/apis/api.console.halo.run/v1alpha1/attachments/upload",
      fd
    );
    const url = data?.status?.permalink;
    if (!url) throw new Error("上传未返回图片地址");
    form.avatar = url;
    Toast.success("已上传并设置为大头贴");
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
    await loadGroups();
    // 附件分组信息位于 spec.groupName（2.26 无 group-name 标签），客户端过滤
    const { data } = await axiosInstance.get<{
      items?: { metadata?: { name?: string }; spec?: { displayName?: string; mediaType?: string; policyName?: string; groupName?: string }; status?: { permalink?: string } }[];
    }>("/apis/storage.halo.run/v1alpha1/attachments", {
      params: { page: 1, size: 100, sort: "metadata.creationTimestamp,desc" },
    });
    libItems.value = (data?.items || [])
      .filter((a) => {
        const url = a.status?.permalink || "";
        const mt = (a.spec?.mediaType || "").toLowerCase();
        // mediaType 可能为 application/octet-stream（部分上传链路），按扩展名兜底
        return url && (mt.startsWith("image/") || /\.(png|jpe?g|jpeg|gif|webp|svg|avif|bmp)$/i.test(url));
      })
      .map((a) => ({
        name: a.metadata?.name || "",
        displayName: a.spec?.displayName || a.metadata?.name || "",
        permalink: a.status?.permalink || "",
        policyName: (a.spec as { policyName?: string } | undefined)?.policyName || "",
        groupName: (a.spec as { groupName?: string } | undefined)?.groupName || "",
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
  libSelected.value = null;
  void fetchLibrary();
}



function chooseLib() {
  if (!libSelected.value) return;
  form.avatar = libSelected.value.permalink;
  libVisible.value = false;
  Toast.success("已选择图片");
}

function closeLib() {
  libVisible.value = false;
  libSelected.value = null;
}

interface PersonForm {
  displayName: string;
  nickname: string;
  relation: string;
  dateType: DateType;
  solarDate: string;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  gender: string;
  bloodType: string;
  heightCm: number | null;
  weightKg: number | null;
  hobbies: string;
  note: string;
  avatar: string;
  visible: boolean;
}

const empty = (): PersonForm => ({
  displayName: "",
  nickname: "",
  relation: "",
  dateType: "SOLAR",
  solarDate: "",
  lunarMonth: 1,
  lunarDay: 1,
  isLeapMonth: false,
  gender: "",
  bloodType: "",
  heightCm: null,
  weightKg: null,
  hobbies: "",
  note: "",
  avatar: "",
  visible: true,
});

const form = reactive<PersonForm>(empty());

// 放在 form 声明之后：watch 的 getter 在 setup 阶段会立即求值，过早引用 form 会触发 TDZ
watch(() => form.avatar, () => { avatarBroken.value = false; });

/** 名称 → 显示名 映射(用于把配置里的原始名翻译成界面可读名) */
const groupLabelMap = ref<Record<string, string>>({});
const policyLabelMap = ref<Record<string, string>>({});
const groupNames = ref<string[]>([]);
const policyNames = ref<string[]>([]);

function displayOf(map: Record<string, string>, name: string): string {
  return map[name] || name;
}

/** 打开弹窗时：加载最新插件设置 + 系统 分组/策略 显示名映射 */
async function loadMeta() {
  await loadGroups();
  try {
    const g = await axiosInstance.get<{ items?: { metadata?: { name?: string; labels?: Record<string, string>; deletionTimestamp?: string }; spec?: { displayName?: string } }[] }>(
      "/apis/storage.halo.run/v1alpha1/groups", { params: { page: 1, size: 100 } }
    );
    const gm: Record<string, string> = {};
    const gn: string[] = [];
    for (const it of g.data?.items || []) {
      const n = it.metadata?.name || "";
      if (n && it.metadata?.labels?.["halo.run/hidden"] !== "true" && !it.metadata?.deletionTimestamp) {
        gm[n] = it.spec?.displayName || n;
        gn.push(n);
      }
    }
    groupLabelMap.value = gm;
    groupNames.value = gn;
  } catch {
    groupLabelMap.value = {};
  }
  try {
    const p = await axiosInstance.get<{ items?: { metadata?: { name?: string; labels?: Record<string, string>; deletionTimestamp?: string }; spec?: { displayName?: string } }[] }>(
      "/apis/storage.halo.run/v1alpha1/policies", { params: { page: 1, size: 100 } }
    );
    const pm: Record<string, string> = {};
    const pn: string[] = [];
    for (const it of p.data?.items || []) {
      const n = it.metadata?.name || "";
      if (n && it.metadata?.labels?.["halo.run/hidden"] !== "true" && !it.metadata?.deletionTimestamp) {
        pm[n] = it.spec?.displayName || n;
        pn.push(n);
      }
    }
    policyLabelMap.value = pm;
    policyNames.value = pn;
  } catch {
    policyLabelMap.value = {};
  }
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return;
    void loadMeta();
    const p = props.person;
    if (p) {
      Object.assign(form, {        displayName: p.spec.displayName || "",
        nickname: p.spec.nickname || "",
        relation: p.spec.relation || "",
        dateType: p.spec.dateType || "SOLAR",
        solarDate: p.spec.solarDate || "",
        lunarMonth: p.spec.lunarMonth || 1,
        lunarDay: p.spec.lunarDay || 1,
        isLeapMonth: !!p.spec.isLeapMonth,
        gender: p.spec.gender || "",
        bloodType: p.spec.bloodType || "",
        heightCm: p.spec.heightCm ?? null,
        weightKg: p.spec.weightKg ?? null,
        hobbies: p.spec.hobbies || "",
        note: p.spec.note || "",
        avatar: p.spec.avatar || "",
        visible: p.spec.visible !== false,
      });
    } else {
      Object.assign(form, empty());
    }
  }
);

function close() {
  emit("update:visible", false);
}

async function save() {
  if (!form.displayName.trim()) {
    Toast.warning("请填写姓名");
    return;
  }
  if (form.dateType === "SOLAR" && !form.solarDate) {
    Toast.warning("请选择阳历生日");
    return;
  }
  saving.value = true;
  try {
    const payload: Person = {
      apiVersion: "importantdates.halo.run/v1alpha1",
      kind: "Person",
      metadata: {
        name: props.person?.metadata.name || `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...(props.person?.metadata || {}),
      },
      spec: {
        displayName: form.displayName.trim(),
        nickname: form.nickname.trim() || undefined,
        relation: form.relation || undefined,
        dateType: form.dateType,
        solarDate: form.dateType === "SOLAR" ? form.solarDate : undefined,
        lunarMonth: form.dateType === "LUNAR" ? form.lunarMonth : undefined,
        lunarDay: form.dateType === "LUNAR" ? form.lunarDay : undefined,
        isLeapMonth: form.dateType === "LUNAR" ? form.isLeapMonth : false,
        gender: form.gender || undefined,
        bloodType: form.bloodType || undefined,
        heightCm: form.heightCm ?? undefined,
        weightKg: form.weightKg ?? undefined,
        hobbies: form.hobbies.trim() || undefined,
        note: form.note.trim() || undefined,
        avatar: form.avatar.trim() || undefined,
        visible: form.visible,
      },
    };
    if (props.person) {
      await updatePerson(payload);
    } else {
      await createPerson(payload);
    }
    Toast.success(props.person ? "已保存" : "已新增");
    emit("saved");
    close();
  } catch (error) {
    Toast.error(`保存失败：${(error as Error)?.message || "未知错误"}`);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.type-select {
  flex: 0 0 90px;
  width: 90px;
}

.pick-wrap {
  flex: 1;
}

.avatar-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.avatar-preview {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  overflow: hidden;
  flex: none;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview.avatar-empty {
  background: #eef2ff;
}

.avatar-char {
  font-size: 26px;
  font-weight: 700;
  color: #6366f1;
}

.avatar-inputs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.avatar-btns {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hidden-file {
  display: none;
}

.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 150px);
  gap: 12px;
  max-height: 380px;
  overflow: auto;
  padding: 4px;
}

.lib-item {
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background: #f9fafb;
  text-align: center;
  transition: border-color 0.15s ease;
}

.lib-item:hover {
  border-color: #a5b4fc;
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
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
}

.lib-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.lib-controls {
  margin-left: auto;
  margin-right: 12px;
  display: flex;
  gap: 8px;
}

.policy-select {
  width: 200px;
  height: 30px;
  font-size: 13px;
  padding: 3px 8px;
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

.lib-close:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.lib-body {
  padding: 16px 18px;
  max-height: 420px;
  overflow: auto;
}

.lib-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 18px;
  border-top: 1px solid #e5e7eb;
}

.hint {
  font-size: 12px;
  color: #6b7280;
}
</style>








