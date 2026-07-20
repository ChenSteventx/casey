总判：**v6 仍有 1 条 High 阻断，暂不可进入 accept**。A 已消解；B 接受 D7 延期裁决后不存在迁移机制缺失问题，但冻结移交账仍缺一条机械血缘 join。

## A. unit 分区边：消解

v6 已补齐 R5 要求的四个独立端点：

- `source-obligations` 自身持有 `successor`，不再是无法产生期望边的源，[plan.md:45](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:45)。
- matrix 与收据均携带 `obligationId + kind + targetKey`，[plan.md:46](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:46)、[plan.md:47](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:47)。
- 存活 unit check 独立冻结 `sourceObligationId`，[plan.md:48](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:48)。
- unit 目标已定义为 `(unitGoldenPath, unitCheckId)`，明确禁止裸 `unitCheckId`，[plan.md:49](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:49)；四端比较的完整边为 `(obligationId, unitGoldenPath, unitCheckId)`，[plan.md:51](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:51)-[53](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:53)。
- 已明确加入“matrix+收据协同换线、独立 `sourceObligationId` 不变”必红攻击，[plan.md:55](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:55)、[plan.md:95](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:95)。

因此，R5 的同分区换线攻击不能再仅靠同时修改 matrix 和收据逃逸；规范 join 的语义组成也已定清。

非阻断实现要求：acceptance-gate 应把 `targetKey` 的具体 JSON 编码及仓根相对路径规范冻结下来，避免实现采用有歧义的字符串拼接；这是既定二元键的落盘细节，不是新的设计分岔。

## B. D7 延迟后的诚实闭合：仍残留 High

D7 的 scope 裁决本身成立：

- manifest 明确只存不可变定义和来源血缘，并进入 `testChecksums`，[plan.md:35](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:35)-[39](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:39)。
- 墓碑 story 保持 `passes:false`，而不是拿未跑的真机 UAT 伪造绿色，[plan.md:61](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:61)-[64](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:64)。
- receipt、可信签名、触发 registry、append-only ledger 被完整移给命名后续契约，并未留下半套迁移门，[plan.md:105](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:105)-[109](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:109)、[GRILL.md:49](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/GRILL.md:49)-[53](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/GRILL.md:53)。
- 每条 fake-SUT obligation 都要求进入 UAT 边，并各有一条 `observability` 项；manifest case 与 observability 项要求双射，[plan.md:53](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:53)、[plan.md:96](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:96)。

所以没有“整条 obligation 无账承接”的缺行漏洞，D7 只延迟“以后如何翻 true”，没有延迟覆盖盘点。

但仍有一条 High：**manifest 的血缘载荷没有被纳入机械 join。**

manifest 声称保存：

`sourceObligationId / sourceGolden / sourceCheckId / archiveSha256 / invariant` 等字段，[plan.md:37](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:37)。

然而当前全链边只比较 `(obligationId, uatCaseId)`，[plan.md:53](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:53)；验收点也只明确 manifest case↔observability 的双射，[plan.md:96](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:96)。墓碑机制虽然验证归档摘要等于退休收据的 `originalSha256`，[plan.md:63](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:63)、[plan.md:66](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:66)，却没有要求 manifest 的 `archiveSha256` 加入这条等式。

敌意修改可以：

1. 保持所有 `sourceObligationId`、`uatCaseId` 不变；
2. 在两个 manifest case 间交换 `sourceGolden/sourceCheckId/archiveSha256/invariant/nlSteps`；
3. 同步修改 observability 的散文 invariant，但保留 `uatCaseId`。

按目前明确写出的边集和双射，全部仍可通过；checksum 只会把这份错误绑定冻结下来，不能证明它起初绑定正确。这仍可能把某 obligation 指向另一条行为定义，属于“账清什么”的本契约责任，不属于 D7 延迟的迁移机制。

具体修法：

- 增加逐 case 的机械投影等式：
  `manifest.{sourceObligationId,sourceGolden,sourceCheckId,archiveSha256}`
  必须等于
  `obligation.{obligationId,sourceGolden,checkId,originalFileSha256}`。
- 再要求：
  `manifest.archiveSha256 === retirementReceipt.originalSha256 === sha256(gunzip(archive))`。
- observability 要么机械验证 `dimension` 中的 invariant 等于 manifest invariant，要么只把结构化 `uatCaseId` 当权威指针、明确散文不承载第二份事实。
- 补固定 ID 下交换 manifest payload、改单个 lineage 字段、交换 observability invariant 的 mutation 必红。

诚实划界：本轮仅静态只读复审，没有运行 golden/gate，也没有启动或连接 SUT。计划中的 obligations、manifest、新 PRD、扫描器和反向闭包工具当前尚未生成；本结论只评价 v6 是否足以进入 acceptance-gate。迁移 receipt、可信 signer、触发 registry 与 ledger 在 D7 前提下均属 `real-uat-attestation` 后续契约的非阻断项。
