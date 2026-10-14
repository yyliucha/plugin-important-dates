<template>
  <div class="id-check">
    <div class="id-check__head">
      <div>
        <div class="id-check__title">提醒自检</div>
        <div class="id-check__hint">
          弹窗没出现、或不确定提醒到底有没有生效时，点一下这里。
        </div>
      </div>
      <VButton size="sm" :loading="running" @click="run">开始检查</VButton>
    </div>

    <div v-if="results.length" class="id-check__list">
      <div v-for="r in results" :key="r.name" class="id-check__row" :class="`is-${r.level}`">
        <span class="id-check__icon">{{ icon(r.level) }}</span>
        <div class="id-check__body">
          <div class="id-check__item">{{ r.name }}</div>
          <div class="id-check__detail">{{ r.detail }}</div>
          <div v-if="r.fix" class="id-check__fix">→ {{ r.fix }}</div>
        </div>
      </div>
    </div>

    <div v-if="checked && hasProblem" class="id-check__note">
      以上任何一项显示异常，先<strong>强刷浏览器（Ctrl+Shift+R）</strong>，仍不正常就<strong>重新启动一次 Halo 服务</strong>。
      这两步能解决绝大多数「提醒突然不见了」的情况。
    </div>
  </div>
</template>

<script setup lang="ts">
// 插件设置里的自检卡片（通过 console 入口注册的 FormKit 输入组件渲染）。
//
// 目的：这个插件不再持续开发之后，用户遇到"提醒不弹"时没法靠读源码判断原因。
// 这里把几条最容易出问题的链路各测一遍，用人话给出结论和下一步动作，
// 让用户能自己解决，而不是以为插件坏了。
import { computed, ref } from "vue";
import { VButton } from "@halo-dev/components";

defineProps<{ modelValue?: unknown }>();

type Level = "ok" | "warn" | "bad";

interface CheckResult {
  name: string;
  level: Level;
  detail: string;
  fix?: string;
}

const running = ref(false);
const checked = ref(false);
const results = ref<CheckResult[]>([]);

const hasProblem = computed(() => results.value.some((r) => r.level !== "ok"));

const icon = (level: Level) => (level === "ok" ? "✅" : level === "warn" ? "⚠️" : "❌");

const REMINDERS_URL = "/important-dates-reminders";
const PLUGIN_URL = "/apis/plugin.halo.run/v1alpha1/plugins/plugin-important-dates";

async function run() {
  running.value = true;
  results.value = [];
  try {
    // ---- ① 提醒接口：整个提醒链路的数据源，匿名也应可访问 ----
    let payload: Record<string, unknown> | null = null;
    try {
      const res = await fetch(`${REMINDERS_URL}?ts=${Date.now()}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      payload = await res.json();
      results.value.push({
        name: "提醒接口",
        level: "ok",
        detail: `可访问，当前 ${Number(payload?.toastItems ? (payload.toastItems as unknown[]).length : 0)} 条进入提醒期`,
      });
    } catch (e) {
      results.value.push({
        name: "提醒接口",
        level: "bad",
        detail: `取不到提醒数据（${e instanceof Error ? e.message : String(e)}）`,
        fix: "到「插件」页面确认「记得」是启用状态；刚装完或刚升级请重启一次 Halo 服务",
      });
    }

    // ---- ② 服务端实际生效的版本 ----
    let serverBuild = "";
    try {
      if (!payload) throw new Error("接口不可用");
      serverBuild = String(payload.build || "");
      results.value.push({
        name: "服务端版本",
        level: serverBuild ? "ok" : "warn",
        detail: serverBuild ? `实际运行 ${serverBuild}` : "服务端未返回版本标记",
        fix: serverBuild ? undefined : "服务端可能是很旧的版本，建议升级到最新正式版",
      });
    } catch {
      results.value.push({
        name: "服务端版本",
        level: "bad",
        detail: "接口不可用，无法确认版本",
        fix: "先解决上面的「提醒接口」问题",
      });
    }

    // ---- ③ 插件版本 vs 服务端版本：不一致通常就是"jar 换了但没重启" ----
    try {
      const res = await fetch(PLUGIN_URL, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const plugin = await res.json();
      const spec = String(plugin?.spec?.version || "");
      const same = !!spec && !!serverBuild && spec === serverBuild;
      results.value.push({
        name: "插件版本",
        level: same ? "ok" : spec ? "warn" : "bad",
        detail: same
          ? `${spec}（版本一致）`
          : `插件是 ${spec || "未知"}，服务端却在跑 ${serverBuild || "未知"}`,
        fix: same ? undefined : "升级插件后请完整重启一次 Halo 服务：只替换 jar 不重启，Halo 会继续用内存里的旧代码",
      });
    } catch {
      results.value.push({
        name: "插件版本",
        level: "bad",
        detail: "读不到插件版本（可能没有查看插件的权限）",
        fix: "确认当前账号是管理员",
      });
    }

    // ---- ④ 页面里实际注入的弹窗脚本版本 ----
    const script = document.querySelector<HTMLScriptElement>('script[src*="reminder-toast.js"]');
    if (!script) {
      results.value.push({
        name: "弹窗脚本",
        level: "warn",
        detail: "当前页面里没有找到弹窗脚本",
        fix: "「启用」开关是否已打开；「显示范围」若为「仅记得页面」，那只有「记得」页会注入，属于正常",
      });
    } else {
      const url = script.getAttribute("src") || "";
      const v = (/[?&]v=([^&]+)/.exec(url) || [])[1] || "";
      // 脚本的 ?v= 是它自己的递增序号（如 137），和插件版本号（如 2.0.0）不是一套编号，
      // 所以这里只确认"取到了脚本"，不做两者比大小 —— 那会误报。
      // 真要看弹窗行为是否最新，用上面的「插件版本」那一项：升级后没重启，它一定会报出来。
      results.value.push({
        name: "弹窗脚本",
        level: "ok",
        detail: `已注入（脚本序号 v${v || "未知"}）`,
      });
    }
  } finally {
    checked.value = true;
    running.value = false;
  }
}
</script>

<style scoped>
.id-check {
  border: 1px solid var(--halo-card-border-color, #e5e7eb);
  border-radius: 8px;
  padding: 12px 14px;
}
.id-check__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.id-check__title {
  font-weight: 600;
}
.id-check__hint {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 2px;
}
.id-check__list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.id-check__row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--halo-fill-color, #f9fafb);
}
.id-check__row.is-warn {
  background: #fffbeb;
}
.id-check__row.is-bad {
  background: #fef2f2;
}
.id-check__body {
  min-width: 0;
}
.id-check__item {
  font-weight: 600;
}
.id-check__detail {
  opacity: 0.8;
}
.id-check__fix {
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.75;
}
.id-check__note {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.75;
  line-height: 1.7;
}
</style>
