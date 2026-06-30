# Casey 接缝冻结提案 — 完整 schema + fixture（冻前人审）

> 排期 v2 第1层。审完回去告诉 Claude：批准冻结 / 哪条要改。

## 1-events
**接缝**: events.json

**用途**: 编译→回放之间的确定性可回放 spec（web channel）。编译门产出的 flow（原子序列）落成一份 web events.json：每个交互动作一条 event，落稳定属性(stepId+role+accessibleName / semantic 语义定位器)，回放期由 autotester _data_runner（findEvent/overlayRow/buildSpecFromEvents）确定性加载并可参数化注入，下游 verdict.mjs 凭 event 上回填的 intentId/atom 把 N 个 event 卷回一条 intent 出三轴。P3 第一硬门：这份 events.json 必须能被 runner 加载、且不触 authored/参数化拒绝。

- schema: 1-events.schema.json
- fixture: 1-events.fixture.json

## 2-observed-reality
**接缝**: observed-reality

**用途**: 编译期（相1）落盘的地面真值 observed-&lt;caseId&gt;.json：LLM agent 唯一一次直接跑用例时，在每个回放原子步达静默点后采集的真实成功 URL / 干净标题 / toast / 流式回复 / 请求日志。相2 断言草拟读它推导带类型 expected[]（默认结构式、易变值模板化），相4 裁定的取证背书与之同形（requestLog 对齐 watchNetworkForensics 的 network 取证条目）。它是 ground truth 而非裁定结论——存实测字面量（含 atl_&lt;ts&gt; 实例名），由下游 templatize，自身绝不冻结、不进 verdict.json golden。

- schema: 2-observed-reality.schema.json
- fixture: 2-observed-reality.fixture.json

**歧义/抉择**:
- Q: requestLog 的 ts 用 epoch 毫秒数还是 ISO-8601 字符串？　建议: A：与 design §9.1 的 {url,status,ts,initiator} 一致，且 observed 不进 golden、ts 仅供归因排序，数值最省。capturedAt 保留 ISO 因其是元数据。
- Q: requestLog 按每步采集桶(per-step)还是单一全局日志 + attributedStepId？　建议: A：§9.3 明文 per stepId requestLog[]，且 verdict-cases.json 的 background_401 正是放在某步桶内但 attributedStepId 指向他步/为空。保留 per-step 桶但允许条目 attributedStepId 与桶主 stepId 不同，归因以 initiator 为准(非桶位)。
- Q: replyText 是否截断/限长？长 LLM 输出可能很大。　建议: A：observed 是地面真值且报告第4小节要展示 LLM回复-文本全文，replyContains 草拟也需全文；它不进 verdict.json golden 故无字节复现压力。若实测体积失控再加可选 truncated 元字段，v1 先不引入。
- Q: errorEnvelope 与 requestLog 是否要承载更细的 response/request 体以便复盘？　建议: A：硬规则要求 .auth/site.json 凭据不得进任何输出/报告，请求体/响应头是凭据与 PII 高危面。schema 用 additionalProperties:false 兜底禁止 body/headers/cookie/token，errorEnvelope 只留被检字段标量。排障改由 trace(.zip) 承担。

## 3-report-model
**接缝**: report-model.json — Casey 报告数据源接缝：verdict.mjs 输出 ⋈ StepAxes ⋈ observedReality ⋈ prd 冻结契约的合成产物，反向约束报告渲染器（HTML/MD/json 旁车）。

**用途**: 把 S1 冻结的最小裁定（verdict.mjs 仅吐 {stepId,intentId,atom,verdict,reason}）与渲染报告所需的「期望对实际字面量 / 取证归因 / 观测现状 / 附件路径」一次性合成成单一只读数据源，让报告渲染器（P7）变成无逻辑的纯渲染消费者：报告要展示什么，本 model 就必须携带什么。它同时是 P7 渲染器唯一 golden 校验对象（HTML 因内嵌录屏/时间戳不做字节 golden，本 model 做）。命名采用 report-spec §6 的建议 report-model.json，与 verdict.mjs 原始输出（裁定档 verdict.json）显式区分，免两个「verdict.json」打架。

- schema: 3-report-model.schema.json
- fixture: 3-report-model.fixture.json

## 4-drift-patch
**接缝**: drift-patch · 非就地自愈补丁旁文件 drift/<caseId>.<ts>.patch（自愈 → 重跑/复核）。连接相5自愈（L3，HARNESS_ERROR 下游消费者）与人签门 + 同一冻结 L0 checker 复核。

**用途**: 把一步「确证工装漂移（HARNESS_ERROR）」的重锚提案落成旁文件证据：记原 locator/稳定签名 → 重锚后 locator/签名、触发取证（verdict=HARNESS_ERROR 引用 + driftProbe + recordedLocatorMiss）、人签字段、应用状态生命周期。守护栏 #5（非就地、人签后才应用、原 spec 不变照常回放、spec 指纹另由 gate 守）与 #13（自愈只对正向确证 HARNESS_ERROR 开闸；缺 miss 证据/缺同签名唯一元素即不合法）。单步一补丁，便于人签原子化与同一步 N 次漂移按 driftCount 升级 inbox（flaky locator）。下游：轨 D·P6 对此 fixture 跑 hermetic；应用后由同一 verdict.mjs/check.mjs 复核回 PASS 才闭环。

- schema: 4-drift-patch.schema.json
- fixture: 4-drift-patch.fixture.json

## 5-prd-schema-v2
**接缝**: prd.schema-v2 —— loop/prd.schema.json 的加性扩展（schemaVersion 1 不变、新增 schemaVersion 2 的 Casey 冻结断言契约层）。单文件同时校验 v1（loop-kit 通用 task/stories/passes 契约）与 v2（v1 全集 + caseId + 逐 intent typed expected[] 带人签元数据 + 多态裁定枚举）。

**用途**: 把「冻结断言契约」这条接缝在 schema 层钉死，让 P4（冻结+人签）/P5（多态裁定）/P6（自愈）等下游里程碑能各自对合成 fixture 并行开发：上游产出 expected[]+人签元数据、下游 verdict.mjs/report 共吃同一份 verdict 枚举（与已冻 verdict.json 同一 Published Language）。核心不变量在 schema 里强制：终判（PASS/SUT_DEFECT/HARNESS_ERROR）reason 必 null、NEEDS_HUMAN 必带 5 个 reason 子类之一（fail-safe，镜像 bin/verdict.mjs §4.2 判定树）；每条冻结 expected[] 必带 signedAt/signedAgainstBuild/signerId（期望版本化，§4.3）。向后兼容：现有 schemaVersion 1 的 prd-*.json（prd-selftest.json / prd-p2-intent-compile.json）一字不改仍合法。

- schema: 5-prd-schema-v2.schema.json
- fixture: 5-prd-schema-v2.fixture.json
