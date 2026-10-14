/**
 * 清理测试数据。
 *
 * **为什么需要**：这些套件在真实实例上跑，会留下 `date-xxx-<时间戳>` 这类记录。
 * 单次运行结束时会删掉自己的数据，但如果中途失败/中断，残留就会一直堆着。
 * 堆到一定程度会**让后续用例失败** —— 弹窗只显示最近几条，一堆历史"就是今天"
 * 会把本次用例自己造的数据挤出显示窗口，报出来的错却和真正的原因毫不相干。
 *
 * 所以每个依赖"弹窗内容"的套件都应该在**开始前**先清一遍，而不是只依赖自己结尾的清理。
 *
 * 安全边界：只删除**名字带时间戳后缀的测试数据**（`-<13位毫秒>`），
 * 绝不碰用户真实创建、名字里没有时间戳的条目。
 */
const TS = /-\d{13}$/;

/** 测试会创建的各类资源路径 */
const ENDPOINTS = {
  dates: "/apis/importantdates.halo.run/v1alpha1/importantdates",
  cars: "/apis/importantdates.halo.run/v1alpha1/cars",
  persons: "/apis/importantdates.halo.run/v1alpha1/persons",
};

/**
 * @param {(path: string, init?: object) => Promise<{status: number, text: string}>} api
 *        调用方自己的带会话请求函数
 * @returns {Promise<{dates:number, cars:number, persons:number}>} 各类型删除条数
 */
export async function cleanupTestData(api) {
  const removed = { dates: 0, cars: 0, persons: 0 };
  for (const [kind, base] of Object.entries(ENDPOINTS)) {
    let list = [];
    try {
      const res = await api(`${base}?size=0`);
      if (!res || res.status >= 400) continue;
      const body = JSON.parse(res.text);
      list = body.items || [];
    } catch {
      continue; // 列表拿不到就跳过这一类，不要因为清理失败把用例本身搞挂
    }
    for (const item of list) {
      const name = item?.metadata?.name || "";
      if (!TS.test(name)) continue;
      try {
        const del = await api(`${base}/${name}`, { method: "DELETE" });
        if (del && del.status < 400) removed[kind]++;
      } catch {
        // 单条删不掉不影响其它条目
      }
    }
  }
  return removed;
}
