# FAIL

1. Finding 1（High）— 未闭合，且补签表述有新问题

三项决定与 R2 请求一致，已记录于 `docs/plans/flow-bridge-golden-refit/HUMAN-SIGN.md:7-17`。

但自相矛盾仍在：

- `HUMAN-SIGN.md:3` 仍写“签后全批重签 + 复 gate”。
- `HUMAN-SIGN.md:61-63` 仍写波0关系“需 Steven 签字确认”。
- 与 `HUMAN-SIGN.md:7-17` 的“已签定”和 `:82-87` 的“均已执行完成”直接冲突。

新问题：`:19-27` 将 round1 修正称为“补签”，标题却署 codex，且 `:27` 把 Steven 对新冻结字节的复核写成“如需”。因此无法无歧义证明两处评审后冻结面变更已经过 ADR-0004 要求的人签。

2. Finding 2（Medium）— 未闭合

两份当前 PRD 确有新鲜绿兄弟：

- `loop/prd-flow-bridge.json:23-34`
- `loop/prd-replay-nth-visible-hardening.json:17-29`

但校验器只要求任一 story 存在新鲜 evidence：`tests/_golden/support/refit-regate-verify.mjs:52-58`。gate 支持 `--story`，并且仅运行、更新被选 story：`../loop-kit/bin/gate.mjs:84-89,106-117`。

可绕过场景：保留恒红 story 的旧 `passes:false`，只对绿兄弟执行 `gate --story <green-story>`。兄弟获得晚于红基线的 evidence，校验器便通过，但恒红 story 的 acceptance 从未复跑。因此它只能证明“同 PRD 某个 story 跑过”，不能证明“整 PRD 已复 gate”。

3. Finding 3（Medium）— 闭合，无新问题

- `publication.cleanup()` 异常被捕获：`tests/_golden/cli-mcp-face.golden.mjs:353-354`
- 随后无条件执行 `lease.cleanup()`：`:355`
- 租约清理拒绝与 publication 清理异常分别写入 `fails`：`:356-357`
- 最终 `fails` 非空导致金牌退出 1：`:380-382`

`lease.cleanup()` 当前把内部异常转换为 `{ok:false}`：`tests/_golden/support/canonical-case-lease.mjs:65-89`。所以 publication 清理抛错不会再跳过租约清理；两处同时失败也都会上报。