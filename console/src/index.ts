import { definePlugin } from "@halo-dev/console-shared";
import { markRaw } from "vue";
import CalendarIcon from "./components/CalendarIcon.vue";
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
});
