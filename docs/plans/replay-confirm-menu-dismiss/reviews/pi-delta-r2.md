# delta 复审收据 R2 —— pi.dev（异构，评审 630958d → d860c6f 的评审修正）

- 简报：本目录同级的 DELTA-BRIEF（六问，含要求它挑战我自己的三处证明）
- 评审树：~/casey-review-menu-dismiss/casey，已切 d860c6f，金牌 28/28、tier1 全绿
- 日志：~/casey-recovery-20260807/delta-pi-menudismiss.log（进程正常退出）
- 总判：**APPROVE** —— Critical 0 / High 0 / Medium 0

以下为评审方原文，未经改写：

```
All probes complete. Here is my structured delta review.

---

## 逐问核验结果

### Q1 — 收窄后的 R12 是不是空检查？

**否，R12 不是空检查。** 可复现证据：

```
$ node tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs
FAIL R12 … 触发解析态（菜单不得被弹层选择器当成新弹层）：期望 "unique"，实得 "action_failed"
26/28 checks passed
EXIT=1
```

突变：在 `lib/workflow-delete-domain.mjs:11` 的 `DIALOG_SELECTOR` 数组首位插入 `'.hr-dropdown',`，让菜单被弹层选择器捕获。R12 由绿转红，`trigger.resolution` 从 `"unique"` 跌落为 `"action_failed"`。还原后 sha256 逐字节一致（`8d25168a…`）。

R12 钉住的命题是「菜单还开着时，弹层选择器不得把菜单当成确认弹层」，该命题在 `DIALOG_SELECTOR` 被污染时实红。R12 只留下 `trigger.resolution` 与 `found?.resolution` 两条，这两条都受 `DIALOG_SELECTOR` 串味影响（串味会让 `trigger` 非唯一），不存在「性质被破坏却仍绿」的旁路。

### Q2 — 删除的断言有无覆盖洞？

**无覆盖洞。** 删除的两条断言：
1. `eq(confirmed?.resolution, 'unique', …)` — 菜单开着、无遮挡场景下的确认落笔断言，在真机上该前提不成立（hit-target 拦截），属假绿。成功路径的确认落笔由 **R26**（`confirmed?.resolution, 'unique'`）和 **R28**（同上）各自断言；失败路径由 **R27**（`confirmed?.resolution, 'action_failed'`）断言。两条新断言均开 `menuBlocksOutsideClick`，在真机等价的遮挡模型上做断言，覆盖面优于旧断言。

2. `eq(page.requests.length, 1, …)` — R26 断言 1、R27 断言 0、R28 断言 1、R13 断言 1。三条主路径都已独立断言出站请求条数。

不存在「只在 R12 里被钉过、现在没人钉」的命题。

### Q3 — 功能红签名是否成立？

**成立。** 可复现：

```
$ # mutation: return { ...picked, menuDismiss: { dismissed: true, waitedMs: 0 } };
FAIL R26 … 确认落笔解析态（修前必红：没等菜单就点，被遮挡）：期望 "unique"，实得 "action_failed"
FAIL R27 … 超时须留痕为未离场：期望 false，实得 true
26/28 checks passed
EXIT=1
```

R26 红的是 `confirmed.resolution` 为 `"action_failed"`（功能事实——确认真的被拦了），不是字段形状（`menuDismiss.dismissed` 和 `waitedMs` 都齐全）。这与 `red-baseline.txt` 记载一致。还原后 sha256 逐字节一致。

### Q4 — 50/49/1 可复现？

**可复现。** 按 `affected-goldens.txt` 的选集规则运行：
```bash
{ ls tests/_golden/*.mjs | grep -E 'replay|delete'; grep -ln 'workflow-delete-domain' tests/_golden/*.mjs; } | sort -u | grep -E 'zero-sut|\.static\.'
```
输出 **50 份**，与清单逐项比对一致。

- `real-run-trust`：exit 1，错误 `run 令牌须透传 replay`（`tests/_golden/real-run-trust.zero-sut.golden.mjs:21`）
- 抽样 3 份（`agent-delete-confirm-import`、`delete-spec-magnifier`、`workflow-delete-causal-binding`）：全 exit 0

**Stale red 推理成立：** `git diff 630958d d860c6f -- lib/workflow-delete-domain.mjs` 零输出——生产件未动。`bin/replay.mjs` 与该金牌同在 630958d 就已红（`o.uniqueName = argv[++i]` 旧式解析在该提交被改为 `args.uniqueName`），delta 未碰两者任一。无间接影响路径。

### Q5 — 换签记录忠实吗？

**忠实。** 逐项对照：

| `checksumAmendments[0].reason` 叙述 | diff 实际 | 匹配 |
|---|---|---|
| ① 金牌：R12 收窄、删 confirmed+requests，补 occlusion 注释 | `wf-delete-card-layout.zero-sut.golden.mjs` diff | ✓ |
| ② plan.md：补 affected-goldens 引用 + 数字更正 | `plan.md` diff | ✓ |
| ③ red-baseline.txt：正突变二计数 + 补功能红签名 | `red-baseline.txt` diff | ✓ |

无「叙述写了 diff 没做」或「diff 做了叙述没提」的条目。新增文件（`affected-goldens.txt`、`tier1-clone-degrade-artifact.md`、`fixes-r1.md`、`grok-r1.md`、`pi-r1.md`）不在冻结件列表内，不需 amend reason 覆盖。

**`signedBy` 诚实度足够**：明写「**本字段由 Claude 代填**」及凭据来源（AskUserQuestion 选定），明确标注 Steven 本人未书写且后续可以更正。不夸大授权范围。

### Q6 — 有无新矛盾？

**无矛盾。** 逐文档扫：

| 文档 | 内容 | 与…是否一致 |
|---|---|---|
| **plan.md** | "32/7 那两个数都是错的" | 与 630958d 提交信息冲突，但 plan.md **主动指出错误**，属纠正而非矛盾 |
| **fixes-r1.md** | 同上数错 + 突变二笔误 | 与 plan.md、red-baseline.txt 一致 |
| **red-baseline.txt** | 突变二 3 红（非 2 红） | 实测 3 红，与 grok-r1.md 记录一致 |
| **GRILL.md** | 不含 32/7 数字 | 无冲突点 |
| **grok-r1.md** | Q6 写 NEEDS_HUMAN（未复跑） | 如实反映评审时状态，delta 已补跑修正 |
| **pi-r1.md** | M1/M2 + APPROVE | 与 delta 处置一致（M1 不改、M2 加注释） |

**630958d 提交信息留旧数字的处理方式可接受。** plan.md 显式指正了该错误并给出 50/49/1 事实；`affected-goldens.txt` 提供了可重跑清单；`fixes-r1.md` 解释了成因（9p 断连 → 假红）。历史提交不改是标准惯例，处置得当。

---

## Findings

| 级别 | 条数 | 说明 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |

DELTA-DONE APPROVE
```
