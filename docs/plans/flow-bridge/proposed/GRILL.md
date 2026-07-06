# flow-bridge — grill 决策记录（相1 LLM flow 草拟桥，full）

## 背景

compile 的「LLM 一次编译」链条里唯一没落地的机制口：规范 TestCase（design §2 嵌套 steps）→ compile 吃的
`flow`（原子+参数步骤数组）。今天 golden 手写 flow（`FLOW_GOOD`），真链缺这座桥。桥是 L0 确定性复核器——
LLM 在 CLI 外把 TestCase.steps 的 intent 映射成原子草稿（mapping），桥校验后产 compile 直接吃的 `--flow`。

## D1 flow 数据契约

`flow = { id, name, category, steps: [{ atom, params }] }`（compile.mjs gateMode 读、`validateDraft` 消费、
`compileAtomStep({atom, params})` 执行）。桥产物就是 compile 的 `--flow` 输入（round-trip 灌进 gate 段 exit 0）。

## D2 桥的三闸（确定性，fail-closed）

1. **投影忠实闸**（桥独有）：每个 TestCase.steps[].intentId 必被 ≥1 flow 原子覆盖（严格全覆盖）；mapping
   不得造 TestCase 里不存在的 intentId（凭空造步）。**不可自动化的 intent 走显式 route:human 跳过通道
   留痕，绝不静默丢**（Steven 前拍板：严格全覆盖 + 显式跳过）。
2. **编译知识允许集闸**（补 compile-gate 的缝）：每个 atom 必 ∈ `COMPILE_KNOWN_ATOMS`（11 个有编译知识的），
   否则 fail-closed exit 65。真缝实证：`nav.workflowManagement` 在 60 册内、`compile-gate.validateDraft`
   会放行、但 `--execute` 才 `compileAtomStep` throw——桥前置拦住，不让「过闸却执行时炸」。
3. **复用 compile-gate.validateDraft**（结构 + 破坏性前缀硬闸 + 状态机）：不另造闸，桥产的 flow 原样能过
   compile 自己那道门（破坏性原子实体名带 TestCase.uniquePrefix 前缀；模板 `{{uniqueName}}` 不冻字面量）。

## D3 LLM 边界

LLM 在 CLI 外产 mapping（同 `lib/assertion-draft.mjs` 补缝、compile `--flow` 先例）；桥进程零 LLM、零真机。
测时用 mock/内联 mapping 夹具喂桥，不烧真 LLM。

## D4 compile-atoms 加法（消双源漂移）

`lib/compile-atoms.mjs` export `COMPILE_KNOWN_ATOMS`（11 原子集），`:259` 的 throw 改读该 set——行为一字不变，
但允许集成单一事实源（桥的允许集闸与 compileAtomStep 同源，护栏 #17）。

## D5 覆盖范围

11 已知原子够跑通一个最小真实用例（workflow dom_crud + chat）；扩原子是飞轮另案，不在本契约。

## D6 hermetic 可建

桥纯确定性、无浏览器。golden round-trip：`casey flow-bridge` 产 flow.json → `casey compile --flow` gate 段
exit 0 落 flow-<caseId>.json。mock LLM = 内联 mapping 夹具；真机侧不涉（桥不碰 SUT）。

## D7 非目标

不碰真机 / tier2 route:human；不建 ingest（相0 并行相，桥 golden 用内联 TestCase 夹具）/ 不建 sign；
进程内不烧 LLM；不扩原子、不改 `atoms-registry.snapshot.json`；不改 compile 执行/核验段、不动 compile-gate
本体；不动冻结的 verdict.mjs/gate.mjs/断言冻结内核。
