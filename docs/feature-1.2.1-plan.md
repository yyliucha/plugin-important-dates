# 1.2.1 需求执行状态与交接(A–G)

> 目标版本:**`1.2.1`(开发版 `1.2.1-SNAPSHOT`;正式版需用户测试通过后发布)**
> 编号说明:需求批次原按 `1.2.2` 记录,但 `1.2.1` 号段从未发布过 Release(市场/仓库最新正式版为 `1.2.0`),按用户指示**不跳号**——本轮成果以 `1.2.1-SNAPSHOT` 交付,测试通过后发布正式版 `1.2.1`。
> 约束:零系统配置写入、零主题文件写入、全部官方扩展点;老数据迁移必须**幂等**、只操作插件自身数据。
> 最近一次提交见本文件所在提交;每项完成后在下方更新状态与验证方式。

## 状态总览

| 项 | 内容 | 状态 | 说明 |
|---|---|---|---|
| **A** | 车辆级「保险公司」+ 保险项精简 + 循环间隔(每年/每两年/每三年/不循环/自定义)+ 老数据幂等迁移 | ✅ | `Car.spec.insurer`、`Reminder.repeatMonths` 就绪;`migrateCarInsurers()` 启动时幂等执行;`CarFormModal` 增加车辆级保险公司(含常用公司快捷提示与 datalist)、到期项精简为「险种/保单号/到期日/提前天数/循环间隔/启用」、保险项可「使用其他保险公司」覆盖 |
| **B** | 年检按「首次登记日期 + 车型规则」自动推算 + 手动覆盖 + 注明依据 | ✅ | `VehicleSupport.nextInspection()`;finder 未填日期时自动推算(阶段进标题、依据进 `ruleNote`);表单实时预览「按规则自动推算:日期(阶段)」+ 依据文案 + 缺登记日期提示与「去填写」;新增「手动指定日期」开关(开启时预填推算结果) |
| **C** | 年检 / 车船税默认「与保险同期」(可取消) | ✅ | 表单加「与保险同期」勾选(默认开):勾选且已填交强险到期日时日期只读联动,保存写入相同日期;未填交强险时提示,填好后自动联动;旧数据按「无日期或与交强险同日」推断默认口径 |
| **D** | 同车同日多事项提醒合并(后台列表仍逐项) | ✅ | `ImportantDateRouter` 按 `carName + dateText` 分组合并,标题形如 `小鹏 · 交强险 / 商业险 / 年检`;日期不同则不合并 |
| **E** | 进入上线检验期 / 切换每年规则的一次性提示 | ✅ | `console/src/utils/vehicle.ts#inspectionNotice()` 判定阶段(第 6 年起 `ONSITE`、第 11 年起 `YEARLY`);后台座驾页顶部横幅提示 + 「知道了」写回 `Car.spec.inspectionNoticeAck`(幂等去重,已售/报废车不提示) |
| **F** | 年检提前 30 天 + 办理时长提示 | ✅ | 表单提示:「年检默认提前 30 天提醒(办理含上线检验通常需 2–3 个工作日)」;`REMINDER_PRESETS` 年检默认 30 天 |
| **G** | 仪表盘小分页(默认每页 5 条、可配可关闭),口径与前台一致 | ✅ | 设置项 `dashboardPageSize`(默认 5)、`dashboardPagination`(默认开);接口新增 **`allReminders`**(完整列表,不受"每类最多 N 条"降噪限制);`ReminderWidget.vue` 本地分页(‹ 1 / N › + 共 X 条,越界回退最后一页,60 秒自动刷新保留当前页) |

## 实现要点(已全部落地)

1. **G UI** — `console/src/components/ReminderWidget.vue`:读取 `dashboardPageSize` / `dashboardPagination`,数据一次拉全后仅切本地状态;后端在 `/important-dates-reminders` 增加 `allReminders` 字段(降噪前的完整合并列表),`reminders` 保持原语义供前台横幅与悬浮弹窗使用。
2. **A 表单** — `CarFormModal.vue`:车辆级保险公司(常用公司快捷芯片 + `datalist`);到期项两行布局;循环间隔下拉(每年/每两年/每三年/不循环/自定义月数),保存时按项目默认值显式落库;保险项「使用其他保险公司」展开式覆盖。
3. **B/C/D 规则口径统一** — 新增 `console/src/utils/vehicle.ts`,把后端的循环间隔、年检推算、到期日解析规则镜像到前端(`defaultRepeatMonths` / `nextInspection` / `resolveDueDate` / `inspectionNotice`);后台座驾卡片列表改用同一口径(含年检自动推算与「不循环」不滚动),避免后台与前台不一致。
4. **E 提示** — 后台座驾页顶部横幅:「「车名」已进入上线检验期(第 6 年起不再免检:第 6、10 年需上线检验,第 11 年起每年一次),年检提醒已按规则自动滚动」;点「知道了」把阶段写入 `Car.spec.inspectionNoticeAck`,并记一条操作日志。
5. **收尾** — 版本号切 `1.2.1-SNAPSHOT`(`gradle.properties` + `plugin.yaml`);`gradlew clean build` 产出 `plugin-important-dates-1.2.1-SNAPSHOT.jar`;版本说明 `docs/release-notes-1.2.1-SNAPSHOT.md`(中文)+ `.en.md`(英文)。

## 收尾待执行命令(因本机 shell 运行器故障中断,恢复后照此执行)

```powershell
cd F:\dsh\plugin-important-dates
# 1) 旧计划文档已被本文件取代(需求批次编号 1.2.2 → 发布编号 1.2.1)
git rm docs/feature-1.2.2-plan.md
# 2) 端到端留证截图入库(截图生成于 F:\dsh\halo-test\ui-121-*.png)
Copy-Item F:\dsh\halo-test\ui-121-car-insurer.png        docs\manual-test\e121-car-insurer.png
Copy-Item F:\dsh\halo-test\ui-121-car-reminders2.png     docs\manual-test\e121-car-reminders.png
Copy-Item F:\dsh\halo-test\ui-121-notice.png             docs\manual-test\e121-inspection-notice.png
Copy-Item F:\dsh\halo-test\ui-121-dashboard-pager.png    docs\manual-test\e121-dashboard-pager.png
# 3) 提交(英文提交信息)
git add -A
git commit -m "release: 1.2.1-SNAPSHOT development build - vehicle-level insurer, per-item repeat interval, derived inspection with manual override and insurance-synced dates, merged same-day reminders, dashboard widget paging, one-time inspection rule notice; docs and regression notes (smoke 50/50, browser 13/13, migration idempotent)"
```

交付物(本地,未推送 GitHub):`build/libs/plugin-important-dates-1.2.1-SNAPSHOT.jar`(453 KB,含控制台 UI 产物)、`docs/release-notes-1.2.1-SNAPSHOT.md`(中文)、`docs/release-notes-1.2.1-SNAPSHOT.en.md`(英文)。

## 验证基线

已完成(全部通过):

- `gradlew compileJava` 通过;`gradlew clean build` 通过(含前端 `vite build` 与控制台产物打包);`npm run build` 通过;临时 `tsconfig.check.json` 下 `tsc --noEmit` 无新增类型错误(仅既有 `lunar-javascript` 缺声明与 `index.ts` 的 `@ts-expect-error` 两条历史告警);
- **全新 Halo 2.26 实例冒烟回归 `halo-smoke.mjs` 50/50 PASS**(工作目录 `F:\dsh\halo-test\work-122`,端口 8090,日志 `F:\dsh\halo-test\smoke-121-final.log`)。用例总数 44 → 50,新增 6 项:循环间隔 0(不滚动,过期即过期提醒)、循环间隔 24(滚动到未来 330 天)、年检未填日期自动推算(第 4 年「免检申领」+ 第 6 年「上线检验」两个阶段)、`Car.spec.inspectionNoticeAck` 持久化、车辆级保险公司 + 单项覆盖 + 保单号 + 循环间隔同时落库、`allReminders` 完整列表与 `dashboardPageSize`/`dashboardPagination` 下发;
- **浏览器端到端 13/13 PASS**(`F:\dsh\halo-test\browser-121-e2e.mjs`,日志 `browser-121-final.log`):同车同日合并为一条、上线检验期一次性提示与「知道了」去重(写回 `inspectionNoticeAck=ONSITE`)、车辆级保险公司字段与常用公司快捷提示、循环间隔五种选项与默认值回填、年检推算展示(「按规则自动推算:2026-09-20(免检申领)」+ 依据)、「手动指定日期」开关(自动取消同期并预填推算结果,取消后恢复同期)、车船税默认与交强险同期且只读联动、保存后落库校验、仪表盘小组件分页(共 9 条 / 每页 5 条 → 可翻到第 2 页)、小组件显示合并行、控制台零脚本错误;
- **迁移幂等验证 PASS**(`F:\dsh\halo-test\migrate-check.mjs`):造一条「项目级保险公司、无车辆级」的旧数据 → 重启 Halo → 断言车辆级 = 中国人保、交强险/商业险重复值被清空、车船税的不同公司「太平洋保险」保留;再次重启后 `metadata.version` 仍为 1(无写入),即幂等;
- 截图留证:`ui-121-car-insurer.png`(车辆级保险公司 + 快捷公司)、`ui-121-car-reminders.png` / `ui-121-car-reminders2.png`(到期项精简、循环间隔、年检推算与同期联动)、`ui-121-notice.png`(上线检验期提示)、`ui-121-dashboard-pager.png`(小组件分页)。

剩余(等用户测试通过后):

1. 按 `docs/releasing.md` 发布正式版 **`1.2.1`**(版本号去掉 `-SNAPSHOT`、重新构建 jar、中文 + 英文版本说明已就绪:`docs/release-notes-1.2.1-SNAPSHOT.md` / `.en.md` 需改名并更新标题),然后推送 GitHub Release(标题 = tag,`--prerelease` → 正式版用 `--latest`)、提交应用市场;
2. 正式版发布前把本文件的 `-SNAPSHOT` 字样与 README 的「当前开发版」说明一并更新。

## 已知环境注意点

- 本机构建 jar 需要 `NPM_CMD` 指向 npm 可执行文件(例如 `C:\Users\Administrator\AppData\Local\nvm\v22.20.0\npm.cmd`),否则 `buildFrontend` 任务报 `A problem occurred starting process 'command 'npm''`;**打包前请确认 `console/build/dist` 已生成**(必要时先 `cd console; npm run build`,再 `gradlew build -x buildFrontend`),并核对 jar 内存在 `console/main.*.js`——本机曾出现过 `BUILD SUCCESSFUL` 但 jar 内没有控制台产物的情况;
- 启动 Halo 请用 `--halo.work-dir=F:/dsh/halo-test/work-xxx`(**正斜杠**;反斜杠会让 H2 的 `r2dbc:///` URL 报 `Illegal character in path`);
- 长时间运行的 Halo 不要放进会被强制结束的后台管道作业里:残留的 java 子进程曾让本机 shell 运行器整体失效(报 `subprocess-local: Windows Job runner exited with exit code 1 before proving its managed range empty`),改用 `Start-Process -RedirectStandardOutput` 独立启动即可;
- 冷启动首次安装插件需要 10~20 秒才注册路由,`halo-smoke.mjs` 已改为轮询等待插件接口可用(`pluginReady()`),避免固定等待导致的批量误报。
