# plan · post-nav-anchor-wait（light）

## 背景与根因

列表页 SPA 渲染尾巴竞态第三处（同类前两处：create 入口锚 `158829d`、登录导航预算
`9bb2300`）。真机定量已在案：列表页 `load` 后卡片/控件还要约 3.5s 才可定位，而编译
nav 后锚定窗约 4s（`quietPoint` 2.5s + `resolveTarget` 附着 1.5s）。本日实证两次咬人：

- B4 五跑（重表达后首跑）：`workflow.open` 的 text-exact 锚 `atstep_9 absent count=0`
  ——create 八步全过、真建实体后 open 点不到刚建的卡片，级联 source 读回双证门
  `envelope-empty` 硬阻断，删除链未达（残留已按纪律真删清偿 exit 0）。
- B4 四跑：`workflow.deleteByName` 的搜索框 `count=0` → 误入 `CASE_DEFECT 候选` 分支
  （入口并非真缺席，是没等到渲染）。

## 修法（最小，与 create 入口锚同款模式）

两处各加有界就绪锚（250ms 步长轮询、预算 15s、耗尽不改判照走既有 fail-closed 路径）：

- `lib/compile-atoms-workflow-nav.mjs` `compileWorkflowOpen`：容器归属闸探针前，
  对 `getByText(instantiate(openName), { exact: true })` 轮询 `count()`；该文件原无
  `sleep` 导入，随修并入（上一契约的 S4 普查钉自动覆盖此新增消费点）。
- `lib/compile-atoms-workflow-crud.mjs` `compileWorkflowDelete`：nav emit 后、搜索框
  `count()` 判定前，对 `getByRole(textbox, SEARCH_BOX_NAME)` 轮询 `count()`。

零行为差论证：等待只改变「什么时候开始判」，判定本身不动——open 耗尽后照发 emit 走
absent 身份门；deleteByName 耗尽后照走 `CASE_DEFECT 候选` 分支（真缺席仍会被如实记）。

## 验收

新金牌 `tests/_golden/post-nav-anchor-wait.zero-sut.golden.mjs` 五钉：

- S1 open 迟挂载行为钉：目标文本 1.2s 后可定位的塑形替身跑 `compileWorkflowOpen`：
  不抛、点击 emit 发出时目标已可定位（替身记录标志）、count 采样 ≥2、容器归属闸照走
  （emit 前探针命中容器）。红基线：现行代码零等待、emit 时未挂载。
- S2 delete 搜索框迟挂载行为钉：搜索框 1.2s 后可定位的替身跑 `compileWorkflowDelete`：
  不抛、**不落 CASE_DEFECT 候选**、fill/press emit 照发（随后被计数对账门如实拦是
  既有行为、不在本钉断言面）。红基线：现行代码立即判 count=0、误落 CASE_DEFECT。
- S3 open 预算耗尽零行为差钉（回归钉，现行同绿）：目标永不挂载时照发 absent 点击
  emit、总耗时有界（<20s）。
- S4 delete 预算耗尽零行为差钉（回归钉，现行同绿）：搜索框永不挂载时照落
  `CASE_DEFECT 候选`、事件只有 nav、总耗时有界（<20s）。
- S5 结构钉：两处就绪锚（`就绪锚` 注释 + 15000 + `count()` 轮询）在各自判定点之前；
  nav 模块 import 行含 `sleep`。

红基线对最终金牌字节实抓（S1/S2/S5 红、S3/S4 绿），证据
`accept/red-proofs/post-nav-anchor.red.txt`；突变闭环同前例（还原红/复原 sha256 同/绿）。

邻接复跑：`wf-create-entry-anchor-wait` + `wf-crud-sleep-import`（S4 普查钉覆盖 nav
模块新增 sleep 消费）+ `login-nav-budget` + `term-lint --registry` + `selftest --tier1`。

## 非目标

- 不动 `quietPoint`/`resolveTarget` 全局时序（那是 kernel 级、爆炸半径大；三处外科锚
  已覆盖 B4 全链路的 nav 后首锚点）；
- 不动 open 的容器归属闸与 delete 的计数对账门语义；不碰回放侧与冻结件；
- 若后续再冒第四处同类锚点，升级为「nav 后首锚统一就绪协议」另立契约，不再逐点打补丁。
