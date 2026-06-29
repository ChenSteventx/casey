# P4 断言冻结 + 人签 grill 决策记录（slug: p4-freeze，lane=light）

> light lane stub：P4 的设计争点早在 design §5 / §4.3 与 ADR「断言冻结人签」中拍定，本轮只落「确定性骨架」增量，不重开设计。本文件是 light lane 的 grill 阶段交付物 + 决策快照。

## 框定：本轮只做确定性骨架，语义质量归 route:human

P4 的两块：① 断言草拟（L2，LLM 从 `intent` + 观测现状推导 typed `expected[]`）；② 冻结 + 人签（Test Ratchet 锁死、人签后才算数）。

LLM 草拟的语义质量（断言选得对不对、覆盖够不够）天然是 `route:human` 评审，不可 hermetic 命令化，不在本增量。本轮只做能 golden、零外部依赖、不碰已冻内核的确定性骨架：

1. 把已冻 `expected.frozen` 旁车里逐条 typed 断言，确定性编译成可运行 `check` 命令字符串（保持 `prd.acceptance` 形状、design §5/§8 gate 主循环原样）。
2. 人签门的确定性字段校验：每条冻结断言的 `signedAt`/`signedAgainstBuild`/`signerId` 齐全且非空才「算数」，缺一即未签、裁定流程拒算。真人签本身是 `route:human`，这里只确定性校字段齐全。

## 已锁决策（承接 design，不重议）

- 消费已冻接缝：`tests/_golden/schemas/expected-frozen.schema.json` + `tests/_golden/fixtures/seams/expected-frozen.fixture.json` + `bin/check.mjs` 词表（均已存在、本轮只读不改）。
- 编译产物形状钉死 design §5：`node bin/check.mjs --case <caseId> --intent <intentId> --kind <kind> --op <op> --value <value>`；`globalAssertions` 无 `intent` 维度。
- `soft` 断言也编译，但标记出来（仍进报告不进裁定，由已冻 `verdict.mjs` 处理，不是本模块的事）—— 防假绿（design §4.4 / §5）。
- 人签是 `CASE_DEFECT` 与 `SUT_DEFECT` 的分水岭（design §4.3）；本模块只验「字段齐」这一确定性前置，未签拒算数。
- 纯函数、不碰已冻内核 impl（`verdict.mjs`/`check.mjs`/`compile-gate.mjs`/`forensics.mjs`）与已冻 seams 文件。

## route:human / deferred（不在本 hermetic 增量）

- LLM 草拟 `expected[]` 的语义质量与覆盖度（断言选得对不对）—— 语义抽检，`route:human`。
- 真人签 UX（CLI `--sign` 形态、签署人身份核验）—— `route:human`，design §11 待裁决项 1。
- `checkFingerprint` 守 spec 指纹（pin `recordedAt+length`）—— gate 检查项，后续 story。
- per-kind `op` 约束加固、`equals` 含 `atl_`/ID 字面量冻结期 lint —— design §2.1 留 P4 后续加固。
