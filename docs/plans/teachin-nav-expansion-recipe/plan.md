# plan — teachin-nav-expansion-recipe

> 前置：`GRILL.md`。lane=full。目标：真机两击导航（组展开+条目）可被闭环解析为
> 单个 `nav.workflowManagement` 单元，`tc_wf_list_smoke` 冲首个真机自动闭环绿。

## 1. 生产件改动（v3 槽位约束版，三文件；初版「一处纯增量」被 codex r1 双 High 推翻）

1. `lib/teachin-distillation/atom-resolution.mjs`：
   - `BUILTIN_RECIPES` 增双击带槽配方（GRILL D3 v2：槽 0 智能应用、槽 1 流程管理/工作流管理）；
   - `matchesAt` 增槽位校验分支（带 `slots` 逐位 `semanticText ∈ slots[offset].textAnyOf`；
     无槽配方行为零变化）；
   - `resolveCaptureAtoms` 增可选 `boundIntents` 防合并守卫（GRILL D6：多击跨度含
     已绑定事件且 intentId 不一致即不匹配，默认不传零变化）；
   - `normalizeRegistryRecipe` 接受并校验 `slots`（长度须等于 actions、形状非法整条弃用）。
2. `lib/teachin/cycle-plan-generator.mjs` 两处：
   - `remapKnownUnits` 第二遍 `resolveCaptureAtoms` 调用传入 `boundIntents`（重绑 seq 集）；
   - `semanticIntentMatches` 标签事实源扩展（opus 可达性实测逮出的计划缺口）——
     **v3 定案（codex delta 裁定）：带槽配方只认末槽**（目的地条目名）；并集会让
     只写「智能应用」的 authored intent 错绑本 atom，须新增负钉（N9）。
3. `lib/teachin/resolved-projection.mjs`（codex delta 补钉 M4 的漏调用面）：
   `resolveCaptureProjection` 内 `resolveCaptureAtoms` 调用传入绑定集——
   **取本次投影业务事件与 `intentIdBySeq` 的交集**（v4 修正：mapping 行是调用方
   自报、可携越界 seq，原「直接传 keys」会让越界 seq 在 fidelity 之前被守卫
   入参校验抢先吞成 `UNSAFE_DATA_SHAPE`，冲掉冻结金牌 P6 的具名拒付
   `MAPPING_EVENT_OUT_OF_RANGE`——opus 打样实测逮出并复验修复）。守卫效力
   不减：真被 authored 绑定的业务事件一个不少。`cycle-plan-generator` 处无需
   交集（其 keys 可证为业务 seq 子集）。
4. `boundIntents` 成员校验（codex delta 裁定② + r3 补严）：非 `Set` 拒
   `UNSAFE_DATA_SHAPE`；`Set` 成员须正安全整数**且存在于本次投影的业务事件
   `eventSeq` 集内**（`Set([999])` 之类幽灵成员同拒——否则守卫看似在场实则
   空转）。守卫落位 `matchesAt`（裁定③：属「配方不匹配」，须在最长匹配与
   歧义筛选前生效以保留短配方回退）。

## 2. 金牌（红先行，v2 八组）

新金牌 `tests/_golden/teachin-nav-expansion-recipe.zero-sut.golden.mjs`（零 SUT），
N1-N8 语义见 GRILL D4 v2（夹具取 134930 采形状包脱敏重表达）。红绿分布预期：
N1/N5 修前红（现状 pending / MAPPING_REQUIRED）；N2/N4 修前绿修后必须仍绿；
N3（v2 翻转为不吸收）与 N6（反向吞并封死）修前绿修后必须仍绿——它们钉的是
新配方**不得**破坏的语义；N7/N8 依赖新机制（slots/boundIntents），修前红。

v3 增补（codex delta）：
- N8 增两限：`boundIntents` 非 `Set` 拒 `UNSAFE_DATA_SHAPE`；`Set` 含脏成员
  （非正安全整数）同拒；
- N9（新，末槽负钉）：authored intent 文本只含「智能应用」（组名、无条目名）→
  `semanticIntentMatches` 必须拒绑（`CYCLE_PLAN_INTENT_BINDING_REQUIRED`），
  正限=含「工作流管理」照常绑上；
- N10（新，绑定投影守卫接线钉）：`resolveCaptureProjection` 路（绑定投影）守卫
  真接线——**形状按机制事实定**（opus 实测：给组展开击也写 mapping 行必
  `MAPPED_PENDING_OVERLAP`，观察不到合并差异）：mapping 只声明条目击、组展开击
  作未映射 pending 共存（复用 `resolved-projection` P8 冻结形态），跨度一绑一未绑
  且 intentId 不一致即触发 D6 守卫；接线钉经负控实证（打样中删除该路 `boundIntents`
  传参 → N10 红 `CAPTURE_EVENT_UNCOVERED`，恢复即绿）。

v3 落成记录（opus 三轮迭代）：金牌 10 组、修前 6 红（N1/N5/N7/N8/N9/N10）
4 绿（N2/N3/N4/N6）exit 1；克隆副本按本节 diff 打样 10/10 绿、邻接四枚零回归。
两条已定口径：①带槽配方若同时声明跨度级 `textAnyOf`，末槽压过之（标签事实源
唯一在 slots，与 `matchesAt` 同口径）——未金牌钉、登记第二条带槽配方前须补钉；
②`boundIntents` 成员判据 `Number.isSafeInteger && >0` 且须存在于投影业务事件集
（与 `evidenceEventSeqs` 既有判据同域）。金牌 647 行不在 boundaries B1 的 600 行扫描面
（其只扫 `teachin-replayability-*` 家族），若并入该家族命名须先下沉装具。

复跑矩阵（护栏 #19）：`teachin-replayability-*` 家族含 atom-roundtrip/boundaries/
review-hardening/cycle-plan 等 + `record-distill` + 上一契约新金牌
`teachin-clear-fill-admission` + sweep 分片装具自身（其 52 枚期望表不含本新金牌，
新金牌另列 acceptance；漂移扫覆盖跨 prd）。

## 3. prd 与验收

`loop/prd-teachin-nav-expansion-recipe.json`：s1=新金牌红→绿；s2=邻接复跑
（关键家族清单）；s3=漂移扫+term-lint。gate 独写 `passes`。

验收点（全按退出码）：
- A1 新金牌翻绿；A2 邻接零回归；A3 全仓冻结件零漂移；
- A4（真机、route:human）：134930 采形状包 `teachin-plan` 干跑出 plan（exit 0）；
  Steven 重录两击 → `teachin-cycle` 同进程闭环「技术等价成立」（developmentOnly）。

## 4. 评审

计划审 codex sol xhigh（异构铁律）；实现后 codex+grok 联审（真仓暴露）；
修复即复审；账落 `loop/audit.jsonl`。

## 5. 风险清单（给评审，v2）

- R1（已定案 v2）：吸收假绿路由槽位约束封死（N3 翻转钉不吸收）；
- R2 最长匹配歧义面：长度不同不歧义；同长碰撞由 N7 显式钉 `KNOWN_RECIPE_AMBIGUOUS`；
- R3 配方碰撞治理（GRILL D7）：nav 家族唯一登记家=BUILTIN，违者歧义大声暴露；
- R4 跨 authored intent 防合并（GRILL D6）：`boundIntents` 显式声明、默认零变化，
  N8 双向钉；
- R5 槽 0 白名单（智能应用）对菜单改名脆弱：冻结策略治理面（改名→amendment 重签），
  非缺陷；
- R6 `matchesAt`/`normalizeRegistryRecipe` 属共享冻结面邻接（护栏 #19）：
  复跑矩阵含 resolved-projection 与全家族。

## 6. 计划评审记录

- r1（2026-07-29）：codex `gpt-5.6-sol` xhigh 判 `PLAN_CHANGES_REQUIRED`
  （2 High + 2 Medium，原卷 `plan-codex-r1.log`）：H1 等价兜底论证不成立
  （expected 空断言+双回放不比动作序列→吸收可产假绿）、H2 反向吞并破坏
  resolved-projection 冻结语义（探针复现）、M3 配方碰撞治理缺失、M4 跨 intent
  防合并缺失。四条全采纳：方案由松匹配转槽位约束（D1/D3 v2）、N3 翻转、
  新增 D6/D7 与 N6/N7/N8。本版即修订后计划，待 delta 复审与 Steven 确认。
