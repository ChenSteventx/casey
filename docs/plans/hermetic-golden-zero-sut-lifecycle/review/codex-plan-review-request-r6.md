# codex 异构评审请求 R6 — hermetic-golden-zero-sut-lifecycle plan v6

你（gpt-5.6-sol high）R5 认 `--sut` 效果路径归因（F2）+ 迁移门原始攻击面消解，余 3 条 High：① unit 分区边缺规范 join、③ receipt 无可执行定义、④ append-only ledger 无机械定义。Claude 修成 v6（`plan.md`，顶部 v6 标注）。

**关键：Steven 就 scope 亲裁（D7，`GRILL.md`）**——③④ 本质要在本契约内造一整套真机 UAT 存证+可信签名+触发 registry+append-only 迁移 ledger，而可信 signer 机制仓内不存在（P4 signerId 仍挂人审）、真机本轮不实跑。**裁决=延给命名后续契约 `real-uat-attestation`**；本契约移交覆盖改用 loop-kit designed 机制 `observability` route:human 承接 + 冻结 manifest（不可变 UAT 定义+血缘、checksum 锁）作精确账，不建 receipt 校验器/签名/ledger。

本轮请核**两件事**：

## A. R5 unit 边（①）→ v6 修是否消解

v6：`source-obligations` 每条加 `successor:{kind,targetKey}` 边字段（补 obligations 端产不出边）；unit target 用**规范复合键** `(unitGoldenPath, unitCheckId)`（禁裸 unitCheckId 防跨文件碰撞）；存活 unit check 冻 `sourceObligationId`；zero-SUT-unit 边 `(obligationId,unitGoldenPath,unitCheckId)` 四处一致；mutation 加「unit 分区 matrix+收据协同换线而独立源 sourceObligationId 不变必红」。核：unit 分区换线漏洞是否真闭合？规范 join 键是否定清？

## B. D7 延迁移机制 → 本契约的**诚实闭合性**（非要求造机制）

请**接受 D7 scope 裁决为前提**（③④ 迁移机制不在本契约、延 `real-uat-attestation`），只核**延迟后本契约的设计是否诚实闭合**：
- 移交覆盖用 `observability` route:human 项承接（`{dimension, route:human, uatCaseId}`）+ 冻结 manifest（checksum 锁、不可变定义+血缘、archiveSha256）作精确账。
- 你早轮（R1/R2）曾嫌「裸 observability route:human 是 vaporware/永久 pending」。核：**冻结 manifest 精确账 + observability route:human + 命名后续契约**这个组合，是否已破 vaporware（有冻结账、非裸串）与假绿（route:human 诚实未验、非 story 伪绿）？manifest case↔observability 项双射闭合是否够？有无「延迁移」引入的新假绿/覆盖丢失？
- 特别核：本契约不建迁移机制，会不会让某些覆盖既非 hermetic 验、又无冻结账承接而**静默丢失**？（即 D7 延迟是否只延「怎么翻 true」、而非延「账清什么」。）

## 只读这些 + 核其引用

- `docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md`（v6）、`GRILL.md`（D7）
- `review/codex-plan-review-reply-r5.md`（R5 三残留，对照）
- 允许只读核验：`tests/_golden/**`、`loop/prd-*.json`。

## 产出

A/B 分别判（消解/仍残留/新引入）+ file:line。总判：**v6 可进 accept，还是仍有阻断项**。若阻断按严重度列 + 具体修法。若可进 accept，明说 + 列剩余属实现层/后续契约的非阻断项。诚实划界你没核到的。
