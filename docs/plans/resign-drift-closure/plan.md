# plan — resign-drift-closure（漂移收口，light）

## 目标
收口八契约遗留的两处「共享冻结文件只在一个 prd 重签、漏签另一个」ratchet 漂移。红先行验非语义回归后重签 checksum，人签。不碰 lib/bin 裁定逻辑。

## 改动清单
1. `tests/_golden/fixtures/p2/verdict-cases.json`：`ambiguous_action` 用例 line42 `resolution:"fallback_first"` → `"ambiguous"`（对齐 resolution 契约收敛后词表）。
2. `loop/prd-p2-intent-compile.json`：`verdict-cases.json` 的 testChecksums 重签 `a3e66a80…` → `a9adb77a…`（改后文件真实 sha256）。
3. `loop/prd-mcp-parity.json`：`cli-mcp-face.golden.mjs` 的 testChecksums 重签 `75f1c4b3…` → `1926d3cb…`（金牌实际 sha256，金牌本体不动）。

## 验收点（红先行）
- `node tests/_golden/p2-verdict.golden.mjs`：改前 RED（ambiguous_action 期望 AMBIGUOUS_ACTION 实得 INDETERMINATE），改后 GREEN（8/8 四态全中）。
- `node tests/_golden/cli-mcp-face.golden.mjs`：改前后皆 GREEN（9 过 0 败，语义未坏，证 mcp-parity 漂移是纯 checksum 台账问题非回归）。
- `node loop-kit/bin/gate.mjs --prd loop/prd-p2-intent-compile.json`：终态 GREEN。
- `node loop-kit/bin/gate.mjs --prd loop/prd-mcp-parity.json`：终态 GREEN。
- `node bin/casey.mjs selftest --tier1`：GREEN（裁判零 LLM 不破）。

## 人签门
`verdict-cases.json` 是裁判内核四态判据的冻结地面真值，改它须 Steven 人核「对齐收敛词表、非弱化裁定」后人签（ADR-0004）。

## 非目标
不改 `bin/verdict.mjs` 裁定逻辑、不改 `cli-mcp-face.golden.mjs` 金牌本体、不动 run-history schema 的 fallback_first 台账可表征枚举。
