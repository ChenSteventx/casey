# review + 人签记录 — resign-drift-closure（漂移收口）

## 异构冗余评审（Claude 实现 → codex 评，实现族≠评审族）
- 评审方：`gpt-5.6-terra` @ max（codex-cli 0.144.1）。首轮 `gpt-5.6-sol` @ xhigh 结果在会话崩溃中丢失（scratchpad 清空），重跑用 terra。
- terra 深核 2214 行探索，独立证实：
  1. 两 checksum 自跑 sha256 = MATCH（`prd-mcp-parity` 冻 `cli-mcp-face.golden` = `1926d3cb`；`prd-p2-intent-compile` 冻 `verdict-cases.json` = `a9adb77a`）。
  2. `bin/verdict.mjs` decide() `ap==='ambiguous' → NEEDS_HUMAN/AMBIGUOUS_ACTION`（line 81）正确，改后 `ambiguous_action` 用例不弱化 fail-safe。
  3. 收敛语义对：读 `resolution.golden.mjs` 红线「多匹配恒 NEEDS_HUMAN/AMBIGUOUS_ACTION，绝不翻 PASS/SUT_DEFECT」，本改对齐该收敛。
  4. `run-history` schema 的 `fallback_first`/`coord_fallback` 可表征锁未被触碰（读 `seams-freeze-v2.golden.mjs` 确认）。
  5. 零 findings 冒头。
- 局限：`chatgpt.com` 网络在 terra 接近结尾时提断（model-refresh timeout / transport closed），未输出形式化 CLEAN/findings 结论段。探索证实充分、无问题冒头。

## Claude 侧自核（实现方亲核，触裁判内核冻结面加做）
- 红先行：`p2-verdict.golden` 改前 RED（ambiguous_action 期望 AMBIGUOUS_ACTION 实得 INDETERMINATE）→ 改后 GREEN（8/8 四态全中）。
- `cli-mcp-face.golden` 改前后皆 GREEN（9 过 0 败）——证 `prd-mcp-parity` 漂移是纯 checksum 台账、非语义回归。
- gate `--prd prd-resign-drift-closure` GREEN（ratchet + p2-verdict + cli-mcp-face + p2-compile-gate + tier1 全 ok）。
- 未碰 `bin/verdict.mjs` 裁定逻辑、未改 `cli-mcp-face.golden` 金牌本体。

## 人签
Steven 2026-07-10 人签批准：认可现有证据（Claude 三重验证 + codex-terra 深探零 findings），确认 `verdict-cases.json` 改动对齐 resolution 收敛词表、非弱化裁定，放行提交合 dev。
