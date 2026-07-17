# teachin-runtime-nonvacuous-readiness — plan（full）

> 本契约 supersede（取代）`teachin-semantic-lock-runtime-authority` 的运行期完成声明；旧 plan、golden、fixture 和 PRD 保持逐字节不变。旧门禁仍可证明调用者不能自铸权威，但其运行期正向检查在生产 `driver` 与 `runner` 均未发布时提前返回，不能背书 `SAME` 或 successor（后继身份证明）已可用。

## 1. 已核事实

1. 生产运行期 `driver` 注册表当前为空，`run context`（本轮运行上下文）状态也没有公开的可信签发者；因此当前机器能证明的只有 `fail-closed`（故障关闭），不能证明真实运行期正向能力。
2. 旧发布清单仍把 `tests/_golden/fixtures/` 下的正向与负向固定语料当生产读取根；固定摘要能阻止普通替换，却不能把测试语料变成真实发布权威。
3. `verifyEntityLockSet` 只在发布条目带动作身份 policy（策略）时检查必需角色。旧发布条目没有 policy，仍能产生未标明运行权限的 handle（句柄）；未来一旦真实 `driver` 打开，这会绕过角色完整性检查。

## 2. 目标

### 2.1 非真空就绪状态

- 新增公开只读就绪状态。真实 `driver` 或可信 `runner` 尚未发布时，必须明确返回 `available:false`、`route:'human'` 与 `reason:'DRIVER_NOT_PUBLISHED'`。
- 零 `SUT` 机器套件此时只可声明运行期保持拒绝；不得把适配器或运行能力缺席后的提前返回记作 `SAME`、successor 或正向闭环通过。
- 本契约不为了转绿而向生产注册表塞 hermetic（封闭合成）`driver`、测试私钥或伪 `runner`。

### 2.2 无动作 policy 的历史锁集降权

- 所有可进入 `evaluateEntityAction` 的发布条目必须带冻结动作身份 policy；未知 atom/action（原子/动作）继续按 `fail-closed` 拒绝。
- 没有 policy 的历史条目只有两种合法状态：未发布；或显式标为 `historical`，验证结果带 `runtimeAuthorized:false`。
- 历史 handle 即使未来拿到合法运行能力，`evaluateEntityAction` 与 `createRunSuccessorProof` 也必须先以 `ENTITY_LOCK_RUNTIME_UNAUTHORIZED` 拒绝，不能依赖当前“运行能力本身也无效”的偶然拒绝。

### 2.3 生产发布清单移出测试语料

- 生产发布清单禁止任何 `tests/`、`_golden`、fixture（固定语料）、负向样例、`docs/`、`loop/`、`cases/`、`runs/` 或调用者普通工作区路径。
- 发布条目必须显式声明来自独立 release resource（发布资源）或 signed manifest（签名清单）；本契约没有真实发布物时允许清单为空并保持拒绝。
- 真发布前必须另立真实 `SUT` 门：真实 `driver`、可信 `runner`、动作 policy 和发布资源共同取证，不能由本轮零 `SUT` 门禁代签。

## 3. 验收点

### 可命令化

1. `readiness`：公开就绪状态在当前缺真实发布时精确申报不可用；调用者 `read` 与普通运行对象继续拒绝。测试缺 API 时直接红，不得提前返回冒充正向通过。
2. `legacy-policy`：旧无 policy 条目只能未发布，或产生 `runtimeAuthorized:false` 的历史 handle；若 handle 存在，动作评估与 successor 必须以专门的运行未授权原因先拒。
3. `publication`：生产发布清单逐项静态审计来源、mode（模式）和路径；任何测试/负向/普通工作区资产都红；调用者选择未发布路径继续拒绝。

### 可观察性申报

- `route:human`：真实 AI 中台 `driver` 与登录后只读扫描接线；用真实账户联网真机证明一次唯一匹配得到 `SAME`，包含录屏、视觉复核、单用例 HTML 和附件。
- `route:human`：真实 `runner` 签发的运行能力与浏览器/session（会话）生命周期同源；真实变更后 successor 成功，关窗、重连、跨运行及 revoked generation（已撤销代际）的旧能力全部拒绝。
- `route:human`：真实发布资源或签名清单的生成、签署、安装和密钥保管边界；Win PowerShell、WSL、macOS 分发后均不能由普通工作区文件替换。
- `route:human`：真实 compile（编译）产生的每个变更/关系动作，与冻结动作身份 policy 的必需角色逐项一致；未知动作现场保持零动作。

## 4. 非目标与停止条件

- 不实现生产 `driver`、`runner`、发布签名或真实 `SUT` 正向链；这些必须由后续真实环境契约完成。
- 本工序不改 `lib/`、`bin/`，不启动 `SUT`、fake、fixture server、浏览器或网络。
- 新 golden 在 `0c9e21a` 上必须真实为 RED；测试与红证据冻结进独立 PRD，`passes` 初始全为 `false`，`gate --dry` 可消费。
