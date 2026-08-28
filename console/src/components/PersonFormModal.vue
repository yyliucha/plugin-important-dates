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
import { reactive, ref, watch } from "vue";
import { Toast, VButton, VModal, VSpace } from "@halo-dev/components";
import SunLunarPicker from "@/components/SunLunarPicker.vue";
import { createPerson, updatePerson } from "@/api";
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
});

const form = reactive<PersonForm>(empty());

watch(
  () => props.visible,
  (v) => {
    if (!v) return;
    const p = props.person;
    if (p) {
      Object.assign(form, {
        displayName: p.spec.displayName || "",
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

.type-select {
  flex: 0 0 90px;
  width: 90px;
}

.pick-wrap {
  flex: 1;
}
</style>
