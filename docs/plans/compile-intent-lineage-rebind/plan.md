# PLAN · compile-intent-lineage-rebind

前置：同目录 GRILL.md 定案（前提修正 + Steven 三轮裁定：先修接线取真证再裁、full 六阶段、
混合态全或无阻断）。本 plan 只落实现路线，不复述论证。

## 缺陷与目标

- 缺陷：标准编译路径（无 lineagePlan）事件保留编译器自生 `intent_N`，确认流
  `sourceIntentId` 无人消费 → 出处链成品闸按 `sourceIntentId` 匹配终端事件必拒
  （十三跑 `CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID`，探针双向复现）。
- 目标：`compileFlow` 标准路径在事实产生点把每步产出事件的 `intentId` 重绑为该步
  `sourceIntentId`（全或无，混合硬阻断），使 authored 语义号进入正式产物、`intent_N`
  只服务编译运行态——与 teach-in 原则注释、CONTEXT.md `intentId` 词条一致。

## 改法（主改一个文件）

`lib/compile-atoms-flow.mjs` · `compileFlow`：

1. 逐步存在即绑（2026-08-07 反转定稿；首版「全或无+混合掷错」被
   `entity-ui-wiring.bindagent-replay` 冻结金牌夹具口径证伪——变异步带号、nav/assert
   裸步是既定合法惯例，assert 折进前一意图锚，详 GRILL 第 6 条）：不设流级判定、
   不掷混合错。
2. 步后重绑块（仅 `!plan` 时走新块）：本步带非空 `sourceIntentId` 且产出事件时，把
   `run.events.slice(firstEvent)` 各事件 `intentId` 重绑为 `step.sourceIntentId`，
   `lastIntentId` 同步（断言折叠锚不让 `intent_N` 旁路泄回）；裸步保持自生号与
   遗留折叠行为。
3. 与 teach-in lineage 块并列不合并：teach-in 系 PRD 冻结面大（81/26/25 件级），
   字节零漂移优先于去重。
4. 不动：`entityBindingProvenance`（其行本就同录 `intentId` 与 `sourceIntentId`，
   重绑后相等属预期）、观察归档（已用 `step.sourceIntentId`）、三道冻结门、
   teach-in lineage 块。

## 接缝影响核查（实现中逐项验证）

- 出处链闸：重绑后意图匹配成立、create/delete 终端各恰 1 → ok（探针已证）。
- 基数双射闸：组键 `JSON([intentId,atom])`，重绑只改组名不改组结构；open 让位红照旧
  （十四跑预期唯一红）。
- 身份观察：`evidenceStepId` 按 stepId join，零影响。
- C3 连续性 ref / 出站精确 ID 守卫：按 platformId/目标名选观察，零影响。
- 全仓金牌双态扫描（护栏 #19）：重绑改事件字节；含 `intent_N` 字面的 97 个金牌文件多为
  自造夹具直驱纯函数、预判不受产方重绑影响，逐一以退出码判绿；任何红先判「钉的是缺陷
  行为还是契约行为」，冻结金牌红走改版举证、不许静默改。

## 验收金牌（accept 阶段冻结）

- G1 缝金牌：mock Page 驱真实 `compileFlow`（镜像
  `entity-workflow-source-readback.wiring.zero-sut` 姿势），authored 流产出事件
  `intentId` 全为 authored 号、无 `intent_N` 残留 → 喂真实
  `issueCreatedWorkflowCompileProvenance`（真 `flow.confirmed` 字节形）→ ok；
  突变（重绑还原）→ 同码红。
- G2 混合态钉（反转后）：混合流不掷错、两步全跑，带号步重绑、裸步保持 `intent_N`、
  裸步后 `lastIntentId` 跟随该步自生号（遗留折叠行为）。
- G3 遗留零漂移钉：全不带 `sourceIntentId` 的流 → 事件 `intentId` 保持 `intent_N`。
- G4 teach-in 零漂移：lineagePlan 路径行为一字不差——沿用既有 teach-in 金牌绿 +
  全仓双态扫描背书，不新造重复钉。
- 红/绿基线先行运行验证，sha256 冻结进 `loop/prd-compile-intent-lineage-rebind.json`；
  `passes` 只由 `gate.mjs` 写。

## 评审与收口

- 先 commit 成不可变快照（`git diff HEAD` 为空再派审）；评审后提交前核
  `git diff --cached`。
- 双路异构：grok（真仓暴露 worktree + 自跑金牌）+ `pi.dev` deepseek-v4-pro high；
  任一 `CHANGES_REQUIRED` 按并集修 + delta 复审。
- 收据 + learn 落本目录；HANDOFF/NEXT-SESSION 同步修正被证伪前提（「三门一致表达
  单流单发行」收窄为基数门一道）后再提交 dev。
- merge dev 后主树十四跑（先重启隧道两端）：预期出处链闸绿、exit 65 恰剩
  `OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION` 一道；其他红即停。跑毕以
  单焦点真证摆 Steven 重裁：C 维持还是改收窄版 A。

## 非目标

同 GRILL 第 9 条：不动三道冻结门字节；不碰滞后冻结件（`entity-locks.frozen.json` /
`expected.frozen.json` 的改版重签属 Steven 在途 PRD 冻结清单工作流）；不裁基数门修向；
不动观察让位机制。
