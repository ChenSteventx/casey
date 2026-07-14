# codex 实现评审 r2 —— drawer-lock-hardening（异构冗余，r1 findings 修复复核，实现方=Claude，评审方=codex）

- 评审者：gpt-5.6-sol @ medium（codex-cli，`codex exec --skip-git-repo-check -C 本树 -s read-only`，指令+评审料经 stdin 喂入）
- 评审料：`docs/plans/drawer-lock-hardening/review/material-impl-r2.md`（r1 findings 逐条处置表 + 红证摘录 + 门禁证据 + `git diff 0301936..835a8ec -- lib tests loop` 修复全量 diff【驱动员机械导出并逐字节核对 MATCH】；护栏 #9：不含凭据、不含实现者内心推理）
- 评审指令：`docs/plans/drawer-lock-hardening/review/instr-impl-r2.txt`
- 家族：OpenAI GPT ≠ Claude（crossFamily 成立）
- 运行：2026-07-14，exit 0
- 驱动员：Claude（只备料/跑 CLI/归档，不代评审下判断）

## 总裁决

CHANGES-REQUIRED（1 HIGH / 1 MED / 0 LOW）

## 评审输出全文（逐字归档）

## HIGH

1. pin 可复制，HIGH#1 的错抽屉假绿仍未闭合。

代码依据：

- [lib/replay-actions.mjs:157](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:157) 的重判只确认“标题域内唯一节点带有 pin”，不确认“全页只有该节点带 pin”。
- [lib/replay-actions.mjs:176](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:176) 后续根却是全页属性选择器 `.hr-drawer__content-wrapper[data-casey-domain-pin=...]`，口径比标题域宽。
- 编译门存在同样问题：[lib/compile-atoms.mjs:174](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:174)、[lib/compile-atoms.mjs:193](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:193)。
- 所谓落笔时刻重判仍只检查标题域节点自身的属性；之后的动态 `fields`/`triggers` Locator 可解析到复制了 pin 的其他抽屉：[lib/replay-actions.mjs:278](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:278)、[lib/replay-actions.mjs:367](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/replay-actions.mjs:367)、[lib/compile-atoms.mjs:706](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:706)、[lib/compile-atoms.mjs:823](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:823)。

可复现路径：

1. 合法抽屉 A 含目标标题，但无目标字段；无标题抽屉 B 含唯一同占位符字段。
2. 页面用 `MutationObserver` 观察 A 新增 `data-casey-domain-pin`，将同值复制到 B，同时保留 A 的 pin。
3. 钉后及所有落笔前重判均看到：标题域仍恰一，A 仍带正确 pin，因此全部通过。
4. 全页 pin 根同时包含 A、B；字段 Locator 只在 B 命中一次，于是 B 被填入。
5. 动态回读仍从 B 读到精确值，回放返回 `unique`，编译门也可产成功事件，形成假绿。下拉触发器同理。

此外，初次域判定返回的仍是动态 Locator；在域扫描结束到 `elementHandle()` 解析之间若唯一同标题抽屉被替换，新节点会被钉住并通过钉后重判，stamp 时刻漂移也没有真正封死。应保留初次获得的物理节点句柄，并用该句柄执行后续动作；若句柄脱离则失败，不能重新按可复制属性解析身份。

## MED

1. G12a/b/c 没有覆盖其声称的“落笔前重判”，且 3000ms 窗口没有确定性同步。

代码依据：

- `twindelay` 的真实抽屉刻意没有字段或触发器：[server.mjs:361](/mnt/d/ctx/heren/casey-drawer-lock-hardening/tests/fixtures/fake-sut/server.mjs:361)。
- 因而 G12a/b/c 都在字段或触发器 `count=0` 分支返回，永远到不了 `preFill`、`preClick`、`preOpt` 或编译门 emit 内重判。
- 所以只实现“pin 属性根”，完全删除所有动作时刻重判，也能通过这三条金牌。
- 夹具从开抽屉点击起固定等待 3000ms：[server.mjs:341](/mnt/d/ctx/heren/casey-drawer-lock-hardening/tests/fixtures/fake-sut/server.mjs:341)。但编译 emit 在下一原子前还允许 600ms 响应等待、150ms 因果窗及最长 2500ms 静默点：[lib/compile-atoms.mjs:309](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:309)、[lib/compile-atoms.mjs:362](/mnt/d/ctx/heren/casey-drawer-lock-hardening/lib/compile-atoms.mjs:362)。没有握手证明“初判完成后才插入”，慢机上冒牌可能在初次 pin 前出现。
- 此时旧实现仍会红，但原因可能只是初始 `count=2`，不能证明红证确实命中了 TOCTOU 窗口。

建议夹具采用显式阶段握手，并增加“合法抽屉本身有可操作字段/触发器，初判后再复制、移除或迁移 pin”的金牌，直接断言动作时刻重判与零错抽屉落笔。

## LOW

无新增 LOW finding。

HIGH#2 的进函数即失效覆盖了当前所有显式返回路径；仅在点后恰一时写回，现有 `mark()/rollback()` 的唯一调用位于删除原子，且状态机同时移除“节点抽屉已开”，未发现本轮新增可利用缺陷。MED#1 两份实现均改为存在量词语义，未发现新误纳；串行遍历有线性开销，但抽屉规模下不足以构成 finding。G13、G14a/b 红证与断言方向成立。

冻结闭包机械核对为完整：受影响文件只对应三个 PRD，当前 sha256 与登记一致。`ratchet verify` 仅报备料所述两项既有 `cases/` 缺失。未发现凭据值、真目标地址或裁判 LLM 化；`bin/verdict.mjs` 与 `events.schema.json` 均未改动，西里尔字符已清零，统一语言检查通过。目标金牌因只读环境禁止创建 `/tmp` 目录而无法复跑；四个改动 JavaScript 文件语法检查均通过。

**总裁决：CHANGES-REQUIRED**

## 驱动员事实核对（仅核「引用是否存在/机制是否如述」，不构成对 findings 的采信/驳回）

- HIGH 引用的代码位置成立：`verifyPinnedNodeDrawer` 确未查 pin 全页唯一性；root 确为全页属性选择器 `.hr-drawer__content-wrapper[data-casey-domain-pin=...]`；fields/triggers 确经该 root 动态解析（驱动员对照 835a8ec 实码核对属实）。
- MED 引用成立：twindelay 真抽屉确无字段/触发器（ddempty 形态），G12a/b/c 确在 count=0 分支返回、触不到 preFill/preClick/preOpt；3000ms 为时间基延时、无阶段握手（红证实录红形为 unique+冒牌真落笔，证明该次红跑确实命中了 TOCTOU 窗口，但慢机下不保证）。
- 末段「金牌因只读环境禁止创建 /tmp 目录而无法复跑」属评审沙箱环境限制，非实现问题。
