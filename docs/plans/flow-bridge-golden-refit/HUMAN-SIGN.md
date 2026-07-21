# flow-bridge-golden-refit 冻结面人签清单（ADR-0004）

落地 2026-07-21。三家族已实现到真绿（退出码判定），mutant 突变红证已做（`evidence/mutant-proof.md`）。以下五项 route:human 已由 Steven 于 2026-07-21 签定（见下「签署记录」），据此已全批重签 + 按 `accept/execution-account.json` 固定顺序复 gate + s4 校验器转绿、契约 loop 闭合；后经 codex 异构评审两轮修正，两处评审改动的冻结字节亦由 Steven 补签（见「评审修正补签」）。

各项签字前的事实核实全部完成，逐条列在下面；每条都是「机器已把能证的证到，判断权归人」，人裁结论均落在「签署记录」。本文件全文为已签后状态，无遗留待裁项。

## 签署记录（Steven 2026-07-21，经 AskUserQuestion 三问三答）

三项 route:human 决策由 Steven 当场签定，据此才进重签+复 gate：

1. 冻结面重签（项一）：**批准全部，继续重签+复 gate**。
2. 波0 承接（项二）：**确认承接替代旧令**（新裁的隔离恒红承接替代 `DIRECTION-AFTER-CODEX`「波0 保留即权威」旧令）。
3. B2 语义迁移（项三）：**确认，照此挂账+改写**。

项四（B1 未降级）、项五（mutant 红证）为据实报告，非待裁，Steven 已知悉。

签后机器动作已执行（见文末「签后机器动作」节，均已完成）。

### 评审修正补签（异构评审方 codex gpt-5.6-sol high；签署人 Steven，2026-07-21）

codex 异构评审 round1 判 FAIL 三缺陷、round2 复核后定稿；修正连带改动两处已签冻结面字节，Steven 已于 2026-07-21 经 AskUserQuestion 补签批准（决策：批准补签两处）：

- `cli-mcp-face.golden.mjs`（B1，Finding 3 修）：A6 清理次序加固——`publication.cleanup()` 包 try/catch 捕获异常，保证 `lease.cleanup()` 恒执行、两清理失败都进 `fails` 上报（金牌自红），堵 `rmSync` 抛出时跳过租约清理留孤儿的窗口。字节 `9543a9dea86a…` → `04899debbb8d…`，已重签 `prd-mcp-parity`。
- `tests/_golden/support/refit-regate-verify.mjs`（s4 校验器，Finding 2 修）：撤回 round1 曾加的「同 prd 兄弟 story evidence 新鲜」反证（codex round2 指出可被 `gate --story` 单跑绕过、且冒称已复 gate），改为诚实标注——正面证明的是 39 条复 gate 刷新绿（passes===true + evidence 晚于红基线），恒红 2 条只保证 passes===false（未被违规翻绿）、不冒称已复 gate（其 acceptance 自身失败、gate 不为失败 story 写 evidence，无从正面证明；亦无必要，恒红系 isolation-pending 承接、结构恒红）。字节 `b8cd39a8…` → `9b9b28030f40…`，已重签本契约 prd。
- `HUMAN-SIGN.md`（Finding 1 修）：全文改为已签后状态、消除签前时态自相矛盾、落本补签记录；本文件非 testChecksums 冻结面，无需重签。

两处冻结面字节变更属评审修正、非语义翻案，均经 Steven 上述补签。

## 项一：冻结面重签（ADR-0004 核心）

### 1a 六个既有 checksum owner 重签（金牌字节 old → new）

| prd | 金牌 | old sha（前缀） | new sha（前缀） |
| --- | --- | --- | --- |
| `prd-flow-bridge.json` | `flow-bridge.golden.mjs` | `122977f61e3729b0…` | `1864f99249d688cf…` |
| `prd-integrate-regress-agent-tool-slice.json` | `flow-bridge.golden.mjs`（同一文件、另一 owner） | `122977f61e3729b0…` | `1864f99249d688cf…` |
| `prd-ingest.json` | `ingest.golden.mjs` | `028f1b8eb62aa954…` | `f399c81d4dd77a9e…` |
| `prd-mcp-parity.json` | `cli-mcp-face.golden.mjs` | `d59f7d2de0e29229…` | `9543a9dea86a70ff…` |
| `prd-record-distill.json` | `record-distill.golden.mjs` | `f673665c9db6c558…` | `0f0508d6cdae4014…` |
| `prd-teachin-observation-authority-root.json` | `teachin-observation-authority-root.zero-sut.golden.mjs` | `7fb6f783469c862e…` | `0519cf098294a3b0…` |

全值以 gate 重签时实算为准；此表供人核「改了哪些、方向对不对」。

### 1b 原字节处置

旧字节即 2026-07-17/18 三波信任根收紧（dfee72c / 05573d1 / edea1f9）后未复跑的陈旧冻结值——普查已证这六条运行时非绿（陈旧绿/红）。新字节是修夹具侧、生产零改后的定稿。旧字节不另留兜底，git 历史留底。

### 1c 新增件纳入冻结面

- `tests/_golden/teachin-observation-authority-root.worker.mjs`（new `ab6328dbf619f7f2…`）——B3 bootstrap/worker 两段式的 worker 段，加进 `prd-teachin-observation-authority-root.json` testChecksums。
- `tests/_golden/support/ephemeral-driver-publication.mjs`（new `eada8b25310d2530…`）——三金牌共用的临时 Ed25519 动态签名/发布件，恰被 `cli-mcp-face` / `record-distill` / `authority-root` 三金牌 import，故注册进 `prd-mcp-parity` / `prd-record-distill` / `prd-teachin-observation-authority-root` 三个依赖 prd 的 testChecksums。

### 1d 既有共享夹具不扩签

`canonical-case-lease.mjs`、`observation-runtime-trust-root` 的 loader、`safe-case-lease-v2` 固定 receipt 字节不变、不扩签（归属仍在各自 owner prd）。

### 1e 旧无签名 receipt 夹具保留作负例

`tests/_golden/fixtures/teachin-observation-authority-root/identity-readback-receipt.json`（无签名旧夹具）保留在位，供 B3 worker 的 F1 负例「旧无签名 receipt 喂给 authority root 必拒」使用，不删。

## 项二：波0 承接确认

`prd-drawer-lock-hardening.json` s1 与 `prd-replay-nth-visible-hardening.json` s2 由 `passes:false` → `true`（复 gate 后）。其 acceptance 经生命周期重裁已是纯 zero-SUT 残余，fake-SUT 半由各自隔离 story 恒红承接（`hermetic-golden-isolation-pending` 恒红 78）。此与 `DIRECTION-AFTER-CODEX` 旧令「波0 保留即权威」的关系，Steven 已签定为承接替代旧令（见「签署记录」第 2 条）。

## 项三：B2 语义迁移确认

三列账审计件 `accept/b2-migration-table.md`（14 段）已由本次真跑冻实：

- 保留 11：C1/C3/C5/C6/C2a/C2b/C2c/C4/C2g/C4f/C7（同一拒因或结构不受改形影响）。
- 迁移 3（真跑实测定谳、非静态预测）：C2d 改断 `CAPTURE_URL_LEAK`、C2f/C2h 改断 `CRED_GATE_HIT`（均 exit 65 + 零候选落盘 + 新增直调纯函数红证复核同一执法点）。
- 丢失 4，挂账 `record-three-piece-producer`（机器可做、非 route:human）：record producer 真 CLI 三件套产出 / record→intake 字节接缝 / 旧单文件布局隐性作废 / distill 内联编码门行为级覆盖。含丢失断言清单 + 接手条件。
- `prd-mcp-parity` 与 `prd-record-distill` 的 task/story/observability 语义文本改写（不再声称「真 record→intake」，如实写「手造三件套经 intake」）。

## 项四：B1 未触发降级（据实报告，非待裁）

B1 `cli-mcp-face` A6 MCP intake happy 已真达成（`NODE_OPTIONS` 挂 loader 经 MCP 透传 → exit 0 + 台账恰新增一条 accepted、generation 2），独立正控先行（直调 `bin/intake.mjs` accepted、generation 1）+ 成对证据（无 loader 精确 `DRIVER_NOT_PUBLISHED` + exit 65 + 台账字节零变化）+ 负向姊妹齐过（12 过 / 0 败）。三条件与的降级判据未触发，MCP happy 零覆盖挂账不发生。此项无需裁，据实告知。

## 项五：mutant 突变红证复核（已做，附证）

见 `evidence/mutant-proof.md`：一次性隔离 worktree、冻结金牌投影 sha 一致（`1864f99…` MATCH）、同树 baseline GREEN（17/0）→ mutant RED（16/1，唯一翻红 C17 反向锁）、主树 `lib/flow-bridge.mjs` 字节前后双录一致（`617fd227…`）、现场清理无残留。

## 签后机器动作（均已执行完成，2026-07-21）

1. 已全批重签：六 owner prd 金牌 sha 更新 + 三依赖 prd 加 support/worker checksum（`resign-changed-goldens.mjs` + 新条目 write-time 算 sha），全仓 testChecksums 漂移扫确认冻结面对齐。
2. 已按 `accept/execution-account.json`（22 prd / 41 story）固定顺序全批复 gate：35 绿刷新 / 4 红→绿 / 2 隔离恒红保持诚实 false。B3 的 E1 跨锁在 prd-record-distill 重签后已转绿。
3. `node tests/_golden/support/refit-regate-verify.mjs`（s4 校验器）报 41 过 / 0 败；契约 prd gate GREEN 4/4，loop 阶段已 done。
4. 评审 round1 修正后：`cli-mcp-face.golden.mjs` 与 `refit-regate-verify.mjs` 字节变更已重签、受影响 prd 已复 gate、s4 复核仍绿（见本文件「评审 round1 修正补签」）。
