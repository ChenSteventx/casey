# GRILL — resign-drift-closure（漂移收口）

八契约那趟合并留下两处「共享冻结文件只在一个 prd 重签、漏签另一个」的 ratchet 漂移。B+D 合并的全仓 ratchet 总核逮出。本契约红先行验非语义回归后重签收口，人签。

## D1 两处漂移各是什么根因？
- `p2-verdict`：`tests/_golden/fixtures/p2/verdict-cases.json` 的 `ambiguous_action` 用例 line42 仍喂旧死字面量 `resolution:"fallback_first"`，而 resolution 契约（0f79adf）已把 `verdict.mjs` 识别端收敛成只认 `"ambiguous"` 并同步了 compile/replay/report-model/p3/p5/layer3 金牌，独漏这个 sha256 冻结的 p2 夹具。`deriveActionPerformed` 认不出旧值 → 落 INDETERMINATE 而非 AMBIGUOUS_ACTION。是夹具与实现词表脱节，非裁判逻辑错。
- `prd-mcp-parity`：mcp-parity（1d0d648）冻结 `cli-mcp-face.golden.mjs`（75f1c4b3）后，casey-doctor（693646e）/distribution（44df070）改该漂移锁金牌加 EXCLUDED 项、重签了 `prd-cli-mcp-face` 却漏签 `prd-mcp-parity`（也冻同一金牌）。金牌实际已到 1926d3cb。

## D2 修法为何是「改夹具/重签」而非「改裁判内核」？
verdict.mjs 裁定逻辑正确（`ambiguous → AMBIGUOUS_ACTION` 短路已在）。p2-verdict 只需把夹具输入对齐到收敛后词表；mcp-parity 金牌语义仍通（9 过 0 败），只是 checksum 台账没跟。两者都**不碰 lib/bin 裁定逻辑**、不改断言强度。

## D3 如何证非语义回归（红先行）？
- p2-verdict：改前 `p2-verdict.golden` RED（ambiguous_action 期望 AMBIGUOUS_ACTION 实得 INDETERMINATE）；改后 GREEN（8/8 四态全中）。
- mcp-parity：改前 `cli-mcp-face.golden` 本身 GREEN（9 过 0 败，语义没坏），仅 `gate --prd prd-mcp-parity` 的 ratchet RED；重签后 ratchet 对上。

## D4 为何近冻结面须人签？
p2-verdict 夹具是裁判内核（verdict.mjs 四态判据）的冻结地面真值。改它须人核确认「对齐收敛词表、非弱化裁定」后人签，符 ADR-0004 断言冻结 + 人签门。
