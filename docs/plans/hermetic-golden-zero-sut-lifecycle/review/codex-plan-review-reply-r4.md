总判：**仍有阻断项，v4 暂不可进入 accept**。

v4 消除了 R3 指出的两处表面矛盾，但留下 4 个 High 级闭环缺口：映射血缘可互换、detector 会误判无 SUT 路径、receipt 仍不能机械证明真实执行、迁移校验器本身未纳入冻结棘轮。

## 1. R3-F1/F3：部分消解，仍残留

### 已消解

- `matrix.keys === obligations.keys` 已明确覆盖两类 obligation，[plan.md:46](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:46)。
- successor 已分成 `unit-golden|uat-case`，[plan.md:46](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:46)。
- unit/UAT 分区不再混成一条互相矛盾的公式，[plan.md:48](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:48)、[plan.md:49](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:49)、[plan.md:50](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:50)。
- check 前共享、check 内启动、启动前纯 check、跨多 check 控制已进入验收，[plan.md:29](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:29)、[plan.md:91](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:91)。

因此，R3 所指出的“全部 matrix 同时等于 fake-SUT 子集”和“全部 receipt successor 等于 manifest”的原始自相矛盾已经消解。

### 仍残留 High：闭合的是目标集合，不是带血缘的边集合

当前公式只列各端对象集合，未定义跨命名空间比较时使用的规范键；obligationId、uatCaseId、storyId、存活 checkId 本来不是同一值域，[plan.md:46](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:46)-[50](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:50)。

更关键的是，吊销收据 successor 只有 `{kind,ref}`，没有 `obligationId`；收据按 executable 汇总，[plan.md:60](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:60)。两个同分区 obligation 的 successor 被互换时：

- obligation、matrix、receipt、manifest、story 的总体集合仍完全相等；
- category 也没有跨分区错配；
- 但每条原覆盖义务被错误后继接管。

现有 mutation 只点名断链、跨分区错配，[plan.md:52](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:52)、[plan.md:92](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:92)，不能保证这种“同分区换线”变红。

修法：把闭合对象明确为边元组而非裸目标集：

- unit：`(obligationId, unitCheckId)`；
- UAT：`(obligationId, uatCaseId)`；
- receipt successor 增加 `obligationId`；
- manifest 校验 `(sourceObligationId, uatCaseId)`；
- story 显式携 `uatCaseId`，校验 case→story 唯一性；
- 增加同分区交换 successor、两个 obligation 指同一目标、receipt 目标重复等 mutation 红证。

### 仍残留 High：`--sut` 数据流不是“实际依赖活 SUT”的充分条件

detector 把 `--sut` 数据流列为命中依据，[plan.md:25](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:25)，check 分类又依赖“SUT handle/url 流向断言”，[plan.md:29](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:29)。仓内已有具体反例：

- `record-capture` 给了 `--sut`，但走 `--from-events`，成功后只检查离线 capture，[record-capture.golden.mjs:44](/mnt/d/ctx/heren/casey/tests/_golden/record-capture.golden.mjs:44)-[50](/mnt/d/ctx/heren/casey/tests/_golden/record-capture.golden.mjs:50)。
- 另一现役 golden 明确说明同一路径“hermetic、无浏览器”，仍传 `--sut`，[cli-mcp-face.golden.mjs:213](/mnt/d/ctx/heren/casey/tests/_golden/cli-mcp-face.golden.mjs:213)、[cli-mcp-face.golden.mjs:221](/mnt/d/ctx/heren/casey/tests/_golden/cli-mcp-face.golden.mjs:221)-[223](/mnt/d/ctx/heren/casey/tests/_golden/cli-mcp-face.golden.mjs:223)。

现有负控只明确安全前置闸/sentinel，未覆盖“合法携带 `--sut`，但所选 CLI 分支确定不连接、不启动浏览器”的路径，[plan.md:27](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:27)、[plan.md:91](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:91)。误判会把存活 zero-SUT 检查送入墓碑链，属于覆盖损失风险。

修法：归因须跟踪实际效果路径，而不只是值污点；至少加入：

- `record --from-events + --sut` 必不依赖 SUT；
- 前置闸后不可达 launch；
- 共享启动后但完全不消费其结果的纯 check；
- subprocess 参数含 `--sut`、但命令模式确定不连接的负控；
- 间接输出、控制依赖和副作用依赖的正控。

## 2. R3-F5：双状态已消解，其余仍阻断

### 已消解

manifest 已明确只存定义与血缘并删除 `passes/route`，[plan.md:35](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:35)-[37](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:37)；successor story 的 `passes` 被指定为唯一当前状态源，[plan.md:39](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:39)-[42](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:42)。

R3 所述 manifest/story 双状态问题已消解。

### 仍残留 High：validator 的“有效 receipt”没有可执行定义

receipt schema 只有 `runEvidenceRef`、`signer`、时间、build 和 conclusion，[plan.md:41](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:41)。计划没有规定 validator 必须机械验证：

- evidence 是否存在及位于固定根下；
- evidence 的 sha256、schema、case/build/conclusion 绑定；
- evidence 是否确实来自一次完成的真机 run；
- `signer` 的可信身份或签名；
- 允许的 conclusion；
- 所谓“明确命名触发条件”究竟叫什么、存在哪里、如何证明已发生。

仓内现有 P4 仍把“签署人身份核验”明确挂为后续人审事项，[prd-p4-freeze.json:15](/mnt/d/ctx/heren/casey/loop/prd-p4-freeze.json:15)-[16](/mnt/d/ctx/heren/casey/loop/prd-p4-freeze.json:16)，因此 v4 不能无定义地继承一个现成可信签名机制。

目前一个人可以填写所有字段并令 `runEvidenceRef` 指向占位物；反过来，若永远没人跑真机，计划也只规定“恒非零”，[plan.md:42](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:42)，而真机执行本身被排除在范围外，[plan.md:104](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:104)-[105](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:105)。所以它提供了“有证据时可迁移”的通道，但尚未防止永久 pending。

修法：

- receipt 增加 `triggerId`、`runEvidenceSha256`、evidence kind/schema、实际 run case/build/conclusion 绑定；
- validator 固定根解析、拒绝穿越/软链，加载并校验真实 evidence，而非只验引用字符串；
- 明确可信 signer 机制；若只能 ADR 人审，应诚实定义人审凭据及其可机械验证载体；
- 在 PRD 中命名实际触发里程碑、owner 和触发后的阻断规则；触发后缺 receipt 必须使对应 release/gate 红，而不是无限保留普通 `passes:false`；
- 增加空引用、不存在 evidence、错 hash、错 case/build、未知 signer、错误 conclusion、触发前复用 receipt 等负控。

### 新引入 High：迁移门自身未冻结

计划只明确把 manifest 放入 `testChecksums`，[plan.md:37](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:37)、[plan.md:93](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:93)；ADR 冻结面也列了 receipt，却没有列 `uat-receipt-validator.mjs`，[plan.md:96](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:96)。

如果迁移校验器未 checksum/ratchet 冻结，把它改成无条件 exit 0 就能翻 story true。receipt 虽称“不可变”，也未定义成功迁移后如何冻结其字节以及 evidence digest。

修法：将 validator、本身的 golden/敌意 fixture、receipt schema 一并纳入 PRD checksum；story 翻 true 时冻结 receipt sha 和 run evidence sha，或写入追加不可变 ledger；后续 gate 必须复验所有已 true UAT story 的 receipt/evidence，不能只验证首次迁移。

## 新引入的非阻断清理项

- 工序标题仍写 `v3`，[plan.md:73](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:73)。
- 工序仍称“四集合双向闭合”，而 v4 已改成多分区、多关系链，[plan.md:82](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:82)。

诚实划界：本轮仅做静态只读设计复审，没有运行 golden/gate，也没有启动、连接或回放 SUT。拟议 scanner、obligations、manifest、validator、反向闭包工具和新 PRD 当前均尚未生成；结论只评价 v4 设计能否交 acceptance-gate，不代表未来实现质量。