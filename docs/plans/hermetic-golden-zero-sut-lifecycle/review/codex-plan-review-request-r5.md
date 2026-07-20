# codex 异构评审请求 R5 — hermetic-golden-zero-sut-lifecycle plan v5

你（gpt-5.6-sol high）R4 认 R3 表面矛盾消解、余 4 条 High（`review/codex-plan-review-reply-r4.md`）：① 边血缘可互换（裸集闭合漏「同分区换线」）② `--sut` 值污点非「实际依赖活 SUT」充分条件 ③ receipt「有效」无可执行定义 ④ 迁移门自身未冻结。Claude 修成 v5（`plan.md`，顶部 v5 标注）。本轮：**逐条核 R4 的 4 条是否消解，有无新引入，v5 是否可进 accept**。对抗式、不确定判需补证。

## 只读这些 + 核其引用

- `docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md`（v5）
- `review/codex-plan-review-reply-r4.md`（R4 四残留，对照）
- 允许只读核验：`tests/_golden/**`、`loop/prd-*.json`、`bin/verdict.mjs`、`lib/entity-semantic-lock-preflight.mjs`。

## 逐条复核（R4 残留 → v5 修法）

1. **R4 边血缘可互换（High）**：v5 改闭合**带血缘的边元组**——收据 successor 增 `obligationId`，zero-SUT-unit 边 `(obligationId,unitCheckId)`、fake-sut-behavior 边 `(obligationId,uatCaseId)` 全链一致，mutation 加「同分区两 obligation 交换 successor / 两 obligation 指同一 targetId / 收据 targetId 重复」。核：边元组闭合是否真堵「换线总集仍等」漏洞？规范 join 键是否定清？
2. **R4 `--sut` 值污点非充分（High）**：v5 改**效果路径归因**（选中 CLI 分支是否真连接/启动/消费 SUT），加负控 `record --from-events+--sut` 必不依赖、前置闸后不可达 launch、共享启动后不消费其结果的纯 check、subprocess argv 含 --sut 但命令模式不连接（点名仓内反例 record-capture / cli-mcp-face）。核：效果路径归因是否够、不再误送存活 zero-SUT check 进墓碑链？
3. **R4 receipt 无可执行定义（High）**：v5 给 receipt 加 `triggerId/runEvidenceSha256/evidenceKind/evidenceSchemaId/runCaseId/build/conclusion`，校验器固定根加载真 evidence 核 sha/schema/绑定、conclusion 允许集、signer 诚实定义可信凭据（不无定义继承、点名 P4 signerId 仍挂人审）、triggerId 里程碑须真发生 + 触发后缺 receipt 必红。核：可执行「有效」定义是否够、是否真防「一人填全字段指占位物」与「永久 pending」？signer 诚实定义是否成立？
4. **R4 迁移门未冻结（High）**：v5 把 `uat-receipt-validator.mjs`+golden/敌意 fixture+receipt schema 纳 `prd-hermetic-retired-uat` checksum，翻 true 冻 receipt/evidence sha 进 append-only ledger，gate 持续复验所有已 true UAT story。核：这是否堵「改校验器无条件 exit 0 伪翻 true」？持续复验闭环是否完整？

## 产出

逐条判（消解/仍残留/新引入）+ file:line。总判：**v5 可进 accept，还是仍有阻断项**。若阻断，按严重度列 + 具体修法。若已可进 accept，明说「可进 accept」+ 剩余属实现层非 plan 阻断的清理项（如有）。诚实划界你没核到的。
