<template>
  <div class="id-help">
    <button type="button" class="id-help__toggle" @click="open = !open">
      <span>{{ open ? "▾" : "▸" }}</span>
      <span>使用说明与常见问题</span>
      <span class="id-help__sub">装完不知道从哪开始、提醒没出现，都可以看这里</span>
    </button>

    <div v-if="open" class="id-help__body">
      <section>
        <h4>三步就能用起来</h4>
        <ol>
          <li>到侧边栏「记得」→ <b>重要日期</b> 页签，记下第一个纪念日或生日（支持阳历/农历，每年自动循环）。</li>
          <li>想管爱车就到 <b>座驾</b> 页签添加车辆，填上保险、年检、保养的到期日。汽车 / 电瓶车 / 自行车各有各的项目，只会显示这辆车真正适用的。</li>
          <li>想在前台展示给访客看，就把对应条目的「前台」开关打开；不想公开的保持关闭即可。</li>
        </ol>
      </section>

      <section>
        <h4>提醒会在哪三个地方出现</h4>
        <ul>
          <li><b>后台仪表盘</b>：登录后台后在首页小组件里看到。</li>
          <li><b>前台横幅</b>：在「记得」页面顶部。</li>
          <li><b>全站悬浮弹窗</b>：需要在上面的「全站悬浮提醒」里手动开启。</li>
        </ul>
        <p class="id-help__note">
          弹窗只做提醒、不堆清单：一辆车只占一行，其余汇总成「还有 N 项」，点下面的文字可以去看完整清单。
          每一项的完整日期始终在横幅和「记得」页里逐条可见。
        </p>
      </section>

      <section>
        <h4>弹窗为什么"刷新又出来了" / "怎么才能不烦我"</h4>
        <ul>
          <li>弹窗是<b>每次打开页面都会出现</b>的，这是设计如此（刷新、换页都会再弹）。</li>
          <li>点 × 后可以选 <b>本次关闭 / 今天不再提示 / N 天内不显示</b>，时长记在访客浏览器里，到期自动恢复。</li>
          <li>这里<b>没有"永久不再提示"</b>：所有静音都有期限，避免有人手一滑就再也收不到提醒。</li>
          <li>「关闭方式菜单」关掉时，点 × <b>只收起当前这个弹窗</b>、不写任何记录 —— 这是刻意的，防止静默静音。</li>
          <li>嫌弹得太频繁，就用「提示频率」限制次数（按访客浏览器计，换设备各自计算）。</li>
        </ul>
      </section>

      <section>
        <h4>默认值是给谁看的</h4>
        <p>
          插件默认<b>不把内容暴露给访客</b>：前台展示生日、前台展示大头贴、前台显示逾期项都是关闭的。
          座驾的车牌、VIN、发动机号、保单号、价格等敏感字段在前台一律脱敏或不下发。
          要公开什么，由你逐项打开。
        </p>
      </section>

      <section>
        <h4>到期了没办会怎么样</h4>
        <ul>
          <li>逾期后会继续提醒几天（天数可配），之后转成「<b>待处理</b>」不再主动打扰。</li>
          <li>但<b>一直保留在清单里</b>，直到你点「已办」或「忽略」，不会被静默清掉。</li>
          <li>循环项点「已办」会自动顺延到下一期；保养项会记下「刚做完保养」并据此推算下次。</li>
          <li>点错了可以<b>撤销办理</b>，到期日会还原到办理前。</li>
        </ul>
      </section>

      <section>
        <h4>提醒没出现怎么办</h4>
        <p>按顺序试这三步，绝大多数情况能解决：</p>
        <ol>
          <li>用上面的「<b>提醒自检</b>」点一下，它会指出是哪一环出了问题。</li>
          <li><b>强刷浏览器</b>（Ctrl+Shift+R）：浏览器会长时间缓存插件的脚本，升级后可能还在跑旧的。</li>
          <li><b>完整重启一次 Halo 服务</b>：只替换 jar 文件而不重启，Halo 会继续使用内存里的旧代码。</li>
        </ol>
      </section>

      <section>
        <h4>数据在哪 / 怎么搬走</h4>
        <p>
          纪念日、人员、座驾都保存在 Halo 自己的数据里，卸载插件不会替你删除。
          「记得」页面右上角的<b>导出</b>可以把全部内容存成一个 JSON 文件，随时留底或迁移。
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// 插件内置使用说明。
//
// 用户从应用市场安装插件，看不到 GitHub 上的 README，所以把"怎么用"和
// "提醒没出现怎么办"直接放进设置页，做成可折叠的，默认收起、不打扰。
import { ref } from "vue";

defineProps<{ modelValue?: unknown }>();

const open = ref(false);
</script>

<style scoped>
.id-help {
  border: 1px solid var(--halo-card-border-color, #e5e7eb);
  border-radius: 8px;
}
.id-help__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-align: left;
}
.id-help__sub {
  font-weight: 400;
  font-size: 12px;
  opacity: 0.65;
}
.id-help__body {
  padding: 0 14px 12px;
  font-size: 13px;
  line-height: 1.8;
}
.id-help__body section + section {
  margin-top: 12px;
}
.id-help__body h4 {
  font-weight: 600;
  margin: 0 0 4px;
}
.id-help__body ul,
.id-help__body ol {
  margin: 0;
  padding-left: 20px;
}
.id-help__note {
  margin: 6px 0 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--halo-fill-color, #f9fafb);
  opacity: 0.85;
}
</style>
