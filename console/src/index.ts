import { definePlugin } from "@halo-dev/console-shared";
import { createInput } from "@formkit/vue";
import { defineAsyncComponent, markRaw } from "vue";
import { IconCalendar } from "@halo-dev/components";
import ReminderWidget from "./components/ReminderWidget.vue";
import ImportantDatesView from "./views/ImportantDatesView.vue";

export default definePlugin({
  // 设置页里的两块自定义 UI（Halo 2.25+ 支持 formkit.inputs）：
  // 自检卡片帮用户自己判断"提醒为什么没弹"，帮助面板把用法写在插件里 ——
  // 从应用市场装插件的用户看不到 GitHub 上的 README。两者都不持久化任何值。
  formkit: {
    inputs: {
      idReminderSelfCheck: createInput(
        defineAsyncComponent(() => import("./components/SettingsSelfCheck.vue")),
      ),
      idReminderHelp: createInput(
        defineAsyncComponent(() => import("./components/SettingsHelpPanel.vue")),
      ),
    },
  },
  routes: [
    {
      parentName: "Root",
      route: {
        path: "/important-dates",
        name: "ImportantDates",
        component: ImportantDatesView,
        meta: {
          title: "记得",
          searchable: true,
          permissions: ["plugin:important-dates:view"],
          menu: {
            name: "记得",
            group: "content",
            icon: markRaw(IconCalendar),
            priority: 0,
          },
        },
      },
    },
  ],
  // 控制台仪表盘小组件（Halo 2.21+ 控制台支持；旧版本自动忽略）
  // @ts-expect-error 2.21+ 才具备的扩展点，旧版类型没有该键
  extensionPoints: {
    "console:dashboard:widgets:create": () => [
      {
        id: "important-dates-reminder",
        component: markRaw(ReminderWidget),
        group: "记得",
        defaultSize: { w: 6, h: 5, minW: 3, minH: 3, maxW: 12, maxH: 8 },
      },
    ],
  },
});

