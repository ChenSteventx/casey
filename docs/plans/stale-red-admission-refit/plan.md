# stale-red-admission-refit — plan（light）

## 背景

实体语义锁准入面（预执行身份权威 + 冻结实体锁 + 回放准入）落地后，两个冻结金牌变陈旧红，stash 实证红先于 2026-07-22 报告模板改动：

- `tests/_golden/report-diagnostics.golden.mjs`：E1 端到端 `casey run` 用单事件夹具（`nav.editor`，mutation 默认原子）且不带实体锁 → 回放准入 `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`，exit 65。11 过 / 1 红。
- `tests/_golden/p3-compile.golden.mjs`：多个 `compile --execute` / `--verify` 子检查未带预执行身份权威 / 冻结锁 / `--skip-login`，被浏览器前准入拦，产物缺失连锁 10 红（C7/C7b/C8 等）。4 过 / 10 红。

两金牌分属 `loop/prd-report-diagnostics.json`（checksum 冻结）与 `loop/prd-p3-compile.json`。

## 目标与红线

- 目标：夹具侧铸测试受众准入件（或改用只读白名单信封）让金牌诚实复绿；被证义务一条不丢。
- 红线：生产 `lib/ bin/` 行为零改；绝不弱化准入面；冻结金牌修改走修单协议（prd `checksumAmendments` 留痕 + 重钉 sha256 + gate 复跑）；夹具不许倒着裁到预定裁定，只准复现已冻接缝（金牌先例：`entity-ui-wiring.searchopen` 铸权模板、`bindagent-lockchain` 锁链模板）。

## 方案（送异构咨询后定形）

按 Steven 指示，先把两条修形前提送 `codex exec`（`gpt-5.6-sol`，`model_reasoning_effort=max`）咨询再动手：

1. `report-diagnostics` E1 二选一：甲=夹具改只读白名单信封（`nav.workflowManagement` 固定列表路由 + `assert.textVisible`，走 `deterministic-read-only-policy` 零权威路径），乙=保留 mutation 事件、铸 audience=test 冻结实体锁（临时 prd `wx` 独占 + finally 清理）。取舍点：E1 的被证义务是「诊断栏目端到端嵌入」而非实体准入，甲更小；但甲改变事件形状需确认不掉被证义务。
2. `p3-compile`：`--execute` 子检查补 `--skip-login`（测试凭据上下文）+ flow 步补 `sourceIntentId`/`entityBindings` + 铸 audience=test 预执行权威（临时 prd 模式）；`--verify` 子检查同法铸冻结锁。确认各子检查被证义务不因加旗标而漂移。

## 验收点

1. `node tests/_golden/report-diagnostics.golden.mjs` exit 0（12/12）。
2. `node tests/_golden/p3-compile.golden.mjs` exit 0（14/14）。
3. `node loop-kit/bin/gate.mjs --prd loop/prd-report-diagnostics.json` 与 `--prd loop/prd-p3-compile.json` exit 0，且 prd 带本次 `checksumAmendments` 修单记录。
4. 报告族金牌抽跑（p7-report / report-nl-atomic / output-seal）与 `selftest --tier1` 续绿。
5. codex 异构评审修后 diff（家族≠实现家族铁律）。

## 观察义务

- 真机侧准入链（production 受众）已由 2026-07-22 三链真机重表达实证，本契约只管 hermetic 夹具面，不重复申报。
