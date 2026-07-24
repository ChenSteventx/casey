# Grok `/code-review` 只读异构复审 — C4

> 日期：2026-07-24  
> 会话：`019f9334-26c5-7b71-9250-39b521c82f67`  
> 终判：`CHANGES_REQUIRED`  
> C4 状态：baton 保持 4/6，`review` / `learn` 不得推进

## 调用与证据边界

在完整工作树 `/tmp/casey-c4-golden-closure` 内，通过项目既定的 Grok TUI
内联调用 `/code-review`：

```text
grok --cwd /tmp/casey-c4-golden-closure \
  --no-alt-screen --disable-web-search --no-subagents --no-memory \
  --permission-mode plan \
  "/code-review
  <要求读取完整仓库权威源、C4 全部材料、生产路径、候选与差异的只读评审提示>"
```

TUI 实际加载了 `/home/test/.grok/skills/code-review/SKILL.md`。评审者读取了仓根
规则、统一语言、交接、护栏、ADR-0002/0004、C4 全部计划/评审/验收/候选材料、
生产回放与 preflight 路径、冻结金牌、母规格及 C1/C3 相关材料；没有编辑仓库，
没有调用 Claude Code、子代理、浏览器、SUT、网络或凭据。

项目 `pre_tool_use` hook 拒绝了 TUI 内的 `node` / `git` shell 调用（exit 2），
因此 Grok 没有在自身会话内亲跑金牌。文件读取和模型评审均正常完成，故不是
`HARNESS_ERROR`；动态运行结果只采用仓内已保存证据，终判明确保留此限制。

## VERDICT

`CHANGES_REQUIRED`

- 核心生产面：原 C4 的 `workflow.rename + action:'click'` 多层 fail-closed 成立；
  不能扩称为所有 action 都 fail-closed。
- 证据保真面：冻结金牌、plan、GRILL 仍含“第一次浏览器副作用前 / page 零触碰”
  的过度声称。两枚候选订正方向正确，但尚未签进冻结面。
- 签署流程面：候选未正式化，冻结面未按 ADR-0004 人签和修订 checksum，且本次
  终判不是 PASS，所以不得完成 `review` / `learn`。

## Critical findings

none

在 C4 实际落地并冻结的 `rename + click` 业务动作分发路径上，未发现未知原子会
执行破坏动作并产 PASS 的生产 fail-open。

## High findings

### H1 · 冻结面仍过度声称 page 零触碰

位置：

- `tests/_golden/entity-rename-negative-guard.zero-sut.golden.mjs:11`
- `tests/_golden/entity-rename-negative-guard.zero-sut.golden.mjs:137`
- `docs/plans/entity-rename-negative-guard/plan.md:17`
- `docs/plans/entity-rename-negative-guard/GRILL.md:9`
- `lib/replay-actions.mjs:37`

`bin/replay.mjs` 的非 nav 事件环在 `dispatchReplayAction` 前可能先做 `pre.path`
恢复导航、`rowCount` 只读采样、对话基线读取，并为 click 装
`page.waitForResponse`。准确保证是：进入分发接缝后，未知字符串原子不委派
`performAction`、不执行破坏动作、不产 `unique`；不是整个事件环 page 零触碰。
`proposed/boundary-correction.md` 已准确订正，但未进入冻结面。

### H2 · `unknown string + action==='nav'` 绕过分发闸已坐实

位置：

- `bin/replay.mjs:574`
- `bin/replay.mjs:602`
- `bin/replay.mjs:618`
- `lib/replay-actions.mjs:30`
- `lib/entity-semantic-lock-preflight.mjs:444`

nav 分支直接 `page.goto` 并可写入 `resolution:'unique'`，不会经过
`dispatchReplayAction`。preflight 对未知字符串默认按 mutation + subject
处理，而不是按可编译原子闭集拒绝：

- 没有有效冻结锁时，会在浏览器前因锁缺失而拒绝；
- 存在匹配 subject 的已签冻结锁时，preflight 可放行，goto 成功后可产
  `unique`，断言满足时可产 PASS。

本轮应把 C4 声明收窄到业务动作分发路径（非 nav），并另立强制面修单，在 nav
分叉前统一拒绝未知字符串。静默把 nav 强制面塞进未签 C4 会扩大范围并增加与
C3 的承重代码合并风险。

### H3 · 冻结面未签，baton 不可推进

位置：

- `loop/active-contract.json`
- `loop/prd-entity-rename-negative-guard.json`
- `docs/plans/entity-rename-negative-guard/proposed/boundary-correction.md`
- `docs/plans/entity-rename-negative-guard/review/codex-verdict.md`

PRD 的 `testChecksums` 仍只有原四项，没有两枚候选和
`checksumAmendments`；已有 Codex 评审没有干净 PASS。本次 Grok 终判又是
`CHANGES_REQUIRED`。因此 baton 保持 4/6。

### H4 · C4 与 C1/C3 的合并风险被原计划低估

母规格把 `lib/replay-actions.mjs` 列为串行承重文件；C4 实际同时修改了
`lib/replay-actions.mjs` 和 `bin/replay.mjs`，C3 也修改事件环与破坏性动作
路径。C4 plan 所称“与 C0-C3 无文件依赖”不准确。后续合并必须对这两个文件
做 git-native 人裁，并按护栏 #19 在组合树复跑全部受影响金牌。

## Medium findings

### M1 · 候选消费真生产路径，但部分证据是源码序特征化

`non-string-preflight` 的 P1 调用真实 `checkReplayEntityAdmission`，准确钉住
`REPLAY_EVENT_SHAPE_INVALID` 与 `allowBrowserLaunch:false`。P2/P3 通过源码
顺序佐证 exit 65 早于 `chromium.launch`，不是进程级端到端证明；可选补用已有
`CASEY_LAUNCH_SENTINEL` 做机械证明。

`event-loop-boundary` 动态调用真实 `dispatchReplayAction`，准确证明分发后
拒绝且不触 page；事件环层使用源码 marker 顺序，不能证明 marker 间绝无其他
写操作。两者都不是当前假绿，但正式冻结时必须如实写明证据强度。

### M2 · 原冻结金牌仍隐式依赖上游 preflight

原金牌仍断言 `unknownAtomRejection` 对缺失或非字符串 atom 返回 `null`。
非字符串安全实际由上游 preflight 提供；候选一虽补证了这层，在正式签入前，
冻结自证仍存在隐式耦合。

### M3 · nav 洞应由单点强制面后继修单关闭

较干净的生产结构是在事件环 action 分叉前按可编译原子闭集统一拒绝未知
字符串，避免 preflight / dispatch / nav 三处职责分裂。该修复应红先行、与
C3 调和并复跑护栏 #19，不应无签扩大当前 C4。

## 两枚候选逐枚裁定

### `non-string-preflight.candidate.zero-sut.golden.mjs`

裁定：`ACCEPT_WITH_CAVEATS`

- 消费真实 `checkReplayEntityAdmission` 生产函数；
- 四种坏形态、具名 reason 和 `allowBrowserLaunch:false` 断言准确；
- P1 无假绿；P2/P3 属源码序特征化；
- 可在人签后晋升 `tests/_golden` 并入 checksum，建议后继补 sentinel
  进程级证据。

### `event-loop-boundary.candidate.zero-sut.golden.mjs`

裁定：`ACCEPT_WITH_CAVEATS`

- 消费真实分发函数并结合真实事件环源码顺序；
- 准确边界是“分发后不委派、不产 unique”，而非“事件环 page 零触碰”；
- 当前断言无假绿；
- 未覆盖 `unknown+nav`，范围必须在冻结声明里明确收窄。

## `unknown+nav` 裁定

旁路坐实。推荐采用两步边界：

1. 本轮人签把 C4 声明收窄为 `workflow.rename + 非 nav 业务动作分发路径`；
2. 另立强制面后继修单，在 nav 分叉前按闭集拒绝未知字符串原子。

只收窄而不立修单，会保留“有签锁的 rename+nav 可 PASS”风险；只修生产却不
收窄并重签冻结面，会违反 ADR-0004 且放大与 C3 的合并风险。

## baton 是否可推进

不可。保持 4/6：

- `grill` / `plan` / `accept` / `loop` 已完成；
- `review` / `learn` 不得标完成。

推进前置为：人签准确边界、两枚候选正式化、冻结面订正、
`checksumAmendments`、zero-SUT 复跑，以及干净异构复审 PASS。

## 正式收口前最小动作

1. 人裁并签署 `unknown+nav` 的“C4 收窄 + 后继强制面修单”边界。
2. 人签 `proposed/boundary-correction.md` 和两枚候选的证据强度。
3. 两枚候选晋升 `tests/_golden`，不弱化断言。
4. 按订正表修改 golden / plan / GRILL 的冻结措辞。
5. 按 ADR-0004 写 `checksumAmendments`，把新金牌纳入 `testChecksums`。
6. 亲跑两枚新金牌、原金牌和 0/26 诚实红，确认原因不漂。
7. 完整工作树上取得干净异构复审 PASS 后，才推进 review / learn。
8. 与 C1/C3 合并时人裁两个 replay 承重文件，并执行护栏 #19。
9. `passes` 只允许 `gate.mjs` 写。

## 最终结论

C4 在 `workflow.rename + click` 分发路径上的负护栏生产语义成立；当前阻塞是
冻结措辞过度声称、候选未签、nav 声明未收窄和无干净 PASS。终判为
`CHANGES_REQUIRED`，不得推进 review / learn。
