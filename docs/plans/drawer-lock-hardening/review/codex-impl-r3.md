# codex 实现评审 r3 —— drawer-lock-hardening（异构冗余，r2 findings 加固复核，实现方=Claude，评审方=codex）

- 评审者：gpt-5.6-sol @ medium（codex-cli，`codex exec --skip-git-repo-check -C 本树 -s read-only`，指令+评审料经 stdin 喂入）
- 评审料：`docs/plans/drawer-lock-hardening/review/material-impl-r3.md`（r2 findings 原文逐字 + 门禁复验结论 + `git show 1f29740` 加固全量 diff【驱动员机械导出，sha256 `c500d6ad…bb45` 与嵌入块逐字节核对 MATCH】；护栏 #9：不含凭据、不含实现者内心推理）
- 评审指令：`docs/plans/drawer-lock-hardening/review/instr-impl-r3.txt`
- 家族：OpenAI GPT ≠ Claude（crossFamily 成立）
- 运行：2026-07-14，exit 0（tokens used 139,748）
- 驱动员：Claude（只备料/跑 CLI/归档，不代评审下判断）

## 总裁决

NEEDS CHANGES（2 HIGH / 0 MED / 0 LOW；r2 MED 与 r2 HIGH 的 pin 复制子项判已闭合，r2 HIGH 的 stamp 时刻漂移子项判未闭合 + 新报 pin 搬移绕过一条）

## 评审输出全文（逐字归档）

# 第三轮结论：NEEDS CHANGES

第二轮 MED 的确定性握手与动作窗口覆盖已基本补齐，pin 复制路径也被挡住；但第二轮 HIGH 仍有一条明确未闭合，且新 pin 校验还存在一条可复现假绿路径。

## HIGH

1. 初次域扫描仍返回动态 Locator，stamp 时刻漂移原样保留

代码依据：

- [lib/replay-actions.mjs:129](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:129) 的 `nodeDrawerDomain()` 在扫描时只把 `structural.nth(k)` Locator 放进数组，并于第 146 行返回，没有保存当时检查过的物理节点句柄。
- [lib/replay-actions.mjs:202](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:202) 扫描结束后才进入 `pinNodeDrawer()`；第 207 行重新解析 `domain[0].elementHandle()`。
- 编译门完全同型：[lib/compile-atoms.mjs:148](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:148)、[lib/compile-atoms.mjs:218](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:218)、[lib/compile-atoms.mjs:224](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:224)。
- 后续物理同一校验只能证明“钉后一直是后来解析到的节点”，无法证明它就是初次域扫描检查过的节点。

可复现路径：

1. 初次扫描期间唯一合法抽屉为 A。
2. 在 `nodeDrawerDomain()` 返回后、`domain[0].elementHandle()` 执行前，用浏览器任务将 A 替换为同位置、同标题的冒牌 B。
3. 动态 `nth(0)` 在第 207/224 行重新解析为 B，于是 `rootHandle` 从一开始就是 B。
4. 钉后重判看到当前唯一节点 B 与 `rootHandle` 物理相同，且 pin 全页恰一，返回 `ok`。
5. 后续字段或触发器句柄均从 B 获取，包含关系、动作后重判和精确回读全部成立，最终仍可返回 `unique`。

这正是 r2 HIGH 明确要求“初次扫描时即保留物理句柄”的子项；本轮没有修改 `nodeDrawerDomain()` 的返回形态，因此未堵死。

2. pin 被“搬移”而非复制时，全页唯一校验仍可被绕过并改变候选域

代码依据：

- [lib/replay-actions.mjs:186](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:186) 的重判只检查：
  - 当前标题域唯一节点与 `rootHandle` 物理相同；
  - 全页该 pin 的数量恰一。
- 它没有检查这唯一 pin 仍实际挂在 `rootHandle` 上。编译门同样如此：[lib/compile-atoms.mjs:203](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:203)。
- 后续候选根仍由 pin 属性重新解析：[lib/replay-actions.mjs:218](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:218)、[lib/compile-atoms.mjs:235](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:235)。

可复现路径：

1. 合法抽屉 A 含标题和两个同占位符字段；未给 `nth` 时正确结果应为 `ambiguous`。
2. A 内嵌一个无标题、同为 `.hr-drawer__content-wrapper` 的子容器 B；B 只包含其中一个字段。
3. `MutationObserver` 观察 A 被写入 pin 后，删除 A 的 pin，并把同值搬到 B。全页始终只有一个该 pin。
4. 标题域仍只认 A，且 A 与 `rootHandle` 物理相同；`pinCount===1`，因此重判错误返回 `ok`。
5. pin 根却解析成 B，字段计数从 A 域应有的 2 被缩窄成 1；该字段仍物理包含于 A，所以 `handleInsideRoot()` 也通过。
6. 实现填写该字段并精确回读，返回 `unique`，把本应 `ambiguous` 的操作洗成假绿。

G15 只覆盖“复制后 pin 数量变为 2”，没有覆盖“从原根移走但全页仍恰一”，因此现有 33 条检查无法发现此路径。

## 其余复核

- r2 MED：`pinclone` 以 stamp 为握手信号，消除了 `twindelay` 的纯时间基依赖；G16/G17 也确实进入可操作字段/触发器的动作窗口。该 finding 的主要覆盖诉求已修复。
- 新增句柄均有 `finally` 释放；编译门检查 `run.emit()` 的 `resolution`，未发现由此产生的假绿或明显句柄泄漏。
- 三份冻结文件的实际 SHA-256 与 PRD 登记一致。
- 四个改动 JavaScript 文件语法检查通过。
- 当前只读沙箱禁止在 `/tmp` 创建目录，目标金牌复跑以 `EROFS` 中止；未将其冒充为通过。
- `bin/verdict.mjs` 与 `events.schema.json` 未改动。

**总裁决：NEEDS CHANGES**

## 驱动员事实核对（仅核「引用是否存在/机制是否如述」，不构成对 findings 的采信/驳回）

- HIGH#1 引用成立：`nodeDrawerDomain`（`lib/replay-actions.mjs:129-146` / `lib/compile-atoms.mjs:148-165`）确实只收集动态 `structural.nth(k)` Locator 进数组返回、扫描期不存物理句柄；`pinNodeDrawer` 确在扫描结束后才 `domain[0].elementHandle()`（`lib/replay-actions.mjs:207` / `lib/compile-atoms.mjs:224`）；此后全部重判以该句柄为身份地面真值——构造上分不清「扫描时检查过的节点」与「elementHandle 时刻解析到的节点」。`1f29740` diff 实核：未改 `nodeDrawerDomain` 返回形态。
- HIGH#2 引用成立：`verifyPinnedNodeDrawer`（`lib/replay-actions.mjs:186` / `lib/compile-atoms.mjs:203`）确实只验「域内唯一者与 `rootHandle` 物理同一」+「pin 全页恰一」两条，不验该 pin 恰挂在 `rootHandle` 上；后续 root 确按 pin 属性全页重解析（`lib/replay-actions.mjs:218` / `lib/compile-atoms.mjs:235`），字段/触发器计数确以 `bound.root` 为根（如 `lib/replay-actions.mjs:324`）；`handleInsideRoot` 验的是 `rootHandle` 物理包含——嵌套在被钉抽屉内部的子 wrapper 里的字段同样算包含。驱动员按 codex 可复现路径在现行代码上逐步走查，每步判定结果与其描述一致。
- 金牌覆盖注记成立：pinclone 夹具为「复制保留原 pin」（`tests/fixtures/fake-sut/server.mjs:502`，复制后全页 pin 计 2），G15a/b 断言走 `pinCount !== 1` 分支；无「pin 从原根移走、全页仍恰一」的金牌场景。
- 与 pi 路分歧点的机械注记：pi 残缝检查第 2 条（「复制后移除原 pin → `sameDomNode` 失败拦截」）成立的前提是 pin 落点节点进入标题域；codex HIGH#2 场景中 pin 落到无标题嵌套 wrapper、标题域仍解析回 `rootHandle` 本身，`sameDomNode` 通过——两路审的是不同的 pin 搬移落点，并非同一路径上的结论冲突。并集差集由实现侧对账，驱动员不代评审采信或驳回。
- 末段「只读沙箱禁止在 /tmp 创建目录、金牌复跑 EROFS 中止」属评审沙箱环境限制，非实现问题；驱动员已于本树独立实跑 tier1 GREEN（见评审料第一节）。
