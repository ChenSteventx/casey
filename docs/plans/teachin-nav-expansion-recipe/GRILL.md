# GRILL — teachin-nav-expansion-recipe（菜单组展开点击的导航配方）

> 契约 lane=full。触发：2026-07-29 下午真机实证（`tc_wf_list_smoke` 采形状录制
> `runs/teachin-uat/tc_wf_list_smoke_capture_20260729_134930`）——真机侧栏默认折叠，
> 任何导航录制都是「展开组（智能应用）→ 点条目（工作流管理）」两击；
> `resolveCaptureAtoms` 实测 seq2 解析为 `nav.workflowManagement`、seq1
> `KNOWN_RECIPE_MISSING` → `CYCLE_PLAN_MAPPING_REQUIRED` 转人工。
> hermetic 金牌用单击夹具，碰不到此边界；这是自动闭环在真机上的最后一块拼图。

## 一、机制事实（已读码钉死）

- `matchesAt`（`lib/teachin-distillation/atom-resolution.mjs`）原生支持多击配方：
  按 `recipe.actions` 逐位对齐连续业务事件；`textAnyOf` 只需**跨度内任一**事件命中；
  `requiresSemanticEvidence` 要求跨度内**每一**事件带语义文本。
- 解析主循环最长匹配优先（`longest`/`best`）：同起点多配方命中时取动作数最长者；
  同长多命中才 `KNOWN_RECIPE_AMBIGUOUS`。现役单击配方与新增双击配方长度不同，
  互不制造歧义；单击直达（组已展开）仍由单击配方吃。
- 配方两个登记口：`BUILTIN_RECIPES`（生产件内，冻结策略钦定家）与注册表
  `atoms[*].teachinRecipes`（数据）。

## 二、决策树

**D1 松匹配 vs 槽位约束？**（v2 定案，codex 计划审 r1 双 High 推翻初版）
**取槽位约束**。初版松匹配的「等价兜底」论证不成立——codex 实锤两条：
①闭环 expected 空断言 + 双回放不比动作序列，被吸收的无关首击两侧都成功即产
`ok:true` 技术等价**假绿**（developmentOnly 只拦晋升、拦不住假绿本身）；
②反向吞并：「流程管理文本击 + 未登记动作」也因跨度任一命中被整体吸收，破坏
`resolved-projection` 冻结金牌的「首击 resolved、次击 pending」既有语义（探针复现）。
定案：recipe schema 增可选 `slots`（逐位 `textAnyOf`），`matchesAt` 对带槽配方
逐位校验语义文本；槽 0=菜单组白名单（现役只登记「智能应用」，扩组=策略修订
走 amendment）、槽 1=条目白名单（流程管理/工作流管理）。白名单对菜单改名脆弱
属冻结策略的正确治理面（改名→策略修订+重签），不是缺陷。

**D2 登记在哪？** `BUILTIN_RECIPES`（生产件）。理由：本配方是冻结策略钦定的
只读、零身份绑定导航原子的变体，正是该常量的设计职责（其注释即此语义）；
注册表 snapshot 属生成物、手改有被重生成覆盖的风险。

**D3 配方形状（v2，带槽）**：
```js
{
  ruleId: 'known-nav-workflow-management-grouped',
  actions: ['click', 'click'],
  requiresSemanticEvidence: true,
  slots: [
    { textAnyOf: ['智能应用'] },
    { textAnyOf: ['流程管理', '工作流管理'] },
  ],
  atom: 'nav.workflowManagement',
  params: {},
}
```
`matchesAt` 扩展：配方带 `slots`（长度必须等于 `actions`）时逐位校验
`event.semanticText ∈ slots[offset].textAnyOf`，跨度级 `textAnyOf` 对带槽配方
不适用；无槽配方行为零变化。`normalizeRegistryRecipe` 同步接受并校验 `slots`
（形状非法即整条弃用，fail-closed）。产出单元 = 单个 `nav.workflowManagement`，
`evidenceEventSeqs` 含两击、`intentId` 取跨度首事件——authored 侧维持单步不变。

**D6 跨 authored intent 防合并（codex r1 M4）**：`resolveCaptureAtoms` 增可选
`boundIntents`（Set<eventSeq>，调用方声明哪些事件的 intentId 是 authored 绑定而非
合成序数）。多击配方跨度内含任一已绑定事件且跨度 intentId 不一致 → 该配方按
不匹配处理（fail-closed 落 pending）。默认不传=现语义零变化（首轮合成标签
i1/i2 不受影响）；`cycle-plan-generator` 第二遍重绑投影时传入绑定集。

**D7 配方碰撞治理（codex r1 M3）**：`collectRecipes` 拼接 builtin 与注册表
`teachinRecipes`，同长同起点多命中即 `KNOWN_RECIPE_AMBIGUOUS`（现役语义，
保持）。治理策略：nav 家族配方唯一登记家=BUILTIN，注册表不得重复登记同 atom
导航配方；违者由歧义信号大声暴露（金牌钉 builtin 精确重复与等长异 atom 重叠
两反例），不静默择优。

**D4 行为钉（金牌面，v2）**：
- N1 正钉：真机形状两击（智能应用→工作流管理）→ `resolved=1, pending=0`、
  evidenceEventSeqs=[1,2]；
- N2 回归钉：单击直达仍走原单击配方、ruleId 不变；
- N3（v2 翻转）：无关首击（文本不在槽 0 白名单，如「任意按钮」）+条目击 →
  **不吸收**，首击 pending、次击 resolved——假绿路封死；
- N4 fail-closed：首击无语义文本 → 首击 pending（不变量）；
- N5 端到端：真形状 capture 过 `generateKnownReadOnlyCycleInput` 出 plan
  （mappingCandidate 单单元绑 intent_nav_wf）；
- N6（codex H2 反向吞并钉）：「流程管理文本击+未登记动作」→ 首击由单击配方
  resolved、次击 pending（`resolved-projection` 冻结语义保持）；
- N7（codex M3 碰撞钉）：builtin 精确重复登记 → `KNOWN_RECIPE_AMBIGUOUS`；
  等长异 atom 槽重叠 → 同判；
- N8（codex M4 防合并钉）：两相邻 authored intent 各自绑定的两击传
  `boundIntents` → 双击配方不合并、各自落位；不传 `boundIntents` 时首轮
  合成标签行为零变化。

**D5 不追认已录 capture？** 采形状包（134930）是干净语料、无键损毁——与 clear-fill
的「键已丢不可证」本质不同，本配方落地后**同一包可直接复跑 `teachin-plan` 验绿**
（干跑无副作用）；但正式闭环绿仍需同进程重录（cycle 合同要求 live handles），
Steven 重录一次两击即可。

## 三、挂账（route:human）

- ~~槽位约束硬化~~（v2 已本轮落地为 D1/D3 定案，欠账撤销——codex delta Low 纠）；
- 新金牌冻结人签（ADR-0004，accept 时 Steven 签）；
- 闭环绿后：`cycle-testcase/cycle-expected` 开发期候选的正名（是否入 case 目录
  规范）留后议。
