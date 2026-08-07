# 评审提示词 · compile-intent-lineage-rebind

你是异构评审方，对一个已提交的不可变快照做代码评审。只报 Critical / High / Medium；
结论行格式 `VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`，逐条 finding 给
文件:行号、严重级、失败场景。

## 仓与基线

- 仓：当前工作目录即契约工作树（只读评审，可自己跑命令验证）。
- 基线：dev `05800b4`；评审对象 = `git diff 05800b4..HEAD`。
- 背景文档（按需读）：`docs/plans/compile-intent-lineage-rebind/GRILL.md`（前提修正与
  三轮裁定）、`docs/plans/compile-intent-lineage-rebind/plan.md`（实现路线）。

## 改动白名单（超出即报）

1. `lib/compile-atoms-flow.mjs` —— 唯一生产码改动：步后标准路径重绑块（与 teach-in
   lineage 块并列；逐步存在即绑——带非空 `sourceIntentId` 的步重绑并同步
   `lastIntentId`，裸步保持自生号；混合流合法，无流级判定、无掷错。设计经历一次
   Steven 裁定反转，依据与红证见 GRILL 第 6 条与 accept/red-proofs/）。
2. `tests/_golden/compile-intent-lineage-rebind.zero-sut.golden.mjs` —— 新验收金牌。
3. `loop/prd-compile-intent-lineage-rebind.json`、`docs/plans/compile-intent-lineage-rebind/**`
   —— 契约文书。

## 缺陷与修法（事实，不含实现者推理）

- 生产编译事件带自生 `intent_0..N`；出处链成品闸
  `issueCreatedWorkflowCompileProvenance`（`lib/entity-created-workflow-continuity-v3.mjs:208-236`）
  按确认流步 `sourceIntentId` 匹配终端事件——两套命名空间永不相等，B4 十三跑
  `CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID` 实证。
- 修法：标准路径在事实产生点把每步产出事件 `intentId` 重绑为该步 `sourceIntentId`
  （teach-in 路径已有同款块与原则注释，字节不动）；全带才重绑、全不带零漂移、混合掷错。

## 风险清单（请优先证伪）

- R1 重绑是否破坏任何以 `intent_N` 为键的既有消费者（观察归档用 `step.sourceIntentId`、
  evidenceStepId 按 stepId join——请独立核实）。
- R2 逐步重绑下裸步（nav/assert 惯例）的事件与折叠锚行为是否与遗留逐字等价
   （`entity-ui-wiring.bindagent-replay` 夹具口径是判据，可自跑复核）。
- R3 teach-in lineage 路径是否字节零漂移（两块并列的交互）。
- R4 新金牌是否真钉在缝上（mock 驱真实 `compileFlow`，非源码串 grep；突变闭环
  已验：还原实现 exit 1、恢复后 sha256 同、exit 0——可自行复验，姿势
  `git show HEAD:lib/compile-atoms-flow.mjs >` 重定向、勿用 `git checkout -- `）。
- R5 `rebindToSource` 判定的边界：空流、`sourceIntentId` 空白串、步对象非 plain object。

## 既有证据（可自行复跑）

- `node tests/_golden/compile-intent-lineage-rebind.zero-sut.golden.mjs` → 11/11，exit 0。
- 红基线（实现前 6 过/5 红）：`docs/plans/compile-intent-lineage-rebind/accept/red-proofs/`。
- 邻接八命令全 exit 0（wiring / readback-requery / observation-yield / created-in-run /
  teach-in lineage 双金牌 / term-lint / selftest --tier1）。
- 全仓 298 金牌与 dev 基线双态对比零回归（收据随附）。

## 禁区

不得读取或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。
