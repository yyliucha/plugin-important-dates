import { definePlugin } from "@halo-dev/console-shared";
import { markRaw } from "vue";
import CalendarIcon from "./components/CalendarIcon.vue";
import ReminderWidget from "./components/ReminderWidget.vue";
import ImportantDatesView from "./views/ImportantDatesView.vue";

export default definePlugin({
  routes: [
    {
      parentName: "Root",
      route: {
        path: "/important-dates",
        name: "ImportantDates",
        component: ImportantDatesView,
        meta: {
          title: "重要日期",
          searchable: true,
          permissions: ["plugin:important-dates:view"],
          menu: {
            name: "重要日期",
            group: "content",
            icon: markRaw(CalendarIcon),
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
        group: "重要日期",
        defaultSize: { w: 6, h: 5, minW: 3, minH: 3, maxW: 12, maxH: 8 },
      },
    ],
  },
});
