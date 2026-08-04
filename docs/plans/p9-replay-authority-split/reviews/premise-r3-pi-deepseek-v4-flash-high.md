All verification complete. Final review:

# R3 前提复核 · p9-replay-authority-split（R2 新开口闭合审）

## 0. 可复现实证（只信退出码）

| 项 | 结果 |
|---|---|
| cli-session 自跑 | `node tests/_golden/p9-replay-authority-split.cli-session.zero-sut.golden.mjs` → **0/12，exit 1**，红因与红证逐字一致 |
| pure-suite 自跑 | `node …pure-suite…` → **0/8，exit 1**，红因逐字一致 |
| sha256 对账 | 三件实测 `1386e874…` / `56b458c4…` / `8241717a…`，与两份红证头部**全对**（含夹具一致） |
| 零浏览器 | 哨兵在 `bin/replay.mjs:450`（`chromium.launch` 前）写文件并 exit 66 短路；R1/R2 的「哨兵已落盘」是**洞还在**的实证，非真启 chromium |
| 生产件零动 | `git diff --stat -- lib bin loop` 为空；`git status --porcelain -- lib bin loop` 为空（这些目录有已跟踪文件，非空目录假阴性） |
| 引证逐条核实 | collect.mjs:186/405 spawnSync 成员循环、:378-379 每批一次 `randomBytes(4)` batchToken、manifest.mjs:28-32/:71-74/:111-117/:257-259、casey.mjs:109-110、replay.mjs:70-73/:144/:179/:365-374 —— 全部与 plan 声称一致，无虚引 |

## 1. C-new 真闭合（Critical 面）

- **拓扑核实**：Tier2 三成员确实逐个 `spawnSync` 且共用同一 `batchToken`（collect.mjs:186 在 :405 循环内、:378-379 每批一次）。§3.3 批会话协议在真实拓扑下：成员① `wx` 落 session + 自己 consumed → 放行；成员② 核 session 同值 + caseId 在授权集 + `wx` 落自己的 consumed → 放行；整批跑通。once = 「一票一批会话、每成员恰一次」。
- **R14–R17 成组读**：R16 是**真正控**——naive「占用 nonce 即拒」实现下成员② `launched===false` → R16 红；「同 token 无限 launch」退化解被 R15 捕（同成员重跑必拒）。R14 捕崩溃重跑（新 token 撞 session 异值），R17 捕越权成员。四钉互为阴阳，坏实现无逃逸。
- **协议新缝排查**：session 写后崩溃 → 重跑新 token 撞 `BATCH_SESSION_MISMATCH`（R14 钉死）；半消耗票据一律作废走人签新票。**成员集为空的票据**未钉：零成员自然零 launch，fail-closed 无放行风险，仅留「死票」语义问题（Info，非缝）。

## 2. R18 真钉并发

`spawn`（异步）+ `Promise.all([launch('p1'), launch('p2')])` 同时起两进程，同 ledger、同 token、同 caseId、同标记 → 断言**恰一胜者**、败者 exit 65 且具名 `MEMBER_ALREADY_CONSUMED`。非串行（R10/R14-16 才是串行）。`wx`（O_EXCL）OS 层保证单胜者，plan §3.4 已文档化。作者「串行双跑证不出 check-and-set」的判断诚实。

## 3. R2 各开口闭合核实

- **H-new**：fixtures:120-133 `replayArgs` 恒传 `--replay-grant-ledger`；所有 runReplay spawn 都带 ledgerRoot；R1/R9/R13-R18 均双旗标在场（R2 故意缺 grant——它钉的就是缺票门本身；R3b/R8 是 entity-authority 直 spawn 无需两旗标）。不复发。
- **M-new1**：plan §3.4（:125-144）唯一形状，显式禁 entries[]/jsonl/rename/appendLine；R5 judge 吃读快照不碰文件系统。
- **M-new2**：原语定死 `wx`；R18 并发实测。
- **M-new3**：plan:190-196 采集强制接线 + 浏览器前门两者都做；新钉 R11b 要求 collect 模块导出闸并 fail-closed（红因恰是「未导出」，红证真实）。
- **L-new1-4 + pi 残差**：:269-270 计数 0/12+0/8（12+8=20 条，与「实跑 20 条」一致）；:266-268 红证路径指向 `accept/red-proofs/`（实测文件在）；R10 补断言 `launched===true` + `exit 66`（golden 内核实）；GRILL Q5（:334）与 :440-441 行数刷新 285+218+131；:58-67 排除项四项逐条分述（platformId/batchToken 理由单独成立）；:277-278 R9 禁喂时如实标注「设计约束非机制」。全部落位。

## 4. Findings（均不否决）

- **[Low] R11b 钉面比声明弱一档**：它验证的是采集模块**导出**了闸函数及其 fail-closed 契约（refusals/receiptRequired/spawnAllowed），未钉成员循环**调用点**——导出了正确闸却不在循环里调用的实现仍会绿。浏览器前门仍是硬执法点（fail-safe 不破），漏的正是 M-new3 要防的「浪费子进程 + 回执缺位」。与 R9 同类属设计约束层；建议实现时让闸可注入或至少在异构评审步人工核对调用点。
- **[Low] R18 证伪概率性**：坏实现（读后写）下若败者读到标记时胜者已写完，也只放一个。确定性保证在 OS 的 O_EXCL（§3.4 已文档化），R18 是零 SUT 约束下最强实测。作者声明诚实。
- **[Info] 空成员集票据未钉**：fail-closed 无害，产品语义级死票，可不处理。
- **[nit] R2 断言 `output.includes('replay-grant')` 子串同样命中 `--replay-grant-ledger`**：但 R2 恒传 ledger、独缺 grant，配合 status 64 + launched===false + 排除 batch-token，可证伪面仍成立（只强制 ledger 的实现会一路跑到哨兵而红）。

## 5. 结论

R2 全部新开口（C-new/H-new/M-new1-3/L-new1-4 + pi 两条残差）**干净闭合**：批会话协议与 Tier2 真拓扑吻合、正控 R16 可证伪「整批跑不通」、R18 真并发钉 `wx` 单胜者、双旗标恒传不复发、台账形状唯一、采集强制接线、文书残差逐项修净。两枚金牌自跑 0/12+0/8、exit 1、sha256 对账、零浏览器、生产件零动——红证真实可复现。四条 findings 均 Low 以下，属实现期收口项，不构成新开洞。

VERDICT: PREMISE_SOUND
