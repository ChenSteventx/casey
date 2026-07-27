# intent-plan-known-atom-foundation

> 目标：以最小改动闭合“陌生用例表述优先复用已有 atom，并把用户 authored expected
> 确定性冻结”的 Wave 1 主干。

## 1. 现状与真缝

现有能力：

- `lib/flow-bridge.mjs` 已校验投影忠实、atom 可编译性、实体角色和 compile-gate；
- `lib/compile-gate.mjs` 已拥有 registry requires/provides/removes 状态机；
- `lib/entity-semantic-lock*.mjs` 已拥有名称 + 编号/平台 ID 身份链；
- `lib/assertion-draft.mjs`、`bin/draft.mjs`、`bin/sign.mjs` 已拥有 draft/validate/sign/frozen 主链。

缺口：

1. flow mapping 目前 100% 依赖外部模型，没有 known-atom dominance；
2. 状态机只返回 problems，不输出可供 intent plan/grill 使用的逐步 trace；
3. `TestCase.steps[].expected/globalAssertions` 已有 schema，但当前 draft 主链不直接消费；
4. 模型 patch 可以与 authored assertion 并存，但尚无“authored 不可覆盖”的合并契约。

## 2. 实现设计

### 2.1 intent plan

新增：

- `lib/intent-plan.mjs`
- `lib/intent-recipes.snapshot.json`
- `tests/_golden/schemas/intent-plan.schema.json`

API：

```text
buildIntentPlan({
  testcase,
  knownRecipes,
  modelProposals,
  registry
}) → {
  schemaVersion,
  caseId,
  decisions,
  mapping,
  unresolved,
  stateTrace,
  ready
}

mappingFromIntentPlan(plan) → flow-bridge mapping
```

规则：

- recipe 只允许 exact/anchored-template；
- 唯一 recipe 命中且 atom 在 registry 与 compile knowledge 交集时，decision=`known`；
- 模型只补零命中的 intent；
- 模型覆盖 known intent → `KNOWN_ATOM_OVERRIDE`；
- 多 recipe 命中 → `KNOWN_RECIPE_AMBIGUOUS`；
- required param 缺失不产半份 mapping，进入 unresolved；
- 最终 mapping 必须经过现有 `validateBridge`；
- `candidateId` 是 Casey join id；平台 ID 不进 mapping locator。

第一版 recipe 只覆盖少量现役高频可编译原子，不承诺任意自然语言：

- `nav.workflowManagement`
- `workflow.create`
- `workflow.save`
- `workflow.open`
- `agent.searchOpen`

### 2.2 state trace

对 `lib/compile-gate.mjs` 做加法：

```text
traceStateMachine(flow, registry, initialStates)
→ {
  steps: [{
    index,
    atom,
    before,
    requires,
    missing,
    provides,
    removes,
    after
  }],
  finalStates,
  problems
}
```

现有 `checkStateMachine` 委托该 API 并保持旧 problems 字节语义，不复制第二套 states。

### 2.3 authored assertion

对 `lib/assertion-draft.mjs` 做加法：

```text
projectTestCaseAssertions(testcase)
mergeAssertionSources({ testcase, observed, assertionAtoms })
```

合并顺序：

```text
TestCase authored expected/globalAssertions
→ compiler assertionAtoms 的确定性映射
→ pending
→ 可选模型 patch，只允许加法
→ 现有 validateDraft
→ sign / expected.frozen
```

`bin/draft.mjs` 增加内部 `--testcase`；不给时保持旧行为。给了以后 caseId 必须四方一致，authored
assertion 不得被 patch 删除或覆盖。

## 3. touchesFiles

实现文件：

- `lib/intent-plan.mjs`
- `lib/intent-recipes.snapshot.json`
- `lib/compile-gate.mjs`
- `lib/assertion-draft.mjs`
- `bin/draft.mjs`

验收文件：

- `tests/_golden/schemas/intent-plan.schema.json`
- `tests/_golden/intent-plan-known-atom.zero-sut.golden.mjs`
- `tests/_golden/intent-state-trace.zero-sut.golden.mjs`
- `tests/_golden/testcase-expected-draft.zero-sut.golden.mjs`

契约产物：

- `docs/plans/intent-plan-known-atom-foundation/GRILL.md`
- `docs/plans/intent-plan-known-atom-foundation/plan.md`
- `docs/plans/intent-plan-known-atom-foundation/accept/red-proofs/`
- `loop/prd-intent-plan-known-atom-foundation.json`

明确不碰：

- `bin/replay.mjs`
- `bin/verdict.mjs`
- `bin/sign.mjs`
- `lib/flow-bridge.mjs`
- `lib/atoms-registry.snapshot.json`
- identity runtime 与正式 frozen schema。

## 4. 验收

### A. intent plan

1. 唯一 exact recipe 命中，输出现役 flow-bridge mapping；
2. 模型在同 intent 给出不同 atom/params/entityBindings，拒 `KNOWN_ATOM_OVERRIDE`；
3. 多条 deterministic recipe 命中，拒 `KNOWN_RECIPE_AMBIGUOUS`；
4. recipe 指向册外或册内不可编译 atom，不能成为 known mapping；
5. 只有 unresolved intent 接受 model proposal；
6. required param 取不出时进入 unresolved，不产半 mapping；
7. mapping 保留 name/code 参数与 `candidateId` binding；
8. mapping round-trip 通过真实 `validateBridge/buildFlow`；
9. 同名但平台 ID 错继续由现有 semantic lock 拒，不能名称回退。

### B. state trace

1. 初始状态、requires、missing、provides、removes 和 finalStates 可复现；
2. 缺 requires 时 trace 点名 missing，problems 与旧 `checkStateMachine` 相同；
3. provider 前置后 missing 消失；
4. exclusive group 继续移除旧状态；
5. 既有 `p2-compile-gate` golden 不漂移。

### C. authored assertion

1. TestCase step expected 确定性进入对应 draft intent；
2. globalAssertions 进入 draft；
3. authored assertion 优先于 compiler assertion，重复项确定性去重；
4. compiler assertion 仍可加法进入；
5. 不完整 authored assertion 进入 pending 或 fail-closed，不能由模型猜成 hard；
6. 模型 patch 不能删除/覆盖 authored assertion；
7. `--testcase` 缺席时 draft CLI 旧行为不变；
8. testcase/observed/report caseId 不一致时拒绝；
9. 产物继续通过现有 validateDraft，sign/frozen 形状不变。

### D. 回归

- `node tests/_golden/flow-bridge.golden.mjs`
- `node tests/_golden/p2-compile-gate.golden.mjs`
- `node tests/_golden/p4-drafter.golden.mjs`
- `node tests/_golden/draft-cli.golden.mjs`

## 5. observability

以下不作为本契约机器完成项：

- 真实 AI 中台 UAT：后继浏览器契约；
- 新平台 ID 真机读回：沿现有 C1 route:human；
- recipe 覆盖率：本契约只报告 5 个明确 recipe，不报自然语言泛化率；
- Grok 异构复审：实现合拢后执行，结果入 review；
- 人工签署：本契约不代签。

## 6. 完成定义

只有三组新验收全部 GREEN、四组存量回归 GREEN、gate GREEN、Grok 复审通过且实现提交合拢后，
才能声明 Wave 1 完成。

不能声明：

- 已支持任意陌生页面；
- zero-shot 浏览器已经实现；
- C1 身份晋升正式完成；
- 人工录制已可回放。
