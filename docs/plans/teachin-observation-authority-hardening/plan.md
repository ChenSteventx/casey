# teachin-observation-authority-hardening — plan（full）

目标：以替代性契约收紧 身份观察旁车 的最后一段受信边界。旧 `expectedBinding` 只能帮助结构复核发现换包，永远不能产生 `trusted:true`；新的受信入口只消费 示教三件套 经 示教入账台账 最新 accepted 记录联合核验后铸造的不透明 authority（权威能力句柄）。同时冻结事件证据单对象占用、动作与证据相关性、UTF-8 百分号编码敏感内容和 JavaScript Proxy（代理对象）四组 fail-closed 行为。

本契约 supersede（替代并收严）`teachin-observation-sidecar-hardening`，不修改原冻结测试、原 PRD 或原 checksum。

## 1. 权威来源与 API 分层

1. `reviewIdentityObservationBundle` 保持结构复核面，结果恒为 `trusted:false`；它可以用普通 `expectedBinding` 对比 hash，但普通对象不构成台账来源证明。
2. 旧 `verifyTrustedIdentityObservationBundle` 不得继续把任何 plain object（普通对象）形式的 `expectedBinding` 升成 `trusted:true`；兼容保留时也只能拒绝或降权为结构复核。
3. 新增 `verifyAcceptedIdentityObservationBundle`。它接收 `acceptedIntakeAuthority`，且必须调用 `lib/record-distill.mjs` 的 `acceptedIntakeAuthorityFacts` 验证模块私有品牌。
4. 有效句柄只能来自真实纯函数接缝：`verifyTeachInPackage` 联合验证 capture、`identity-observations.json`、`teach-in-package.json` 最终字节并铸造 package authority → `verifyIntakenPackage` 将当前三件套与最新 accepted 台账记录逐字段对账并铸造 accepted-ledger authority → 新 API 消费该句柄。
5. `{ source:'accepted-intake-ledger', ...hashes }`、复制句柄可见字段、package authority 或任意 Proxy 均不得冒充 accepted-ledger authority。当前身份旁车的真实 `artifactKind` 必须能走通上述 package/intake 接缝，不得另造测试专用旁车形状。

## 2. eventSeq 证据基数与相关性

1. capture event 的 `seq` 仍须为唯一正 safe integer；每条观察仍须引用存在的 event。
2. 同一个 `eventSeq` 最多授权一个业务对象身份观察。两个不同 workflow/agent/其它对象共用一次事件证据时拒绝，不能让“一次读回”被复制成多对象背书。
3. 观察的 `evidenceKind` 必须与被引用事件的 action 属于显式闭合兼容表。至少 `fill`/`press` 这类输入动作不得被 `detail-dual-anchor-readback`、`same-record-dual-anchor-readback` 或 `platform-response-readback` 自声明成对象读回证据。
4. 兼容表外的组合一律 `trusted:false`；不得根据 `text`、名称相似或 LLM/视觉推测放宽。

## 3. UTF-8 百分号编码敏感门

1. 对每个可落盘 string 扫描原值，并将连续 `%HH` 字节按 UTF-8 严格解码后逐轮扫描，直到不动点。
2. 单轮及多轮编码的中文“密码/口令/密钥/验证码”、英文 `token`/`secret` 与 URL 均按 `SENSITIVE_CONTENT` 拒绝。
3. UTF-8 截断、overlong（过长编码）、非法 continuation byte（续字节）、混入非法 `%` escape（转义）和轮数上限内不收敛均 fail-closed；错误只返回类别码，不回显原值。
4. 普通中文和自然语言裸百分号（例如“完成率 100%”）保留为合法反误伤基线。

## 4. Proxy 零 trap 边界

1. `snapshotPlainOwnData` 在任何 prototype、ownKeys 或 descriptor 反射之前，先使用 `node:util/types` 的 `isProxy` 拒绝 Proxy。
2. 顶层 options、嵌套 observation、capture、pathFacts、旧 expectedBinding 与新 authority 任一层是 Proxy 都须固定类别拒绝。
3. 拒绝过程中 Proxy 的 `getPrototypeOf`、`ownKeys`、`getOwnPropertyDescriptor`、`get` 等 trap 调用次数必须为 0；不得通过“捕获 trap 异常”冒充安全快照。

## 5. 可命令化验收

- `node tests/_golden/teachin-observation-authority-hardening.zero-sut.golden.mjs`

新增 golden 必须在实现前真实红，并覆盖：普通 `expectedBinding` 假权威、真实 opaque accepted-ledger authority 正反路径、eventSeq 一证多对象、无关 action/evidence、UTF-8 多轮与非法编码、Proxy 零 trap，以及两份旧冻结测试 checksum 不变。

## 6. 可观察性申报

- accepted-ledger authority 在真实 I/O 中必须来自固定同级三件套、同一打开文件快照及 append-only 台账最新 accepted 行；纯函数 golden 不证明文件系统 TOCTOU，`route:human`。
- workflow/agent/其它业务对象在真实 AI 中台上的 action/evidence 兼容性与同记录名称+编号读回，必须联网真机逐 case 录屏和视觉复核，`route:human`。
- 本工序禁止启动 SUT、fake、fixture server、浏览器或网络；只冻结契约，不写生产实现。

## 7. 停止条件

新 golden 取得真实红输出并存档；sha256 写入新 PRD；`gate --dry --prd <新 PRD>`、术语检查和 `git diff --check` 通过；提交只含本计划、红证、新 golden 和新 PRD 后停止。
