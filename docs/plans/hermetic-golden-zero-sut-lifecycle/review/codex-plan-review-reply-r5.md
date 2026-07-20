总判：**仍有阻断项，v5 暂不可进入 accept**。

R4 的效果路径归因问题已消解，迁移校验器冻结也解决了原始攻击面；但 unit 分区的边血缘仍缺规范 join，receipt 的可信证据/签署/触发定义仍不足以编写确定性验收，并且新加的 append-only ledger 没有可执行的不变性定义。

## 1. R4 边血缘可互换：部分消解，仍残留 High

已消解：

- matrix、receipt、manifest、story 现在都显式携带 obligation 血缘，[plan.md:49](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:49)-[57](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:57)。
- 同分区交换、重复 target、两 obligation 指同一 target 的 mutation 已明确要求红，[plan.md:59](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:59)、[plan.md:99](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:99)。
- fake-SUT 分区有 `manifest(sourceObligationId→uatCaseId)`，能够提供明确 join，[plan.md:53](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:53)、[plan.md:57](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:57)。

仍残留 High：

- `source-obligations` 的定义只有原始 `{sourceGolden, checkId, ...}`，没有 `unitCheckId` 或 successor 边，[plan.md:33](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:33)。
- 计划却声称 zero-SUT 边在“obligations、matrix、receipt、存活 check”四处一致，[plan.md:56](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:56)。其中 obligations 端并不能按现有 schema 产生 `(obligationId,unitCheckId)`。
- “存活 unit golden 的 check”也没有规定携带 `sourceObligationId`，且 `unitCheckId` 是否全局唯一、是否由 `goldenPath+checkId` 组成均未定义。若不同文件复用局部 check ID，裸 `unitCheckId` 仍可能碰撞。
- 因而对 unit 分区同时交换 matrix 与 receipt 的 successor 时，剩余两端没有独立、规范化的映射足以把它判红；R4 的“同分区换线”漏洞只在 fake-SUT 分区真正闭合。

具体修法：

- 定义规范 unit target key，例如 `(unitGoldenPath,unitCheckId)`，禁止只用未声明全局唯一的 `unitCheckId`。
- 为每个存活 unit check 冻结 `sourceObligationId`，或新增独立 unit-successor manifest。
- 明确 obligations 端如何确定期望边；验收须分别突变每一端，并补“matrix+receipt 协同换线但独立源不变”必红。

## 2. R4 `--sut` 值污点非充分：消解

v5 已从参数污点提升为实际效果路径归因，并明确 `--sut` 本身不是充分条件，[plan.md:29](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:29)。

R4 点名的两条仓内反例也被原样纳入负控：

- `record --from-events + --sut`，[record-capture.golden.mjs:44](/mnt/d/ctx/heren/casey/tests/_golden/record-capture.golden.mjs:44)-[50](/mnt/d/ctx/heren/casey/tests/_golden/record-capture.golden.mjs:50)；
- hermetic、无浏览器但携带 `--sut`，[cli-mcp-face.golden.mjs:213](/mnt/d/ctx/heren/casey/tests/_golden/cli-mcp-face.golden.mjs:213)、[cli-mcp-face.golden.mjs:221](/mnt/d/ctx/heren/casey/tests/_golden/cli-mcp-face.golden.mjs:221)-[223](/mnt/d/ctx/heren/casey/tests/_golden/cli-mcp-face.golden.mjs:223)。

共享启动、不可达 launch、不消费启动结果、间接输出/控制/副作用依赖也分别列入验收，[plan.md:29](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:29)、[plan.md:98](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:98)。

结论：R4 指出的具体误送风险已在 plan 层消解。实现时仍须把 effect source/sink 与跨进程命令模式做成显式语义表，但这可由 acceptance fixture 钉死，不再单列 plan 阻断。

## 3. R4 receipt 无可执行定义：仍残留 High

v5 有实质进步：加入 evidence hash/schema/case/build/conclusion 绑定、固定根/no-follow、负控和触发后阻断，[plan.md:41](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:41)-[45](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:45)。

但还不能据此铸确定性验收：

- Receipt schema 只有 `runEvidenceSha256`，没有 evidence 相对路径、content-addressed key 或确定性文件名规则，[plan.md:41](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:41)。校验器所谓“固定根加载真实 evidence”因此没有可执行的定位算法，[plan.md:42](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:42)。
- `conclusion ∈ 允许集` 没有列出允许集，更没有明确“只有哪一个结论允许 story 翻 true”。若 `FAIL`、`NEEDS_HUMAN` 等合法结论也令 validator exit 0，就会把未通过 UAT 翻成 true，[plan.md:42](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:42)。
- `signer` 仍只是一个字段；“若仅 ADR 人审，则……”是待选条件，不是已经选定的可信机制。没有 signature、keyId、信任锚、规范签名字节或防重放规则，[plan.md:41](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:41)-[42](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:42)。仓内 P4 也确实仍把身份核验挂在人审，[prd-p4-freeze.json:15](/mnt/d/ctx/heren/casey/loop/prd-p4-freeze.json:15)-[16](/mnt/d/ctx/heren/casey/loop/prd-p4-freeze.json:16)。
- `triggerId` 只要求里程碑“真发生”，却没有触发状态权威源、触发证据 schema、授权写入者或 validator 的确定性读取规则，[plan.md:42](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:42)-[43](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:43)。因此仍可永远声称“尚未触发”，触发后阻断规则无法机械启动。
- 真机运行仍明确不在本轮范围，[plan.md:113](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:113)-[114](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:114)，所以这些后续迁移接口必须现在定义完整，不能留给实现临场选择。

具体修法：

- 固定 evidence 根与规范定位方式；receipt 增 `evidenceRelPath`，或规定按 sha256 寻址。
- 冻结 evidence schema registry 和精确 conclusion 枚举，并写死只有成功结论可触发 false→true。
- 选择一种 signer 机制并完整入 schema，例如 `keyId+signature` 对规范化 receipt、evidence digest、trigger digest 联签；冻结公钥/信任根及未知 key、重放、错签负控。
- 为 trigger 定义机读 registry/state artifact、可信写入规则和 digest；补伪触发、回滚触发、错 case trigger、触发后缺 receipt 的红证。

## 4. R4 迁移门未冻结：原问题消解；新引入 High

原始攻击面已经消解：

- validator、golden/敌意 fixture、receipt schema 均明确进入新 PRD 的 `testChecksums`，[plan.md:44](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:44)、[plan.md:101](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:101)。
- “validator 改成无条件 exit 0 必被 checksum 逮”已成为明确 mutation，[plan.md:101](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:101)。
- 仓库现有 ratchet 也确实负责检查 PRD checksum 缺失、漂移和冲突，[prd-ratchet-reverse-index.json:17](/mnt/d/ctx/heren/casey/loop/prd-ratchet-reverse-index.json:17)-[24](/mnt/d/ctx/heren/casey/loop/prd-ratchet-reverse-index.json:24)。

新引入 High：

- 新增的 append-only ledger 只有一句行为描述，没有路径、schema、entry 主键、唯一性、前序 hash/head、prefix 不变规则或 story↔ledger 双射，[plan.md:44](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:44)、[plan.md:101](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:101)。
- Ledger 仅在 ADR 人签冻结面被点名，[plan.md:105](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:105)，却没有进入 line 44/101 的机械 checksum/敌意 fixture 闭环。
- 因而删除或改写旧 entry、替换 ledger 后再让当前 receipt/evidence 与之匹配，并没有被现有验收点明确判红；“持续复验当前文件”不等于证明历史 append-only。

具体修法：

- 冻结 ledger 路径和 schema；entry 至少绑定 `uatCaseId/storyId/triggerDigest/receiptSha256/evidenceSha256/previousEntryHash`。
- 规定每个 true story 恰有一个有效迁移 entry，false→true 单向且不得手改 `passes:true` 绕过 ledger。
- 把 ledger validator、schema、fixture 纳 checksum；补删除、重写、重排、重复 entry、旧 receipt 回滚、直接翻 `passes:true` 等 mutation 红证。

非阻断清理：工序标题仍写 `v4`，[plan.md:80](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:80)。

诚实划界：本轮是静态只读 plan 复审，没有运行 golden/gate，也没有启动或连接 SUT。计划中的 scanner、obligations、manifest、新 PRD、receipt validator 和反向闭包工具当前均尚未生成；结论只判定 v5 是否足以进入 acceptance-gate，不评价尚不存在的实现。