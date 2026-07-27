# precondition-atom-workflow

> 目标：把业务前置条件从自然语言假设提升为可排序、可执行、可取证、失败时阻断主体 flow 的
> setup atom workflow。

## 1. 现状与真缝

现有 `TestCase.preconditions` 在旧 compile-gate 中是初始状态种子，但自然语言业务前置不代表运行时已经完成。
S1 只信 Login Bootstrap 已证的 `已登录`；其余业务状态必须由 setup probe/post-readback 取得。现有 compile
flow 也没有 setup/subject 阶段屏障：如果上游只把前置条件写成文字，系统无法证明它做过，更无法证明失败后
主体没有继续。

可复用的确定性能力：

- atom registry 的 requires/provides/removes；
- `traceStateMachine` 的单一状态机；
- flow-bridge 的投影忠实、可编译性、破坏性前缀和实体角色闸；
- compile identity observation 的名称、编号、平台 ID 观察行；
- 现役 Entity Identity Receipt 与 semantic lock 主链。

## 2. 交付设计

### 2.1 setup plan

新增 `lib/adaptive-execution/setup-flow.mjs`：

```text
planSetupFlow({
  testcase,
  candidate,
  registry
}) → {
  schemaVersion,
  artifactKind: "setup-flow-plan",
  caseId,
  ready,
  orderedIntentIds,
  flow,
  initialStates,
  providedStates,
  stateTrace,
  problems
}
```

Candidate 形状：

```jsonc
{
  "schemaVersion": 1,
  "artifactKind": "setup-flow-candidate",
  "caseId": "tc_demo",
  "goalStates": ["智能体详情已开"],
  "steps": [
    {
      "intentId": "setup_open_agent",
      "atom": "agent.searchOpen",
      "params": {
        "searchKeyword": "AG-001",
        "openName": "示例智能体",
        "code": "AG-001"
      },
      "entityBindings": [
        { "candidateId": "agent_1", "role": "subject" }
      ]
    }
  ]
}
```

规则：

1. requires/provides/removes 从 registry 读取；candidate 若携审计投影，必须与 registry 完全一致；
2. 对每个未满足 requires，只有 candidate 内唯一 provider 才连边；
3. 缺 provider、多 provider、依赖环、目标状态未达成全部结构化拒绝；
4. 稳定 Kahn 拓扑排序，tie-break 使用 `intentId`，相同输入输出字节稳定；
5. 排序后委托 `traceStateMachine`，不能把 trace 为防连锁误报临时补入的 missing 状态算作真实提供；
6. `login`、未知 atom、册内不可编译 atom拒绝；
7. 复用现有实体角色策略：mutation 恰 `subject`，relation 恰 `source + target`，不得按数组顺序猜角色；
8. setup flow 使用现有 `buildFlow` 形状，能交给后继 compile 执行接线。
9. 已登记身份观察义务的 atom，动作角色与观察角色必须一致；现役 `workflow.open`
   `action=subject / observation=source` 尚未统一，因此规划期直接 `SETUP_IDENTITY_ROLE_CONFLICT`
   且 `route:human`，不得先执行后在 receipt 阶段才发现冲突。

### 2.2 setup receipt 与主体准入

新增 `lib/adaptive-execution/setup-receipt.mjs`：

```text
createSetupAdmissionSession({ caseId }) → opaque session

createSetupExecutionRequest({ plan, admissionSession }) → {
  schemaVersion,
  artifactKind: "setup-execution-request",
  caseId,
  setupPlanSha256,
  executionChallenge
}

finalizeSetupReceipt({ plan, execution, admissionSession }) → { ok, receipt, problems }

admitMainFlowWithSetup({
  testcase,
  mainMapping,
  setupPlan,
  setupReceipt,
  identityObservationBytes,
  registry,
  admissionSession
}) → {
  ok,
  allowMainStart,
  initialStates,
  mainFlow,
  stateTrace,
  resolvedIdentities,
  problems
}
```

Receipt 必须：

- `signed:false/replayReady:false`，且没有 PASS/verdict 字段；
- 绑定 setup plan 原始确定性 digest；
- 绑定 barrier 在执行前签发的一次性 `executionChallenge`；旧 execution evidence 不能放进 fresh session
  重新 finalize；
- 每个 setup intent 恰一条、顺序相同；
- `executed` 必须动作 unique 且提供状态有 post-readback；
- `already-satisfied` 必须 `acted:false` 且有确定性 probe proof；
- 任一步 ambiguous/absent/action_failed、缺步、重复步、错序、额外状态都不能成 receipt。

主体准入：

- 只有合法 receipt 的 `providedStates` 才能与已证 Login Bootstrap 状态合并；TestCase 中其他业务前置文本不直通；
- 合并后重跑真实 `validateBridge`/状态机；
- 无 receipt、receipt 被改、主体仍缺状态时 `allowMainStart:false`；
- receipt 只存 identity observation 引用。消费时按原始字节 sha、caseId、
  `sourceIntentId/candidateId/role/atom/evidenceStepId` 唯一解析观察行；
- 名称和编号必须与 setup 参数一致；平台 ID 只从唯一观察行投影，不按名称生成、不从 receipt 接受。

### 2.3 runtime barrier

新增 `lib/adaptive-execution/setup-barrier.mjs`：

```text
executeWithSetupBarrier({
  setupPlan,
  testcase,
  mainMapping,
  registry,
  executeSetup,
  executeMain
}) → {
  stage,
  setupReceipt,
  mainResult,
  problems
}
```

`executeSetup` 与 `executeMain` 是后继 compile/browser adapter（适配器）注入点。`executeSetup`
接收 `(setupPlan, executionRequest)`，返回的 evidence 必须回绑 request challenge。屏障自身固定顺序：

```text
admitSetupPlan
→ createSetupAdmissionSession
→ createSetupExecutionRequest
→ executeSetup
→ finalizeSetupReceipt
→ admitMainFlowWithSetup
→ executeMain
```

setup plan 未就绪时 `executeSetup` 本身必须零调用；后续任一阶段失败或抛错，`executeMain` 必须零调用。
第一版同一调用内传递 identity observation 原始字节和一次性 challenge；跨 run 复用后置。

## 3. touchesFiles

实现：

- `lib/adaptive-execution/setup-flow.mjs`
- `lib/adaptive-execution/setup-receipt.mjs`
- `lib/adaptive-execution/setup-barrier.mjs`

验收：

- `tests/_golden/precondition-atom-workflow.zero-sut.golden.mjs`
- `tests/_golden/setup-receipt-identity.zero-sut.golden.mjs`
- `tests/_golden/setup-runtime-barrier.zero-sut.golden.mjs`

加法回归：

- `tests/_golden/intent-state-trace.zero-sut.golden.mjs`
- `tests/_golden/flow-bridge.golden.mjs`
- `tests/_golden/entity-binding-operability-successor.zero-sut.golden.mjs`

明确不碰：

- `bin/verdict.mjs`
- `bin/replay.mjs`
- `lib/record-intake.mjs`
- 正式 Entity Identity Receipt schema；
- `.auth/`、`site.json` 和真实目标地址。

## 4. 验收

### A. setup plan

1. 乱序的真实 registry provider/consumer 被稳定重排，重复运行字节一致；
2. candidate 自报状态投影与 registry 不符时拒绝；
3. 缺 provider、多 provider、依赖环分别具名拒绝；
4. 未知、册内不可编译、`login` atom 不得进入 setup flow；
5. 目标状态未达成时不 ready；
6. mutation/relation 角色不完整或未知时拒绝，relation 不按数组顺序猜；
7. 输入对象不被变异，输出数组稳定。
8. 动作/观察角色策略冲突时规划期 `route:human`，不得执行 setup adapter。

### B. receipt 与身份

1. setup 步全部 unique 且 post-readback 完整时产生 candidate receipt；
2. ambiguous/absent/action_failed、缺步、重复、错序、plan digest 错、额外状态均拒绝；
3. `already-satisfied` 没有 probe proof 时拒绝，有 proof 时动作次数为零；
4. 无 receipt 时主体仍点名 missing；合法 receipt 合并状态后主体 bridge 变绿；
5. receipt 内联 platform ID 或 identity observation hash/关联键错误时拒绝；
6. 同 candidate 多观察行拒绝；唯一观察行精确匹配名称/编号后才投影平台 ID；
7. 主体 mapping 仍只有 `candidateId + role`，不写入平台 ID。
8. 同一 receipt 不可重复准入；旧 execution evidence 不能在 fresh session 重新 finalize/准入。

### C. runtime barrier

1. happy path 调用顺序固定为 plan admission → execution request → setup → receipt → admission → main；
2. plan 未就绪时 setup/main 均零调用；setup adapter 抛错、非 unique 或 readback 不足时 main 零调用；
3. receipt/admission 被篡改时 main 零调用；
4. barrier 输出不含 PASS/verdict，不调用 LLM。

### D. 邻接回归

- `node tests/_golden/intent-state-trace.zero-sut.golden.mjs`
- `node tests/_golden/flow-bridge.golden.mjs`
- `node tests/_golden/entity-binding-operability-successor.zero-sut.golden.mjs`

## 5. observability

以下必须显式 route:human，不能用 zero-SUT 冒充：

- 真实 AI 中台执行一个 setup atom 后主体 atom 才启动；
- AI 中台版本变化后的 setup readback 稳定性；
- 医生站 held-out setup workflow；
- Hi 小助 CEF 通道；
- `workflow.create` 与 `workflow.open` 的 `subject/source` 角色冲突；S1 明确 fail-closed
  `route:human`，不得伪装为可执行 setup；
- 多身份通道和跨 run receipt；
- destructive/relation setup 真机 UAT；
- 人工录制前置条件并蒸馏为 atom 的闭环，归 S3/S4。

## 6. 完成定义

三条新金牌真实 RED 后冻结，三个实现分支合拢后全部 GREEN；三条邻接回归 GREEN；PRD checksum
无漂移；异构实现评审无未处置 Critical/High/Medium，才可声明 S1 纯函数与 adapter 闭合。

不能声明：

- 真实页面 setup UAT 已通过；
- 陌生页面 zero-shot 已实现；
- 人工录制已可正式 intake/replay；
- 新平台 ID 已由 setup receipt 自行签署。
