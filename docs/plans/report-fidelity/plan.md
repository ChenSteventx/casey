# report-fidelity — 报告保真度三修（light）

## 背景

相6 首份真机报告（`run_1783000971249`）体检出三处保真度缺陷：①「期望版本：（未签）」——`report-model` 未接 `--expected`，其文档自注「完整 expected join 押后真机 bring-up（P3）」的押后条件已成；② 硬断言期望值 `/heren/aimanagement/process/list`（34 字符纯路径）整段 `[redacted]`——撞 `OPAQUE_BLOB` 32+ 长串启发式（layer3 防凭据硬化的误伤面）；③ 断言 `actual` 全 `null`——`evaluateAssertions` 不回填实测值，报告「期望对实际」栏目名存实亡。决策口径见 `proposed/GRILL.md` G1–G3。

## 改动（四处）

1. `bin/report-model.mjs`：加可选 `--expected`——全签且均一才投影 `signedAgainstBuild`/`signerId` 入 meta（`isSigned` 逐条核，任一未签/不均一即不投影、报告如实「未签」）；`--case-meta` 显式字段优先。
2. `bin/casey.mjs`：`runPipeline` 装配 stage 恒透传 `--expected`（run 必带该参，一行）。
3. `lib/report-model.mjs`：`redactScalar` 纯路径形态 token（`^/[A-Za-z0-9_\-./]*$`）转 `redactUrlPath` 逐段脱敏；其余形态原判不动（凭据方向零放松）。
4. `lib/replay-assert.mjs`：`evaluateAssertions` 加性回填标量 `actual`（口径见 G3；未实现 kind 恒 null）。

## 非目标

不动 `verdict.mjs`/冻结 schema（`report-model.schema` 的 postAssertion 已含 `actual`）；不追报告 HTML 版式；`intentTextByIntent`（意图留痕入报告）待 `casey draft` 命令化一并议——expected.frozen 无意图文本、其源在 TestCase，本轮不跨。

## 验收（红先行，新 golden `tests/_golden/report-fidelity.golden.mjs`）

- F1 路径保真三向：装配后纯路径期望值保可读（现红）；`token=SECRET` 形态仍 `[redacted]`；路径内 40 字符长串段仍 `[redacted]`（守卫不塌）。
- F2 actual 回填：`urlPathname` 的 `actual` = 实测 pathname（现红）；未实现 kind `actual` 恒 null；装配后 postAssertions.actual 经脱敏在场。
- F3 `--expected` 投影三向：全签均一 → meta 投影（现红）；未签 → 不投影；混签（两值）→ 不投影。
- 回归锁：`layer3-wiring-coverage.golden`（脱敏金丝雀全保）+ `p7-report.golden` + `p5-replay.golden` + `p5-replay-coverage.golden`（`evaluateAssertions` 形状加性）+ `selftest --tier1`。
- 收口后重跑真机 `casey run` 亲验报告三缺陷消失（route:human 过目）。
