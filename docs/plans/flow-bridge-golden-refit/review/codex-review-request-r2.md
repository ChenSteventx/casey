# codex 异构评审请求 round2：flow-bridge-golden-refit 修复复审

round1 你判 FAIL，三缺陷。本轮只复审这三处修复 hunk 是否闭合各自缺陷、有无新引入。read-only，不改文件，不重开 round1 已判成立的风险。

## 修复清单（逐条核 hunk）

### Finding 1（High）——人签留痕
- 修：`docs/plans/flow-bridge-golden-refit/HUMAN-SIGN.md` 新增「签署记录」节，落 Steven 2026-07-21 经 AskUserQuestion 签定的三项决策（冻结面重签=批准全部 / 波0 承接=确认承接替代旧令 / B2 语义迁移=确认照此挂账+改写），并把文末「签后机器动作」改为已执行时态、补「评审 round1 修正补签」节。
- 核：签署记录是否消除了 round1 指的自相矛盾（原文「待签…签后才…」），三项决策是否与本请求一致，审计上能否证明 ADR-0004 三项人裁发生。

### Finding 2（Medium）——s4 恒红 story 复 gate 证明
- 修：`tests/_golden/support/refit-regate-verify.mjs` 的 expectRed 分支——确认 `passes===false` 后，新增「同 prd 任一 story 有晚于红基线的 gate evidence」反证（gate 整 prd 一起跑，兄弟 story 新鲜即证本 prd 已复 gate）；无兄弟新鲜则判红。
- 核：这个反证是否真堵住 round1 指的「跳过恒红 prd 复 gate、拿旧 false 冒充」缺口；两恒红 prd（prd-flow-bridge / prd-replay-nth-visible-hardening）是否都有新鲜绿兄弟；逻辑有无绕过。

### Finding 3（Medium）——A6 清理孤儿窗口
- 修：`tests/_golden/cli-mcp-face.golden.mjs` 的 A6 finally——`publication.cleanup()` 包 try/catch 捕获异常，保证 `lease.cleanup()` 恒执行，两处清理失败都 push 进 fails（不吞），杜绝 `publication.cleanup()` 抛出时跳过租约清理留 `tc_mcp_intake_signed` 孤儿。
- 核：`lease.cleanup()` 是否现在恒执行（含 publication.cleanup 抛出时）；清理失败是否都上报（金牌自红）；有无新引入的吞异常/漏报。

## 现成证据（读，别复跑）

- 修后本地退出码：`cli-mcp-face.golden.mjs` 仍 12 过 / 0 败 exit 0、cases/ 零 mcp 租约残留；`refit-regate-verify.mjs` 仍 41 过 / 0 败（两恒红 story 现走「本 prd 已复 gate：兄弟 story evidence 已刷新」）。
- 两处冻结面字节变更已重签：`cli-mcp-face.golden.mjs`→`prd-mcp-parity`、`refit-regate-verify.mjs`→本契约 prd；受影响运行方 prd 已复 gate。

## 产出格式

给 `PASS`/`FAIL`。逐条修复给判断（闭合/未闭合/有新问题）+ file:line。若某修复未闭合或引入新缺陷，标严重度 + 具体场景。若三处全闭合、无新引入，明说 PASS 依据。
