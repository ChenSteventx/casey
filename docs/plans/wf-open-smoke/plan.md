# wf-open-smoke — 飞轮第五条（只读零缝暖场，direct）

## 背景

飞轮排期自点名的暖场候选：只读打开工作流详情，零新 kind、两纯加法编译原子。决策见 `proposed/GRILL.md`。

## 改动

1. `lib/compile-atoms.mjs`：分派表 +`nav.workflowManagement` +`workflow.open`（形态见 GRILL D1；
   COMPILE_KNOWN_ATOMS 11→13 自动派生）。
2. `tests/fixtures/fake-sut/server.mjs`：行名 td 可点 → 详情（加法；prd-p5-replay 夹具重签）。
3. `tests/_golden/flow-bridge.golden.mjs` 三钉点例翻 `workflow.addNode` + 集 13（prd-flow-bridge 重签）。
4. `tests/_golden/wf-open-smoke.golden.mjs`（红先行）+ `loop/prd-wf-open-smoke.json`。

## 非目标

见 GRILL D5。

## 验收（红金牌）

- C1 两原子可编译 + 集恰 13；
- C2 compile 全程（fake-sut happy）：events 恰 [nav(intent_0), click(intent_1)]、observed 尾步
  urlPathnameAfter=/ai-manager/process/detail、assertionAtoms 两条挂 intent_1；
- C3 mini 端到端：draft(+patch nav 硬断言)→sign→casey run→verdict 全 PASS + 报告在场；
- C4 只读钉死：events 动作 ⊆ {nav,click}、原子集无破坏性原子；
- 涟漪：flow-bridge 金牌翻转后全绿 + prd-flow-bridge/prd-p5-replay 重签双 gate 复验 + p3-compile/
  e2e-chain/tier1 零行为差。
