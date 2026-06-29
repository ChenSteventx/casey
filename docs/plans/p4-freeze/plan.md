# 落地计划：P4 断言冻结 + 人签确定性骨架（slug: p4-freeze，lane=light）

> 配套：`grill.md`（本目录）、`docs/design/txt2testreport-design.md` §5（草拟→冻结→裁判）/ §4.3（人签是分水岭、期望版本化重签）/ §8（gate 主循环原样、acceptance 仍命令数组）、`loop/GUARDRAILS.md` #5（物理隔离）/ #14（fail-safe）/ #16（人签门，gate 绿 ≠ 完成）。
> 重业务轻技术：每 story 给 流程 + 逻辑 + 验收点。可命令化验收点 → 进 `loop/prd-p4-freeze.json` story；不可命令化 → Observability `route:human`。

## 范围与非目标

范围（确定性、可 golden、不碰已冻内核）：
- 把已冻 `expected.frozen` 旁车的逐条 typed 断言确定性编译成可运行 `check` 命令字符串（含 `globalAssertions`、`soft` 标记）。
- 人签门的确定性字段校验：`signedAt`/`signedAgainstBuild`/`signerId` 齐全且非空才算数，缺一未签拒算。

非目标（本期明确不做）：
- LLM 草拟 `expected[]` 的语义质量与覆盖度 —— `route:human` 语义抽检。
- 真人签 UX（CLI `--sign`、身份核验）—— `route:human`，design §11 待裁决项 1。
- `checkFingerprint` 守 spec 指纹、per-kind `op` 加固、冻结期 `equals` 字面量 lint —— 后续 story。
- 不改任何已冻内核 impl（`verdict.mjs`/`check.mjs`/`compile-gate.mjs`/`forensics.mjs`）与已冻 seams 文件。

## Story S1：expected.frozen 编译成 check 命令（确定性）

流程：
1. `lib/expected-compile.mjs` 纯函数 `compileExpectedToChecks(expectedFrozen) -> string[]`：把 `intents[].expected[]` 每条编译成 `node bin/check.mjs --case <caseId> --intent <intentId> --kind <kind> --op <op> --value <value>`（保持 `prd.acceptance` 形状、design §5/§8 gate 主循环原样）。
2. `globalAssertions` 同理编译，但无 `intent` 维度（跨 intent 取证类）。
3. `soft` 断言也编译，但在产出上标记（仍进报告不进裁定，由已冻 `verdict.mjs` 处理）。

逻辑/兜底：纯函数、零外部依赖、确定性可 golden；`kind`/`op` 必落 `bin/check.mjs` 词表（越界由 check 自身硬闸，本模块只编译不发明）；无 `op`/`value` 的取证类 kind 按存在性拼命令。

验收点：
- [命令] 对 `expected-frozen.fixture.json` 编译出的 `check` 命令条数与形状正确（逐 `intent` 卷回 `intentId`、`global` 无 `intent`）。
- [命令] 编译出的每条命令 `kind`/`op` 落 `bin/check.mjs` 词表（抽验 `node bin/check.mjs --validate-only` 合法 exit 0）。
- [命令] `soft` 断言被编译且被标记（区别于硬断言）。

## Story S2：人签门确定性字段校验

流程：
1. `lib/sign-gate.mjs` 纯函数 `isSigned(frozenAssertion) -> boolean`：`signedAt`(ISO)/`signedAgainstBuild`/`signerId` 齐全且非空为真。
2. `assertSignedContract(expectedFrozen) -> { ok, problems }`：逐条校验，任一未签则 `ok:false` 且 `problems` 给出落点（人签门责任落点；真人签是 `route:human`，这里只确定性校字段）。

逻辑/兜底：fail-closed —— 未签即拒「算数」，裁定流程不得对未签断言出终判（design §4.3 人签是分水岭、护栏 #16 gate 绿 ≠ 完成）。

验收点：
- [命令] 完整签名的 `expected.frozen` → `isSigned` 全 `true`、`assertSignedContract` `ok:true`。
- [命令] 删一条 `signedAt` → `assertSignedContract` `ok:false` 且 `problems` 非空（未签拒算数）。

## route:human / deferred 汇总

- [🧑] LLM 草拟 `expected[]` 语义质量与覆盖度 —— 语义抽检 `route:human`。
- [🧑] 真人签 UX 与签署人身份核验 —— `route:human`，design §11 项 1。
- [🧑] `checkFingerprint` 守 spec 指纹（pin `recordedAt+length`）—— 后续 story。

## 立即下一步

1. acceptance-gate：按验收点写 golden 红测试、跑验红基线、sha256 冻结，生成 `loop/prd-p4-freeze.json`；
2. loop 实现 `lib/expected-compile.mjs` + `lib/sign-gate.mjs`（红 → 绿）；
3. gate 翻绿、推进 loop、提交本 worktree 分支。
